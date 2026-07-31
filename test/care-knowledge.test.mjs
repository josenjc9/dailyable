import test from 'node:test';
import assert from 'node:assert/strict';
import { careFor, CARE_ENTRIES, HELPLINES, LTC_ELIGIBILITY, LTC_BENEFITS, ATTRIBUTION } from '../src/care-knowledge.js';

// 這幾條守的是「引用官方資料」這件事本身。抄錯一個數字、寫錯一次服務時間，
// 就會有人在週日晚上抱著期待打 1966。

test('every quoted line carries a source and a date', () => {
  for (const entry of CARE_ENTRIES) {
    assert.ok(entry.quotes.length > 0, `${entry.id} 沒有任何引用`);
    for (const quote of [...entry.quotes, entry.caution, entry.whenToSeek].filter(Boolean)) {
      assert.ok(quote.source?.url?.includes('.gov.tw'),
        `${entry.id} 有一條引用的出處不是 .gov.tw：${quote.text?.slice(0, 30)}`);
      assert.ok(quote.source?.checked, `${entry.id} 有一條引用沒有查證日期`);
      assert.ok(quote.source?.org, `${entry.id} 有一條引用沒有寫是哪個機關`);
    }
  }
});

test('the 1966 line is not described as free or round the clock', () => {
  const line = HELPLINES.find((h) => h.id === 'ltc-1966');
  assert.ok(line.quote.includes('前5min免付費'), '1966 的免費說明必須照抄官方原文');
  assert.ok(line.hours.includes('週一至週五'), '1966 不是 24 小時服務，時段要寫出來');
  const text = JSON.stringify(line);
  assert.ok(!text.includes('24 小時') && !text.includes('24小時'),
    '不能把 1966 寫成 24 小時專線');
  assert.ok(!/免費專線|全程免費/.test(text), '不能把 1966 寫成全程免費');
});

test('no benefit amount is shown, because the official figures conflict', () => {
  // 查證時輔具額度有 4 萬與 6 萬兩種互相矛盾的官方說法，未確認前不顯示。
  const everything = JSON.stringify([CARE_ENTRIES, LTC_ELIGIBILITY, LTC_BENEFITS]);
  assert.ok(!/[0-9]萬元|[0-9,]+ ?元/.test(everything),
    '不該出現任何給付金額——官方說法尚未一致，實際額度也以縣市核定為準');
});

test('the care levels are not relabelled as mild or severe', () => {
  // 衛福部只公布各級額度，沒有公布「第幾級＝輕度／重度」的文字定義。
  const text = JSON.stringify(LTC_ELIGIBILITY);
  for (const invented of ['輕度', '中度', '重度', '極重度']) {
    assert.ok(!text.includes(invented),
      `不能自己給等級貼「${invented}」的標籤，官方沒有公布這個對照`);
  }
});

test('caregiving material does not reach the person being cared for', () => {
  // 翻身、壓瘡照護是寫給照顧者的。端給臥床的本人看沒有意義，還很傷人。
  const forParticipant = CARE_ENTRIES.filter((e) => e.audience === 'participant');
  const text = JSON.stringify(forParticipant);
  for (const word of ['翻身', '病患', '患者採取', '照顧者如不懂']) {
    assert.ok(!text.includes(word), `本人這一側出現了「${word}」——那是寫給照顧者的`);
  }
});

test('it only speaks when an observation actually matches', () => {
  assert.equal(careFor([], 'participant').enough, false);
  assert.deepEqual(careFor([], 'participant').entries, []);

  const water = careFor([{ id: 'waterMl-shift' }], 'participant');
  assert.ok(water.enough);
  assert.ok(water.entries.some((e) => e.id === 'water-intake'));
});

test('the kidney caution always travels with the water advice', () => {
  // 腎臟病患者照一般建議喝水是會出事的，所以這兩件事不能拆開。
  const entry = CARE_ENTRIES.find((e) => e.id === 'water-intake');
  assert.ok(entry.caution?.text.includes('腎臟'), '喝水那條一定要帶著腎臟病的提醒');
});

test('the person and their supporter get material aimed at each of them', () => {
  const signals = [{ id: 'routine-run' }, { id: 'energy-run' }];
  const mine = careFor(signals, 'participant');
  const theirs = careFor(signals, 'supporter');
  assert.ok(mine.enough && theirs.enough);
  const carerLoad = theirs.entries.some((e) => e.id === 'carer-load');
  assert.ok(carerLoad, '支持者應該看得到照顧者負荷那一條');
  assert.ok(!mine.entries.some((e) => e.id === 'carer-load'),
    '照顧者負荷那條不該出現在本人的畫面上');
});

test('titles are translated but the quoted official text never is', () => {
  const result = careFor([{ id: 'waterMl-shift' }], 'participant');
  const entry = result.entries[0];
  assert.ok(entry.titleEn, '標題要有英文版，不然英文介面下整段是中文');
  assert.ok(!/[一-鿿]/.test(entry.titleEn), '英文標題裡不該還留著中文');
  for (const quote of entry.quotes) {
    assert.ok(/[一-鿿]/.test(quote.text),
      '引號裡是官方原文，翻譯它等於改寫它，出處就對不上了');
    assert.ok(quote.source.orgEn, '機關名要有英譯，畫面才不用自己查表');
  }
});

// Boss 2026-07-29：語句要符合心理學、專業且溫暖。
// 這批使用者是慢性病患、獨居者、老弱與照顧他們的人。嚇他們沒有任何好處——
// 一個被自己的紀錄嚇到的人，下一步是不再記錄，那產品就沒了。
test('the headings do not frighten or blame the person reading them', () => {
  const alarming = ['危險', '警告', '嚴重', '惡化', '風險高', '小心', '注意！'];
  const blaming = ['你應該', '你沒有', '早該', '為什麼不', '務必'];
  for (const entry of CARE_ENTRIES) {
    for (const word of [...alarming, ...blaming]) {
      assert.ok(!entry.title.includes(word),
        `「${entry.title}」出現了「${word}」——標題是他打開手機第一眼看到的字`);
    }
    assert.ok(entry.titleEn, `${entry.id} 缺英文標題`);
  }
});

test('every heading opens with something other than a hazard', () => {
  // 正常化優先：先讓他知道這件事很常見、看得出來、處理得了，再給官方原文。
  // 這是刻意的取捨——把數字放前面比較有衝擊力，但衝擊力不是我們要的東西。
  const normalising = ['常見', '不是唯一', '比你想的多', '看得出來', '可以慢慢', '最熟悉'];
  const soft = CARE_ENTRIES.filter((entry) =>
    normalising.some((word) => entry.title.includes(word)));
  assert.ok(soft.length >= CARE_ENTRIES.length - 1,
    `只有 ${soft.length}/${CARE_ENTRIES.length} 個標題是正常化的寫法，其餘讀起來會像警告`);
});

test('everything the resources page shows exists in both languages', () => {
  // 這一區整個由 JS 畫，i18n 的 DOM 掃描碰不到它，所以雙語得自己備齊。
  // 缺一半的症狀是中文介面下半區突然變英文。
  for (const benefit of LTC_BENEFITS) {
    assert.ok(benefit.zh && benefit.en, `${benefit.id} 缺中文或英文名稱`);
    assert.ok(benefit.plain && benefit.plainEn, `${benefit.id} 缺中文或英文說明`);
  }
  for (const who of LTC_ELIGIBILITY.who) {
    assert.ok(who.zh && who.en, '資格條件每一列都要有中英文');
  }
  assert.ok(LTC_ELIGIBILITY.levels && LTC_ELIGIBILITY.levelsEn);
});

test('the licence attribution is present in both languages', () => {
  assert.ok(ATTRIBUTION.zh.includes('政府資料開放授權條款'));
  assert.ok(ATTRIBUTION.en.includes('Open Government Data License'));
  assert.ok(ATTRIBUTION.licenseUrl.startsWith('https://'));
  // 條款要求註明出處，這是條款要求不是禮貌
  assert.ok(ATTRIBUTION.zh.includes('1966'), '要讓人知道緊急時打哪支電話');
});
