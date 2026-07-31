// Published reference ranges, verified against Taiwanese government and public hospital
// sources by Eren on 2026-07-27. See _handoff/Eren_to_Neo_生命徵象參考區間_2026-07-27.
//
// Three rules this file exists to enforce:
//   1. A band is shown only where an official published range for general adults exists.
//      Ordinary post-meal and random glucose have none, so they are recorded without one.
//   2. The 2-hour ≥200 mg/dL figure belongs to the 75 g oral glucose tolerance test. It is
//      not a threshold for an ordinary reading two hours after eating, and conflating the
//      two would tell someone they are diabetic based on a number that cannot say that.
//   3. Published thresholds are quoted as published — the blood pressure page uses ">",
//      so this does not quietly promote it to "≥".
//
// These are for recording and understanding trends. They are not a diagnosis, and the
// product must not turn a diagnostic threshold into an alarm.

export const ATTRIBUTION = {
  en: 'Public health-education reference: Health Promotion Administration (MOHW), Taipei Veterans General Hospital Suao Branch, MOHW Nantou Hospital (accessed 2026-07-27).',
  zh: '公開衛教參考：衛生福利部國民健康署、臺北榮民總醫院蘇澳分院、衛生福利部南投醫院（查閱日期：2026-07-27）。'
};

export const DISCLAIMER = {
  en: 'These ranges come from published public health-education material. They are here to help you record and read your own trend, and they are not a diagnosis. A single reading is affected by how it was measured, activity, food, medication and your own situation. If something stays unusual, or you feel unwell, please speak to a health professional.',
  zh: '以下區間整理自國民健康署及公立醫療機構的公開衛教資料，僅供記錄與理解趨勢，不等同醫療診斷。單次數值會受量測方式、活動、飲食、藥物與個人狀況影響；持續異常或伴隨不適時，請洽醫療專業人員。'
};

const HPA_BP = 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4990&pid=19259';
const HPA_DIABETES = 'https://www.hpa.gov.tw/Pages/List.aspx?nodeid=359';
const HPA_WATER = 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4306&pid=14493';
const VGH_PULSE = 'https://org.vghtpe.gov.tw/savh/files/files/%E6%B8%AC%E9%87%8F%E8%A1%80%E5%A3%93%E8%88%87%E8%84%88%E6%90%8F.pdf';

export const BLOOD_PRESSURE = {
  unit: 'mmHg',
  source: HPA_BP,
  measurement: {
    en: 'Sit quietly for five minutes first; back supported, feet flat, arm at heart height, no talking.',
    zh: '先靜坐休息五分鐘；坐有靠背椅、雙腳平放、手臂與心臟同高、不說話不移動。'
  },
  bands: [
    { id: 'normal', systolic: [null, 120], diastolic: [null, 80], label: { en: 'Published as normal', zh: '公開資料列為正常' } },
    { id: 'elevated', systolic: [120, 139], diastolic: [80, 89], label: { en: 'Published as elevated', zh: '公開資料列為偏高' } },
    { id: 'threshold', systolic: [140, null], diastolic: [90, null], label: { en: 'Above the published hypertension threshold', zh: '高於公開的高血壓門檻' } }
  ],
  // Quoted exactly as the source words it; the page uses ">" rather than "≥".
  // 來源是中文的，但英文介面上不能夾一段中文——照原文的數字給一份英文，同一件事兩種說法。
  quote: {
    zh: '正常血壓：收縮壓 <120 mmHg，舒張壓 <80 mmHg；血壓偏高：120-139 / 80-89；高血壓：>140 / >90',
    en: 'Normal: systolic <120 mmHg and diastolic <80 mmHg. Elevated: 120-139 / 80-89. Hypertension: >140 / >90.'
  }
};

export const PULSE = {
  unit: 'bpm',
  source: VGH_PULSE,
  measurement: { en: 'At rest.', zh: '休息、靜止狀態下。' },
  bands: [{ id: 'normal', range: [60, 100], label: { en: 'Published resting range', zh: '公開的靜止脈搏範圍' } }],
  quote: { zh: '一般的脈搏次數是每分鐘 60~100 次', en: 'A resting pulse is generally 60–100 beats per minute.' }
};

export const WATER = {
  unit: 'mL',
  source: HPA_WATER,
  dailyTarget: 1500,
  cupRange: [1440, 1920],
  label: { en: 'General adult guidance', zh: '一般成人建議' },
  quote: {
    zh: '每日建議成人飲用 6-8 杯水（240 ml/杯）；每天喝至少 1,500 ml',
    en: 'Adults are advised to drink 6–8 cups of water a day (240 mL a cup), at least 1,500 mL.'
  },
  caveat: {
    en: 'General guidance only. Adjust for activity and weather, and ask your doctor if you have kidney or other conditions.',
    zh: '僅為一般建議。請依活動與環境調整；若有腎臟疾病或其他疾病，請詢問醫師。'
  }
};

// Keyed by the glucose context stored on the record. `band: null` is the important case:
// it means no official general-adult range exists, so the value is recorded and shown
// without any judgement attached to it.
export const GLUCOSE_BY_CONTEXT = {
  fasting: {
    unit: 'mg/dL',
    source: HPA_DIABETES,
    band: { prediabetes: [100, 125], diagnosticThreshold: 126 },
    note: {
      en: 'Fasting plasma glucose. 100–125 is published as prediabetes and ≥126 as a diagnostic criterion, which requires repeat testing by a clinician.',
      zh: '空腹血漿血糖。100–125 為公開的糖尿病前期範圍，≥126 屬診斷條件，需由醫療人員重複檢驗確認。'
    },
    quote: {
      zh: '空腹血糖值介於 100 至 125 mg/dL…處於糖尿病前期；空腹血漿血糖 ≧126 mg/dL',
      en: 'A fasting reading of 100–125 mg/dL is published as prediabetes; fasting plasma glucose ≧126 mg/dL is a published diagnostic criterion.'
    }
  },
  'post-meal-2h': {
    unit: 'mg/dL',
    source: HPA_DIABETES,
    band: null,
    note: {
      en: 'Recorded as-is. There is no published general-adult normal range for an ordinary reading two hours after eating, and the OGTT threshold does not apply here.',
      zh: '照實記錄。一般吃飯後兩小時的數值查無國內官方公開的成人正常區間，OGTT 的門檻不適用於此。'
    },
    quote: null
  },
  'ogtt-2h': {
    unit: 'mg/dL',
    source: HPA_DIABETES,
    band: { diagnosticThreshold: 200 },
    note: {
      en: '75 g oral glucose tolerance test, second hour. ≥200 is a published diagnostic criterion and requires repeat testing by a clinician.',
      zh: '75 克口服葡萄糖耐受試驗第二小時。≥200 為公開的診斷條件，需由醫療人員重複檢驗確認。'
    },
    quote: {
      zh: '口服葡萄糖耐受試驗第 2 小時血漿血糖 ≧200 mg/dL',
      en: 'Plasma glucose ≧200 mg/dL at the second hour of the oral glucose tolerance test.'
    }
  },
  random: {
    unit: 'mg/dL',
    source: HPA_DIABETES,
    band: null,
    note: {
      en: 'Recorded as-is. There is no published normal range for a random reading; the ≥200 criterion applies only alongside typical symptoms and is assessed by a clinician.',
      zh: '照實記錄。隨機血糖查無公開的正常區間；≥200 的條件必須同時具備典型高血糖症狀，並由醫療人員評估。'
    },
    quote: null
  },
  unspecified: {
    unit: 'mg/dL',
    source: null,
    band: null,
    note: {
      en: 'The timing was not noted, so this value cannot be read against any range.',
      zh: '沒有記錄量測時機，因此這個數值無法對照任何區間。'
    },
    quote: null
  }
};

export const REFERENCE = {
  attribution: ATTRIBUTION,
  disclaimer: DISCLAIMER,
  bloodPressure: BLOOD_PRESSURE,
  pulse: PULSE,
  water: WATER,
  glucose: GLUCOSE_BY_CONTEXT
};
