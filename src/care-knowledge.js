// 長照與居家照顧：官方公開衛教與資源。
//
// 為什麼要有這一份，而不是沿用 knowledge-base.json：
// 那份是庇護與就服的實務知識庫，從頭到尾寫給就服員與醫護看的——主詞是他們，客體是「個案」。
// 實測把它端到本人面前，不是語氣走味（「讓個案重新感到自己有能力」），就是變成心理學名詞
// 解釋（「正負是加入或移除，不是好壞」）。一個剛過完難受一週的人，兩種都幫不上忙。
//
// 這一份不同：來源是衛福部、長照專區、國健署、社家署的公開衛教，本來就是寫給民眾看的，
// 而且涵蓋 Boss 指名的那群人——慢性病患、獨居者、老弱與他們的照顧者。
//
// 三條規則，寫死在資料結構裡：
//   1. 原文逐字引用，加引號。不改寫成「你應該」——那會把衛教變成我們的醫療建議。
//   2. 每一條都帶出處與查證日期。說不出出處的不放進來。
//   3. 分清楚給誰看。翻身、壓瘡照護是寫給照顧者的，端給臥床本人沒有意義。
//
// 每一條的出處網址與查證日期都寫在下面的資料裡，可以逐條回查。
// 授權：依「政府資料開放授權條款－第1版」，使用時必須註明出處。

const MOHW = '衛生福利部';
export const ORG_EN = {
  '衛生福利部': 'Ministry of Health and Welfare',
  '衛生福利部（部屬醫院衛教）': 'Ministry of Health and Welfare (affiliated hospital health education)',
  '衛生福利部長期照顧專區（1966）': 'MOHW Long-Term Care portal (1966)'
};
const LTC = '衛生福利部長期照顧專區（1966）';
const CHECKED = '2026-07-29';

// 三支專線的說法特別容易寫錯，所以集中在這裡，畫面上都從這裡取。
//
// 1966 不是全時段免費，也不是 24 小時——官方原文是「前 5 分鐘免付費」、週一至週五上班時段。
// 把它寫成「24 小時免費專線」會害人在週日晚上抱著期待打過去。
export const HELPLINES = [
  {
    id: 'ltc-1966',
    name: '長照專線 1966',
    number: '1966',
    quote: '「手機或市話都可直撥『1966』，前5min免付費」',
    hours: '週一至週五 08:30–12:00、13:30–17:30',
    forWhat: '申請長照服務、問資源、問資格',
    source: { org: MOHW, url: 'https://dep.mohw.gov.tw/DONAHC/cp-1089-47380-104.html', checked: CHECKED }
  },
  {
    id: 'carer-0800',
    name: '家庭照顧者關懷專線',
    number: '0800-50-7272',
    quote: '「免費提供家庭照顧者諮詢與會談服務」',
    hours: null,
    forWhat: '照顧到快撐不住的時候，有人聽你說',
    source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-16-79309-1.html', checked: CHECKED }
  },
  {
    id: 'dementia-0800',
    name: '失智症關懷專線',
    number: '0800-474-580',
    quote: '「失智時，我幫您」',
    hours: null,
    forWhat: '記憶、認知相關的疑問與資源',
    source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-2632-14706-1.html', checked: CHECKED }
  }
];

// audience 決定這一條會出現在誰的畫面上：
//   participant  本人自己做得到的事
//   supporter    照顧者／支持者要做的事
//   both         兩邊都用得上
//
// triggers 對應 support-engine 算出來的觀察 id。對不上就不出現——沒有「反正放著也好」這種條目，
// 一個永遠出現的提醒等於沒有提醒。
export const CARE_ENTRIES = [
  {
    id: 'water-intake',
    audience: 'participant',
    triggers: ['waterMl-shift', 'routine-water-overlap'],
    // 標題是我們寫的，翻得動；引號裡的原文一律不翻——翻譯官方衛教等於改寫它。
    //
    // 這些標題的寫法有規則（Boss 2026-07-29）：專業且溫暖，而且要站得住心理學。
    // 具體就是三件事——把狀況正常化（你不是唯一一個）、不責備（沒有「你應該早點」）、
    // 不製造恐慌（這批使用者裡有慢性病患與獨居長者，嚇他們沒有任何好處，只會讓他不敢再記錄）。
    title: '身體缺水的時候，其實看得出來',
    titleEn: 'Your body shows you when it needs water',
    quotes: [
      { text: '「每日建議成人飲用6-8杯水(240 ml/杯)」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-5019-62954-1.html', checked: CHECKED } },
      { text: '「透明黃色(淺黃色)：表示體內水分充足，可正常補充水分」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-5019-62954-1.html', checked: CHECKED } },
      { text: '「黃色：表示可能有一段時間未補充水分或有持續出汗之情形」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-5019-62954-1.html', checked: CHECKED } },
      { text: '「烏龍茶色：表示身體可能已出現缺水狀態，要立即補充水分」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-5019-62954-1.html', checked: CHECKED } }
    ],
    // 這一句一定要跟著上面那幾句走。腎臟病患者照一般建議喝水是會出事的。
    caution: {
      text: '「腎臟疾病的患者因腎臟腎絲球的過濾功能變差，影響每日腎臟可以處理的水量，因此，正確的水分攝取量應該詢問主治醫師後進行調整」',
      source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-5019-62954-1.html', checked: CHECKED }
    }
  },
  {
    id: 'sleep-and-sedatives',
    audience: 'participant',
    triggers: ['energy-run', 'routine-energy-overlap'],
    // 原本寫「有一件事要特別小心」，讀起來像在警告。連著幾天睡不好的人已經夠累了。
    title: '連著幾天睡不好，是可以慢慢處理的事',
    titleEn: 'Several bad nights is something you can work on slowly',
    quotes: [
      { text: '「102年高齡族群鎮靜安眠藥的使用盛行率為25至44歲年齡族群的3倍，45至64歲年齡族群的1.5倍」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-2650-19871-1.html', checked: CHECKED } },
      { text: '「常因非經醫師處方自行購買與自已加量等不適當用藥，以及服用鎮靜安眠藥(BZDs、Z-drugs)後副作用影響，有較高的跌倒及骨折的風險值，值得注意。」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-2650-19871-1.html', checked: CHECKED } }
    ],
    whenToSeek: {
      text: '「失眠原因複雜，若有焦慮或睡眠障礙等問題，需服用鎮靜安眠藥時務必要小心，應循專業醫師診治，遵循醫囑服用鎮靜安眠藥，切勿自行購買藥品服用以及增加或減少用藥劑量」',
      source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-2650-19871-1.html', checked: CHECKED }
    }
  },
  {
    id: 'swallowing',
    audience: 'both',
    triggers: ['routine-run'],
    title: '吃飯會嗆到的人，比你想的多',
    titleEn: 'More people choke while eating than you would think',
    quotes: [
      { text: '「台灣社區65歲以上長者有21.8%於每週至少3次有進食嗆到的現象，有12.8%經過評估為吞嚥異常，即每10個高齡者可能就有1個有輕度以上之吞嚥障礙。」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-3569-38925-1.html', checked: CHECKED } },
      { text: '「長者因器官退化、虛弱或是有疾病(如中風、帕金森氏症等)，會有吞嚥困難問題，於進食時造成嗆咳、吸入性肺炎等。」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-3569-38925-1.html', checked: CHECKED } }
    ],
    whenToSeek: {
      text: '「若您有吃東西、吞嚥上的困難，如：吃東西、喝水時會嗆到或是喉嚨感覺卡卡的、吞不乾淨等問題，建議您尋求醫師及語言治療師的幫忙。」',
      source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-3569-38925-1.html', checked: CHECKED }
    }
  },
  {
    id: 'falls-at-home',
    audience: 'both',
    triggers: ['routine-run', 'systolic-shift'],
    title: '跌倒最常發生在最熟悉的地方',
    titleEn: 'Falls happen most often in the rooms you know best',
    quotes: [
      { text: '「3,280位65歲以上老人中，每6人就有1位在一年內有跌倒的經驗（495人，佔15.5%）」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-4635-51615-1.html', checked: CHECKED } },
      { text: '「室內發生跌傷的第一位為臥室、第二位為客廳、第三位為浴室」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-4635-51615-1.html', checked: CHECKED } },
      { text: '「地板保持乾燥，避免滑倒」「家具遠離走道，雜物收納整齊，電線靠牆收好，避免絆倒」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-4635-51615-1.html', checked: CHECKED } },
      { text: '「室內燈光足夠明亮，可加裝小夜燈」「電燈開關應接近門口，能輕易觸按」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-4635-51615-1.html', checked: CHECKED } },
      { text: '「床高度要能容易上下床」「床邊放置助行器或拐杖」「從床上能輕易開關燈」', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-4635-51615-1.html', checked: CHECKED } }
    ]
  },
  {
    id: 'polypharmacy',
    audience: 'both',
    triggers: ['energy-run', 'systolic-shift', 'glucose-fasting-shift', 'glucose-post-meal-2h-shift'],
    // 「不良反應的機會就跟著高」會嚇到人，而且他多半不是自願吃這麼多種的。
    title: '藥越吃越多，是很常見的狀況',
    titleEn: 'Ending up on more and more medicines is very common',
    quotes: [
      { text: '多重用藥常以「同時使用多種藥物，常以至少使用5種以上藥物為切點」界定', source: { org: `${MOHW}（部屬醫院衛教）`, url: 'https://www.typc.mohw.gov.tw/?aid=302&pid=0&page_name=detail&iid=314', checked: CHECKED } },
      { text: '「任何藥物都可能發生副作用! 使用藥物的種類愈多，發生藥物的不良反應機率就愈高。而老人使用藥物，比起年輕族群更容易出現藥物的不良反應。」', source: { org: `${MOHW}（部屬醫院衛教）`, url: 'https://www.typc.mohw.gov.tw/?aid=302&pid=0&page_name=detail&iid=314', checked: CHECKED } },
      { text: '健保雲端藥歷可讓「醫師可審視患者最近3個月在各家醫院的處方藥物，立即提供用藥建議」', source: { org: `${MOHW}（部屬醫院衛教）`, url: 'https://www.typc.mohw.gov.tw/?aid=302&pid=0&page_name=detail&iid=314', checked: CHECKED } }
    ]
  },
  {
    id: 'carer-load',
    audience: 'supporter',
    triggers: ['routine-run', 'energy-run', 'routine-energy-overlap'],
    title: '覺得快撐不住的時候，你不是唯一一個',
    titleEn: 'When you feel close to worn out, you are not the only one',
    quotes: [
      { text: '112 年來電諮詢主要涉及「情緒支持」（27%）、照顧資源（21.7%）及照顧需求（19.9%）', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-16-79309-1.html', checked: CHECKED } },
      { text: '情緒問題中以「傾訴照顧壓力，如焦慮、憂鬱、無力、疲倦、憤怒等」占 42.4% 最多', source: { org: MOHW, url: 'https://www.mohw.gov.tw/cp-16-79309-1.html', checked: CHECKED } },
      { text: '「每天至少15分鐘留給自己」——從事運動、聆聽音樂、冥想、書寫、散步等自我照顧活動', source: { org: LTC, url: 'https://1966.gov.tw/LTC/cp-6455-75309-207.html', checked: CHECKED } },
      { text: '「找到照顧替手」——運用政府長照資源，推動家庭內照顧溝通與協議，做好照顧安排與時間管理', source: { org: LTC, url: 'https://1966.gov.tw/LTC/cp-6455-75309-207.html', checked: CHECKED } }
    ]
  }
];

// 長照四包錢：查得到、可以顯示的部分。
//
// 刻意不放各等級的金額。查證時發現輔具額度有兩種互相矛盾的官方說法（4 萬 vs 6 萬、
// 分級制 vs 雙軌二擇一），沒確認前寫上去等於給錯資訊；而且實際額度本來就以縣市長照
// 管理中心核定為準，我們寫得再精確也不是那個數字。
// 這裡只做一件事：讓人知道有這四類東西可以申請，然後把他帶到 1966。
export const LTC_BENEFITS = [
  { id: 'care-service', zh: '照顧及專業服務', en: 'Care and professional services', plain: '居家服務、日間照顧、家庭托顧，以及專業人員到家做的訓練與指導', plainEn: 'Home care, day care, family day care, and in-home training or guidance by professionals' },
  { id: 'transport', zh: '交通接送', en: 'Transport', plain: '就醫或就長照服務的往返車程', plainEn: 'Rides to and from medical visits or long-term care services' },
  { id: 'assistive', zh: '輔具及居家無障礙環境改善', en: 'Assistive devices and home accessibility', plain: '輪椅、助行器、扶手、防滑這類東西與工程', plainEn: 'Wheelchairs, walkers, grab bars, anti-slip work and similar' },
  { id: 'respite', zh: '喘息服務', en: 'Respite care', plain: '讓照顧者有時間休息，由別人接手照顧', plainEn: 'Someone else takes over for a while so the carer can rest' }
];

export const LTC_ELIGIBILITY = {
  quote: '經各縣市長期照顧管理中心評估，符合長照需要等級2級以上者',
  who: [
    { zh: '65 歲以上老人', en: 'People aged 65 and over' },
    { zh: '55 歲以上原住民', en: 'Indigenous people aged 55 and over' },
    { zh: '50 歲以上失智症者', en: 'People aged 50 and over living with dementia' },
    { zh: '失能身心障礙者', en: 'People with disabilities affecting daily function' }
  ],
  // 等級只寫範圍，不寫「第幾級＝輕度／重度」。
  // 查證結果：衛福部只公布各級額度階梯，網路上流傳的輕中重對照全是非官方整理。
  levels: '長照需要等級分為 2～8 級，各級對應不同的給付額度',
  levelsEn: 'Care-need levels run from 2 to 8, each with its own benefit amount',
  source: { org: LTC, url: 'https://1966.gov.tw/LTC/cp-6533-70777-207.html', checked: CHECKED }
};

// 頁腳要放的那一段。政府資料開放授權條款第 1 版要求註明出處，這不是禮貌問題是條款要求。
export const ATTRIBUTION = {
  zh: '本頁長照與照顧衛教內容引用自衛生福利部、衛生福利部長期照顧專區（1966）等政府網站公開資料（查證日期：2026-07-29），依「政府資料開放授權條款－第1版」釋出。本產品非官方服務，內容僅供參考；實際給付資格、額度與部分負擔以各縣市長期照顧管理中心核定為準。緊急或病況變化請就醫或撥打長照專線 1966。',
  en: 'The long-term care and home-care material on this page is quoted from public information published by the Ministry of Health and Welfare and its Long-Term Care portal (1966), verified on 2026-07-29 and released under the Open Government Data License, version 1.0. DailyAble is not an official service. Eligibility, benefit amounts and co-payments are decided by each city or county long-term care management centre. In an emergency or if a condition changes, seek medical care or call 1966.',
  licenseUrl: 'https://data.gov.tw/license'
};

const withEnglishOrg = (quote) => ({
  ...quote,
  source: { ...quote.source, orgEn: ORG_EN[quote.source.org] || quote.source.org }
});

// 從觀察挑出用得上的衛教。audience 決定給誰看，觀察對不上就回空的。
export function careFor(observations = [], audience = 'participant') {
  const ids = new Set(observations.map((entry) => entry.id).filter(Boolean));
  const entries = CARE_ENTRIES
    .filter((entry) => entry.audience === audience || entry.audience === 'both')
    .filter((entry) => entry.triggers.some((trigger) => ids.has(trigger)))
    // 寫給這個人的排在「兩邊都適用」的前面。只留兩則，通用的很容易把專屬的擠掉——
    // 支持者最需要看到「照顧者負荷」那條，卻被吞嚥跟防跌卡在前面，實測踩過。
    .sort((a, b) => (a.audience === audience ? 0 : 1) - (b.audience === audience ? 0 : 1))
    // 機關名的英譯在出口一次補齊，畫面就不用自己查表。原文引用永遠不翻。
    .map((entry) => ({
      ...entry,
      quotes: entry.quotes.map(withEnglishOrg),
      caution: entry.caution ? withEnglishOrg(entry.caution) : undefined,
      whenToSeek: entry.whenToSeek ? withEnglishOrg(entry.whenToSeek) : undefined
    }));
  return { entries: entries.slice(0, 2), enough: entries.length > 0 };
}
