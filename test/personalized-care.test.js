import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDailySupport } from '../src/support-engine.js';

const baseline = {
  energy: 'steady', mood: 'okay', sleep: 'restorative', nourishment: 'usual',
  taskLoad: 'manageable', thinking: 'usual', helpRoute: 'self',
  moodDuration: 'not-asked', selfHarmThoughts: 'not-asked', memoryImpact: 'not-asked', perceptionSafety: 'not-asked'
};

function care(input) {
  return createDailySupport(input, {}).encouragement;
}

test('every daily result includes bilingual acknowledgement and care', () => {
  const message = care(baseline);
  assert.ok(message?.en);
  assert.ok(message?.zh);
  assert.doesNotMatch(`${message.en} ${message.zh}`, /diagnos|cure|治癒|診斷|乖|應該振作/i);
});

test('changing each core answer changes the acknowledgement', () => {
  const original = care(baseline).zh;
  const variants = [
    { energy: 'low' },
    { mood: 'low' },
    { sleep: 'interrupted' },
    { nourishment: 'less' },
    { taskLoad: 'harder' },
    { thinking: 'forgetful' },
    { helpRoute: 'supporter' }
  ];
  for (const change of variants) {
    const message = care({ ...baseline, ...change });
    assert.notEqual(message.zh, original, `answer ${Object.keys(change)[0]} must change the care message`);
  }
});

test('multiple answers are reflected together instead of only naming one branch', () => {
  const message = care({
    ...baseline,
    energy: 'very-low', mood: 'very-low', sleep: 'very-little', nourishment: 'missed', taskLoad: 'stuck',
    thinking: 'forgetful', selfHarmThoughts: 'no', memoryImpact: 'recent'
  });
  assert.match(message.zh, /精神/);
  assert.match(message.zh, /心情/);
  assert.match(message.zh, /睡眠/);
  assert.match(message.zh, /吃|喝/);
  assert.match(message.zh, /開始/);
  assert.match(message.zh, /記憶/);
});

test('result renderer writes every next step into the result list', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /const resultSteps = document\.querySelector\('#result-steps'\)/);
  assert.match(app, /replaceContent\(resultSteps, support\.nextSteps\.map/);
  assert.doesNotMatch(app, /replaceContent\(list, support\.nextSteps\.map/);
});

test('urgent results keep encouragement short and direct people to human support', () => {
  const result = createDailySupport({ ...baseline, mood: 'very-low', selfHarmThoughts: 'yes' }, {});
  assert.equal(result.level, 'urgent');
  assert.match(result.encouragement.zh, /真人|身邊的人/);
  assert.ok(result.encouragement.zh.length < 70);
});
