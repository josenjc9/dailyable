const ALLOWED = {
  energy: new Set(['steady', 'low', 'very-low']),
  mood: new Set(['okay', 'low', 'very-low']),
  sleep: new Set(['restorative', 'interrupted', 'very-little']),
  nourishment: new Set(['usual', 'less', 'missed']),
  taskLoad: new Set(['manageable', 'harder', 'stuck']),
  thinking: new Set(['usual', 'forgetful', 'perception']),
  helpRoute: new Set(['self', 'supporter', 'need-help', 'immediate-danger']),
  routine: new Set(['on-track', 'changed', 'off-track']),
  concern: new Set(['none', 'need-help', 'immediate-danger']),
  supportChoice: new Set(['self', 'supporter']),
  moodDuration: new Set(['not-asked', 'today', 'several-days', 'week-plus']),
  selfHarmThoughts: new Set(['not-asked', 'no', 'unsure', 'yes']),
  memoryImpact: new Set(['not-asked', 'no-impact', 'recent', 'daily-impact']),
  perceptionSafety: new Set(['not-asked', 'manageable', 'distressing', 'harm-command'])
};
const OPTIONAL_DEFAULTS = {
  mood: 'okay', thinking: 'usual', routine: 'on-track', sleep: 'restorative', nourishment: 'usual', taskLoad: 'manageable',
  moodDuration: 'not-asked', selfHarmThoughts: 'not-asked', memoryImpact: 'not-asked', perceptionSafety: 'not-asked'
};

function assertInput(input) {
  if (!input.helpRoute) {
    input.helpRoute = input.concern === 'immediate-danger' ? 'immediate-danger'
      : input.concern === 'need-help' ? 'need-help'
        : input.supportChoice === 'supporter' ? 'supporter' : 'self';
  }
  input.concern ||= input.helpRoute === 'immediate-danger' ? 'immediate-danger' : input.helpRoute === 'need-help' ? 'need-help' : 'none';
  input.supportChoice ||= input.helpRoute === 'supporter' ? 'supporter' : 'self';
  for (const [key, value] of Object.entries(OPTIONAL_DEFAULTS)) input[key] ||= value;
  for (const [key, allowed] of Object.entries(ALLOWED)) {
    if (!allowed.has(input[key])) {
      throw new TypeError(`Invalid ${key}`);
    }
  }
}

// 依據：從本人自己的紀錄算出來的觀察。
//
// 以前不管怎麼回答，理由都是同一句「你的精神與作息和平常不同」——沒有說是跟什麼比、看了
// 幾天、根據哪幾筆。這裡把那件事攤開：拿本人前幾天的回報與量測，講出看到什麼。
//
// 三條界線，是這個產品的主張，也是不能越的：
//   * 不下診斷，不解讀數字代表什麼病。
//   * 不打分數。這裡沒有風險值，只有「看到幾次」這種數得出來的事實。
//   * 只跟本人自己前幾天比，永遠不跟別人比。
// 另外，資料不夠就說資料不夠，不硬湊一句像是有根據的話。
const MIN_CHECK_INS = 3;
const MIN_READINGS = 4;

function recent(entries, key, days, now) {
  const cutoff = now - days * 86400000;
  return entries
    .filter((entry) => Date.parse(entry[key]) >= cutoff)
    .sort((a, b) => Date.parse(b[key]) - Date.parse(a[key]));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function observationsFrom(history = {}, now = Date.now()) {
  const checkIns = recent(history.checkIns || [], 'createdAt', 14, now);
  const vitals = recent(history.vitals || [], 'measuredAt', 14, now);
  const observations = [];

  // 「最近五次有三次不一樣」這句話，對連續在惡化的人跟已經在恢復的人是同一句，但那兩件
  // 事的意義差很多。所以把方向也講出來：最近兩次跟前面幾次比，是變多還是變少。
  const drift = (entries, matches) => {
    if (entries.length < 4) return null;
    const recent = entries.slice(0, 2).filter(matches).length / 2;
    const earlier = entries.slice(2).filter(matches).length / entries.slice(2).length;
    if (recent > earlier + 0.25) return 'building';
    if (recent < earlier - 0.25) return 'easing';
    return null;
  };
  const DRIFT_WORDS = {
    building: [' It has come up more often in your last two.', '而且最近兩次更常出現。'],
    easing: [' Your last two look closer to your usual.', '不過最近兩次比較接近你的平常。']
  };

  // 今天是不是其中一次、已經連續幾次、從哪一天開始——這三件事決定一段話讀起來是
  // 「系統在統計我」還是「有人記得我」。
  //
  // 「最近五次有三次不一樣」是統計。「你今天說的這個，是連續第三次了」是有人在看。
  // 同一份資料，差別只在有沒有把今天接回那條線上。
  const streakOf = (entries, matches) => {
    let run = 0;
    for (const entry of entries) {          // entries 已經是新到舊
      if (!matches(entry)) break;
      run += 1;
    }
    return run;
  };
  const dayOf = (entry) => {
    const when = new Date(entry.createdAt || entry.measuredAt);
    return Number.isNaN(when.getTime()) ? null : when;
  };
  const sinceWords = (entries, run) => {
    if (run < 2) return ['', ''];
    const started = dayOf(entries[run - 1]);
    if (!started) return ['', ''];
    const days = Math.max(1, Math.round((now - started.getTime()) / 86400000));
    return [
      ` Today makes ${run} in a row, going back about ${days} day${days === 1 ? '' : 's'}.`,
      `今天是連續第 ${run} 次，大概從 ${days} 天前開始。`
    ];
  };

  if (checkIns.length >= MIN_CHECK_INS) {
    const lastFive = checkIns.slice(0, 5);
    const checkInValue = (entry, key) => entry[key] ?? entry.input?.[key];
    const offRoutine = lastFive.filter((entry) => checkInValue(entry, 'routine') && checkInValue(entry, 'routine') !== 'on-track').length;
    if (offRoutine >= 2) {
      const way = drift(lastFive, (entry) => checkInValue(entry, 'routine') && checkInValue(entry, 'routine') !== 'on-track');
      const [tailEn, tailZh] = DRIFT_WORDS[way] || ['', ''];
      const run = streakOf(checkIns, (entry) => checkInValue(entry, 'routine') && checkInValue(entry, 'routine') !== 'on-track');
      const [sinceEn, sinceZh] = sinceWords(checkIns, run);
      observations.push({
        id: 'routine-run',
        direction: way,
        streak: run,
        en: `Your routine was different from usual in ${offRoutine} of your last ${lastFive.length} check-ins.${sinceEn}${tailEn}`,
        zh: `最近 ${lastFive.length} 次回報裡，有 ${offRoutine} 次你的作息跟平常不一樣。${sinceZh}${tailZh}`
      });
    }
    const lowEnergy = lastFive.filter((entry) => checkInValue(entry, 'energy') && checkInValue(entry, 'energy') !== 'steady').length;
    if (lowEnergy >= 2) {
      const way = drift(lastFive, (entry) => checkInValue(entry, 'energy') && checkInValue(entry, 'energy') !== 'steady');
      const [tailEn, tailZh] = DRIFT_WORDS[way] || ['', ''];
      const run = streakOf(checkIns, (entry) => checkInValue(entry, 'energy') && checkInValue(entry, 'energy') !== 'steady');
      const [sinceEn, sinceZh] = sinceWords(checkIns, run);
      observations.push({
        id: 'energy-run',
        direction: way,
        streak: run,
        en: `You reported lower energy in ${lowEnergy} of your last ${lastFive.length} check-ins.${sinceEn}${tailEn}`,
        zh: `最近 ${lastFive.length} 次回報裡，有 ${lowEnergy} 次你說精神比較低。${sinceZh}${tailZh}`
      });
    }
    for (const [key, usual, id, labelEn, labelZh] of [
      ['sleep', 'restorative', 'sleep-run', 'rest was different', '休息跟平常不同'],
      ['nourishment', 'usual', 'nourishment-run', 'eating or drinking was different', '吃東西或喝水跟平常不同'],
      ['taskLoad', 'manageable', 'task-run', 'starting the next task was harder', '開始下一件事比較困難'],
      ['mood', 'okay', 'mood-run', 'your mood felt lower than usual', '心情比平常低落'],
      ['thinking', 'usual', 'thinking-run', 'memory or perceptions felt different', '記憶或對周遭的感覺跟平常不同']
    ]) {
      const count = lastFive.filter((entry) => checkInValue(entry, key) && checkInValue(entry, key) !== usual).length;
      if (count < 2) continue;
      const matches = (entry) => checkInValue(entry, key) && checkInValue(entry, key) !== usual;
      const way = drift(lastFive, matches);
      const [tailEn, tailZh] = DRIFT_WORDS[way] || ['', ''];
      const run = streakOf(checkIns, matches);
      const [sinceEn, sinceZh] = sinceWords(checkIns, run);
      observations.push({ id, direction: way, streak: run,
        en: `In ${count} of your last ${lastFive.length} check-ins, ${labelEn}.${sinceEn}${tailEn}`,
        zh: `最近 ${lastFive.length} 次回報裡，有 ${count} 次你說${labelZh}。${sinceZh}${tailZh}` });
    }
  }

  // 數字只跟本人自己前幾天比，而且講的是「跟你自己近期比」，不是拿去對任何標準值。
  for (const [key, unit, labelEn, labelZh] of [
    ['systolic', 'mmHg', 'top blood pressure number', '收縮壓'],
    ['waterMl', 'mL', 'water', '喝水量']
  ]) {
    const values = vitals.map((entry) => entry[key]).filter((value) => Number.isFinite(value));
    if (values.length < MIN_READINGS) continue;
    const latest = values[0];
    const usual = median(values.slice(1));
    if (!Number.isFinite(usual) || usual === 0) continue;
    const shift = Math.round(((latest - usual) / usual) * 100);
    if (Math.abs(shift) < 12) continue;
    const higher = shift > 0;
    observations.push({
      id: `${key}-shift`,
      en: `Your latest ${labelEn} is ${Math.abs(shift)}% ${higher ? 'above' : 'below'} what it has usually been these past two weeks (${latest} ${unit}, usually about ${usual} ${unit}).`,
      zh: `你最近一次的${labelZh}比自己這兩週常見的${higher ? '高' : '低'}約 ${Math.abs(shift)}%（這次 ${latest} ${unit}，平常大約 ${usual} ${unit}）。`
    });
  }

  // 血糖一定要分時機各自比。空腹跟飯後兩小時是兩種不同的量測，混在一起算出來的「平常」
  // 兩邊都不是，講出來的話會是錯的。時機沒註明的那些不進來比——不知道是什麼情況下量的，
  // 就不該拿它說話。
  const GLUCOSE_TIMING = {
    fasting: ['fasting glucose', '空腹血糖'],
    'post-meal-2h': ['glucose two hours after a meal', '飯後兩小時血糖']
  };
  for (const [timing, [labelEn, labelZh]] of Object.entries(GLUCOSE_TIMING)) {
    const values = vitals
      .filter((entry) => entry.glucoseContext === timing && Number.isFinite(entry.glucose))
      .map((entry) => entry.glucose);
    if (values.length < MIN_READINGS) continue;
    const latest = values[0];
    const usual = median(values.slice(1));
    if (!Number.isFinite(usual) || usual === 0) continue;
    const shift = Math.round(((latest - usual) / usual) * 100);
    if (Math.abs(shift) < 12) continue;
    observations.push({
      id: `glucose-${timing}-shift`,
      en: `Your latest ${labelEn} is ${Math.abs(shift)}% ${shift > 0 ? 'above' : 'below'} your own usual for readings taken at that same time (${latest} mg/dL, usually about ${usual} mg/dL).`,
      zh: `你最近一次的${labelZh}，比自己同樣時機量到的平常${shift > 0 ? '高' : '低'}約 ${Math.abs(shift)}%（這次 ${latest} mg/dL，平常大約 ${usual} mg/dL）。`
    });
  }

  // 跨訊號：哪些事情是同一段時間發生的。
  //
  // 這件事原本我打算交給 LLM，但它其實算得出來——而且算的比模型可靠。引擎每一項各自
  // 跟自己的平常比，所以看不到「作息開始亂的那幾天，剛好也是飲水掉下來的日子」。
  // 那個重疊是找得出來的：把每一項「不對勁的日子」列出來，看它們重不重疊就好。
  //
  // 為什麼寧可用算的：沒有金鑰、網路不通、超出預算的時候它照樣在，而且同樣的資料永遠
  // 給同樣的答案。LLM 負責把它講得更順，但這段分析本身不依賴 LLM。
  const flaggedDays = (entries, key, matches) => {
    const days = new Set();
    for (const entry of entries) {
      const when = new Date(entry[key]);
      if (Number.isNaN(when.getTime())) continue;
      if (matches(entry)) days.add(when.toISOString().slice(0, 10));
    }
    return days;
  };

  const overlaps = [];
  const routineDays = flaggedDays(checkIns, 'createdAt', (e) => e.routine && e.routine !== 'on-track');
  const energyDays = flaggedDays(checkIns, 'createdAt', (e) => e.energy && e.energy !== 'steady');
  const shared = (a, b) => [...a].filter((day) => b.has(day)).length;

  // 第一版我拿「低於整體中位數」當低飲水，跑出來永遠不成立——因為那幾個低的日子本身
  // 就把中位數拉下去了。測試抓到的。
  //
  // 該問的其實是另一件事：作息有變化的那幾天，飲水跟其他天比起來有沒有差。
  // 兩組直接比，不需要一個會被自己汙染的基準線。
  const waterOn = (days, want) => vitals
    .filter((v) => {
      const when = new Date(v.measuredAt);
      if (Number.isNaN(when.getTime()) || !Number.isFinite(v.waterMl)) return false;
      return days.has(when.toISOString().slice(0, 10)) === want;
    })
    .map((v) => v.waterMl);

  const onFlagged = waterOn(routineDays, true);
  const onOthers = waterOn(routineDays, false);
  if (onFlagged.length >= 2 && onOthers.length >= 2) {
    const flaggedUsual = median(onFlagged);
    const othersUsual = median(onOthers);
    const gap = Math.round(((othersUsual - flaggedUsual) / othersUsual) * 100);
    if (gap >= 20) {
      overlaps.push({
        id: 'routine-water-overlap',
        en: `On the days your routine was different, you drank about ${gap}% less than on your other days. They are moving together rather than separately.`,
        zh: `作息跟平常不一樣的那幾天，你的飲水比其他天少了大約 ${gap}%。這兩件事是一起在動的，不是各自發生。`
      });
    }
  }

  const routineAndEnergy = shared(routineDays, energyDays);
  if (routineAndEnergy >= 3) {
    overlaps.push({
      id: 'routine-energy-overlap',
      en: `Lower energy and a changed routine fell on the same ${routineAndEnergy} days. Whichever came first, they are not separate things.`,
      zh: `精神比較低跟作息不一樣，有 ${routineAndEnergy} 天是同一天發生的。不論哪個先來，這兩件事不是分開的。`
    });
  }

  observations.push(...overlaps);

  if (observations.length) {
    // 支持者要被提醒的是「在累積的事」，不是今天的快照。今天不好過可能只是今天，
    // 連續五天不好過是另一回事，而支持者常常是在第五天才第一次打開這頁。
    const persisting = observations
      .filter((entry) => entry.streak >= 3 || entry.direction === 'building')
      .map((entry) => entry.id);
    return {
      observations,
      enough: true,
      persisting,
      // 最長的那條連續，用來決定要不要在畫面上把它提到最前面
      longestStreak: Math.max(0, ...observations.map((entry) => entry.streak || 0))
    };
  }
  return {
    observations: [],
    enough: false,
    // 資料不夠就直說。硬給一句聽起來有根據的話，比沒有更糟。
    note: {
      en: 'There is not enough written down yet to compare today with your own usual pattern. A few more days of check-ins will make this section useful.',
      zh: '目前記下來的還不夠，沒辦法拿今天跟你自己的平常比。再記幾天，這一段就會有東西可以看。'
    }
  };
}

export function encouragementFor(input) {
  const urgent = input.concern === 'immediate-danger' || input.selfHarmThoughts === 'yes' || input.perceptionSafety === 'harm-command';
  if (urgent) {
    return {
      en: 'Thank you for saying this directly. Please stay with a real person now; everything else can wait.',
      zh: '謝謝你直接把這件事說出來。現在先和身邊的真人待在一起，其他事情都可以往後放。'
    };
  }

  const harder = [];
  const add = (condition, en, zh) => { if (condition) harder.push({ en, zh }); };
  add(input.energy === 'low', 'lower energy', '精神比較低');
  add(input.energy === 'very-low', 'very little energy', '精神很低');
  add(input.mood === 'low', 'a lower mood', '心情比較低落');
  add(input.mood === 'very-low', 'a very low mood', '心情很低落');
  add(input.sleep === 'interrupted', 'interrupted sleep', '睡眠斷斷續續');
  add(input.sleep === 'very-little', 'very little sleep', '睡眠很少');
  add(input.nourishment === 'less', 'less food or water', '吃喝比平常少');
  add(input.nourishment === 'missed', 'missing food or water', '今天幾乎沒吃喝');
  add(input.taskLoad === 'harder', 'more effort to get started', '開始事情比較費力');
  add(input.taskLoad === 'stuck', 'feeling stuck when starting', '開始事情時卡住');
  add(input.thinking === 'forgetful', 'memory feeling different', '記憶跟平常不同');
  add(input.thinking === 'perception', 'your surroundings feeling different', '對周遭的感覺跟平常不同');

  let en;
  let zh;
  if (harder.length) {
    en = `Today you mentioned ${harder.map((item) => item.en).join(', ')}. Putting it into words gives today a little more room; you do not have to sort it all out at once.`;
    zh = `你今天提到${harder.map((item) => item.zh).join('、')}。能把這些說清楚，已經替今天留了一點空間；不用一次全部處理完。`;
  } else {
    en = 'Today looks close to your usual pace. Taking a moment to notice that still matters, and this check-in is enough for now.';
    zh = '今天大致維持著你平常的步調。願意停一下看看自己的狀態仍然很重要，這次回報做到這裡就夠了。';
  }

  if (input.helpRoute === 'supporter' || input.supportChoice === 'supporter') {
    en += ' You also chose to involve Jordan, and you still confirm what is shared.';
    zh += ' 你也選擇讓 Jordan 加入，分享哪些內容仍由你最後確認。';
  }
  return { en, zh };
}

export function createDailySupport(input, history, now = Date.now()) {
  assertInput(input);
  const basis = observationsFrom(history || {}, now);

  if (input.concern === 'immediate-danger' || input.selfHarmThoughts === 'yes' || input.perceptionSafety === 'harm-command') {
    return {
      level: 'urgent',
      ruleId: 'SAFETY-IMMEDIATE-01',
      basis,
      encouragement: encouragementFor(input),
      aiMayOverride: false,
      headline: 'Get immediate human help now',
      reason: input.selfHarmThoughts === 'yes'
        ? 'You reported thoughts of hurting yourself.'
        : input.perceptionSafety === 'harm-command'
          ? 'You reported an experience telling you to hurt yourself or someone else.'
          : 'You selected an immediate safety concern.',
      // 這一條走的是固定安全路徑，AI 不能改。文字也一樣要穩：不評論、不追問、不安慰過頭，
      // 只把「有人可以找」講清楚。這種時刻，多餘的字是負擔。
      context: {
        en: 'This route does not change based on anything else you answered, and nothing here is sent anywhere without you. Reaching a person is the step that matters now — the rest can wait.',
        zh: '這條路徑不會因為你其他的回答而改變，這裡也不會有任何內容自己送出去。現在最重要的是找到一個人，其他的都可以等。'
      },
      nextSteps: [
        'Contact local emergency services now — in Taiwan, call 119 or 110 if anyone may be hurt.',
        'Call Taiwan’s 1925 support line, or stay with a trusted person who can reach you now.'
      ],
      officialResource: { label: 'Ministry of Health and Welfare · 1925 support line', url: 'https://www.mohw.gov.tw/cp-3202-21901-1.html' },
      supporterOption: {
        label: 'Call Jordan now',
        requiresConfirmation: true
      }
    };
  }

  if (input.thinking === 'perception') {
    return {
      level: 'check-in', ruleId: 'MENTAL-PERCEPTION-01', basis, encouragement: encouragementFor(input), aiMayOverride: false,
      headline: 'Talk with a person about what you noticed',
      reason: 'You reported an unusual perception or experience today.',
      context: { en: 'This does not identify a diagnosis. A trusted person or qualified professional can help understand what happened and whether anything needs attention.', zh: '這不代表任何診斷。可信任的人或專業人員可以一起了解發生了什麼，以及是否需要進一步處理。' },
      nextSteps: ['Stay near someone you trust if the experience feels frightening.', 'Arrange a professional conversation if this continues or affects daily life.'],
      officialResource: { label: 'MOHW Nantou Hospital · Understanding psychosis symptoms', url: 'https://www.nant.mohw.gov.tw/?aid=509&pid=34&page_name=detail&iid=66' },
      supporterOption: input.supportChoice === 'supporter' ? { label: 'Ask Jordan to check in', requiresConfirmation: true } : null
    };
  }

  if (input.mood === 'very-low') {
    return {
      level: 'check-in', ruleId: 'MENTAL-MOOD-01', basis, encouragement: encouragementFor(input), aiMayOverride: false,
      headline: 'Do not carry this alone today',
      reason: 'You reported a very low mood today.',
      context: { en: 'This daily answer is not a depression diagnosis or a BSRS-5 score. Duration, safety, and what support you want are the useful next pieces of context.', zh: '這個每日回答不是憂鬱症診斷，也不是 BSRS-5 分數。接下來有用的脈絡是持續多久、目前是否安全，以及你想要哪種支持。' },
      nextSteps: ['Choose one person or professional service you could contact today.', 'Use the official mood resource if you want a separate self-check.'],
      officialResource: { label: 'Health Promotion Administration · BSRS-5 official page', url: 'https://health99.hpa.gov.tw/onlineQuiz/bsrs5' },
      supporterOption: input.supportChoice === 'supporter' ? { label: 'Ask Jordan to check in', requiresConfirmation: true } : null
    };
  }

  if (input.thinking === 'forgetful') {
    return {
      level: 'watch', ruleId: 'MENTAL-MEMORY-01', basis, encouragement: encouragementFor(input), aiMayOverride: false,
      headline: 'Write down the memory change',
      reason: 'You reported that memory felt different from usual.',
      context: { en: 'One report cannot diagnose dementia. What matters for a professional conversation is whether this is new and whether it affects familiar daily tasks.', zh: '單次回報不能判定失智症。和專業人員討論時，重要的是這是否為最近出現，以及是否影響熟悉的日常活動。' },
      nextSteps: ['Note one concrete example and when it happened.', 'If the change is new or affects daily life, arrange a professional assessment.'],
      officialResource: { label: 'Health Promotion Administration · Ten warning signs of dementia', url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=871&pid=8018&sid=4875' },
      supporterOption: input.supportChoice === 'supporter' ? { label: 'Ask Jordan to check in', requiresConfirmation: true } : null
    };
  }

  const routineChanged = input.routine !== 'on-track';
  const needsCheckIn = input.energy === 'very-low' || input.sleep === 'very-little' || input.nourishment === 'missed' || input.taskLoad === 'stuck' || input.routine === 'off-track' || input.concern === 'need-help';

  if (needsCheckIn) {
    return {
      level: 'check-in',
      ruleId: 'SUPPORT-CHECKIN-02',
      basis,
      encouragement: encouragementFor(input),
      aiMayOverride: false,
      headline: 'Make today smaller',
      reason: routineChanged
        ? 'Your energy and routine look different from your usual pattern.'
        : 'You asked for some help today.',
      // 只給兩句指示太薄，讀起來像系統在下命令。多說一段：這個建議站在什麼立場，
      // 以及這一天不好過並不代表做錯了什麼。溫度不是加形容詞，是把人的處境講出來。
      context: {
        en: 'A harder day is not a setback and it is not something you did wrong. What this suggests is not a rule — it is one smaller shape for today, offered because your own recent entries look different from your usual. You know things about today that no record holds, so if this does not fit, it is yours to ignore.',
        zh: '今天比較難不代表退步，也不代表你哪裡做錯了。下面這個建議不是規定，只是把今天縮小一點的一種做法——會這樣建議，是因為你自己最近的紀錄跟你平常的樣子不太一樣。今天發生了什麼，你知道的比任何紀錄都多；覺得不合，就放著不用。'
      },
      nextSteps: [
        'Choose one planned task to pause or shorten.',
        'Write one question you want to ask at your next visit.'
      ],
      supporterOption: input.supportChoice === 'supporter'
        ? { label: 'Ask Jordan to check in', requiresConfirmation: true }
        : null
    };
  }

  if (routineChanged || input.energy === 'low' || input.sleep === 'interrupted' || input.nourishment === 'less' || input.taskLoad === 'harder') {
    return {
      level: 'watch',
      ruleId: 'SUPPORT-WATCH-01',
      basis,
      encouragement: encouragementFor(input),
      aiMayOverride: false,
      headline: 'Protect your pace',
      reason: 'One part of today feels different, while the rest of your routine is still in place.',
      context: {
        en: 'Most of today is holding, and one part is not. That is worth noticing without treating it as a problem to solve — a single different day is usually just a day. What follows is a way to keep some room, in case today asks for more than you expected.',
        zh: '今天大部分都還撐著，只有一部分不太一樣。這值得留意，但不必當成要立刻解決的問題——單獨一天不同，通常就只是一天而已。下面這幾件事是幫你留一點餘裕，萬一今天比你預期的還花力氣。'
      },
      nextSteps: [
        'Keep your next task short and leave time to reset.',
        'Check back later only if it would be useful.'
      ],
      supporterOption: input.supportChoice === 'supporter'
        ? { label: 'Ask Jordan to check in', requiresConfirmation: true }
        : null
    };
  }

  return {
    level: 'routine',
    ruleId: 'SUPPORT-ROUTINE-01',
    basis,
    encouragement: encouragementFor(input),
    aiMayOverride: false,
    headline: 'One small step is enough',
    reason: 'Your self-reported energy and routine are close to your usual pattern.',
    context: {
      en: 'Today reads close to your usual, and steady days are worth recording too — they are what the harder ones get compared against. Nothing here needs acting on. Writing it down is the whole of it.',
      zh: '今天跟你平常差不多。平順的日子一樣值得記下來——之後比較難的那幾天，就是拿這些天當基準。這裡沒有什麼需要你去做，記下來本身就是完成了。'
    },
    nextSteps: [
      'Keep one routine that already works for you.',
      'Save one question if anything feels different later.'
    ],
    supporterOption: null
  };
}
