import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';
import { MemoryStore } from '../src/store.js';
import { readFile } from 'node:fs/promises';

async function fixture() {
  const store = new MemoryStore();
  const server = await startServer(0, { store, demoMode: true });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function createSession(base, role, displayName) {
  const response = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role, displayName })
  });
  return response.headers.get('set-cookie').split(';')[0];
}

async function createInvite(base, cookie) {
  const response = await fetch(`${base}/api/pairing/invites`, {
    method: 'POST',
    headers: { cookie, origin: base }
  });
  assert.equal(response.status, 201);
  return response.json();
}

test('each invitation includes a unique 8-character backup code and a local QR for an absolute same-site URL', async (t) => {
  const fixtureValue = await fixture();
  t.after(() => new Promise((resolve) => fixtureValue.server.close(resolve)));
  const cookie = await createSession(fixtureValue.base, 'participant', 'Pat');

  const first = await createInvite(fixtureValue.base, cookie);
  const second = await createInvite(fixtureValue.base, cookie);

  assert.match(first.code, /^[A-Z0-9]{8}$/);
  assert.notEqual(first.code, second.code);
  assert.equal(first.inviteUrl, `${fixtureValue.base}/connect?invite=${first.code}`);
  assert.match(first.qrDataUrl, /^data:image\/png;base64,/);
  assert.ok(Buffer.from(first.qrDataUrl.split(',')[1], 'base64').length > 100);
  assert.equal('token' in first, false);
});

test('an invitation remains single-use and still requires participant confirmation', async (t) => {
  const fixtureValue = await fixture();
  t.after(() => new Promise((resolve) => fixtureValue.server.close(resolve)));
  const participantCookie = await createSession(fixtureValue.base, 'participant', 'Pat');
  const supporterCookie = await createSession(fixtureValue.base, 'supporter', 'Sam');
  const invite = await createInvite(fixtureValue.base, participantCookie);

  const firstClaim = await fetch(`${fixtureValue.base}/api/pairing/claim`, {
    method: 'POST',
    headers: { cookie: supporterCookie, origin: fixtureValue.base, 'content-type': 'application/json' },
    body: JSON.stringify({ code: invite.code })
  });
  assert.equal(firstClaim.status, 200);
  assert.equal((await firstClaim.json()).status, 'pending_confirmation');

  const secondClaim = await fetch(`${fixtureValue.base}/api/pairing/claim`, {
    method: 'POST',
    headers: { cookie: supporterCookie, origin: fixtureValue.base, 'content-type': 'application/json' },
    body: JSON.stringify({ code: invite.code })
  });
  assert.equal(secondClaim.status, 404);
});

test('connect route preserves a valid invite through sign-in and routes only supporters to the claim form', async (t) => {
  const fixtureValue = await fixture();
  t.after(() => new Promise((resolve) => fixtureValue.server.close(resolve)));
  const code = 'AB12CD34';

  const signedOut = await fetch(`${fixtureValue.base}/connect?invite=${code}`, { redirect: 'manual' });
  assert.equal(signedOut.status, 303);
  assert.equal(signedOut.headers.get('location'), `/session?next=${encodeURIComponent(`/connect?invite=${code}`)}`);

  const supporterCookie = await createSession(fixtureValue.base, 'supporter', 'Sam');
  const supporter = await fetch(`${fixtureValue.base}/connect?invite=${code}`, {
    redirect: 'manual', headers: { cookie: supporterCookie }
  });
  assert.equal(supporter.status, 303);
  assert.equal(supporter.headers.get('location'), `/supporter/connections?invite=${code}`);

  const participantCookie = await createSession(fixtureValue.base, 'participant', 'Pat');
  const participant = await fetch(`${fixtureValue.base}/connect?invite=${code}`, {
    redirect: 'manual', headers: { cookie: participantCookie }
  });
  assert.equal(participant.status, 303);
  assert.equal(participant.headers.get('location'), '/app/privacy');

  const invalid = await fetch(`${fixtureValue.base}/connect?invite=javascript:alert(1)`, { redirect: 'manual' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get('location'), null);
});

test('invitation clients render QR safely, prefill without auto-claiming, and preserve supporter sign-in destination', async () => {
  const connections = await readFile(new URL('../public/connections.js', import.meta.url), 'utf8');
  const sessionClient = await readFile(new URL('../public/session.js', import.meta.url), 'utf8');

  assert.match(connections, /body\.qrDataUrl/);
  assert.match(connections, /createElement\(['"]img['"]\)/);
  assert.match(connections, /inviteUrl/);
  assert.match(connections, /URLSearchParams\(location\.search\).*get\(['"]invite['"]\)/s);
  assert.match(connections, /inviteInput\.value\s*=\s*invite/);
  assert.doesNotMatch(connections, /innerHTML/);
  assert.doesNotMatch(connections, /claim-form['"]\)\.(?:requestSubmit|submit)/);
  assert.match(sessionClient, /role\s*===\s*['"]supporter['"][\s\S]*\/connect\\\?invite=/);
});

test('invitation surfaces default to English and use finite versioned local assets', async () => {
  const i18n = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
  const connections = await readFile(new URL('../public/connections.js', import.meta.url), 'utf8');
  const sessionClient = await readFile(new URL('../public/session.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/portal.css', import.meta.url), 'utf8');
  // 連結管理 2026-07-28 併進資料授權頁——決定分享什麼跟決定分享給誰是同一個決定。
  const participant = await readFile(new URL('../public/participant-privacy.html', import.meta.url), 'utf8');
  const supporter = await readFile(new URL('../public/supporter-connections.html', import.meta.url), 'utf8');
  const sessionPage = await readFile(new URL('../public/session.html', import.meta.url), 'utf8');

  // English is the default for an international entry, and the browser language must not
  // override it. A visitor's own choice is what gets remembered.
  assert.match(i18n, /let language = ['"]en['"]/);
  assert.doesNotMatch(i18n, /navigator\.(?:language|languages)/);
  assert.match(i18n, /localStorage\.setItem\(STORAGE_KEY, next === ['"]zh-TW['"] \? ['"]zh-TW['"] : ['"]en['"]\)/);
  assert.doesNotMatch(i18n, /localStorage\.removeItem\(STORAGE_KEY\)/, 'an English choice is stored, not cleared');
  for (const route of ['/session', '/app/privacy', '/supporter/connections']) {
    assert.match(i18n, new RegExp(`['"]${route.replace('/', '\\/')}['"]\\s*:`));
  }
  for (const html of [participant, supporter, sessionPage]) {
    assert.match(html, /<html lang="en">/);
    assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/i);
    assert.match(html, /portal\.css\?v=[^"']+/);
    assert.match(html, /i18n\.js\?v=[^"']+/);
  }
  // 版本標記由伺服器依檔案內容改寫，這裡只要求頁面確實載入那支程式，不釘死某個編號——
  // 釘死編號等於在保護一個之後一定會變的值（2026-07-27 已經踩過一次）。
  assert.match(participant, /connections\.js\?v=/);
  assert.match(supporter, /connections\.js\?v=/);
  assert.match(sessionPage, /session\.js\?v=20260726o/);
  assert.match(connections, /Promise\.race/);
  assert.match(connections, /toLocaleTimeString\(\s*document\.documentElement\.lang\.startsWith\(['"]zh['"]\) \? ['"]zh-TW['"] : ['"]en-US['"]/);
  assert.match(connections, /toLocaleString\(uiLocale\(\)\)/);
  assert.match(connections, /DOMContentLoaded[\s\S]*if \(!languageReady\) refresh\(\)/);
  assert.doesNotMatch(connections, /document\.addEventListener\(['"]dailyable:languagechange['"],[\s\S]*\nrefresh\(\);\s*$/);
  assert.doesNotMatch(connections, /api\/supporter\/queue/);
  assert.doesNotMatch(css, /animation[^;{}]*infinite/i);
  assert.match(css, /\.invite-qr\{[^}]*max-width:100%/);
  assert.match(sessionClient, /form\?\.addEventListener\(['"]submit['"][\s\S]*Promise\.race[\s\S]*finally\s*\{[\s\S]*submit\.disabled\s*=\s*false/);
});
