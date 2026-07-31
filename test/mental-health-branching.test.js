import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDailySupport, observationsFrom } from '../src/support-engine.js';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

const baseline = {
  energy: 'steady',
  mood: 'okay',
  sleep: 'restorative',
  nourishment: 'usual',
  taskLoad: 'manageable',
  thinking: 'usual',
  helpRoute: 'self'
};

test('daily check-in has seven core decision questions and no more than three adaptive questions', async () => {
  const html = await read('public/participant-check-in.html');
  const core = html.match(/<fieldset class="step/g) || [];
  assert.equal(core.length, 8, 'seven required steps plus one optional records step');
  assert.match(html, /data-optional="true"[^>]*data-record-step="true"/);
  assert.match(html, /name="mood"/);
  assert.match(html, /name="thinking"/);
  assert.match(html, /data-adaptive-domain="mood-duration"/);
  assert.match(html, /data-adaptive-domain="mood-safety"/);
  assert.match(html, /data-adaptive-domain="memory"/);
  assert.match(html, /data-adaptive-domain="perception"/);
  assert.match(html, /at most three extra questions/i);
});

test('adaptive routing is deterministic, optional, and does not auto-share', async () => {
  const [js, html] = await Promise.all([read('public/app.js'), read('public/participant-check-in.html')]);
  assert.match(js, /function adaptiveDomains/);
  assert.match(js, /mood === 'very-low'/);
  assert.match(js, /thinking === 'forgetful'/);
  assert.match(js, /thinking === 'perception'/);
  assert.match(js, /slice\(0, 3\)/);
  assert.match(html, /Skip for now/);
  assert.doesNotMatch(js, /adaptive[^\n]{0,80}shareCheckIn\(/i);
});

test('official source links are presented without claiming embedded government scales', async () => {
  const html = await read('public/participant-check-in.html');
  assert.match(html, /health99\.hpa\.gov\.tw\/onlineQuiz\/bsrs5/);
  assert.match(html, /hpa\.gov\.tw\/Pages\/Detail\.aspx\?nodeid=871&amp;pid=8018/);
  assert.match(html, /nant\.mohw\.gov\.tw/);
  assert.match(html, /not a diagnosis/i);
  assert.doesNotMatch(html, /AD8[^<]{0,80}(question|score)/i);
});

test('self-harm or harm-command responses always enter a fixed human safety route', () => {
  const urgentInputs = [
    { ...baseline, mood: 'very-low', moodDuration: 'week-plus', selfHarmThoughts: 'yes' },
    { ...baseline, thinking: 'perception', perceptionSafety: 'harm-command' }
  ];
  for (const input of urgentInputs) {
    const result = createDailySupport(input, {}, Date.now());
    assert.equal(result.level, 'urgent');
    assert.match(result.ruleId, /SAFETY-/);
    assert.equal(result.aiMayOverride, false);
    assert.match(result.nextSteps.join(' '), /119|110/);
    assert.match(result.nextSteps.join(' '), /1925/);
    assert.ok(result.officialResource?.url);
  }
});

test('mental-health observations work for persisted nested input records', () => {
  const now = Date.now();
  const history = {
    checkIns: [0, 1, 2].map((days) => ({
      createdAt: new Date(now - days * 86400000).toISOString(),
      input: { energy: 'steady', routine: 'on-track', mood: days < 2 ? 'low' : 'okay', thinking: days < 2 ? 'forgetful' : 'usual' }
    }))
  };
  const basis = observationsFrom(history, now);
  assert.equal(basis.enough, true);
  assert.ok(basis.observations.some((item) => item.id === 'mood-run'));
  assert.ok(basis.observations.some((item) => item.id === 'thinking-run'));
});

test('non-urgent mood, memory, and perception signals enter explainable support recommendations', () => {
  const cases = [
    { input: { ...baseline, mood: 'very-low', moodDuration: 'several-days', selfHarmThoughts: 'no' }, rule: /MENTAL-MOOD/ },
    { input: { ...baseline, thinking: 'forgetful', memoryImpact: 'daily-impact' }, rule: /MENTAL-MEMORY/ },
    { input: { ...baseline, thinking: 'perception', perceptionSafety: 'distressing' }, rule: /MENTAL-PERCEPTION/ }
  ];
  for (const item of cases) {
    const result = createDailySupport(item.input, {}, Date.now());
    assert.match(result.ruleId, item.rule);
    assert.equal(result.aiMayOverride, false);
    assert.match(result.reason, /reported|selected/i);
    assert.ok(result.officialResource?.url);
  }
  assert.equal(
    createDailySupport({ ...baseline, mood: 'very-low', thinking: 'forgetful', selfHarmThoughts: 'no' }, {}).ruleId,
    'MENTAL-MOOD-01'
  );
});
