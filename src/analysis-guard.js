// LLM 輸出的守門員。
//
// 「我在 prompt 裡叫它不要診斷」不是安全保證，是期望。模型會照著大部分時候做，而這個
// 產品不能接受「大部分時候」——它服務的是慢性病患、獨居者、身心障礙者，講錯一句話的
// 代價由他們承受。
//
// 所以規則寫成機器檢查：命中就整段丟掉，退回決定性版本。這跟我們既有的做法一致——
// 可機器判定的規則做成檢查，不留在記性裡。
//
// 設計準則跟其他守門員一樣：只擋確定不行的、寧漏不誤擋。誤擋多了會被繞過，防線就廢。

// 一、診斷與病名。產品明說不做診斷，LLM 也不准暗示。
const DIAGNOSIS = [
  /糖尿病|高血壓|憂鬱症|失智|阿茲海默|焦慮症|思覺失調|中風|腎病|心臟病/,
  /\b(diabet|hypertens|depress|dementia|alzheimer|anxiety disorder|schizophren|stroke)/i,
  /診斷|罹患|病情|症狀顯示|疑似.{0,4}症/,
  /\b(diagnos|you have|suffering from|symptom of)/i
];

// 二、把數字變成門檻。產品的立場是跟本人自己比，不套用臨床切分點。
const THRESHOLD = [
  /(超過|高於|低於|大於|小於)\s*\d+\s*(mmHg|mg\/dL|bpm|mL)/,
  /\b(above|below|over|under|exceeds)\s+\d+\s*(mmHg|mg\/dL|bpm|mL)/i,
  /正常值|標準值|安全範圍|危險值|警戒值/,
  /\b(normal range|safe range|danger|cut-?off|threshold)\b/i
];

// 三、跟別人比。這條是產品的核心主張，踩了整個定位就垮。
const COMPARISON = [
  /跟(其他|別的|一般)(人|使用者|患者|長者)/,
  /比(其他|別人|一般人)/,
  /平均而言|同齡|同年齡層/,
  /\b(other (people|users|patients)|average (person|user)|compared (to|with) others|peers|for someone (their|his|her) age)\b/i
];

// 四、指令口氣與評價。這個產品的語氣原則是描述不評價、選擇權在本人。
const VERDICT = [
  /你(應該|必須|一定要|需要立刻)/,
  /\b(you (must|should|need to) )/i,
  /控制不佳|不合格|表現不好|退步了|惡化到/,
  /\b(poorly controlled|non-?compliant|failing|deteriorat)/i
];

const RULES = [
  ['diagnosis', DIAGNOSIS, '出現診斷或病名'],
  ['threshold', THRESHOLD, '把數字講成門檻'],
  ['comparison', COMPARISON, '拿本人跟別人比'],
  ['verdict', VERDICT, '下指令或評價這個人']
];

export function inspect(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, reasons: ['empty'] };
  }
  const reasons = [];
  for (const [name, patterns, why] of RULES) {
    for (const pattern of patterns) {
      if (pattern.test(text)) { reasons.push(`${name}: ${why}`); break; }
    }
  }
  return { ok: reasons.length === 0, reasons };
}

// 用法：過不了就回 null，呼叫端顯示原本的決定性版本。
export function keepIfSafe(result) {
  if (!result?.text) return null;
  const verdict = inspect(result.text);
  if (!verdict.ok) return null;
  return result;
}
