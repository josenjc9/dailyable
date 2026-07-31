import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';

// The reviewer demo has to open the whole product without an account, while the real
// sign-in wall stays shut. These tests pin both halves: judges get in, nobody else does.
let server;
let baseUrl;

test.before(async () => {
  server = await startServer(0, { enforcePageAuth: true });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  const match = raw.match(/dailyable_demo=([^;]*)/);
  return match ? `dailyable_demo=${match[1]}` : '';
}

test('the demo entry page is reachable without any session', async () => {
  const response = await fetch(`${baseUrl}/demo`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Demo data only/i);
});

test('the demo offers exactly one participant and one supporter', async () => {
  const state = await (await fetch(`${baseUrl}/api/demo/state`)).json();
  assert.deepEqual(
    state.people.map(({ id, role }) => ({ id, role })),
    [
      { id: 'alex', role: 'participant' },
      { id: 'jordan', role: 'supporter' }
    ]
  );

  const html = await (await fetch(`${baseUrl}/demo`)).text();
  const personaLinks = [...html.matchAll(/\/demo\/enter\?persona=([a-z]+)/g)].map((match) => match[1]);
  assert.deepEqual(personaLinks, ['alex', 'jordan']);
});

test('the demo pair shares exactly one relationship and one supporter case', async () => {
  const participant = cookieFrom(await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' }));
  const supporter = cookieFrom(await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' }));

  const participantRelationships = await (await fetch(`${baseUrl}/api/pairing/relationships`, {
    headers: { cookie: participant }
  })).json();
  const supporterRelationships = await (await fetch(`${baseUrl}/api/pairing/relationships`, {
    headers: { cookie: supporter }
  })).json();
  for (const body of [participantRelationships, supporterRelationships]) {
    assert.equal(body.relationships.length, 1);
    assert.equal(body.relationships[0].id, 'demo-rel-1');
    assert.equal(body.relationships[0].status, 'active');
  }

  const queue = await (await fetch(`${baseUrl}/api/supporter/queue`, {
    headers: { cookie: supporter }
  })).json();
  assert.deepEqual(queue.items.map(({ id, name }) => ({ id, name })), [
    { id: 'alex-01', name: 'Alex' }
  ]);
  assert.doesNotMatch(JSON.stringify(queue.items), /\b(?:Maya|Mei|Sam)\b/);
});

test('product pages stay closed until a demo person is chosen', async () => {
  for (const path of ['/app', '/app/check-in', '/supporter', '/supporter/queue']) {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 303, `${path} should redirect while signed out`);
    assert.match(response.headers.get('location'), /^\/session\?next=/);
  }
});

test('entering as a participant opens the participant space only', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  assert.equal(entry.status, 303);
  assert.equal(entry.headers.get('location'), '/app');
  const cookie = cookieFrom(entry);
  assert.ok(cookie, 'a demo cookie should be issued');

  for (const path of ['/app', '/app/check-in', '/app/records']) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(response.status, 200, `${path} should open for the demo participant`);
  }

  const supporter = await fetch(`${baseUrl}/supporter`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(supporter.status, 303, 'a participant persona must not reach the supporter space');
});

test('entering as a supporter opens the supporter space and its queue', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' });
  assert.equal(entry.headers.get('location'), '/supporter');
  const cookie = cookieFrom(entry);

  for (const path of ['/supporter', '/supporter/queue', '/supporter/follow-up']) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: 'manual' });
    assert.equal(response.status, 200, `${path} should open for the demo supporter`);
  }
});

test('an unknown demo person is refused', async () => {
  const response = await fetch(`${baseUrl}/demo/enter?persona=not-a-person`, { redirect: 'manual' });
  assert.equal(response.status, 400);
});

test('the real sign-in path stays closed while the demo is open', async () => {
  const response = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'participant', displayName: 'Should not be created' })
  });
  assert.equal(response.status, 503);
});

test('demo sessions read prepared data and never write', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const cookie = cookieFrom(entry);

  const session = await fetch(`${baseUrl}/api/session`, { headers: { cookie } });
  const sessionBody = await session.json();
  assert.equal(session.status, 200);
  assert.equal(sessionBody.demoData, true);
  assert.equal(sessionBody.user.demo, true);

  const history = await fetch(`${baseUrl}/api/check-ins`, { headers: { cookie } });
  const historyBody = await history.json();
  assert.equal(history.status, 200);
  assert.equal(historyBody.demoData, true);
  assert.ok(historyBody.checkIns.length > 0, 'the demo participant should have history to show');

  // The invitation panel still needs a QR image and a code to render, so the demo returns
  // a throwaway one. It is never stored, so claiming it must fail like any unknown code.
  const write = await fetch(`${baseUrl}/api/pairing/invites`, { method: 'POST', headers: { cookie } });
  const writeBody = await write.json();
  assert.equal(write.status, 201);
  assert.equal(writeBody.saved, false);
  assert.equal(writeBody.code, 'DEMO0000');
  assert.match(writeBody.qrDataUrl, /^data:image\/png;base64,/);
  assert.ok(Number.isFinite(Date.parse(writeBody.expiresAt)), 'the panel needs a real expiry to show');

  const supporter = await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' });
  const claim = await fetch(`${baseUrl}/api/pairing/claim`, {
    method: 'POST',
    headers: { cookie: cookieFrom(supporter), 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'DEMO0000' })
  });
  const claimBody = await claim.json();
  assert.equal(claimBody.saved, false, 'the demo invitation must not create a relationship');

  // 沒有帶這一輪的訪客編號時（舊連結、cookie 被擋），展示還是完整的，只是留不住東西——
  // 而且絕對不能寫到那份共用的準備資料上，否則一個沒帶 cookie 的請求會改到之後每個人看到的畫面。
  const checkIn = await fetch(`${baseUrl}/api/check-in`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ energy: 'low', routine: 'changed', concern: 'none', supportChoice: 'self' })
  });
  assert.equal(checkIn.status, 200);
  const after = await fetch(`${baseUrl}/api/check-ins`, { headers: { cookie } });
  const afterBody = await after.json();
  assert.equal(afterBody.checkIns.length, historyBody.checkIns.length, 'the prepared set must not be edited by a visitor');
});

test('a newly submitted check-in stays private until final confirmation', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const raw = (entry.headers.getSetCookie?.() || [entry.headers.get('set-cookie') || '']).join(';');
  const visitCookie = raw.match(/dailyable_demo_visit=[^;]*/)[0];
  const participant = `${raw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;
  const switched = await fetch(`${baseUrl}/demo/switch`, { headers: { cookie: participant }, redirect: 'manual' });
  const supporterRaw = (switched.headers.getSetCookie?.() || [switched.headers.get('set-cookie') || '']).join(';');
  const supporter = `${supporterRaw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;

  const sharedBefore = await (await fetch(`${baseUrl}/api/relationships/demo-rel-1/check-ins`, {
    headers: { cookie: supporter }
  })).json();
  const mineBefore = await (await fetch(`${baseUrl}/api/check-ins`, { headers: { cookie: participant } })).json();

  const submitted = await fetch(`${baseUrl}/api/check-in`, {
    method: 'POST',
    headers: { cookie: participant, 'content-type': 'application/json' },
    body: JSON.stringify({ energy: 'very-low', routine: 'off-track', concern: 'need-help', supportChoice: 'supporter' })
  });
  assert.equal(submitted.status, 200);

  const mineAfter = await (await fetch(`${baseUrl}/api/check-ins`, { headers: { cookie: participant } })).json();
  const sharedAfter = await (await fetch(`${baseUrl}/api/relationships/demo-rel-1/check-ins`, {
    headers: { cookie: supporter }
  })).json();
  assert.equal(mineAfter.checkIns.length, mineBefore.checkIns.length + 1, 'Alex keeps the submitted check-in immediately');
  assert.equal(sharedAfter.checkIns.length, sharedBefore.checkIns.length, 'Jordan receives nothing until Alex confirms sharing');
});

test('final confirmation shares one minimized check-in summary', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const raw = (entry.headers.getSetCookie?.() || [entry.headers.get('set-cookie') || '']).join(';');
  const visitCookie = raw.match(/dailyable_demo_visit=[^;]*/)[0];
  const participant = `${raw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;
  const switched = await fetch(`${baseUrl}/demo/switch`, { headers: { cookie: participant }, redirect: 'manual' });
  const supporterRaw = (switched.headers.getSetCookie?.() || [switched.headers.get('set-cookie') || '']).join(';');
  const supporter = `${supporterRaw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;

  const before = await (await fetch(`${baseUrl}/api/relationships/demo-rel-1/check-ins`, {
    headers: { cookie: supporter }
  })).json();
  const submitted = await fetch(`${baseUrl}/api/check-in`, {
    method: 'POST',
    headers: { cookie: participant, 'content-type': 'application/json' },
    body: JSON.stringify({ energy: 'very-low', routine: 'off-track', concern: 'need-help', supportChoice: 'supporter' })
  });
  const result = await submitted.json();
  assert.equal(submitted.status, 200);
  assert.match(result.checkInId || '', /^demo-checkin-/);

  const confirmed = await fetch(`${baseUrl}/api/check-ins/${result.checkInId}/share`, {
    method: 'POST',
    headers: { cookie: participant, 'content-type': 'application/json' },
    body: JSON.stringify({ relationshipId: 'demo-rel-1' })
  });
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).shared, true);

  const after = await (await fetch(`${baseUrl}/api/relationships/demo-rel-1/check-ins`, {
    headers: { cookie: supporter }
  })).json();
  assert.equal(after.checkIns.length, before.checkIns.length + 1);
  const newest = after.checkIns[0];
  assert.deepEqual(Object.keys(newest).sort(), ['createdAt', 'id', 'summary']);
  assert.deepEqual(Object.keys(newest.summary).sort(), ['level', 'message']);
  assert.doesNotMatch(JSON.stringify(newest), /energy|routine|concern|supportChoice|note/);

  const supporterCannotConfirm = await fetch(`${baseUrl}/api/check-ins/${result.checkInId}/share`, {
    method: 'POST',
    headers: { cookie: supporter, 'content-type': 'application/json' },
    body: JSON.stringify({ relationshipId: 'demo-rel-1' })
  });
  assert.equal(supporterCannotConfirm.status, 403, 'Jordan cannot impersonate Alex’s final confirmation');
});

// 這條線是整個展示的重點：本人回報 → 自己的趨勢看得到 → 支持者那邊也收得到。
// 以前三個畫面各自獨立，評審填完什麼都沒發生。
test('what a visitor enters flows through to their own history and to the supporter', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const raw = (entry.headers.getSetCookie?.() || [entry.headers.get('set-cookie') || '']).join(';');
  const visit = `${raw.match(/dailyable_demo=[^;]*/)[0]}; ${raw.match(/dailyable_demo_visit=[^;]*/)[0]}`;

  const before = await (await fetch(`${baseUrl}/api/check-ins`, { headers: { cookie: visit } })).json();

  const checkIn = await fetch(`${baseUrl}/api/check-in`, {
    method: 'POST',
    headers: { cookie: visit, 'content-type': 'application/json' },
    body: JSON.stringify({ energy: 'very-low', routine: 'off-track', concern: 'none', supportChoice: 'supporter' })
  });
  assert.equal(checkIn.status, 200);
  const checkInResult = await checkIn.json();
  const confirmed = await fetch(`${baseUrl}/api/check-ins/${checkInResult.checkInId}/share`, {
    method: 'POST',
    headers: { cookie: visit, 'content-type': 'application/json' },
    body: JSON.stringify({ relationshipId: 'demo-rel-1' })
  });
  assert.equal(confirmed.status, 200, 'Alex must confirm before the supporter receives the summary');

  const mine = await (await fetch(`${baseUrl}/api/check-ins`, { headers: { cookie: visit } })).json();
  assert.equal(mine.checkIns.length, before.checkIns.length + 1, 'the check-in has to show up in my own history');
  assert.equal(mine.checkIns[0].energy, 'very-low', 'and it has to be the answer that was given');

  // 同一個瀏覽階段切到支持者，看到的是本人剛剛回報的那筆
  const supporter = await fetch(`${baseUrl}/demo/switch`, { headers: { cookie: visit }, redirect: 'manual' });
  const supporterRaw = (supporter.headers.getSetCookie?.() || [supporter.headers.get('set-cookie') || '']).join(';');
  const supporterVisit = `${supporterRaw.match(/dailyable_demo=[^;]*/)[0]}; ${raw.match(/dailyable_demo_visit=[^;]*/)[0]}`;
  const shared = await (await fetch(`${baseUrl}/api/relationships/demo-rel-1/check-ins`, { headers: { cookie: supporterVisit } })).json();
  assert.equal(shared.checkIns.length, mine.checkIns.length, 'the supporter reads the same visit, not a frozen copy');
});

// Every page and every endpoint the demo can reach, swept in one go rather than the handful
// each earlier test happened to name.
//
// 2026-07-27: the prepared demo identifies a pairing as "demo-rel-1", but two routes were
// written to accept hex characters only, because stored ids are UUIDs. So a supporter could
// open a person and find the shared check-ins simply absent — a 404 that the page had no way
// to distinguish from "this person has written nothing". Reading it as missing data rather
// than a wrong route is exactly what makes this kind of bug survive: nothing looks broken.
const PARTICIPANT_PATHS = [
  '/app', '/app/check-in', '/app/records', '/app/summary',
  '/app/records', '/app/support', '/app/privacy', '/app/privacy'
];
const SUPPORTER_PATHS = [
  '/supporter', '/supporter/queue', '/supporter/follow-up',
  '/supporter/method', '/supporter/connections',
  '/supporter/people/demo-rel-1', '/supporter/plans/demo-rel-1'
];
const OPEN_PATHS = ['/', '/demo', '/about', '/how-it-works'];

test('every page the demo offers actually opens', async () => {
  for (const path of OPEN_PATHS) {
    assert.equal((await fetch(`${baseUrl}${path}`)).status, 200, `${path} should open to anyone`);
  }

  const participant = cookieFrom(await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' }));
  for (const path of PARTICIPANT_PATHS) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie: participant }, redirect: 'manual' });
    assert.equal(response.status, 200, `${path} should open for the demo participant`);
  }

  const supporter = cookieFrom(await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' }));
  for (const path of SUPPORTER_PATHS) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie: supporter }, redirect: 'manual' });
    assert.equal(response.status, 200, `${path} should open for the demo supporter`);
  }
});

test('every endpoint the pages read answers the demo with data', async () => {
  const participant = cookieFrom(await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' }));
  const participantReads = [
    '/api/session', '/api/check-ins', '/api/vitals', '/api/meals', '/api/medications',
    '/api/medication-plans', '/api/clinical-summary', '/api/reference-ranges',
    '/api/foods?q=飯', '/api/pairing/relationships', '/api/csrf'
  ];
  for (const path of participantReads) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie: participant } });
    assert.equal(response.status, 200, `${path} should answer the demo participant`);
  }

  const supporter = cookieFrom(await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' }));
  const supporterReads = [
    '/api/session', '/api/supporter/queue', '/api/pairing/relationships',
    '/api/relationships/demo-rel-1/check-ins',
    '/api/relationships/demo-rel-1/body-records'
  ];
  for (const path of supporterReads) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie: supporter } });
    assert.equal(response.status, 200, `${path} should answer the demo supporter`);
  }

  // The two that carry a person's readings have to arrive with something in them, or the
  // supporter dashboard is an empty frame and the complaint is "I cannot see anything".
  const shared = await (await fetch(`${baseUrl}/api/relationships/demo-rel-1/check-ins`, { headers: { cookie: supporter } })).json();
  assert.ok(shared.checkIns?.length, 'a supporter must land on something to read');
  // The raw entries never travel to a supporter — what arrives is the summary built from
  // them — so the thing to check is that the summary actually carries measures.
  const body = await (await fetch(`${baseUrl}/api/relationships/demo-rel-1/body-records`, { headers: { cookie: supporter } })).json();
  const measures = body.summary?.measures || {};
  assert.ok(Object.keys(measures).length, 'the body records panel must have measures to show');
  assert.deepEqual(body.recordCounts, {
    checkIns: 34,
    vitals: 20,
    medications: 13,
    meals: 11,
    from: '2026-05-06T00:00:00.000Z',
    to: '2026-07-26T08:12:00.000Z'
  });
  for (const key of ['systolic', 'diastolic', 'glucose']) {
    assert.ok(measures[key]?.recordedInWindow > 0, `a supporter should see ${key} readings, not an empty panel`);
  }
});

// The single prepared relationship is read by the same page as stored relationships, so both
// roles still need the stored shape: an active status and the other party’s display name.
test('the prepared relationship reads like the same active connection to both roles', async () => {
  const roles = [
    ['alex', 'participant', 'Jordan'],
    ['jordan', 'supporter', 'Alex']
  ];

  for (const [persona, role, expectedName] of roles) {
    const entry = await fetch(`${baseUrl}/demo/enter?persona=${persona}`, { redirect: 'manual' });
    const cookie = cookieFrom(entry);
    const body = await (await fetch(`${baseUrl}/api/pairing/relationships`, { headers: { cookie } })).json();
    assert.equal(body.relationships?.length, 1, `${role} should see the one prepared relationship`);
    assert.equal(body.relationships[0].status, 'active');
    assert.equal(body.relationships[0].otherPartyName, expectedName);
  }
});

// 支持者做完事情要有去處：按了「記錄聯絡」，佇列上那一項的狀態要跟著改，下次檢視是哪一
// 天也要寫出來。以前這裡只回一句成功，回到佇列還是停在「立即關心」。
test('recording a follow-up changes the queue item and writes down the next review', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' });
  const raw = (entry.headers.getSetCookie?.() || [entry.headers.get('set-cookie') || '']).join(';');
  const visit = `${raw.match(/dailyable_demo=[^;]*/)[0]}; ${raw.match(/dailyable_demo_visit=[^;]*/)[0]}`;

  const before = await (await fetch(`${baseUrl}/api/supporter/queue`, { headers: { cookie: visit } })).json();
  const target = before.items[0];
  assert.equal(target.priorityLabel, 'Check in now');

  const recorded = await fetch(`${baseUrl}/api/supporter/queue/${target.id}/follow-up`, {
    method: 'POST',
    headers: { cookie: visit, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'contacted' })
  });
  const body = await recorded.json();
  assert.equal(recorded.status, 200);
  assert.equal(body.saved, true);
  assert.ok(Date.parse(body.item.followUp.nextReviewAt), 'a recorded contact has to name the next review');

  const after = await (await fetch(`${baseUrl}/api/supporter/queue`, { headers: { cookie: visit } })).json();
  assert.equal(after.items[0].priorityLabel, 'Contact recorded', 'the queue has to show the work that was done');

  // 換一輪回到準備好的樣子，上一位訪客按過的不會留給下一位
  const fresh = await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' });
  const freshRaw = (fresh.headers.getSetCookie?.() || [fresh.headers.get('set-cookie') || '']).join(';');
  const freshVisit = `${freshRaw.match(/dailyable_demo=[^;]*/)[0]}; ${freshRaw.match(/dailyable_demo_visit=[^;]*/)[0]}`;
  const clean = await (await fetch(`${baseUrl}/api/supporter/queue`, { headers: { cookie: freshVisit } })).json();
  assert.equal(clean.items[0].priorityLabel, 'Check in now');
});

// 支持者完成動作後，本人要看得到發生了什麼；但只能收到安全摘要，不能把支持者的內部
// 佇列、判斷依據或建議方案整包送回前台。兩種角色也不能互讀對方專用 endpoint。
test('Alex receives a participant-safe support update after Jordan follows up', async () => {
  const participantEntry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const participantRaw = (participantEntry.headers.getSetCookie?.() || [participantEntry.headers.get('set-cookie') || '']).join(';');
  const visitCookie = participantRaw.match(/dailyable_demo_visit=[^;]*/)[0];
  const participant = `${participantRaw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;

  const participantQueue = await fetch(`${baseUrl}/api/supporter/queue`, { headers: { cookie: participant } });
  assert.equal(participantQueue.status, 403, 'a participant must not receive the supporter queue');

  const switched = await fetch(`${baseUrl}/demo/switch`, { headers: { cookie: participant }, redirect: 'manual' });
  const supporterRaw = (switched.headers.getSetCookie?.() || [switched.headers.get('set-cookie') || '']).join(';');
  const supporter = `${supporterRaw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;

  const recorded = await fetch(`${baseUrl}/api/supporter/queue/alex-01/follow-up`, {
    method: 'POST',
    headers: { cookie: supporter, 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'contacted',
      participantMessage: 'I read what you shared. Let us keep today small and check in again tomorrow.',
      internalNote: 'Queue-only note: confirm transport options.'
    })
  });
  assert.equal(recorded.status, 200);

  const statusResponse = await fetch(`${baseUrl}/api/participant/support-status`, { headers: { cookie: participant } });
  const status = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(status.supporterName, 'Jordan');
  assert.deepEqual(Object.keys(status).sort(), ['followUp', 'supporterName']);
  assert.deepEqual(Object.keys(status.followUp).sort(), ['message', 'nextReviewAt', 'status']);
  assert.equal(status.followUp.status, 'contacted');
  assert.equal(status.followUp.message, 'I read what you shared. Let us keep today small and check in again tomorrow.');
  assert.ok(Date.parse(status.followUp.nextReviewAt));
  assert.doesNotMatch(JSON.stringify(status), /Queue-only note|decisionBasis|recommendedPlan|observableReasons|consent|context/);

  const supporterRead = await fetch(`${baseUrl}/api/participant/support-status`, { headers: { cookie: supporter } });
  assert.equal(supporterRead.status, 403, 'a supporter must not impersonate the participant update endpoint');
});

test('a persistent participant never receives the Alex and Jordan demo fixture', async () => {
  const persistent = await startServer(0, { prototypeAuth: true, enforcePageAuth: true });
  const url = `http://127.0.0.1:${persistent.address().port}`;
  try {
    const signedIn = await fetch(`${url}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'participant', displayName: 'Pat' })
    });
    assert.equal(signedIn.status, 201);
    const raw = signedIn.headers.get('set-cookie') || '';
    const session = raw.match(/dailyable_session=[^;]*/)?.[0] || '';
    assert.ok(session);

    const response = await fetch(`${url}/api/participant/support-status`, { headers: { cookie: session } });
    const body = await response.json();
    assert.equal(response.status, 501);
    assert.doesNotMatch(JSON.stringify(body), /Alex|Jordan|alex-01|demo-rel-1/);
  } finally {
    await new Promise((resolve) => persistent.close(resolve));
  }
});

test('revoking the demo relationship immediately closes every supporter sharing route', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const raw = (entry.headers.getSetCookie?.() || [entry.headers.get('set-cookie') || '']).join(';');
  const visitCookie = raw.match(/dailyable_demo_visit=[^;]*/)[0];
  const participant = `${raw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;
  const switched = await fetch(`${baseUrl}/demo/switch`, { headers: { cookie: participant }, redirect: 'manual' });
  const supporterRaw = (switched.headers.getSetCookie?.() || [switched.headers.get('set-cookie') || '']).join(';');
  const supporter = `${supporterRaw.match(/dailyable_demo=[^;]*/)[0]}; ${visitCookie}`;

  const supporterReads = [
    '/api/supporter/queue',
    '/api/supporter/queue/alex-01',
    '/api/relationships/demo-rel-1/check-ins',
    '/api/relationships/demo-rel-1/body-records'
  ];
  for (const path of supporterReads) {
    assert.equal((await fetch(`${baseUrl}${path}`, { headers: { cookie: supporter } })).status, 200, `${path} begins inside active consent`);
  }

  const revoked = await fetch(`${baseUrl}/api/pairing/relationships/demo-rel-1`, {
    method: 'DELETE',
    headers: { cookie: participant }
  });
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).status, 'revoked');

  for (const path of supporterReads) {
    assert.equal((await fetch(`${baseUrl}${path}`, { headers: { cookie: supporter } })).status, 403, `${path} must close immediately after revocation`);
  }
  const shareAfterRevocation = await fetch(`${baseUrl}/api/check-ins/demo-checkin-no-longer-shareable/share`, {
    method: 'POST',
    headers: { cookie: participant, 'content-type': 'application/json' },
    body: JSON.stringify({ relationshipId: 'demo-rel-1' })
  });
  assert.equal(shareAfterRevocation.status, 403, 'revocation blocks any later per-check-in confirmation');
  const followUp = await fetch(`${baseUrl}/api/supporter/queue/alex-01/follow-up`, {
    method: 'POST',
    headers: { cookie: supporter, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'contacted' })
  });
  assert.equal(followUp.status, 403, 'revocation must also block new supporter actions');
});

// 趨勢圖是本人一段時間的走勢，比每日摘要多，所以它是獨立的一項同意。這條測試釘的是
// 「沒給就不出門」：資料在伺服器就被擋下，不是送過去再由畫面決定要不要顯示。
test('the trend only leaves the server once the participant shares it', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const raw = (entry.headers.getSetCookie?.() || [entry.headers.get('set-cookie') || '']).join(';');
  const visit = raw.match(/dailyable_demo_visit=[^;]*/)[0];
  const asParticipant = `${raw.match(/dailyable_demo=[^;]*/)[0]}; ${visit}`;

  const supporterEntry = await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' });
  const supporterRaw = (supporterEntry.headers.getSetCookie?.() || [supporterEntry.headers.get('set-cookie') || '']).join(';');
  const asSupporter = `${supporterRaw.match(/dailyable_demo=[^;]*/)[0]}; ${visit}`;
  const read = async () => (await fetch(`${baseUrl}/api/relationships/demo-rel-1/body-records`, { headers: { cookie: asSupporter } })).json();

  // 展示裡的第一條關係設定成「本人已選擇分享走勢形狀」——沒有人會替評審去打開那個開關，
  // 全部預設關著的話，切到支持者只會看到「還沒分享」，功能等於不存在。
  // 真正要守的約定是「值不值得送出去由分享階決定」，下面逐階驗。
  const before = await read();
  assert.equal(before.sharingLevel, 'trend', 'the prepared connection starts at shape-only');
  assert.ok(before.series?.length, 'shape is shared, so the shape travels');
  assert.ok(before.shapeOnly, 'but at this level the readings themselves are rescaled away');
  assert.ok(before.disclaimer?.zh && before.disclaimer?.en, 'the disclaimer travels with the data, in both languages');

  // 降回最低階，走勢就不該出門——這才是那條線真正的保證
  await fetch(`${baseUrl}/api/pairing/relationships/demo-rel-1/scopes`, {
    method: 'POST',
    headers: { cookie: asParticipant, 'content-type': 'application/json' },
    body: JSON.stringify({ level: 'summary' })
  });
  assert.equal((await read()).series, null, 'dropping to summary stops the readings at once');

  const grant = await fetch(`${baseUrl}/api/pairing/relationships/demo-rel-1/scopes`, {
    method: 'POST',
    headers: { cookie: asParticipant, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'trend_chart', grant: true })
  });
  assert.equal(grant.status, 200);
  const after = await read();
  assert.ok(after.series?.length, 'once shared, the supporter receives the readings');

  // 收回就要立刻停止，不是等下次載入
  await fetch(`${baseUrl}/api/pairing/relationships/demo-rel-1/scopes`, {
    method: 'POST',
    headers: { cookie: asParticipant, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'trend_chart', grant: false })
  });
  assert.equal((await read()).series, null, 'withdrawing has to stop it at once');

  // 支持者不能自己替本人打開
  const selfGrant = await fetch(`${baseUrl}/api/pairing/relationships/demo-rel-1/scopes`, {
    method: 'POST',
    headers: { cookie: asSupporter, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'trend_chart', grant: true })
  });
  assert.equal(selfGrant.status, 403, 'only the participant decides what is shared');
});

test('reset clears the demo person and closes the product pages again', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const cookie = cookieFrom(entry);
  const open = await fetch(`${baseUrl}/app`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(open.status, 200);

  const reset = await fetch(`${baseUrl}/demo/reset`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(reset.status, 303);
  assert.equal(reset.headers.get('location'), '/demo');
  assert.match(reset.headers.get('set-cookie') || '', /dailyable_demo=;/);

  const closed = await fetch(`${baseUrl}/app`, { redirect: 'manual' });
  assert.equal(closed.status, 303);
});
