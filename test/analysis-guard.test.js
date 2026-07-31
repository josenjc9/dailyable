import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, keepIfSafe } from '../src/analysis-guard.js';

// 這支守門員在接 LLM 之前就要能擋。先用已知的壞例子校準，確定它抓得到，
// 再用該放行的例子確定它不亂擋——會誤擋的檢查最後會被關掉，關掉就等於沒有。

test('a diagnosis or condition name is thrown out', () => {
  const bad = [
    '從這幾天的紀錄看，可能是糖尿病控制的問題。',
    'These readings suggest hypertension.',
    '他的症狀顯示疑似憂鬱症。',
    'You have diabetes based on these numbers.'
  ];
  for (const text of bad) {
    assert.equal(inspect(text).ok, false, `should have been caught: ${text}`);
  }
});

test('turning a number into a threshold is thrown out', () => {
  const bad = [
    '收縮壓超過 140 mmHg 就要注意。',
    'Anything above 126 mg/dL is a concern.',
    '這已經超出正常值了。',
    'This is outside the normal range.'
  ];
  for (const text of bad) {
    assert.equal(inspect(text).ok, false, `should have been caught: ${text}`);
  }
});

// 這條是產品的核心主張——跟本人自己比，不跟別人比。踩了整個定位就垮。
test('comparing this person with anyone else is thrown out', () => {
  const bad = [
    '跟其他使用者相比，他的作息變化比較大。',
    'Compared with others of his age, this is unusual.',
    '同齡長者平均而言不會這樣。',
    'This is high for someone their age.'
  ];
  for (const text of bad) {
    assert.equal(inspect(text).ok, false, `should have been caught: ${text}`);
  }
});

test('ordering the person around, or judging them, is thrown out', () => {
  const bad = [
    '你應該立刻去看醫生。',
    'You must record this every day.',
    '他的血糖控制不佳。',
    'The patient is non-compliant.'
  ];
  for (const text of bad) {
    assert.equal(inspect(text).ok, false, `should have been caught: ${text}`);
  }
});

// 另一半的校準：該放行的要放行。只擋確定不行的，模稜兩可的留給判斷。
test('the analysis this product actually wants is let through', () => {
  const good = [
    `看到什麼：他最近五次回報裡有三次說作息跟平常不一樣，今天是連續第三次，大概從五天前開始。同一段時間飲水也比他自己平常少。
可能是什麼：看起來是早晨那一段變得比較難開始，而不是整天都受影響——下午跟晚上的紀錄是穩的。這個看法信心中等，依據的是生態系統理論。
可以怎麼做：先確認睡眠、藥物時間或家裡有沒有變動。可以試低刺激陪伴：先不問原因，讓他知道你在。`,
    `SEEN: Three of the last five check-ins mention a changed routine, and today makes three in a row.
MIGHT BE: The morning seems to be the part that has become hard, rather than the whole day. Moderate confidence.
TRY: Check whether sleep, medicine timing or the household changed. Then try a low-stimulation approach — be present without asking why.`,
    '今天跟他平常差不多，這幾天的紀錄是穩的。沒有什麼需要現在處理。'
  ];
  for (const text of good) {
    const verdict = inspect(text);
    assert.equal(verdict.ok, true, `should have been allowed: ${verdict.reasons.join(', ')}`);
  }
});

test('an empty or missing answer never reaches the page', () => {
  assert.equal(keepIfSafe(null), null);
  assert.equal(keepIfSafe({ text: '' }), null);
  assert.equal(keepIfSafe({ text: '   ' }), null);
  assert.equal(keepIfSafe({ text: '他可能有糖尿病。' }), null);
  assert.ok(keepIfSafe({ text: '今天的紀錄跟他平常差不多。' }));
});
