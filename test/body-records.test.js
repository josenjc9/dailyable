import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';
import { MemoryStore } from '../src/store.js';

// Body records exist so a clinician can read what happened at home. That means the shape
// has to survive the trip: blood pressure keeps both numbers, and a glucose value keeps
// the timing context that makes it interpretable. Everything else may be left blank.
let server;
let baseUrl;
let store;
let cookie;
let csrfToken;

test.before(async () => {
  store = new MemoryStore();
  server = await startServer(0, { store, prototypeAuth: true, enforcePageAuth: false });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'participant', displayName: 'Record Tester' })
  });
  cookie = (session.headers.get('set-cookie') || '').split(';')[0];
  // Writes from a real session are CSRF-guarded, so the tests go through the same door a
  // browser does rather than weakening the guard to make testing easier.
  csrfToken = (await (await fetch(`${baseUrl}/api/csrf`, { headers: { cookie } })).json()).token;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const post = (path, body) => fetch(`${baseUrl}${path}`, {
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrfToken },
  body: JSON.stringify(body)
});

test('blood pressure keeps systolic, diastolic and pulse as separate values', async () => {
  const response = await post('/api/vitals', { systolic: 138, diastolic: 86, pulse: 74, posture: 'sitting' });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.systolic, 138);
  assert.equal(saved.diastolic, 86);
  assert.equal(saved.pulse, 74);
  assert.equal(saved.posture, 'sitting');
});

test('a glucose value without its timing context is stored as unspecified, not assumed', async () => {
  const response = await post('/api/vitals', { glucose: 126 });
  const saved = await response.json();
  assert.equal(saved.glucose, 126);
  assert.equal(saved.glucoseContext, 'unspecified');

  const fasting = await (await post('/api/vitals', { glucose: 126, glucoseContext: 'fasting' })).json();
  assert.equal(fasting.glucoseContext, 'fasting');
});

test('a partial record is accepted; only a completely empty one is refused', async () => {
  const waterOnly = await post('/api/vitals', { waterMl: 750 });
  assert.equal(waterOnly.status, 201);
  const saved = await waterOnly.json();
  assert.equal(saved.waterMl, 750);
  // Blank fields stay blank so a gap reads as "not recorded" rather than a zero reading.
  assert.equal(saved.systolic, null);
  assert.equal(saved.glucose, null);

  const empty = await post('/api/vitals', {});
  assert.equal(empty.status, 400);
});

test('values a home device could not produce are refused with a readable reason', async () => {
  const response = await post('/api/vitals', { systolic: 900 });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /systolic/i);
});

test('meals record what was eaten and when', async () => {
  const response = await post('/api/meals', { mealSlot: 'lunch', description: 'Rice, greens, fish' });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.mealSlot, 'lunch');
  assert.equal(saved.description, 'Rice, greens, fish');
  assert.ok(Number.isFinite(Date.parse(saved.eatenAt)));

  const blank = await post('/api/meals', { mealSlot: 'lunch' });
  assert.equal(blank.status, 400);
});

test('records come back newest first for the person who wrote them', async () => {
  const vitals = await (await fetch(`${baseUrl}/api/vitals`, { headers: { cookie } })).json();
  assert.ok(vitals.records.length >= 4);
  const times = vitals.records.map((record) => Date.parse(record.measuredAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));

  const meals = await (await fetch(`${baseUrl}/api/meals`, { headers: { cookie } })).json();
  assert.ok(meals.records.length >= 1);
});

test('supporters cannot read a participant body record endpoint directly', async () => {
  const supporterSession = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'supporter', displayName: 'Supporter Tester' })
  });
  const supporterCookie = (supporterSession.headers.get('set-cookie') || '').split(';')[0];
  const response = await fetch(`${baseUrl}/api/vitals`, { headers: { cookie: supporterCookie } });
  assert.equal(response.status, 403);
});

// 展示模式的約定改了：同一輪瀏覽裡，評審填的東西要留著——不然回報、趨勢、就診摘要是四
// 個互不相干的畫面，而那條線正是這個服務要展示的。留的地方是記憶體，資料庫依然碰不到，
// 換一輪就回到準備好的那份。
test('a reading entered in the demo comes back, and a new visit starts clean', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const raw = entry.headers.getSetCookie?.() || [entry.headers.get('set-cookie') || ''];
  const demoCookie = raw.join(';').match(/dailyable_demo=[^;]*/)[0];
  const visitCookie = raw.join(';').match(/dailyable_demo_visit=[^;]*/)[0];
  const visit = `${demoCookie}; ${visitCookie}`;

  const listed = await (await fetch(`${baseUrl}/api/vitals`, { headers: { cookie: visit } })).json();
  assert.equal(listed.demoData, true);
  assert.ok(listed.records.length > 0);
  // The prepared set deliberately includes a day with only a glucose reading, so the
  // "not recorded" case is visible to a judge rather than hidden behind complete rows.
  assert.ok(listed.records.some((record) => record.systolic === null && record.glucose !== null));

  const write = await fetch(`${baseUrl}/api/vitals`, {
    method: 'POST',
    headers: { cookie: visit, 'content-type': 'application/json' },
    body: JSON.stringify({ systolic: 120, diastolic: 80 })
  });
  const body = await write.json();
  assert.equal(body.demoData, true);
  assert.equal(body.saved, true, 'the visitor has to be able to see what they just entered');

  const after = await (await fetch(`${baseUrl}/api/vitals`, { headers: { cookie: visit } })).json();
  assert.equal(after.records.length, listed.records.length + 1, 'the reading must come back');
  assert.equal(after.records[0].systolic, 120, 'and it must be the most recent one');

  // 換一輪＝乾淨的展示。上一個人填的東西不該出現在下一個人眼前。
  const second = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const secondRaw = (second.headers.getSetCookie?.() || [second.headers.get('set-cookie') || '']).join(';');
  const freshVisit = `${secondRaw.match(/dailyable_demo=[^;]*/)[0]}; ${secondRaw.match(/dailyable_demo_visit=[^;]*/)[0]}`;
  const fresh = await (await fetch(`${baseUrl}/api/vitals`, { headers: { cookie: freshVisit } })).json();
  assert.equal(fresh.records.length, listed.records.length, 'a new visit starts from the prepared set');
});

test('published ranges are served with sources, and only where one actually exists', async () => {
  const reference = await (await fetch(`${baseUrl}/api/reference-ranges`)).json();

  assert.ok(reference.bloodPressure.source.startsWith('https://'), 'blood pressure needs a citable source');
  assert.ok(reference.pulse.source.startsWith('https://'));
  assert.ok(reference.water.source.startsWith('https://'));
  assert.match(reference.attribution.zh, /國民健康署/);
  assert.match(reference.disclaimer.zh, /不等同醫療診斷/);

  // The whole point of this endpoint: a band appears only where an official general-adult
  // range was found. Ordinary post-meal and random readings have none.
  assert.equal(reference.glucose['post-meal-2h'].band, null);
  assert.equal(reference.glucose.random.band, null);
  assert.equal(reference.glucose.unspecified.band, null);
  assert.equal(reference.glucose.fasting.band.diagnosticThreshold, 126);

  // The 200 mg/dL figure belongs to the tolerance test and must not leak onto an ordinary
  // reading taken two hours after eating.
  assert.equal(reference.glucose['ogtt-2h'].band.diagnosticThreshold, 200);
  assert.equal(reference.glucose['post-meal-2h'].quote, null);
  assert.doesNotMatch(JSON.stringify(reference.glucose['post-meal-2h']), /200/);
});

test('an ordinary post-meal reading and a tolerance test are stored as different contexts', async () => {
  const ordinary = await (await post('/api/vitals', { glucose: 190, glucoseContext: 'post-meal-2h' })).json();
  assert.equal(ordinary.glucoseContext, 'post-meal-2h');

  const tolerance = await (await post('/api/vitals', { glucose: 190, glucoseContext: 'ogtt-2h' })).json();
  assert.equal(tolerance.glucoseContext, 'ogtt-2h');
});

test('medicine is recorded as one entry per dose, so times and counts come from the data', async () => {
  const first = await post('/api/medications', { name: 'Metformin 500 mg', note: 'with breakfast' });
  assert.equal(first.status, 201);
  const saved = await first.json();
  assert.equal(saved.name, 'Metformin 500 mg');
  assert.ok(Number.isFinite(Date.parse(saved.takenAt)));

  await post('/api/medications', { name: 'Metformin 500 mg' });
  const listed = await (await fetch(`${baseUrl}/api/medications`, { headers: { cookie } })).json();
  assert.equal(listed.records.length, 2, 'each dose is its own entry');

  const blank = await post('/api/medications', { note: 'forgot the name' });
  assert.equal(blank.status, 400);
});

test('leaving works inside the demo: sign-out clears the persona so the other role is reachable', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const demoCookie = (entry.headers.get('set-cookie') || '').match(/dailyable_demo=[^;]*/)[0];

  const session = await fetch(`${baseUrl}/api/session`, { headers: { cookie: demoCookie } });
  assert.equal((await session.json()).user.demo, true);

  // The read-only demo guard must not swallow this: it is session control, not a data write.
  const out = await fetch(`${baseUrl}/api/session`, { method: 'DELETE', headers: { cookie: demoCookie } });
  const outBody = await out.json();
  assert.equal(out.status, 200);
  assert.equal(outBody.ok, true);
  assert.notEqual(outBody.saved, false, 'sign-out must not be answered by the demo write guard');
  const cleared = String(out.headers.getSetCookie ? out.headers.getSetCookie().join(';') : out.headers.get('set-cookie'));
  assert.match(cleared, /dailyable_demo=;/, 'the demo persona has to be cleared');
});

test('the visit summary reports the person’s own trend and refuses to interpret it', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const demoCookie = (entry.headers.get('set-cookie') || '').match(/dailyable_demo=[^;]*/)[0];
  const body = await (await fetch(`${baseUrl}/api/clinical-summary`, { headers: { cookie: demoCookie } })).json();
  const summary = body.summary;

  // Three months: the span a clinician looks back over, and enough earlier readings for
  // the recent week to be compared against something.
  assert.equal(summary.windowDays, 90);
  assert.ok(summary.measures.systolic.comparedWithOwnBaseline, 'the prepared set must have enough history to compare');
  assert.ok(summary.coverage.daysWithAnyRecord > 0);
  assert.ok(summary.measures.systolic.recordedInWindow > 0);

  // Readings taken at different times are never averaged together, and a reading whose
  // timing was not noted is carried as un-interpretable rather than quietly included.
  const contexts = Object.fromEntries(summary.glucoseContexts.map((entry) => [entry.context, entry]));
  assert.ok(contexts.fasting, 'fasting readings are reported separately');
  assert.equal(contexts['post-meal-2h'].interpretable, true);
  if (contexts.unspecified) assert.equal(contexts.unspecified.interpretable, false);

  assert.match(summary.boundary, /No diagnosis/i);
  // The data itself must carry no clinical label. The boundary sentence is excluded
  // because it exists precisely to say those words are absent.
  const { boundary, ...data } = summary;
  assert.doesNotMatch(JSON.stringify(data), /prediabet|diabetic|hypertens|abnormal|risk score|high risk/i);
});

test('a supporter cannot pull body records without an active, consented relationship', async () => {
  const supporterSession = await fetch(`${baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'supporter', displayName: 'Nosy Supporter' })
  });
  const supporterCookie = (supporterSession.headers.get('set-cookie') || '').split(';')[0];
  const response = await fetch(`${baseUrl}/api/relationships/not-a-real-relationship/body-records`, {
    headers: { cookie: supporterCookie }
  });
  assert.equal(response.status, 403);

  // A participant is not a supporter and must not reach the supporter-facing route either.
  const asParticipant = await fetch(`${baseUrl}/api/relationships/not-a-real-relationship/body-records`, {
    headers: { cookie }
  });
  assert.equal(asParticipant.status, 403);
});

test('a dose count is read against the plan the person entered, not against nothing', async () => {
  await post('/api/medication-plans', { name: 'Metformin 500 mg', timesPerDay: 2, instructions: 'With meals' });
  const plans = await (await fetch(`${baseUrl}/api/medication-plans`, { headers: { cookie } })).json();
  assert.equal(plans.plans.length, 1);
  assert.equal(plans.plans[0].timesPerDay, 2);

  const nameless = await post('/api/medication-plans', { timesPerDay: 2 });
  assert.equal(nameless.status, 400, 'a plan needs to say which medicine it is');
});

test('meals carry optional nutrition figures and are averaged only over days that have them', async () => {
  const withFigures = await post('/api/meals', { description: 'Rice and fish', kcal: 600, carbG: 80, proteinG: 25, fatG: 15 });
  assert.equal(withFigures.status, 201);
  const saved = await withFigures.json();
  assert.equal(saved.kcal, 600);
  assert.equal(saved.carbG, 80);

  // Naming the food without any figures stays a valid entry.
  const foodOnly = await post('/api/meals', { description: 'Congee' });
  assert.equal(foodOnly.status, 201);
  assert.equal((await foodOnly.json()).kcal, null);

  // Figures with no description are also fine — someone may only have the label.
  const figuresOnly = await post('/api/meals', { kcal: 300 });
  assert.equal(figuresOnly.status, 201);

  const empty = await post('/api/meals', {});
  assert.equal(empty.status, 400);
});

test('the demo summary compares doses with the plan and keeps figure-less meals out of the averages', async () => {
  const entry = await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' });
  const demoCookie = (entry.headers.get('set-cookie') || '').match(/dailyable_demo=[^;]*/)[0];
  const summary = (await (await fetch(`${baseUrl}/api/clinical-summary`, { headers: { cookie: demoCookie } })).json()).summary;

  // Two plans, three doses a day between them.
  assert.equal(summary.medication.expectedPerDay, 3);
  assert.ok(summary.medication.daysBelowPlan >= 0);
  assert.ok(summary.medication.plans.length >= 1);

  // Days without figures must not drag the daily average down.
  assert.ok(summary.meals.entriesWithoutFigures > 0, 'the prepared set keeps some meals figure-less on purpose');
  assert.ok(summary.meals.nutrition.kcal.dailyAverage > 0);
  assert.ok(
    summary.meals.nutrition.kcal.daysWithFigures < summary.meals.daysWithAnyMeal,
    'the average covers only the days that actually carry figures'
  );
});

test('a real account’s check-in history has the same flat shape the charts read', async () => {
  // 2026-07-29 抓到的：展示資料是平的（energy 在頂層），真帳號回的是 {input, result}
  // 巢狀。精神趨勢圖跟首頁七天條都讀 entry.energy——展示身分一切正常，真帳號的圖
  // 全是空的，而評審只看展示，永遠不會發現。這條釘住兩邊形狀一致。
  const checkIn = await post('/api/check-in', { energy: 'low', routine: 'changed', concern: 'none', supportChoice: 'self' });
  assert.equal(checkIn.status, 200);

  const listed = await (await fetch(`${baseUrl}/api/check-ins`, { headers: { cookie } })).json();
  assert.ok(listed.checkIns.length > 0);
  const entry = listed.checkIns[0];
  assert.equal(entry.energy, 'low', '真帳號的列要跟展示資料一樣，energy 在頂層');
  assert.equal(entry.routine, 'changed');
  assert.ok(entry.createdAt, '圖表靠 createdAt 排時間軸');
  // 當時給的下一步跟著紀錄走，重開舊紀錄看到的是當時說的話
  assert.ok(typeof entry.nextStep === 'string' && entry.nextStep.length > 0,
    '每一筆都要留著當時的下一步');
  assert.equal(entry.input, undefined, '巢狀的 input 不該再漏出去');
});

test('a dish typed the way people say it still finds the entry named differently', async () => {
  // 2026-07-29 實走抓到的：搜「滷雞腿」零筆，但資料庫裡有「雞腿便當（滷）」。
  // 人講話的字序跟資料庫命名不同，連續子字串比對就死了。修法是字符覆蓋退路。
  const spoken = await (await fetch(`${baseUrl}/api/foods?q=${encodeURIComponent('滷雞腿')}`)).json();
  assert.ok(spoken.foods.length > 0, '搜「滷雞腿」要找得到「雞腿便當（滷）」');
  assert.ok(spoken.foods.some((food) => food.name === '雞腿便當（滷）'));

  // 校準一：原本就中的查詢還是要中、而且還是排最前（覆蓋分數排在子字串之後）
  const direct = await (await fetch(`${baseUrl}/api/foods?q=${encodeURIComponent('滷肉')}`)).json();
  assert.equal(direct.foods[0].name, '滷肉飯', '子字串命中的排序不能被覆蓋比對打亂');

  // 校準二：字湊不齊的不能亂中——沒有一道菜同時含這四個字
  const nonsense = await (await fetch(`${baseUrl}/api/foods?q=${encodeURIComponent('滷披薩麵')}`)).json();
  assert.equal(nonsense.foods.length, 0, '字符覆蓋不該把湊不齊的查詢也放進來');
});

test('the food table from the earlier project fills the figures in from a portion', async () => {
  const found = await (await fetch(`${baseUrl}/api/foods?q=${encodeURIComponent('滷肉')}`)).json();
  assert.ok(found.foods.length > 0, 'searching a common Taiwanese dish should find it');
  assert.equal(found.foods[0].name, '滷肉飯');
  assert.ok(found.foods[0].kcal > 0);

  // Figures are per 100 units, so a 300 g bowl is three times the table value.
  const meal = await (await post('/api/meals', { foodName: '滷肉飯', quantity: 300 })).json();
  assert.equal(meal.kcal, 405);
  assert.equal(meal.carbG, 66);
  assert.equal(meal.proteinG, 15);
  assert.match(meal.description, /滷肉飯 300g/);

  // Anything typed by hand wins, because the person may be reading an actual label.
  const overridden = await (await post('/api/meals', { foodName: '滷肉飯', quantity: 300, kcal: 500 })).json();
  assert.equal(overridden.kcal, 500);
  assert.equal(overridden.carbG, 66, 'the fields not overridden still come from the table');

  const unknown = await (await post('/api/meals', { foodName: 'not a food', quantity: 100, description: 'Something else' })).json();
  assert.equal(unknown.kcal, null, 'an unknown food adds no invented figures');
});
