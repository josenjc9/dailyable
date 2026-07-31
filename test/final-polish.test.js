import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readPublic = (name) => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');
const readSource = (name) => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('supporter secondary records request cannot remain loading forever', async () => {
  const source = await readPublic('supporter.js');
  assert.match(source, /async function fetchWithRetry/);
  assert.match(source, /RECORD_TIMEOUT_MS/);
  assert.match(source, /loadBodyRecords[\s\S]*fetchWithRetry/);
  assert.match(source, /Retry loading trend/);
});

test('visit summary includes a printable 90-day trend with safe A4 edges', async () => {
  const html = await readPublic('participant-summary.html');
  const client = await readPublic('summary-client.js');
  const css = await readPublic('v3.css');
  const server = await readSource('server.js');
  assert.match(html, /id="summary-trend"/);
  assert.match(html, /trends\.js\?v=/);
  assert.match(client, /DailyAbleTrends\.draw\([^)]*90/);
  assert.match(server, /summary:[\s\S]*series: vitals/);
  assert.match(css, /@page\{size:A4;margin:18mm/);
  assert.match(css, /\.summary-trend-card \.trend-chart>svg\{[^}]*height:38mm/);
  assert.doesNotMatch(css, /\.summary-trend-card svg\{[^}]*height:38mm/);
  assert.match(css, /\.summary-print-sheet/);
});

test('daily check-in uses eight deliberate steps and keeps explicit Continue', async () => {
  const html = await readPublic('participant-check-in.html');
  const app = await readPublic('app.js');
  const engine = await readSource('support-engine.js');
  assert.equal((html.match(/<fieldset class="step/g) || []).length, 8);
  for (const field of ['sleep', 'nourishment', 'taskLoad']) {
    assert.match(html, new RegExp(`name="${field}"`));
    assert.match(engine, new RegExp(`${field}: new Set`));
    assert.match(app, new RegExp(field));
  }
  assert.doesNotMatch(app, /radio[\s\S]{0,80}change[\s\S]{0,80}renderStep/);
});

test('supporter method contains executable prompts, evidence and recording fields', async () => {
  const html = await readPublic('supporter-method.html');
  for (const marker of ['method-decision-table', 'method-question-bank', 'method-record-template', 'What would make the next two hours easier?']) {
    assert.match(html, new RegExp(marker));
  }
});

test('supporter shape-only trend labels normalized points as a relative index', async () => {
  const supporter = await readPublic('supporter.js');
  const trends = await readPublic('trends.js');
  assert.match(supporter, /DailyAbleTrends\.draw\(chartHost, sharedSeries, 30,[\s\S]{0,100}relativeIndex:/);
  assert.match(trends, /relativeIndex/);
  assert.match(trends, /Relative index/);
  assert.match(trends, /相對指標/);
});

test('home uses the warmer professional promise', async () => {
  const html = await readPublic('index.html');
  assert.match(html, /Small signals\. Timely support\. More room to live your day\./);
  assert.match(html, /看見日常的小變化，讓支持在需要時剛好抵達。/);
});
