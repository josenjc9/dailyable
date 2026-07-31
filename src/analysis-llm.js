// LLM 分析層：把「引擎算出來的事實」加上「知識庫檢索到的做法」，寫成針對這個人今天的分析。
//
// ════════════════════════════════════════════════════════════════════════════
// 省 token 的做法，跟我們自建 RAG 那套同一個原則：貴的部分先用便宜的方法做掉
// ════════════════════════════════════════════════════════════════════════════
//
// 1. 知識不進 prompt。153 篇全塞進去，每次呼叫都要付一次錢。改成先用結構化檢索挑出
//    最相關的 3＋3＋2 篇，而且只送需要的欄位（話術內容、目的、白話解釋），不送整篇。
//    這一步就把知識的部分從幾萬 token 壓到幾百。
//
// 2. 一樣的模型請求不重算。直接對完整 request payload 算指紋，實際觀察文字、知識內容、
//    受眾、語言、system prompt 與模型設定只要有一項不同，就不會共用分析結果。
//
// 3. 沒東西可分析就不呼叫。觀察是空的、或資料不足，直接不打——那種情況 LLM 也只會
//    寫出空話。
//
// 4. 輸出設上限。這一段是三小段話，不是文章。
//
// 5. 掛掉就退回決定性版本，畫面不會破。LLM 是加值層，不是必要層。

import { createHash } from 'node:crypto';

const MODEL = process.env.DAILYABLE_LLM_MODEL || 'gpt-4o';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MAX_OUTPUT_TOKENS = 320;
const TIMEOUT_MS = 6000;
// 快取上限：展示模式的組合很少，正式使用時每人每天也就幾種。
const CACHE_MAX = 500;
const cache = new Map();

// 每日呼叫上限，避免任何情況下失控。超過就當作沒有 LLM，畫面照常。
const DAILY_CALL_CAP = Number(process.env.DAILYABLE_LLM_DAILY_CAP || 400);
let callsToday = 0;
let callDay = new Date().toDateString();

export function llmStats() {
  return { callsToday, cacheSize: cache.size, model: MODEL, enabled: Boolean(process.env.OPENAI_API_KEY) };
}

// 直接雜湊送給模型的完整 payload，避免 prompt 與 cache key 各維護一份欄位清單後逐漸分岔。
// 使用完整 SHA-256；快取鍵不需要為了省幾十 bytes 去承擔不必要的碰撞空間。
function fingerprint(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// 只送 LLM 需要的欄位。整篇送過去等於每次為沒用到的內容付錢。
function trim(knowledge) {
  const pick = (list, fields) => (list || []).map((item) => {
    const out = {};
    for (const field of fields) if (item[field]) out[field] = item[field];
    return out;
  });
  return {
    phrases: pick(knowledge.phrases, ['title', 'say', 'avoid']),
    approaches: pick(knowledge.approaches, ['title', 'purpose', 'steps']),
    theories: pick(knowledge.theories, ['title', 'plain'])
  };
}

const SYSTEM = {
  supporter: `You help a non-clinical supporter (family member, social worker, workshop mentor) understand what a person's own records show, and what they might try.

Write three short paragraphs, labelled exactly: SEEN / MIGHT BE / TRY.
SEEN: connect the facts across measures and time. Say what is connected, not each fact separately.
MIGHT BE: a functional hypothesis — which part of their day has become hard — with your confidence, and which of the supplied theories it rests on. Never a diagnosis.
TRY: what to check first, then one thing to try, drawn only from the supplied approaches and phrases.

Hard rules: never name or imply a medical condition. Never give a number as a threshold. Never compare this person to anyone else. Use only the supplied knowledge — do not introduce techniques or theories that were not given. Keep it under 140 words.`,
  participant: `You help a person understand their own records. Write to them, not about them.

Write three short paragraphs, labelled exactly: SEEN / MIGHT BE / TRY.
SEEN: what their own entries show, connected across time. Their words, their record.
MIGHT BE: which part of the day seems to have got harder. Tentative, never a verdict, never a diagnosis.
TRY: one thing they could try, from the supplied approaches. Their choice, not an instruction.

Hard rules: never name or imply a medical condition. Never give a number as a threshold. Never compare them to anyone else. Never evaluate them as a person — describe the day, not the character. Use only the supplied knowledge. Keep it under 120 words.`
};

export async function analyse({ facts = [], knowledge = {}, audience = 'supporter', language = 'zh' } = {}) {
  // 沒東西可分析就不打。空觀察餵進去只會拿到空話，而且要付錢。
  if (!facts.length) return null;
  if (!process.env.OPENAI_API_KEY) return null;

  const payload = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.4,
    messages: [
      { role: 'system', content: SYSTEM[audience] || SYSTEM.supporter },
      {
        role: 'user',
        content: JSON.stringify({
          language: language === 'zh' ? 'Traditional Chinese (Taiwan)' : 'English',
          facts: facts.map((f) => ({
            what: language === 'zh' ? f.zh : f.en,
            streak: f.streak || null,
            direction: f.direction || null
          })),
          knowledge: trim(knowledge)
        })
      }
    ]
  };

  const key = fingerprint(payload);
  if (cache.has(key)) return { ...cache.get(key), cached: true };

  const today = new Date().toDateString();
  if (today !== callDay) { callDay = today; callsToday = 0; }
  if (callsToday >= DAILY_CALL_CAP) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    callsToday += 1;
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) return null;
    const body = await response.json();
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const result = { text, model: MODEL, cached: false };
    cache.set(key, { text, model: MODEL });
    // 舊的先丟，Map 依插入順序走訪
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return result;
  } catch {
    // 超時、網路壞、金鑰錯——一律當作沒有 LLM。畫面已經有決定性版本了。
    return null;
  } finally {
    clearTimeout(timer);
  }
}
