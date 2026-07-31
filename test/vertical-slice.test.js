import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';
import { MemoryStore } from '../src/store.js';

async function fixture(now = () => new Date(), options = {}) {
  const store = new MemoryStore({ now });
  const server = await startServer(0, { store, demoMode: true, now, ...options });
  return { store, server, base: `http://127.0.0.1:${server.address().port}` };
}

async function session(base, role, displayName, headers = {}) {
  const response = await fetch(`${base}/api/session`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ role, displayName })
  });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}

async function api(base, path, cookie, method = 'GET', body, headers = {}) {
  return fetch(`${base}${path}`, {
    method, headers: { cookie, ...(['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? { origin: base } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
}
test('session role boundaries and secure cookie attributes are enforced', async (t) => {
  const f = await fixture(() => new Date(), { trustProxy: true }); t.after(() => new Promise((r) => f.server.close(r)));

  const participant = await session(f.base, 'participant', 'Pat', { 'x-forwarded-proto': 'https' });
  assert.equal(participant.response.status, 201);
  assert.match(participant.response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(participant.response.headers.get('set-cookie'), /SameSite=Lax/i);
  assert.match(participant.response.headers.get('set-cookie'), /Secure/i);
  const trustedOrigin = f.base.replace('http:', 'https:');
  const trustedProxyHeaders = { origin: trustedOrigin, 'x-forwarded-proto': 'https' };
  assert.equal((await api(f.base, '/api/pairing/invites', participant.cookie, 'POST', undefined, trustedProxyHeaders)).status, 201);
  assert.equal((await api(f.base, '/api/pairing/claim', participant.cookie, 'POST', { code: 'NOPE' }, trustedProxyHeaders)).status, 403);
});

test('malformed cookie encoding is treated as an invalid session', async (t) => {
  const f = await fixture(); t.after(() => new Promise((resolve) => f.server.close(resolve)));
  const response = await fetch(`${f.base}/api/session`, { headers: { cookie: 'dailyable_session=%E0%A4%A' } });
  assert.equal(response.status, 401);
});

test('persistent mode refuses self-selected prototype identities by default', async (t) => {
  const server = await startServer(0, { store: new MemoryStore(), demoMode: false, prototypeAuth: false });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'participant', displayName: 'Pat' })
  });
  assert.equal(response.status, 503);
});

test('cookie-authenticated mutations reject a foreign browser origin', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const participant = await session(f.base, 'participant', 'Pat');
  const response = await fetch(`${f.base}/api/pairing/invites`, {
    method: 'POST',
    headers: { cookie: participant.cookie, origin: 'https://attacker.example' }
  });
  assert.equal(response.status, 403);
});

test('cookie-authenticated mutations fail closed without Origin and accept a synchronizer token', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const participant = await session(f.base, 'participant', 'Pat');
  const missingOrigin = await fetch(`${f.base}/api/pairing/invites`, {
    method: 'POST', headers: { cookie: participant.cookie }
  });
  assert.equal(missingOrigin.status, 403);
  const csrf = await (await api(f.base, '/api/csrf', participant.cookie)).json();
  const accepted = await fetch(`${f.base}/api/pairing/invites`, {
    method: 'POST', headers: { cookie: participant.cookie, 'x-csrf-token': csrf.token }
  });
  assert.equal(accepted.status, 201);
});

test('forwarded host and protocol are ignored unless proxy trust is explicit', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const participant = await session(f.base, 'participant', 'Pat');
  const response = await fetch(`${f.base}/api/pairing/invites`, {
    method: 'POST',
    headers: {
      cookie: participant.cookie,
      origin: 'https://forged.example',
      'x-forwarded-host': 'forged.example',
      'x-forwarded-proto': 'https'
    }
  });
  assert.equal(response.status, 403);
});

test('session identity can be read and explicitly signed out', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const participant = await session(f.base, 'participant', 'Pat');
  const current = await api(f.base, '/api/session', participant.cookie);
  assert.equal(current.status, 200);
  assert.equal((await current.json()).user.displayName, 'Pat');
  const logout = await api(f.base, '/api/session', participant.cookie, 'DELETE');
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await api(f.base, '/api/session', participant.cookie)).status, 401);
});

test('invite claim, participant confirmation, listing, and either-side revoke work', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const p = await session(f.base, 'participant', 'Pat');
  const s = await session(f.base, 'supporter', 'Sam');
  const invite = await (await api(f.base, '/api/pairing/invites', p.cookie, 'POST')).json();
  const claimed = await api(f.base, '/api/pairing/claim', s.cookie, 'POST', { code: invite.code });
  assert.equal(claimed.status, 200);
  const relationship = await claimed.json();
  assert.equal(relationship.status, 'pending_confirmation');
  assert.equal((await api(f.base, `/api/pairing/relationships/${relationship.id}/confirm`, p.cookie, 'POST')).status, 200);
  const list = await (await api(f.base, '/api/pairing/relationships', s.cookie)).json();
  assert.equal(list.relationships.length, 1);
  assert.equal(list.relationships[0].status, 'active');
  assert.equal(list.relationships[0].otherPartyName, 'Pat');
  assert.deepEqual(list.relationships[0].scopes, ['checkin_summary']);

  const input = { energy: 'low', routine: 'off-track', concern: 'none', supportChoice: 'supporter' };
  assert.equal((await api(f.base, '/api/check-in', p.cookie, 'POST', input)).status, 200);
  const shared = await api(f.base, `/api/relationships/${relationship.id}/check-ins`, s.cookie);
  assert.equal(shared.status, 200);
  const sharedBody = await shared.json();
  assert.equal(sharedBody.checkIns.length, 1);
  assert.ok(sharedBody.checkIns[0].summary);
  assert.equal('input' in sharedBody.checkIns[0], false);

  assert.equal((await api(f.base, `/api/pairing/relationships/${relationship.id}`, s.cookie, 'DELETE')).status, 200);
  assert.equal((await api(f.base, `/api/relationships/${relationship.id}/check-ins`, s.cookie)).status, 403);
  assert.equal((await api(f.base, `/api/pairing/relationships/${relationship.id}/confirm`, p.cookie, 'POST')).status, 403);

  const reconnectInvite = await (await api(f.base, '/api/pairing/invites', p.cookie, 'POST')).json();
  const reconnected = await api(f.base, '/api/pairing/claim', s.cookie, 'POST', { code: reconnectInvite.code });
  assert.equal(reconnected.status, 200);
  assert.equal((await reconnected.json()).status, 'pending_confirmation');
});

test('expired invites and cross-account relationship access are rejected', async (t) => {
  let clock = new Date('2026-01-01T00:00:00Z');
  const f = await fixture(() => clock); t.after(() => new Promise((r) => f.server.close(r)));
  const p1 = await session(f.base, 'participant', 'Pat');
  const p2 = await session(f.base, 'participant', 'Other');
  const s = await session(f.base, 'supporter', 'Sam');
  const invite = await (await api(f.base, '/api/pairing/invites', p1.cookie, 'POST')).json();
  clock = new Date('2026-01-02T00:00:00Z');
  assert.equal((await api(f.base, '/api/pairing/claim', s.cookie, 'POST', { code: invite.code })).status, 410);
  assert.equal((await api(f.base, '/api/pairing/relationships', p2.cookie)).status, 200);
  assert.deepEqual((await (await api(f.base, '/api/pairing/relationships', p2.cookie)).json()).relationships, []);
});

test('pairing code guesses are rate limited', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const supporter = await session(f.base, 'supporter', 'Sam');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    assert.equal((await api(f.base, '/api/pairing/claim', supporter.cookie, 'POST', { code: `BAD0000${attempt}` })).status, 404);
  }
  assert.equal((await api(f.base, '/api/pairing/claim', supporter.cookie, 'POST', { code: 'BAD99999' })).status, 429);
});

test('spoofed X-Forwarded-For does not bypass supporter account and code throttling', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const supporter = await session(f.base, 'supporter', 'Sam');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await api(f.base, '/api/pairing/claim', supporter.cookie, 'POST', { code: 'SAMECODE' }, {
      'x-forwarded-for': `203.0.113.${attempt + 1}`
    });
    assert.equal(response.status, 404);
  }
  assert.equal((await api(f.base, '/api/pairing/claim', supporter.cookie, 'POST', { code: 'SAMECODE' }, {
    'x-forwarded-for': '198.51.100.99'
  })).status, 429);
});

test('authenticated participant check-ins persist while anonymous demo stays anonymous', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const input = { energy: 'low', routine: 'off-track', concern: 'none', supportChoice: 'supporter' };
  await api(f.base, '/api/check-in', '', 'POST', input);
  assert.equal(f.store.checkIns.length, 0);
  const p = await session(f.base, 'participant', 'Pat');
  await api(f.base, '/api/check-in', p.cookie, 'POST', input);
  assert.equal(f.store.checkIns.length, 1);
});

test('cache, HEAD, record API, and finite loading source contracts', async (t) => {
  const f = await fixture(); t.after(() => new Promise((r) => f.server.close(r)));
  const asset = await fetch(`${f.base}/portal.css?v=20260726b`, { headers: { 'accept-encoding': 'gzip' } });
  assert.match(asset.headers.get('cache-control'), /immutable/);
  assert.equal(asset.headers.get('content-encoding'), 'gzip');
  assert.equal((await fetch(`${f.base}/portal.css`)).headers.get('cache-control'), 'no-cache');
  assert.equal((await fetch(`${f.base}/`, { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(`${f.base}/`, { method: 'HEAD' })).headers.get('cache-control'), 'no-store');
  const record = await fetch(`${f.base}/api/supporter/queue/alex-01`);
  assert.equal(record.status, 200);
  assert.equal((await record.json()).item.id, 'alex-01');
  const source = await (await fetch(`${f.base}/supporter.js?v=20260726b`)).text();
  const connectionsSource = await (await fetch(`${f.base}/connections.js?v=20260726b`)).text();
  assert.match(source, /AbortController/);
  assert.match(source, /Promise\.race/);
  assert.match(source, /Retry/);
  assert.match(source, /\/api\/supporter\/queue\/\$\{/);
  assert.match(connectionsSource, /AbortController/);
  assert.match(connectionsSource, /Promise\.race/);
  assert.match(connectionsSource, /Decline/);
  assert.doesNotMatch(source, /\.replaceChildren\(/);
  assert.doesNotMatch(connectionsSource, /\.replaceChildren\(/);
});
