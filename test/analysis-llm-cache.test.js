import test from 'node:test';
import assert from 'node:assert/strict';

test('LLM cache separates changed observations while reusing an identical request', async (t) => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalCap = process.env.DAILYABLE_LLM_DAILY_CAP;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'x';
  process.env.DAILYABLE_LLM_DAILY_CAP = '10';

  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    const request = JSON.parse(options.body);
    const prompt = JSON.parse(request.messages[1].content);
    const marker = prompt.facts[0].what.match(/\d+/)?.[0] || 'missing';
    return {
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: `SEEN: The latest record is ${marker}.\nMIGHT BE: The morning pattern may have changed.\nTRY: Ask what felt different today.`
            }
          }]
        };
      }
    };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalCap === undefined) delete process.env.DAILYABLE_LLM_DAILY_CAP;
    else process.env.DAILYABLE_LLM_DAILY_CAP = originalCap;
  });

  const moduleUrl = new URL('../src/analysis-llm.js', import.meta.url);
  moduleUrl.searchParams.set('cache-regression', String(Date.now()));
  const { analyse } = await import(moduleUrl.href);

  const fact = (value) => ({
    id: 'systolic-shift',
    zh: `最近一次紀錄是 ${value}。`,
    en: `The latest record is ${value}.`,
    streak: 3,
    direction: 'up'
  });
  const knowledge = {
    phrases: [{ title: 'Ask first', say: 'Ask what changed.', avoid: 'Do not assume.' }],
    approaches: [{ title: 'One small step', purpose: 'Reduce load.', steps: ['Offer one choice.'] }],
    theories: [{ title: 'Daily context', plain: 'Look at what changed around the person.' }]
  };

  const first = await analyse({ facts: [fact(111)], knowledge, language: 'en' });
  const changed = await analyse({ facts: [fact(222)], knowledge, language: 'en' });
  const repeated = await analyse({ facts: [fact(222)], knowledge, language: 'en' });
  const changedKnowledge = {
    ...knowledge,
    phrases: [{ ...knowledge.phrases[0], say: 'Ask what helped instead.' }]
  };
  const guidanceChanged = await analyse({ facts: [fact(222)], knowledge: changedKnowledge, language: 'en' });

  assert.equal(first.cached, false);
  assert.equal(changed.cached, false, 'changed observation content must not reuse another person’s analysis');
  assert.match(changed.text, /222/);
  assert.doesNotMatch(changed.text, /111/);
  assert.equal(repeated.cached, true, 'an identical model request should still reuse its result');
  assert.equal(guidanceChanged.cached, false, 'changed knowledge content must produce a separate analysis');
  assert.equal(calls, 3);
});
