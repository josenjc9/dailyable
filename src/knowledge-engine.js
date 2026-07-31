// 把庇護與就服知識系統接到本人的實際狀況上。
//
// 為什麼不是純向量檢索：這份知識庫每一篇本來就有固定欄位（適用狀態、適用障別、風險等級、
// 話術內容、禁忌做法、理論基礎…），結構化查詢比語意相似度準得多，而且說得出「為什麼是
// 這一篇」——對一個要交代依據的產品來說，可解釋比召回率重要。
//
// 這一層只負責「找出相關的知識」，不負責寫成句子。寫句子是 LLM 的事，而 LLM 只能從這裡
// 拿到的東西裡面選，不能自己發明理論。

import knowledge from './knowledge-base.json' with { type: 'json' };

const ENTRIES = knowledge.entries || [];

// 觀察到的狀態 → 知識庫裡的用語。左邊是產品算得出來的事實，右邊是知識庫描述狀態的詞彙。
// 這張表是人工對照的，因為兩邊的詞彙本來就不同——引擎說「作息連續三次不同」，
// 知識庫說「退縮」「動機低落」。中間這一層要有人負責，不能交給模型猜。
const SIGNAL_TO_STATE = {
  'routine-run': ['退縮', '動機低落', '結構鬆散', '生活作息', '拖延'],
  'energy-run': ['退縮', '動機低落', '無力', '疲憊', '憂鬱'],
  'asked-for-help': ['求助', '主動', '關係修復', '信任'],
  'routine-building': ['惡化', '壓力累積', '負荷'],
  'routine-easing': ['恢復', '小成就', '正增強'],
  'reading-shift': ['身體', '生理', '不適'],
  'immediate-danger': ['自傷', '他傷', '危機', '立即']
};

function scoreEntry(entry, wanted) {
  const haystack = [
    entry.title,
    entry.fields['適用狀態'] || '',
    entry.fields['可解釋的個案現象'] || '',
    entry.fields['適用障別'] || '',
    entry.body || ''
  ].join(' ');
  let score = 0;
  for (const word of wanted) {
    if (!word) continue;
    if (entry.title.includes(word)) score += 3;          // 標題命中最強
    if ((entry.fields['適用狀態'] || '').includes(word)) score += 2;
    else if (haystack.includes(word)) score += 1;
  }
  return score;
}

// 安全永遠優先，而且走的是固定路徑——這一條不參與排序、不被其他訊號稀釋。
// 立即危險的處理方式不該因為「他今天飲水也偏低」而變動。
export function safetyEntries() {
  return ENTRIES
    .filter((entry) => (entry.fields['風險等級'] || '').includes('立即'))
    .map((entry) => shape(entry, 'safety'));
}

function shape(entry, kind) {
  const f = entry.fields;
  return {
    kind,
    title: entry.title,
    // 只挑對使用者有用的欄位送出去，不是整篇倒出來
    purpose: f['目的'] || f['核心概念'] || null,
    plain: f['白話解釋'] || null,
    say: f['話術內容'] || null,
    tone: f['語氣提醒'] || null,
    avoid: f['禁忌替代語'] || f['禁忌做法'] || f['常見誤用'] || null,
    steps: f['操作步驟'] || null,
    appliesTo: f['適用狀態'] || f['適用障別'] || null,
    theory: f['理論基礎'] || f['理論分類'] || null,
    watchFor: f['觀察訊號'] || null,
    escalate: f['升級處理條件'] || f['需要通知誰'] || null,
    immediate: f['立即處理'] || null,
    riskLevel: f['風險等級'] || null,
    // 說得出出處才站得住——每一條都指回知識庫的哪一篇
    source: entry.title
  };
}

// 從觀察找出相關的知識。observations 是 support-engine 算出來的那些（帶 id）。
export function knowledgeFor(observations = [], options = {}) {
  const wanted = [];
  for (const observation of observations) {
    const key = observation.id?.replace(/-shift$/, '-shift').replace(/^glucose-.*-shift$/, 'reading-shift');
    const mapped = SIGNAL_TO_STATE[key] || SIGNAL_TO_STATE[observation.id] || [];
    wanted.push(...mapped);
    if (observation.direction === 'building') wanted.push(...SIGNAL_TO_STATE['routine-building']);
    if (observation.direction === 'easing') wanted.push(...SIGNAL_TO_STATE['routine-easing']);
  }
  if (options.askedForHelp) wanted.push(...SIGNAL_TO_STATE['asked-for-help']);
  if (!wanted.length) return { phrases: [], approaches: [], theories: [], enough: false };

  const scored = ENTRIES
    .map((entry) => ({ entry, score: scoreEntry(entry, [...new Set(wanted)]) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const pick = (test, limit) => scored
    .filter((row) => test(row.entry))
    .slice(0, limit)
    .map((row) => shape(row.entry, 'match'));

  return {
    // 可以直接說出口的
    phrases: pick((e) => e.fields['話術內容'], 3),
    // 要怎麼做
    approaches: pick((e) => e.fields['操作步驟'] || e.fields['核心邏輯'], 3),
    // 依據哪一套
    theories: pick((e) => e.fields['理論分類'] && e.fields['白話解釋'], 2),
    enough: scored.length > 0
  };
}

// ── 為什麼這一份只給支持者 ────────────────────────────────────────────────────
//
// 本人那一側曾經也接這份知識庫，做完之後拆掉了，把過程記在這裡免得再走一次。
//
// 這份庫從頭到尾是寫給就服員與醫護的，主詞是他們，客體是「個案」。操作步驟是
// 「停止要求與糾正」「移除觀眾」「團隊一致回應」——那是別人怎麼對待你，不是你做得到的事。
// 第一版只擋欄位，結果本人在瀏覽器上讀到「想增加的行為，要在行為發生後立即給有意義的結果」
// （正增強設計模型）：欄位完全合法，立場錯了。加上工作者口吻的過濾之後，62 篇理論剩 46 篇，
// 而剩下的變成「正負是加入或移除，不是好壞」這種名詞解釋——對一個剛過完難受一週的人，
// 那不是幫助。
//
// 結論：這份庫裡沒有寫給本人看的東西，硬濾只會在「語氣走味」跟「變詞典」之間二選一。
// 本人那一側改用 care-knowledge.js 的官方衛教，那些本來就是寫給民眾看的。
export const knowledgeSize = ENTRIES.length;
