import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// Boss has had to correct the wording twice ("整體用詞要合理且日常，不要有奇怪的用詞及
// AI 味或程式用語"). Correcting it by hand each time does not make the next build better,
// so the rules that can be checked by machine are checked here.
//
// Deliberately narrow. This blocks only what is clearly wrong in text a participant reads;
// anything arguable is left to judgement, because a check that fires on reasonable copy
// gets switched off and then protects nothing.

const PUBLIC = new URL('../public/', import.meta.url);

// Words that belong to the people who build the thing, not the people who use it.
const ENGINEERING_WORDS = [
  '欄位', '參數', '模組', '渲染', '快取', '字串', '陣列', '物件',
  '初始化', '實例', '介面層', '後端', '前端', '資料表', '重新整理頁面'
];

// Phrasings that read as machine-written Chinese. From 00_控制台/戒AI味_檢查清單.
const AI_TASTE = [
  '賦能', '底層邏輯', '綜上所述', '值得一提', '一鍵直達', '極致',
  '打造專屬', '深度整合', '全方位', '無縫'
];

// 2026-07-29：這支原本只掃 HTML 的 data-zh，但整個支持者頁、回報結果、長照資源區、
// 首頁七天條、歷史表的文案全在 JS 裡用字串寫死——也就是說一整天新增的中文一個字都沒被檢查。
// 現在兩邊都掃。程式碼裡的中文註解不算（那是寫給自己看的），只取字串常值。
const SOURCES = [
  { dir: PUBLIC, ext: '.html', pick: /data-zh="([^"]+)"/g },
  { dir: PUBLIC, ext: '.js', pick: /'([^'\\\n]*[一-鿿][^'\\\n]*)'/g },
  { dir: new URL('../src/', import.meta.url), ext: '.js', pick: /'([^'\\\n]*[一-鿿][^'\\\n]*)'/g }
];

// 註解行不掃。care-knowledge.js 有大量寫給維護者看的中文說明，那些不是使用者讀的字。
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

async function participantFacingStrings() {
  const found = [];
  for (const source of SOURCES) {
    const files = (await readdir(source.dir)).filter((name) => name.endsWith(source.ext));
    for (const file of files) {
      const body = await readFile(new URL(file, source.dir), 'utf8');
      for (const line of body.split('\n')) {
        if (isComment(line)) continue;
        for (const match of line.matchAll(source.pick)) {
          found.push({ file, text: match[1] });
        }
      }
    }
  }
  return found;
}

test('participant-facing Chinese avoids words that belong to the builders', async () => {
  const strings = await participantFacingStrings();
  assert.ok(strings.length > 50, 'the scan should be finding the site copy');

  const offenders = [];
  for (const { file, text } of strings) {
    for (const word of ENGINEERING_WORDS) {
      if (text.includes(word)) offenders.push(`${file}: “${text}” — ${word}`);
    }
  }
  assert.deepEqual(offenders, [], `engineering vocabulary in copy people read:\n${offenders.join('\n')}`);
});

test('participant-facing Chinese avoids machine-written phrasing', async () => {
  const strings = await participantFacingStrings();
  const offenders = [];
  for (const { file, text } of strings) {
    for (const phrase of AI_TASTE) {
      if (text.includes(phrase)) offenders.push(`${file}: “${text}” — ${phrase}`);
    }
  }
  assert.deepEqual(offenders, [], `AI-flavoured phrasing:\n${offenders.join('\n')}`);
});

// 「不是X，是Y」是 Boss 標最兇的一個句型（戒AI味清單，三個 agent 共用標準）。
// Discord 那邊有 hook 擋我的訊息，產品文案沒有——我今天就在支持者頁寫了
// 「這不是把他丟下，是讓你撐得久」，靠 hook 擋 Discord 訊息時才順帶發現。
// 產品文案不該比聊天訊息寬鬆。
test('participant-facing Chinese does not lean on the “not X, but Y” frame', async () => {
  const strings = await participantFacingStrings();
  const frame = /不是[^，。！？]{1,14}，(?:而)?是[^，。！？]/;
  const offenders = strings
    .filter(({ text }) => frame.test(text))
    .map(({ file, text }) => `${file}: “${text}”`);
  assert.deepEqual(offenders, [],
    `這個句型直接描述就好，不要對比：\n${offenders.join('\n')}`);
});

// 校準：確認上面那條真的抓得到，而不是因為正則寫壞了永遠不叫。
test('the “not X, but Y” check would catch a real example', () => {
  const frame = /不是[^，。！？]{1,14}，(?:而)?是[^，。！？]/;
  assert.ok(frame.test('撐不住的時候先照顧自己，這不是把他丟下，是讓你撐得久。'),
    '這正是 2026-07-29 寫出來又改掉的那句，抓不到就代表這條檢查是擺設');
  assert.ok(!frame.test('空白代表那天沒有記，不是量到零。'),
    '單純的否定不該被誤判——會亂叫的檢查最後只會被關掉');
});

// Every visible string carries both languages, or the toggle silently leaves it behind.
// This is how the session panel ended up frozen in whichever language loaded first.
test('every translated string carries both languages', async () => {
  const files = (await readdir(PUBLIC)).filter((name) => name.endsWith('.html'));
  const offenders = [];
  for (const file of files) {
    const html = await readFile(new URL(file, PUBLIC), 'utf8');
    const en = (html.match(/data-en="/g) || []).length;
    const zh = (html.match(/data-zh="/g) || []).length;
    if (en !== zh) offenders.push(`${file}: ${en} English vs ${zh} Chinese`);
  }
  assert.deepEqual(offenders, [], `strings translated on one side only:\n${offenders.join('\n')}`);
});

// The check above counts tagged pairs, so it sees a string translated on one side only and
// misses the sentence carrying neither tag. Those rely on the dictionary in i18n.js, matched
// on the exact English wording — and when a page is reworded afterwards the key stops
// matching. Nothing reports it: the sentence simply stays in English next to its translated
// neighbours. Three of them were sitting in the middle of the Chinese check-in, on the page a
// participant uses first. Covers the markup; strings built in JavaScript are not visible here.
const VOID_TAGS = new Set([
  'br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'path', 'circle', 'rect',
  'use', 'area', 'col', 'embed', 'track', 'wbr'
]);

// Names, units and the product itself stay in English in both languages.
const STAYS_ENGLISH = new Set([
  'DailyAble', 'Alex', 'Jordan',
  'DailyAble home', 'mmHg', 'bpm', 'mg/dL', 'DEMO DATA', 'English', 'SDG'
]);

function untaggedVisibleText(html) {
  const start = html.indexOf('<body');
  const body = (start === -1 ? html : html.slice(start))
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
  const found = [];
  const stack = [];
  let covered = 0;
  let last = 0;
  let match;
  const tag = /<(\/?)([a-zA-Z0-9-]+)([^>]*?)(\/?)>/g;
  while ((match = tag.exec(body))) {
    const text = body.slice(last, match.index).replace(/\s+/g, ' ').trim();
    last = tag.lastIndex;
    if (!covered && text) found.push(text);
    const [, closing, name, attributes, selfClosing] = match;
    if (closing) {
      if (stack.pop()?.covers) covered -= 1;
      continue;
    }
    if (VOID_TAGS.has(name.toLowerCase()) || selfClosing) continue;
    const covers = (/\bdata-en=/.test(attributes) && /\bdata-zh=/.test(attributes)) || /\bdata-i18n-ignore=/.test(attributes);
    if (covers) covered += 1;
    stack.push({ covers });
  }
  return found;
}

// 官方區間的原文是中文的。整段照搬到英文介面上，讀者看到的是一半英文一半中文——
// 這在一個要送國際賽的原型上是硬傷。每一句引述都要兩種語言各一份。
test('every published range can be read in the language the reader chose', async () => {
  const reference = await import('../src/reference-ranges.js');
  const quotes = [];
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if ('quote' in value) quotes.push(value.quote);
    for (const nested of Object.values(value)) collect(nested);
  };
  for (const exported of Object.values(reference)) collect(exported);

  assert.ok(quotes.length >= 5, `expected the published quotes, found ${quotes.length}`);
  for (const quote of quotes) {
    if (quote === null) continue;
    assert.equal(typeof quote, 'object', `a quote must carry both languages, got: ${quote}`);
    assert.ok(quote.zh && quote.en, `both languages are required: ${JSON.stringify(quote)}`);
    assert.doesNotMatch(quote.en, /[一-鿿]/, `the English quote must not contain Chinese: ${quote.en}`);
  }
});

test('a sentence with no translation tag can still be said in Chinese', async () => {
  const source = await readFile(new URL('i18n.js', PUBLIC), 'utf8');
  const dictionary = source.slice(source.indexOf('const zh = {'), source.indexOf('const reverse'));
  const keys = new Set([...dictionary.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)].map((entry) => entry[1]));
  assert.ok(keys.size > 200, `expected the translation dictionary, found ${keys.size} entries`);

  const files = (await readdir(PUBLIC)).filter((name) => name.endsWith('.html'));
  const stranded = [];
  for (const file of files) {
    for (const text of untaggedVisibleText(await readFile(new URL(file, PUBLIC), 'utf8'))) {
      if (!/[A-Za-z]{4,}/.test(text)) continue;
      if (STAYS_ENGLISH.has(text) || keys.has(text)) continue;
      stranded.push(`${file}: ${JSON.stringify(text.slice(0, 90))}`);
    }
  }
  assert.deepEqual(stranded, [], `these stay in English when the page is in Chinese:\n${stranded.join('\n')}`);
});
