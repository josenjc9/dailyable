import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer } from '../src/server.js';

let server;
let baseUrl;

test.before(async () => {
  server = await startServer(0, { demoMode: true, prototypeAuth: true, enforcePageAuth: true });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

// The entrance points at the reviewer demo, not the sign-in form: real accounts stay
// closed until identity verification exists, so /session would be a dead end for anyone
// arriving from the competition. The single-entrance and no-shortcut rules still hold.
test('public home has one clear entrance and no direct app shortcut', async () => {
  const html = await (await fetch(`${baseUrl}/`)).text();
  assert.equal((html.match(/>See the demo</g) || []).length, 1);
  assert.match(html, /href="\/demo"[^>]*>See the demo</);
  assert.doesNotMatch(html, /href="\/(?:app|supporter)"/);
});

test('operating pages require a session and preserve the requested destination', async () => {
  for (const route of ['/app', '/app/check-in', '/app/privacy', '/supporter', '/supporter/queue', '/supporter/connections']) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
    assert.equal(response.status, 303, route);
    assert.equal(response.headers.get('location'), `/session?next=${encodeURIComponent(route)}`, route);
  }
});

// English is the default for an international entry. The browser language must not be
// consulted, or a reviewer's machine could decide the language for them. A visitor's own
// choice is remembered so the toggle is only needed once.
test('language defaults to English and remembers whatever the visitor picks', async () => {
  const source = await (await fetch(`${baseUrl}/i18n.js`)).text();
  assert.match(source, /let language = 'en'/);
  assert.doesNotMatch(source, /navigator\.(?:language|languages)/, 'the browser language must not decide this');
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY, next === 'zh-TW' \? 'zh-TW' : 'en'\)/);
  assert.doesNotMatch(source, /localStorage\.removeItem\(STORAGE_KEY\)/, 'an English choice is stored, not cleared');
});

test('shared design system defines warm editorial tokens and complete reduced-motion fallback', async () => {
  const css = await (await fetch(`${baseUrl}/styles.css`)).text();
  assert.match(css, /--canvas:\s*#f7f3ec/i);
  assert.match(css, /--coral:/);
  assert.match(css, /--sage:/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*\.01ms!important/);
  assert.match(css, /transition-duration:\s*\.01ms!important/);
}
);

test('critical check-in rendering keeps an older WebView-compatible DOM path', async () => {
  const source = await (await fetch(`${baseUrl}/app.js`)).text();
  assert.match(source, /function replaceContent\(/);
  assert.doesNotMatch(source, /\.replaceChildren\(/);
});

test('third-generation home leads with the live Alex-Jordan loop', async () => {
  const html = await (await fetch(`${baseUrl}/`)).text();
  assert.match(html, /class="v3-hero home-opening"/);
  assert.match(html, /class="support-loop-preview"/);
  assert.match(html, /class="v3-story-section consent-thread"/);
  assert.doesNotMatch(html, /public-hero-inner|product-window|window-bar|A hard day can still have one clear next step/);
});

test('session keeps role selection and trust facts together in the desktop first screen', async () => {
  const html = await (await fetch(`${baseUrl}/session`)).text();
  assert.match(html, /class="session-stage"/);
  assert.match(html, /class="trust-strip"/);
  assert.match(html, /class="role-card [^"]+"/);
});

test('participant and supporter use structurally distinct shells', async () => {
  const participant = await readFile(new URL('../public/participant-home.html', import.meta.url), 'utf8');
  const supporter = await readFile(new URL('../public/supporter-dashboard.html', import.meta.url), 'utf8');
  assert.match(participant, /data-role-shell="participant"/);
  assert.match(participant, /class="participant-dock/);
  assert.doesNotMatch(participant, /class="ops-rail/);
  assert.match(supporter, /data-role-shell="supporter"/);
  assert.match(supporter, /class="ops-rail/);
});

test('reveal enhancement never hides content before JavaScript readiness', async () => {
  const css = await (await fetch(`${baseUrl}/styles.css`)).text();
  const source = await (await fetch(`${baseUrl}/ui.js`)).text();
  assert.doesNotMatch(css, /\[data-reveal\]\s*\{[^}]*opacity:\s*0/);
  assert.match(css, /\.js-ready\s+\[data-reveal="pending"\]/);
  assert.match(source, /documentElement\.classList\.add\('js-ready'\)/);
  assert.match(source, /rootMargin:\s*'120px 0px'/);
});

test('mobile public header keeps the language switch visible above a full-width navigation row', async () => {
  const css = await (await fetch(`${baseUrl}/public-site.css`)).text();
  const source = await (await fetch(`${baseUrl}/i18n.js`)).text();
  assert.match(css, /@media\(max-width:620px\)[\s\S]*\.public-site \.site-header\{[^}]*grid-template-columns:1fr auto/);
  assert.match(css, /\.public-site \.site-header nav\{[^}]*grid-column:1\/-1[^}]*grid-row:2/);
  assert.match(css, /\.public-site \.site-header \.language-toggle\{[^}]*grid-column:2[^}]*grid-row:1/);
  assert.match(source, /querySelector\('\.site-header, \.portal-header'\)/);
  assert.doesNotMatch(source, /querySelector\('\.site-header nav, \.portal-header'\)/);
});

test('supporter priority preview and body records occupy separate desktop rows', async () => {
  const css = await (await fetch(`${baseUrl}/portal.css`)).text();
  assert.match(css, /\.ops-overview > \.portal-grid > \.portal-card\.full:nth-child\(4\)\{grid-column:1\/10;grid-row:1\}/);
  assert.match(css, /\.ops-overview > \.portal-grid > \.portal-card\.full:nth-child\(5\)\{grid-column:1\/10;grid-row:2\/4\}/);
  assert.match(css, /@media\(max-width:980px\)[\s\S]*\.portal-card\.full:nth-child\(4\)[\s\S]*grid-row:auto/);
});

test('mobile supporter overview resets desktop grid coordinates and queue columns', async () => {
  const css = await (await fetch(`${baseUrl}/portal.css`)).text();
  assert.match(css, /@media\(max-width:980px\)[\s\S]*\.ops-rail\{[^}]*min-width:0!important[^}]*width:100%!important[^}]*overflow:hidden/);
  assert.match(css, /@media\(max-width:980px\)[\s\S]*\.ops-rail nav\{[^}]*max-width:100%[^}]*min-width:0/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.ops-overview \.portal-card:nth-child\(1\)[^}]*\{[^}]*grid-column:span 1[^}]*grid-row:auto/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.ops-overview \.portal-card\.full\{[^}]*grid-column:1\/-1[^}]*grid-row:auto/);
  assert.match(css, /@media\(max-width:720px\)[\s\S]*\.ops-overview \.portal-card\.full \.queue-row\{[^}]*grid-template-columns:1fr/);
});

test('language switch and session trust region expose locale-matched accessible labels', async () => {
  const source = await (await fetch(`${baseUrl}/i18n.js`)).text();
  assert.match(source, /'Pilot trust protections':'試行信任保護措施'/);
  assert.match(source, /language === 'zh-TW' \? '切換為英文' : 'Switch to Traditional Chinese'/);
  assert.doesNotMatch(source, /language === 'zh-TW' \? 'Switch to English' : '切換為繁體中文'/);
});

test('dark public evidence cards and table headers explicitly use readable light text', async () => {
  const css = await (await fetch(`${baseUrl}/public-site.css`)).text();
  assert.match(css, /\.public-site \.decision-evidence article\{[^}]*background:#17201f[^}]*color:#f7f3ec/);
  assert.match(css, /\.public-site \.decision-evidence article p\{[^}]*color:#c7d0cc/);
  assert.match(css, /\.public-site \.support-patterns \.table-head\{[^}]*color:#f7f3ec/);
});

test('Traditional Chinese covers redesigned homepage labels and supporter error actions', async () => {
  const source = await (await fetch(`${baseUrl}/i18n.js`)).text();
  for (const pair of [
    ["Evidence", "證據"],
    ["Method", "方法"],
    ["ONE QUIET THREAD", "一條安靜清楚的路徑"],
    ["TWO ROLES / TWO WORLDS", "兩種角色，兩套體驗"],
    ["DESIGNED FOR REAL ACCESS", "為真實可及性而設計"],
    ["2026 PILOT", "2026 試行"],
    ["The demo queue could not load.", "無法載入展示清單。"],
    ["Retry", "再試一次"]
  ]) {
    assert.match(source, new RegExp(`'${pair[0].replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}':'${pair[1]}'`));
  }
});

test('short desktop session keeps trust protections in the first viewport', async () => {
  const css = await (await fetch(`${baseUrl}/portal.css`)).text();
  assert.match(css, /@media\(min-width:981px\) and \(max-height:760px\)\{[\s\S]*\.session-stage\{[^}]*padding:76px[^}]*16px[^}]*gap:12px/);
  assert.match(css, /@media\(min-width:981px\) and \(max-height:760px\)\{[\s\S]*\.role-card\{[^}]*min-height:105px/);
  assert.match(css, /@media\(min-width:981px\) and \(max-height:760px\)\{[\s\S]*\.trust-strip\{[^}]*padding-top:8px/);
});

test('participant shell uses the authenticated session display name', async () => {
  const [home, ui] = await Promise.all([
    readFile(new URL('../public/participant-home.html', import.meta.url), 'utf8'),
    fetch(`${baseUrl}/ui.js`).then((response) => response.text())
  ]);
  assert.match(home, /data-session-greeting/);
  assert.match(home, /data-session-display-name/);
  assert.match(ui, /fetch\('\/api\/session'/);
  assert.match(ui, /dataset\.sessionGreeting/);
  assert.match(ui, /body\.user && body\.user\.displayName/);
});

test('supporter detail error replaces loading title and localizes recovery action', async () => {
  const [supporter, i18n] = await Promise.all([
    fetch(`${baseUrl}/supporter.js`).then((response) => response.text()),
    fetch(`${baseUrl}/i18n.js`).then((response) => response.text())
  ]);
  assert.match(supporter, /function renderLoadError\(\)/);
  assert.match(supporter, /renderLoadError\(\);/);
  assert.match(supporter, /#person-name/);
  assert.match(i18n, /'Record unavailable':'無法開啟紀錄'/);
  assert.match(i18n, /'The selected demo record could not be loaded\.':'無法載入所選的展示紀錄。'/);
});

test('public role story stays within the document width without overflow masking', async () => {
  const css = await (await fetch(`${baseUrl}/public-site.css`)).text();
  assert.match(css, /\.supporter-world\{[^}]*margin:0;[^}]*padding:54px/);
  assert.doesNotMatch(css, /\.supporter-world\{[^}]*margin:0 -5vw/);
});

test('participant home gives the large card to today’s primary action', async () => {
  const home = await readFile(new URL('../public/participant-home.html', import.meta.url), 'utf8');
  assert.match(home, /<a class="portal-card wide soft-blue home-primary-card" href="\/app\/check-in">/);
  assert.match(home, /class="home-today-status"[\s\S]*No check-in yet/);
  assert.ok(home.indexOf('home-primary-card') < home.indexOf('id="week-count"'));
});

test('decision method summary is a real in-page navigation', async () => {
  const method = await readFile(new URL('../public/supporter-method.html', import.meta.url), 'utf8');
  for (const id of ['safety', 'fact', 'context', 'function', 'trial', 'result']) {
    assert.match(method, new RegExp(`href="#method-${id}"`));
    assert.match(method, new RegExp(`id="method-${id}"`));
  }
  assert.match(method, /<nav class="method-nav(?: [^"]*)?"/);
});

test('records page shows trends before record forms and tables', async () => {
  const records = await readFile(new URL('../public/participant-records.html', import.meta.url), 'utf8');
  assert.ok(records.indexOf('id="trend-charts"') < records.indexOf('id="vital-form"'));
  assert.ok(records.indexOf('id="feeling-chart"') < records.indexOf('id="vital-rows"'));
});

test('supporter assets share the current cache key and stale records offer recovery', async () => {
  const [person, dashboard, supporter] = await Promise.all([
    readFile(new URL('../public/supporter-person.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/supporter-dashboard.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/supporter.js', import.meta.url), 'utf8')
  ]);
  for (const html of [person, dashboard]) {
    assert.match(html, /portal\.css\?v=20260730b/);
    assert.match(html, /supporter\.js\?v=20260731d/);
  }
  assert.match(supporter, /function renderMissingRecordState\(/);
  assert.match(supporter, /Restart Alex demo/);
  assert.match(supporter, /record-density/);
});
