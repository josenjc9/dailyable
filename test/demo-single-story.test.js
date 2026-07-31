import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const RETIRED_DEMO_PEOPLE = /\b(?:Maya|Mei|Sam)\b/;
const SUPPORTER_ROLE_COLLISIONS = /Jordan (?:wants help preparing|marked two records|wants help organizing questions|selects the final two questions|and let Jordan choose the final questions|一起看就診摘要，最後要問哪幾題讓 Jordan 自己決定)/;
const STORY_ASSET_VERSIONS = {
  'public-site.css': '20260730a',
  'portal.css': '20260730b',
  'v3.css': '20260731f',
  'i18n.js': '20260731a',
  'app.js': '20260731c',
  'participant-support.js': '20260731a',
  'supporter.js': '20260731d',
  'summary-client.js': '20260731a'
};

let server;
let baseUrl;

test.before(async () => {
  server = await startServer(0, { enforcePageAuth: true });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

function demoCookie(response) {
  const raw = response.headers.get('set-cookie') || '';
  const match = raw.match(/dailyable_demo=([^;]*)/);
  return match ? `dailyable_demo=${match[1]}` : '';
}

async function shippedTextFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await shippedTextFiles(path));
    else if (/\.(?:html|js)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test('every shipped interface and runtime asset uses only Alex and Jordan for the demo story', async () => {
  for (const directory of [PUBLIC, SRC]) {
    for (const path of await shippedTextFiles(directory)) {
      const source = await readFile(path, 'utf8');
      assert.doesNotMatch(source, RETIRED_DEMO_PEOPLE, `${path} still ships a retired demo person`);
      assert.doesNotMatch(source, SUPPORTER_ROLE_COLLISIONS, `${path} still casts Jordan as a participant`);
    }
  }
});

test('updated story assets use a fresh cache version on every page that loads them', async () => {
  const htmlPaths = (await shippedTextFiles(PUBLIC)).filter((path) => path.endsWith('.html'));

  for (const path of htmlPaths) {
    const source = await readFile(path, 'utf8');
    for (const [asset, version] of Object.entries(STORY_ASSET_VERSIONS)) {
      if (!source.includes(`${asset}?v=`)) continue;
      assert.ok(
        source.includes(`${asset}?v=${version}`),
        `${path} still points ${asset} at a stale browser cache key`
      );
    }
  }
});

test('the demo API uses one canonical name for each side of the pair', async () => {
  const state = await (await fetch(`${baseUrl}/api/demo/state`)).json();
  assert.deepEqual(state.people.map(({ id, role, displayName }) => ({ id, role, displayName })), [
    { id: 'alex', role: 'participant', displayName: 'Alex' },
    { id: 'jordan', role: 'supporter', displayName: 'Jordan' }
  ]);

  const participant = demoCookie(await fetch(`${baseUrl}/demo/enter?persona=alex`, { redirect: 'manual' }));
  const supporter = demoCookie(await fetch(`${baseUrl}/demo/enter?persona=jordan`, { redirect: 'manual' }));
  const participantRelationships = await (await fetch(`${baseUrl}/api/pairing/relationships`, { headers: { cookie: participant } })).json();
  const supporterRelationships = await (await fetch(`${baseUrl}/api/pairing/relationships`, { headers: { cookie: supporter } })).json();
  assert.equal(participantRelationships.relationships[0].otherPartyName, 'Jordan');
  assert.equal(supporterRelationships.relationships[0].otherPartyName, 'Alex');

  const queue = await (await fetch(`${baseUrl}/api/supporter/queue`, { headers: { cookie: supporter } })).json();
  assert.deepEqual(queue.items.map(({ id, name }) => ({ id, name })), [{ id: 'alex-01', name: 'Alex' }]);
});

test('a completed Alex check-in offers only Jordan as the human follow-up', async () => {
  const response = await fetch(`${baseUrl}/api/check-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      energy: 'very-low',
      routine: 'off-track',
      concern: 'need-help',
      supportChoice: 'supporter'
    })
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.supporterOption?.label, 'Ask Jordan to check in');
  assert.doesNotMatch(JSON.stringify(result), RETIRED_DEMO_PEOPLE);
});

test('the reviewer entrance explains one closed loop before either role is opened', async () => {
  const html = await (await fetch(`${baseUrl}/demo`)).text();
  assert.match(html, /data-reviewer-flow/);
  assert.match(html, /Alex completes today’s check-in/);
  assert.match(html, /Alex chooses what Jordan may receive/);
  assert.match(html, /Jordan reviews Alex’s request/);
  assert.match(html, /Jordan records the agreed follow-up/);
});

test('both role homes state their part in the same Alex and Jordan story', async () => {
  const participant = await readFile(new URL('../public/participant-home.html', import.meta.url), 'utf8');
  const supporter = await readFile(new URL('../public/supporter-dashboard.html', import.meta.url), 'utf8');
  assert.match(participant, /data-demo-story="participant"[\s\S]*Alex[\s\S]*Jordan/);
  assert.match(supporter, /data-demo-story="supporter"[\s\S]*Jordan[\s\S]*Alex/);
});

test('Alex support page renders Jordan follow-up from a participant-safe endpoint', async () => {
  const html = await readFile(new URL('../public/participant-support.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/participant-support.js', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(html, /id="support-update-status"[^>]*aria-live="polite"/);
  assert.match(html, /participant-support\.js\?v=20260731a/);
  const asset = await fetch(`${baseUrl}/participant-support.js?v=20260731a`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type') || '', /javascript/);
  assert.match(source, /fetch\('\/api\/participant\/support-status'/);
  assert.match(source, /AbortController/);
  assert.match(source, /textContent\s*=/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.match(source, /dailyable:languagechange/);
  assert.match(packageJson.scripts.check, /node --check public\/participant-support\.js/);
});

test('Alex final confirmation calls the sharing endpoint instead of changing UI only', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /\/api\/check-ins\/\$\{encodeURIComponent\(currentSupport\.checkInId\)\}\/share/);
  assert.match(source, /relationshipId:\s*'demo-rel-1'/);
  assert.match(source, /x-csrf-token/);
  assert.match(source, /AbortController/);
  assert.match(source, /currentSupport\.shareConfirmed\s*=\s*true/);
  assert.match(source, /Nothing was sent/);
});

test('support and clinical authority stay explicitly separated', async () => {
  const html = await readFile(new URL('../public/supporter-method.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /Supporters and qualified professionals make support and clinical decisions/);
  assert.match(html, /Participants choose sharing and their support goals\. Supporters carry out agreed support decisions\. Qualified professionals make clinical decisions\./);
  assert.match(html, /本人決定分享範圍與支持目標；支持者執行雙方同意的支持安排；臨床判斷由合格專業人員負責。/);
});

test('each check-in step advances only through the explicit Continue action', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /form\.addEventListener\('change'/);
  assert.match(source, /nextButton\.addEventListener\('click'[\s\S]*current \+= 1;[\s\S]*renderStep\(\);/);
});
