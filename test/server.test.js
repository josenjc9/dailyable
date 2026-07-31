import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStartupError, startFailureServer, startServer } from '../src/server.js';

let server;
let baseUrl;

test.before(async () => {
  server = await startServer(0);
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test('exposes a deployment health endpoint', async () => {
  const response = await fetch(`${baseUrl}/api/ping`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'dailyable');
});

test('startup dependency failures expose only a sanitized health response', async (t) => {
  assert.equal(classifyStartupError(Object.assign(new Error('private connection details'), { code: '28P01' })), 'database_auth_failed');
  const failureServer = await startFailureServer(0, Object.assign(new Error('secret database details'), { code: 'ENOTFOUND' }));
  t.after(() => failureServer.close());
  const { port } = failureServer.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '30');
  const body = await response.json();
  assert.deepEqual(body, { status: 'unavailable', dependency: 'database', reason: 'database_host_unresolved' });
  assert.doesNotMatch(JSON.stringify(body), /secret|password/i);
});

test('keeps common public aliases working', async () => {
  const participant = await fetch(`${baseUrl}/participant`, { redirect: 'manual' });
  assert.equal(participant.status, 308);
  assert.equal(participant.headers.get('location'), '/app');

  const health = await fetch(`${baseUrl}/api/health`);
  const healthBody = await health.json();
  assert.equal(health.status, 200);
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.service, 'dailyable');

  const openGraph = await fetch(`${baseUrl}/og-image.png`, { redirect: 'manual' });
  assert.equal(openGraph.status, 308);
  assert.equal(openGraph.headers.get('location'), '/og-dailyable.png');
});

test('serves public, participant, and supporter page families', async () => {
  const publicRoutes = ['/', '/about', '/how-it-works'];
  const participantRoutes = ['/app', '/app/check-in', '/app/records', '/app/support', '/app/privacy'];
  const supporterRoutes = ['/supporter', '/supporter/queue', '/supporter/people/alex-01', '/supporter/plans/alex-01', '/supporter/follow-up', '/supporter/method'];

  for (const route of [...publicRoutes, ...participantRoutes, ...supporterRoutes]) {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await response.text();
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/);
    // The stamp is the file's content hash now, so pinning a literal one here would only
    // pin the habit this replaced. What matters is that the switcher is loaded and stamped.
    assert.match(html, /<script src="\/i18n\.js\?v=[a-f0-9]+" defer><\/script>/, `${route} loads language switcher`);
    assert.match(html, /<title>[^<]+<\/title>/, `${route} has its own title`);
    assert.match(html, /<h1[\s>]/, `${route} has its own h1`);
  }

  for (const route of participantRoutes) {
    const html = await (await fetch(`${baseUrl}${route}`)).text();
    assert.match(html, /data-role-shell="participant"/, `${route} uses participant shell`);
    assert.match(html, /href="\/app\/check-in"/);
    // 趨勢併進 /app/records、連結管理併進 /app/privacy（2026-07-28）
    assert.match(html, /href="\/app\/records"/);
    assert.match(html, /href="\/app\/support"/);
    assert.match(html, /href="\/app\/privacy"/);
    assert.match(html, /data-role-switch[^>]+href="\/session\?next=\/supporter"/, `${route} can switch role`);
    assert.doesNotMatch(html, /supporter-private-workspace/);
  }

  for (const route of supporterRoutes) {
    const html = await (await fetch(`${baseUrl}${route}`)).text();
    assert.match(html, /data-role-shell="supporter"/, `${route} uses supporter shell`);
    assert.match(html, /href="\/supporter\/queue"/);
    assert.match(html, /href="\/supporter\/follow-up"/);
    assert.match(html, /href="\/supporter\/method"/);
    assert.match(html, /data-role-switch[^>]+href="\/session\?next=\/app"/, `${route} can switch role`);
    assert.doesNotMatch(html, /participant-check-in-form/);
  }
});

test('each operating shell exposes exactly one cross-role switch', async () => {
  for (const route of ['/app', '/app/check-in', '/app/records', '/app/support', '/app/privacy', '/app/privacy']) {
    const html = await (await fetch(`${baseUrl}${route}`)).text();
    assert.equal((html.match(/data-role-switch/g) || []).length, 1, route);
    assert.match(html, /data-role-switch href="\/session\?next=\/supporter"/);
    assert.doesNotMatch(html.match(/<nav[\s\S]*?<\/nav>/)?.[0] || '', /href="\/supporter/);
  }
  for (const route of ['/supporter', '/supporter/queue', '/supporter/follow-up', '/supporter/method', '/supporter/people/alex-01', '/supporter/plans/alex-01', '/supporter/connections']) {
    const html = await (await fetch(`${baseUrl}${route}`)).text();
    assert.equal((html.match(/data-role-switch/g) || []).length, 1, route);
    assert.match(html, /data-role-switch href="\/session\?next=\/app"/);
    assert.doesNotMatch(html.match(/<nav[\s\S]*?<\/nav>/)?.[0] || '', /href="\/app/);
  }
});

test('multi-page flows keep queue, person, plan, and participant check-in in separate documents', async () => {
  const queue = await (await fetch(`${baseUrl}/supporter/queue`)).text();
  const person = await (await fetch(`${baseUrl}/supporter/people/alex-01`)).text();
  const plan = await (await fetch(`${baseUrl}/supporter/plans/alex-01`)).text();
  const checkIn = await (await fetch(`${baseUrl}/app/check-in`)).text();
  const supporterScript = await (await fetch(`${baseUrl}/supporter.js`)).text();

  assert.match(queue, /id="queue-list"/);
  assert.doesNotMatch(queue, /id="person-detail"/);
  assert.match(person, /id="person-detail"/);
  assert.doesNotMatch(person, /id="queue-list"/);
  assert.match(plan, /id="plan-detail"/);
  assert.match(checkIn, /participant-check-in-form/);
  assert.doesNotMatch(checkIn, /supporter-private-workspace/);
  assert.match(supporterScript, /\/supporter\/people\//);
  assert.match(supporterScript, /\/supporter\/plans\//);
});

test('new page families avoid CSP-blocked inline styles', async () => {
  const routes = ['/app', '/app/check-in', '/app/records', '/app/support', '/app/privacy', '/supporter', '/supporter/queue', '/supporter/people/alex-01', '/supporter/plans/alex-01', '/supporter/follow-up', '/supporter/method'];
  for (const route of routes) {
    const html = await (await fetch(`${baseUrl}${route}`)).text();
    assert.doesNotMatch(html, /\sstyle=/i, route);
  }
});

test('serves the bilingual runtime with persistence and accessibility hooks', async () => {
  const response = await fetch(`${baseUrl}/i18n.js`);
  const source = await response.text();
  assert.equal(response.status, 200);
  assert.match(source, /localStorage/);
  assert.match(source, /document\.documentElement\.lang/);
  assert.match(source, /aria-label/);
  assert.match(source, /繁體中文/);
  assert.match(source, /English/);
});

test('participant page avoids CSP-blocked inline styles', async () => {
  const response = await fetch(`${baseUrl}/check-in`);
  const html = await response.text();
  assert.doesNotMatch(html, /\sstyle=/i);
});

test('shared styles preserve native hidden-state behavior', async () => {
  const response = await fetch(`${baseUrl}/styles.css`);
  const css = await response.text();
  assert.match(css, /\[hidden\]\{display:none!important\}/);
});

test('calculates an actionable check-in response', async () => {
  const response = await fetch(`${baseUrl}/api/check-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      energy: 'low',
      routine: 'off-track',
      concern: 'none',
      supportChoice: 'supporter'
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.level, 'check-in');
  assert.equal(body.supporterOption.requiresConfirmation, true);
});

test('serves a prioritized supporter queue with demo disclosure', async () => {
  const response = await fetch(`${baseUrl}/api/supporter/queue`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.demoData, true);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, 'alex-01');
  assert.equal(body.items[0].priority, 'check-now');
  assert.ok(body.items[0].observableReasons.length > 0);
  assert.ok(body.items[0].functionalSignals.length >= 3);
  assert.ok(body.items[0].recommendedPlan.length >= 3);
  assert.ok(body.items[0].connectionOptions.length >= 2);
  assert.equal(body.items[0].connectionLevel, 'review');
  assert.equal(typeof body.items[0].connectionLabel, 'string');
  assert.ok(body.items[0].decisionBasis.length >= 4);
  assert.ok(body.items[0].exclusionsToCheck.length >= 3);
  assert.ok(body.items[0].evaluationSignals.length >= 3);
});

test('participant and supporter page families include role-specific operation guidance', async () => {
  const participant = await (await fetch(`${baseUrl}/app/check-in`)).text();
  const supporterMethod = await (await fetch(`${baseUrl}/supporter/method`)).text();
  assert.match(participant, /quick-guide/);
  assert.match(participant, /icons\.svg#icon-tap/);
  assert.match(participant, /participant-check-in-form/);
  assert.match(supporterMethod, /method-steps/);
  assert.match(supporterMethod, /Authority boundary/);
});

test('public competition pages keep evidence outside the operating views', async () => {
  const home = await (await fetch(`${baseUrl}/`)).text();
  const about = await (await fetch(`${baseUrl}/about`)).text();
  const method = await (await fetch(`${baseUrl}/how-it-works`)).text();
  const supporterScript = await (await fetch(`${baseUrl}/supporter.js`)).text();
  const portalCssResponse = await fetch(`${baseUrl}/portal.css`);
  const portalCss = await portalCssResponse.text();
  const publicCssResponse = await fetch(`${baseUrl}/public-site.css`);
  const publicCss = await publicCssResponse.text();

  assert.equal(portalCssResponse.status, 200);
  assert.equal(publicCssResponse.status, 200);
  assert.match(portalCss, /@media\(max-width:720px\)/);
  assert.match(home, /Small signals\. Timely support\. More room to live your day\./);
  assert.match(home, /property="og:image" content="https:\/\/dailyable\.zeabur\.app\/og-dailyable\.png"/);
  const openGraphImage = await fetch(`${baseUrl}/og-dailyable.png`);
  assert.equal(openGraphImage.status, 200);
  assert.equal(openGraphImage.headers.get('content-type'), 'image/png');
  assert.match(home, /support-loop-preview/);
  assert.match(home, /ALEX → JORDAN → ALEX/);
  assert.match(home, /v3-product-split/);
  assert.match(home, /href="\/about"/);
  assert.match(about, /What works now/);
  assert.match(about, /What the pilot must add/);
  assert.match(about, /Proof of Concept/);
  assert.match(publicCss, /\.opening-statement h1/);
  assert.match(publicCss, /\.consent-thread/);
  assert.match(publicCss, /\.two-worlds/);
  for (const marker of ['method-story', 'method-tabs', 'principle-list']) {
    assert.match(method, new RegExp(marker), marker);
  }
  assert.match(supporterScript, /DECISION BASIS/);
  assert.match(supporterScript, /WHAT TO RULE OUT/);
  assert.match(supporterScript, /HOW WE WILL KNOW/);
});

test('mobile and tablet surfaces include LINE WebView safeguards', async () => {
  const routes = [
    '/', '/about', '/how-it-works',
    '/app', '/app/check-in', '/app/records', '/app/support', '/app/privacy',
    '/supporter', '/supporter/queue', '/supporter/people/alex-01',
    '/supporter/plans/alex-01', '/supporter/follow-up', '/supporter/method'
  ];

  for (const route of routes) {
    const html = await (await fetch(`${baseUrl}${route}`)).text();
    assert.match(
      html,
      /name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/,
      `${route} accounts for LINE WebView safe areas`
    );
  }

  const sharedCss = await (await fetch(`${baseUrl}/styles.css`)).text();
  const portalCss = await (await fetch(`${baseUrl}/portal.css`)).text();
  const participantScript = await (await fetch(`${baseUrl}/app.js`)).text();
  assert.match(sharedCss, /-webkit-text-size-adjust:100%/);
  assert.match(sharedCss, /touch-action:manipulation/);
  assert.match(portalCss, /env\(safe-area-inset-top\)/);
  assert.match(portalCss, /env\(safe-area-inset-bottom\)/);
  assert.match(portalCss, /min-height:44px/);
  assert.match(portalCss, /\.role-layout\{[^}]*min-width:0/);
  assert.match(portalCss, /\.form-actions\{[^}]*position:sticky/);
  assert.match(participantScript, /renderStep\(\{ focusQuestion: false \}\)/);
});

test('rejects oversized or invalid JSON requests', async () => {
  const response = await fetch(`${baseUrl}/api/check-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ energy: 'wrong' })
  });
  assert.equal(response.status, 400);
});
