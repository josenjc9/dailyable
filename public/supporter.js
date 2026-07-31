const tr = (value) => window.DailyAbleI18n?.t(value) || value;
let items = [];
let activeFilter = 'all';
// 本人在自己畫面上看到的那份依據。支持者要讀到同一份，不能兩邊各講各的。
let sharedBasis = null;
let supporterCare = null;
let helplines = null;
// 從庇護與就服知識系統檢索出來的話術、做法與理論依據。
let guidance = null;
// LLM 把事實與知識組成的分析。沒有就是沒有，下面的內容本來就完整。
let narrative = null;
// 走勢只有在本人打開「趨勢圖」那一項時才會送過來，沒授權時這裡就是 null。
let sharedSeries = null;
let sharedScopes = [];
let sharedDisclaimer = null;
let recordCounts = null;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function replaceContent(target, ...children) {
  while (target.firstChild) target.removeChild(target.firstChild);
  target.append(...children);
}

const RECORD_TIMEOUT_MS = 4500;

async function fetchWithRetry(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), RECORD_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
      if (response.ok || (response.status < 500 && ![408, 429].includes(response.status))) return response;
      lastError = new Error(`Request failed: ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('Request failed');
}

function recordsRetry(section, relationshipId) {
  const message = node('p', 'empty-state', tr('Could not load records right now.'));
  const retry = node('button', 'button secondary', tr('Retry loading trend'));
  retry.type = 'button';
  retry.addEventListener('click', () => {
    replaceContent(section, node('h2', '', tr('WHAT THEY RECORDED')), node('p', '', tr('Loading their own trend…')));
    loadBodyRecords(relationshipId, section);
  });
  replaceContent(section, node('h2', '', tr('WHAT THEY RECORDED')), message, retry);
}

function restartDemoLink() {
  const link = node('a', 'button secondary', tr('Restart Alex demo'));
  link.href = '/demo/enter?persona=jordan';
  return link;
}

function recordDensity(counts) {
  if (!counts) return null;
  const zh = document.documentElement?.lang?.startsWith('zh');
  const section = node('section', 'record-density');
  const labels = [
    ['checkIns', zh ? '次回報' : 'check-ins'],
    ['vitals', zh ? '筆身體紀錄' : 'body readings'],
    ['medications', zh ? '筆用藥' : 'medication records'],
    ['meals', zh ? '筆飲食' : 'meal records']
  ];
  for (const [key, label] of labels) {
    const item = node('article');
    item.append(node('strong', '', String(counts[key] || 0)), node('span', '', label));
    section.append(item);
  }
  if (counts.from && counts.to) {
    const locale = zh ? 'zh-TW' : 'en-GB';
    const format = { year: 'numeric', month: 'short', day: 'numeric' };
    const from = new Date(counts.from).toLocaleDateString(locale, format);
    const to = new Date(counts.to).toLocaleDateString(locale, format);
    section.append(node('p', 'record-density-range', zh ? `紀錄涵蓋 ${from} 至 ${to}` : `History from ${from} to ${to}`));
  }
  return section;
}

function currentRecordId() {
  const match = location.pathname.match(/^\/supporter\/(?:people|plans)\/([a-z0-9-]+)$/);
  return match ? match[1] : null;
}

function priorityClass(value) {
  return String(value).replace(/[^a-z-]/g, '');
}

function visibleItems() {
  const filtered = activeFilter === 'all' ? items : items.filter((item) => item.priority === activeFilter);
  return location.pathname === '/supporter' ? filtered.slice(0, 3) : filtered;
}

function queueRow(item) {
  const link = node('a', 'queue-row');
  link.href = `/supporter/people/${encodeURIComponent(item.id)}`;
  link.setAttribute('aria-label', `${item.name}, ${tr(item.priorityLabel)}, ${tr(item.observableReasons[0])}`);

  const person = node('div');
  person.append(node('strong', '', item.name), node('small', '', tr(item.updatedAt)));
  const reason = node('p', 'queue-reason', tr(item.observableReasons[0]));
  const priority = node('span', `priority ${priorityClass(item.priority)}`, tr(item.priorityLabel));
  const status = node('span', 'status-tag', tr(item.connectionLabel));
  link.append(person, reason, priority, status);
  return link;
}

function renderQueue() {
  const list = document.querySelector('#queue-list');
  if (!list) return;
  const visible = visibleItems();
  if (!visible.length) {
    replaceContent(list, node('p', 'empty-state', tr('No demo items in this view.')), restartDemoLink());
    return;
  }
  replaceContent(list, ...visible.map(queueRow));
}

function renderStats() {
  const values = {
    '#stat-now': items.filter((item) => item.priority === 'check-now').length,
    '#stat-today': items.filter((item) => item.priority === 'review-today').length,
    '#stat-routine': items.filter((item) => item.priority === 'routine').length
  };
  Object.entries(values).forEach(([selector, value]) => {
    const target = document.querySelector(selector);
    if (target) target.textContent = value;
  });
}

function detailSection(title, value, list = false) {
  const section = node('section', 'detail-section');
  section.append(node('h2', '', tr(title)));
  if (list) {
    const ul = node('ul');
    value.forEach((entry) => ul.append(node('li', '', tr(entry))));
    section.append(ul);
  } else {
    section.append(node('p', '', tr(value)));
  }
  return section;
}

function functionalSection(item) {
  const section = node('section', 'detail-section');
  section.append(node('h2', '', tr('FUNCTIONAL SUPPORT VIEW')));
  const grid = node('div', 'portal-grid');
  item.functionalSignals.forEach((entry) => {
    const card = node('article', 'portal-card half');
    card.append(node('h3', '', tr(entry.area)), node('p', '', tr(entry.signal)), node('strong', '', tr(entry.support)));
    grid.append(card);
  });
  section.append(grid);
  return section;
}

// 收起來的段落用瀏覽器內建的 details/summary，不自己做。它天生就能用鍵盤打開、
// 讀螢幕的人也聽得到「已收合／已展開」，自己寫一個只會做得比較差。
function foldable(titleKey, content) {
  const box = document.createElement('details');
  box.className = 'detail-fold';
  const head = document.createElement('summary');
  head.textContent = tr(titleKey);
  const inner = content.querySelector('h2');
  if (inner) inner.remove();
  box.append(head, content);
  return box;
}

function renderPerson(item) {
  const detail = document.querySelector('#person-detail');
  if (!detail) return;
  document.querySelector('#person-name').textContent = item.name;
  document.querySelector('#person-summary').textContent = `${tr(item.priorityLabel)} · ${tr(item.context)}`;
  const links = node('div', 'link-row');
  const plan = node('a', 'button primary', tr('Open support plan'));
  plan.href = `/supporter/plans/${encodeURIComponent(item.id)}`;
  const follow = node('a', 'button secondary', tr('View follow-up record'));
  follow.href = '/supporter/follow-up';
  links.append(plan, follow);
  const bodySection = node('section', 'detail-section');
  bodySection.id = 'body-record-section';
  bodySection.append(node('h2', '', tr('WHAT THEY RECORDED')));
  bodySection.append(node('p', '', tr('Loading their own trend…')));
  // 這頁原本是七段等重的文字疊在一起，打開來像一份報表：支持者得自己讀完才知道現在
  // 該做什麼。有人在等他回覆的時候，這個排法就是障礙。
  //
  // 改成三層：先一句「現在做這件事」，再來是本人分享的走勢跟摘要，其餘的判斷依據、
  // 要排除的因素、授權範圍收進可展開的段落——需要細看的時候才打開。
  // 收起來的東西沒有消失，展開的標題就說得出裡面是什麼，不用點開猜。
  const now = node('section', 'detail-section detail-now');
  now.append(node('h2', '', tr('DO THIS NEXT')));
  now.append(node('p', 'detail-now-action', tr(item.suggestedAction || item.context)));
  const why = node('ul', 'detail-now-why');
  for (const reason of (item.observableReasons || []).slice(0, 2)) {
    why.append(node('li', '', tr(reason)));
  }
  if (why.children.length) now.append(why);

  replaceContent(detail,
    now,
    bodySection,
    foldable('DECISION BASIS', detailSection('DECISION BASIS', item.decisionBasis, true)),
    foldable('CONTEXT TO CONFIRM', detailSection('CONTEXT TO CONFIRM', item.context)),
    foldable('WHAT TO RULE OUT', detailSection('WHAT TO RULE OUT', item.exclusionsToCheck, true)),
    foldable('FUNCTIONAL SUPPORT VIEW', functionalSection(item)),
    foldable('PARTICIPANT PERMISSION', detailSection('PARTICIPANT PERMISSION', item.consent)),
    actionSection(item),
    links
  );
  loadBodyRecords(item.id, bodySection);
}

// The supporter lands on the dashboard, so what they need has to be there rather than one
// click deeper on a detail page. This renders the same consented summary as a short strip.
async function renderBodyOverview() {
  const host = document.querySelector('#body-record-overview');
  if (!host) return;
  const first = items[0];
  if (!first) {
    replaceContent(host, node('p', 'empty-state', tr('No demo items in this view.')));
    return;
  }
  let summary;
  try {
    const response = await fetchWithRetry(`/api/relationships/${encodeURIComponent(first.id)}/body-records`, { credentials: 'same-origin' });
    if (!response.ok) {
      replaceContent(host, node('p', 'empty-state', tr('Nobody has shared their records with you yet.')));
      return;
    }
    const payload = await response.json();
    summary = payload.summary;
    recordCounts = payload.recordCounts || null;
  } catch {
    replaceContent(host, node('p', 'empty-state', tr('Could not load records right now.')));
    return;
  }

  const zh = document.documentElement?.lang?.startsWith('zh');
  const grid = node('div', 'portal-grid');

  for (const [key, en, zhLabel, unit] of MEASURE_ROWS) {
    const measure = summary.measures[key];
    if (!measure || !measure.recordedInWindow) continue;
    const card = node('article', 'portal-card half');
    card.append(node('h3', '', zh ? zhLabel : en));
    card.append(node('strong', '', `${measure.recentAverage} ${unit}`));
    const change = measure.comparedWithOwnBaseline;
    card.append(node('p', '', change
      ? (change.direction === 'same'
        ? (zh ? '跟他自己先前差不多' : 'about the same as their earlier days')
        : (zh
          ? `比他自己先前${change.direction === 'higher' ? '高' : '低'} ${Math.abs(change.change)} ${unit}`
          : `${Math.abs(change.change)} ${unit} ${change.direction} than their earlier days`))
      : (zh ? '先前紀錄不足，還無法比較' : 'not enough earlier entries to compare')));
    grid.append(card);
  }

  const parts = [];
  const density = recordDensity(recordCounts);
  if (density) parts.push(density);
  parts.push(grid);

  const medication = summary.medication;
  if (medication) {
    const card = node('article', 'portal-card full');
    card.append(node('h3', '', zh ? '用藥' : 'Medicine'));
    if (medication.expectedPerDay) {
      card.append(node('p', '', zh
        ? `他登記的用藥計畫是每天 ${medication.expectedPerDay} 次。這段期間有 ${medication.daysMatchingPlan} 天記到相同次數，${medication.daysBelowPlan} 天比計畫少。`
        : `Their plan says ${medication.expectedPerDay} a day. ${medication.daysMatchingPlan} days match it, ${medication.daysBelowPlan} days came in lower.`));
    } else {
      card.append(node('p', '', zh
        ? `這段期間記了 ${medication.dosesRecorded} 次用藥。他還沒登記每天該吃幾次，所以沒有東西可以對照。`
        : `${medication.dosesRecorded} doses recorded. No daily plan entered yet, so there is nothing to compare against.`));
    }
    for (const plan of medication.plans || []) {
      card.append(node('p', 'field-hint', `${plan.name}${plan.timesPerDay ? ` · ${zh ? '每天' : ''}${plan.timesPerDay}${zh ? ' 次' : '/day'}` : ''}${plan.instructions ? ` · ${plan.instructions}` : ''}`));
    }
    parts.push(card);
  }

  const meals = summary.meals;
  if (meals?.nutrition) {
    const card = node('article', 'portal-card full');
    card.append(node('h3', '', zh ? '飲食' : 'Meals'));
    const energy = meals.nutrition.kcal;
    card.append(node('p', '', energy?.dailyAverage
      ? (zh
        ? `有填數字的那 ${energy.daysWithFigures} 天，平均每天 ${energy.dailyAverage} 大卡；醣類 ${meals.nutrition.carbG.dailyAverage ?? '—'} 克、蛋白質 ${meals.nutrition.proteinG.dailyAverage ?? '—'} 克。`
        : `Across the ${energy.daysWithFigures} days with figures: ${energy.dailyAverage} kcal a day, ${meals.nutrition.carbG.dailyAverage ?? '—'} g carbohydrate, ${meals.nutrition.proteinG.dailyAverage ?? '—'} g protein.`)
      : (zh ? '有飲食紀錄，但還沒有填熱量或營養數字。' : 'Meals recorded, but no energy or nutrition figures yet.')));
    if (meals.entriesWithoutFigures) {
      card.append(node('p', 'field-hint', zh
        ? `另有 ${meals.entriesWithoutFigures} 筆只寫了吃什麼、沒填數字，這些沒有算進平均。`
        : `${meals.entriesWithoutFigures} entries name the food without figures and are left out of the averages.`));
    }
    parts.push(card);
  }

  parts.push(node('p', 'field-hint', zh
    ? '以上是本人記錄的數值與他自己的變化，不含判讀或診斷。'
    : 'Recorded values and this person’s own trend. No interpretation, no diagnosis.'));

  replaceContent(host, ...parts);
}

const MEASURE_ROWS = [
  ['systolic', 'Systolic', '收縮壓', 'mmHg'],
  ['diastolic', 'Diastolic', '舒張壓', 'mmHg'],
  ['pulse', 'Pulse', '脈搏', 'bpm'],
  ['glucose', 'Blood glucose', '血糖', 'mg/dL'],
  ['waterMl', 'Water', '飲水', 'mL']
];

// A supporter sees the shape of the person's own trend, never the diary entries. Every
// line says what was recorded and how it compares with that person's earlier days —
// there is no threshold, no colour and no verdict, because that judgement is not theirs
// to make from this screen.
async function loadBodyRecords(relationshipId, section) {
  let summary;
  try {
    const response = await fetchWithRetry(`/api/relationships/${encodeURIComponent(relationshipId)}/body-records`, {
      credentials: 'same-origin'
    });
    if (!response.ok) {
      replaceContent(section,
        node('h2', '', tr('WHAT THEY RECORDED')),
        node('p', '', tr('This person has not shared their body records with you.'))
      );
      return;
    }
    const payload = await response.json();
    summary = payload.summary;
    sharedBasis = payload.basis || null;
    guidance = payload.guidance || null;
    supporterCare = payload.care || null;
    helplines = payload.helplines || null;
    narrative = payload.narrative || null;
    sharedSeries = payload.series || null;
    sharedScopes = payload.scopes || [];
    sharedDisclaimer = payload.disclaimer || null;
    recordCounts = payload.recordCounts || null;
  } catch {
    recordsRetry(section, relationshipId);
    return;
  }

  const zh = document.documentElement?.lang?.startsWith('zh');
  const list = node('ul', 'permission-items');
  for (const [key, en, zhLabel, unit] of MEASURE_ROWS) {
    const measure = summary.measures[key];
    if (!measure || !measure.recordedInWindow) continue;
    const label = zh ? zhLabel : en;
    const change = measure.comparedWithOwnBaseline;
    const trend = change
      ? (change.direction === 'same'
        ? (zh ? '跟先前差不多' : 'about the same as before')
        : `${zh ? '比先前' : ''}${change.direction === 'higher' ? (zh ? '高' : 'higher than before by ') : (zh ? '低' : 'lower than before by ')}${zh ? '約 ' : ''}${Math.abs(change.change)} ${unit}`)
      : (zh ? '先前紀錄不足，還無法比較' : 'not enough earlier entries to compare');
    const item = node('li', '', `${label} · ${zh ? '近期平均' : 'recent average'} ${measure.recentAverage} ${unit} · ${trend} · ${measure.recordedInWindow} ${zh ? '筆' : 'entries'}`);
    list.append(item);
  }

  const parts = [node('h2', '', tr('WHAT THEY RECORDED'))];
  const density = recordDensity(recordCounts);
  if (density) parts.push(density);
  if (list.children.length) parts.push(list);
  else parts.push(node('p', '', zh ? '這 30 天沒有身體數據紀錄。' : 'No body records in the last 30 days.'));

  // 趨勢圖：本人有打開那一項才有資料，沒有的話說清楚沒有，不留一個空框讓人以為壞了。
  const chartHost = node('div', 'shared-trend');
  if (sharedSeries?.length && window.DailyAbleTrends) {
    parts.push(node('p', 'eyebrow', zh ? '本人分享的趨勢圖' : 'TREND SHARED BY THIS PERSON'));
    // 支持者要知道這張圖是怎麼來的、給到哪一階。看到別人的健康走勢卻不知道是誰決定給的，
    // 那就變成監看；寫清楚是本人選的、隨時收得回，這張圖才站得住。
    parts.push(node('p', 'field-hint', sharedScopes.includes('trend_values')
      ? (zh ? '這是本人自己選擇分享的，含實際數值。他隨時可以改成只給形狀或只給摘要。'
        : 'Shared by this person, including the readings themselves. They can change it to shape-only or summary-only at any time.')
      : (zh ? '這是本人自己選擇分享的，只給走勢形狀、不含實際數值。他隨時可以收回。'
        : 'Shared by this person as shape only — the readings themselves are not included. They can withdraw it at any time.')));
    parts.push(chartHost);
  } else {
    parts.push(node('p', 'field-hint', sharedScopes.includes('trend_chart')
      ? (zh ? '這段時間沒有足夠的紀錄可以畫成走勢。' : 'Not enough entries in this stretch to draw a trend.')
      : (zh ? '這位使用者還沒分享趨勢圖。要看走勢的話，請他在「連結管理」那頁打開這一項。'
        : 'This person has not shared their trend chart. They can turn it on from their connections page.')));
  }

  // LLM 的分析放最上面——它是把下面所有東西串起來的那段話。沒有它的時候下面照樣完整，
  // 所以這裡不留空位、不顯示載入中，有就出現、沒有就當它不存在。
  if (narrative?.text) {
    const box = node('section', 'narrative');
    box.append(node('p', 'guidance-label', zh ? '這幾天合起來看' : 'READING THESE DAYS TOGETHER'));
    // 模型輸出的是 SEEN / MIGHT BE / TRY 三段，照段落拆開比一整塊好讀
    for (const para of narrative.text.split(/\n{1,}/).map((s) => s.trim()).filter(Boolean)) {
      box.append(node('p', 'narrative-line', para));
    }
    box.append(node('p', 'field-hint', zh
      ? 'AI 依據上面那些紀錄與專業知識整理，它不做診斷、也不替你決定。判斷仍然在你跟本人身上。'
      : 'Written by AI from the records above and the practice knowledge below. It does not diagnose and it does not decide for you.'));
    parts.push(box);
  }

  // 支持者常常是在第五天才第一次打開這頁。今天不好過可能只是今天，連續五天是另一回事，
  // 而那個差別在一堆條列裡看不出來。持續中的事要自己站出來說話。
  if (sharedBasis?.longestStreak >= 3) {
    const alert = node('div', 'streak-alert');
    alert.append(node('p', 'guidance-label', zh ? '這件事在持續' : 'THIS HAS BEEN GOING ON'));
    for (const observation of sharedBasis.observations || []) {
      if (!(observation.streak >= 3 || observation.direction === 'building')) continue;
      alert.append(node('p', 'streak-line', zh ? observation.zh : observation.en));
    }
    alert.append(node('p', 'field-hint', zh
      ? '連續幾天跟單獨一天不一樣。如果你是這幾天第一次打開，這幾件是他已經經歷了一段時間的。'
      : 'A run of days is not the same as one day. If this is your first look in a while, these are what they have been carrying.'));
    parts.push(alert);
  }

  // 「看到紀錄了，然後呢」——這一段就是答案。
  //
  // 支持者多半沒有受過專業訓練，是家屬、社工、庇護工場的輔導員。他打開這頁的當下卡住的
  // 是「我等一下要說什麼、我怕說錯話」。只給他觀察，等於把功課丟回去。
  //
  // 這裡把觀察接上知識庫裡的現場話術、介入模型與理論依據，而且每一條都指得出出處——
  // 講得出依據哪一篇，這些建議才站得住，不然就只是聽起來很專業的話。
  if (guidance?.enough) {
    parts.push(node('p', 'eyebrow', zh ? '可以怎麼做' : 'WHAT YOU CAN DO'));
    const box = node('div', 'guidance');

    if (guidance.phrases?.length) {
      box.append(node('p', 'guidance-label', zh ? '可以這樣開口' : 'A WAY TO OPEN'));
      for (const item of guidance.phrases) {
        const card = node('div', 'guidance-card');
        card.append(node('strong', '', item.title));
        if (item.say) card.append(node('p', 'guidance-say', `「${item.say}」`));
        if (item.tone) card.append(node('p', 'guidance-note', (zh ? '語氣：' : 'Tone: ') + item.tone));
        // 「不要說什麼」跟「可以說什麼」一樣重要，而且更少人講
        if (item.avoid) card.append(node('p', 'guidance-avoid', item.avoid));
        box.append(card);
      }
    }

    if (guidance.approaches?.length) {
      box.append(node('p', 'guidance-label', zh ? '可以試的做法' : 'APPROACHES TO TRY'));
      for (const item of guidance.approaches) {
        const card = node('div', 'guidance-card');
        card.append(node('strong', '', item.title));
        if (item.purpose) card.append(node('p', '', item.purpose));
        if (item.steps) card.append(node('p', 'guidance-note', item.steps));
        box.append(card);
      }
    }

    if (guidance.theories?.length) {
      box.append(node('p', 'guidance-label', zh ? '這些建議的依據' : 'WHAT THESE REST ON'));
      for (const item of guidance.theories) {
        const card = node('div', 'guidance-card guidance-theory');
        card.append(node('strong', '', item.title));
        if (item.plain) card.append(node('p', '', item.plain));
        box.append(card);
      }
    }

    box.append(node('p', 'field-hint', zh
      ? '這些是一般性的做法參考，來自庇護與就業服務的專業知識，不是針對這個人的診斷。你比任何資料都更了解他今天的處境，覺得不合就不要用。'
      : 'These are general approaches drawn from sheltered-employment and support practice. They are not a diagnosis of this person. You know more about their day than any record does — if something does not fit, do not use it.'));
    parts.push(box);
  }

  // 官方衛教分兩批出，因為說話對象不同，混在一起兩邊都走味：
  //
  //   audience 'both'      → 講他照顧的那個人（吞嚥、防跌、用藥），排在「怎麼幫他」的區域
  //   audience 'supporter' → 講支持者自己（照顧者負荷），用深色塊跟上面整個切開——
  //                          翻到那裡等於產品換了說話對象，第一版把兩批混進同一塊，
  //                          「這一段是給你的」裡出現嗆咳衛教，框架直接破功。
  const aboutPerson = (supporterCare?.entries || []).filter((entry) => entry.audience === 'both');
  const aboutSelf = (supporterCare?.entries || []).filter((entry) => entry.audience === 'supporter');

  if (aboutPerson.length) {
    const watch = node('div', 'guidance');
    watch.append(node('p', 'guidance-label', zh ? '照顧上可以留意' : 'WORTH KEEPING AN EYE ON'));
    for (const entry of aboutPerson) {
      const card = node('div', 'guidance-card');
      card.append(node('strong', '', zh ? entry.title : (entry.titleEn || entry.title)));
      for (const quote of entry.quotes) card.append(node('p', 'guidance-note', quote.text));
      if (entry.whenToSeek) card.append(node('p', 'guidance-avoid', entry.whenToSeek.text));
      card.append(node('p', 'understanding-source',
        (zh ? '出處：' : 'Source: ') + (zh ? entry.quotes[0].source.org : (entry.quotes[0].source.orgEn || entry.quotes[0].source.org))));
      watch.append(card);
    }
    parts.push(watch);
  }

  // 照顧者關懷專線的來電裡，42.4% 是照顧者在講自己撐不住。一個撐不住的支持者
  // 幫不了任何人，所以這一塊講的是「你自己呢」。
  if (aboutSelf.length) {
    const own = node('div', 'supporter-own');
    own.append(node('p', 'guidance-label', zh ? '這一段是給你的' : 'THIS PART IS FOR YOU'));
    for (const entry of aboutSelf) {
      const card = node('div', 'supporter-own-card');
      card.append(node('strong', '', zh ? entry.title : (entry.titleEn || entry.title)));
      for (const quote of entry.quotes) card.append(node('p', 'guidance-note', quote.text));
      card.append(node('p', 'understanding-source',
        (zh ? '出處：' : 'Source: ') + (zh ? entry.quotes[0].source.org : (entry.quotes[0].source.orgEn || entry.quotes[0].source.org))));
      own.append(card);
    }
    // 電話擺在講完負荷之後——先讓他知道這很常見，再給號碼，順序反過來就變成推銷專線
    const carerLine = (helplines || []).find((line) => line.id === 'carer-0800');
    if (carerLine) {
      own.append(node('p', 'helpline', carerLine.name.includes(carerLine.number)
        ? carerLine.name
        : `${carerLine.name}　${carerLine.number}`));
      own.append(node('p', 'field-hint', zh
        ? '先照顧好自己，才有力氣繼續陪他。'
        : 'Look after yourself first — that is what makes staying beside them possible.'));
    }
    parts.push(own);
  }

  // 本人看到的那幾句，支持者看到一模一樣的幾句。這樣兩邊講的是同一件事，本人也知道對方
  // 讀到什麼——這是這個產品在授權上的主張，不只是畫面好看。
  if (sharedBasis?.observations?.length) {
    parts.push(node('p', 'eyebrow', zh ? '本人畫面上看到的說法' : 'WHAT THIS PERSON SEES ON THEIR OWN SCREEN'));
    const basisList = node('ul', 'permission-items');
    for (const observation of sharedBasis.observations) {
      basisList.append(node('li', '', zh ? observation.zh : observation.en));
    }
    parts.push(basisList);
  }

  // Readings taken at different times are listed apart, because averaging them together
  // would produce a number that means nothing.
  if (summary.glucoseContexts?.length) {
    const glucose = node('ul', 'permission-items');
    for (const entry of summary.glucoseContexts) {
      const contextLabel = entry.interpretable
        ? entry.context
        : (zh ? '未註明時機（無法對照）' : 'timing not noted (cannot be compared)');
      glucose.append(node('li', '', `${contextLabel} · ${entry.count} ${zh ? '筆' : 'entries'} · ${zh ? '平均' : 'average'} ${entry.average} mg/dL`));
    }
    parts.push(node('h2', '', tr('GLUCOSE BY WHEN IT WAS TAKEN')), glucose);
  }

  if (summary.medication?.dosesRecorded) {
    parts.push(node('p', '', zh
      ? `用藥：30 天內記下 ${summary.medication.dosesRecorded} 次，分布在 ${summary.medication.daysRecorded} 天。`
      : `Medicine: ${summary.medication.dosesRecorded} doses recorded across ${summary.medication.daysRecorded} days.`));
  }

  parts.push(node('p', 'field-hint', zh
    ? '以上是本人自己記錄的數值與相對於他自己的變化，不含判讀或診斷。'
    : 'Recorded values and this person’s own trend. No interpretation, no diagnosis.'));

  // 免責聲明跟著資料走：支持者看到的是本人自己的紀錄，不是判讀結果。
  if (sharedDisclaimer) parts.push(node('p', 'caption', zh ? sharedDisclaimer.zh : sharedDisclaimer.en));
  replaceContent(section, ...parts);
  // 圖要在掛進畫面之後才畫，量得到寬度才不會被壓縮。
  if (sharedSeries?.length && window.DailyAbleTrends) {
    window.DailyAbleTrends.draw(chartHost, sharedSeries, 30, {
      relativeIndex: !sharedScopes.includes('trend_values')
    });
  }
}

function resourceSection(options) {
  const section = node('section', 'detail-section');
  section.append(node('h2', '', tr('WHEN TO CONNECT OUTSIDE HELP')));
  const resources = node('div', 'resource-list');
  options.forEach((option) => {
    const link = node('a', 'resource-link');
    link.href = option.url;
    link.rel = 'noreferrer';
    const title = node('strong', '', `${tr(option.label)} ↗`);
    const body = node('p', '', tr(option.when));
    const source = node('small', '', option.source);
    link.append(title, body, source);
    resources.append(link);
  });
  section.append(resources);
  return section;
}

function actionSection(item) {
  const section = node('section', 'detail-section');
  section.append(node('h2', '', tr('RECORD FOLLOW-UP')));
  const status = node('p', 'notice', tr(item.status));
  status.setAttribute('role', 'status');

  const fields = node('div', 'feedback-fields');
  const publicLabel = document.createElement('label');
  publicLabel.append(node('strong', '', tr('Message Alex can see')));
  const participantMessage = document.createElement('textarea');
  participantMessage.maxLength = 600;
  participantMessage.rows = 4;
  participantMessage.placeholder = tr('Acknowledge what Alex shared and write one agreed next step.');
  publicLabel.append(participantMessage);

  const privateLabel = document.createElement('label');
  privateLabel.append(node('strong', '', tr('Internal note · Jordan only')));
  const internalNote = document.createElement('textarea');
  internalNote.maxLength = 1200;
  internalNote.rows = 3;
  internalNote.placeholder = tr('Record service coordination details that Alex does not need to receive.');
  privateLabel.append(internalNote);
  fields.append(publicLabel, privateLabel);

  const boundary = node('p', 'field-hint', tr('Use supportive language and agreed actions. Do not diagnose or give medication instructions.'));
  const actions = node('div', 'link-row');
  [['contacted', 'Record contact'], ['scheduled', 'Schedule follow-up'], ['closed', 'Close demo item']].forEach(([action, label]) => {
    const button = node('button', action === 'contacted' ? 'button primary' : 'button secondary', tr(label));
    button.type = 'button';
    button.addEventListener('click', () => recordAction(item, action, status, {
      participantMessage: participantMessage.value,
      internalNote: internalNote.value
    }));
    actions.append(button);
  });
  section.append(status, fields, boundary, actions);
  return section;
}

function renderPlan(item) {
  const detail = document.querySelector('#plan-detail');
  if (!detail) return;
  document.querySelector('#plan-name').textContent = `${item.name} · ${tr('Support plan')}`;
  const back = document.querySelector('#back-to-person');
  back.href = `/supporter/people/${encodeURIComponent(item.id)}`;
  replaceContent(detail,
    detailSection('SUGGESTED SUPPORT PLAN', item.recommendedPlan, true),
    detailSection('HOW WE WILL KNOW', item.evaluationSignals, true),
    resourceSection(item.connectionOptions),
    actionSection(item)
  );
}

function renderFollowUp() {
  const list = document.querySelector('#follow-up-list');
  if (!list) return;
  replaceContent(list, ...items.map((item) => {
    const row = node('a', 'timeline-row');
    row.href = `/supporter/people/${encodeURIComponent(item.id)}`;
    row.append(node('strong', '', item.name), node('span', '', tr(item.suggestedAction)), node('span', 'status-tag', tr(item.status)));
    return row;
  }));
}

async function recordAction(item, action, status, feedback = {}) {
  const response = await fetch(`/api/supporter/queue/${encodeURIComponent(item.id)}/follow-up`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...feedback })
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    status.textContent = tr(problem.error || 'Could not record');
    return;
  }
  const labels = { contacted: 'Contact recorded', scheduled: 'Follow-up scheduled', closed: 'Demo item closed' };
  item.status = labels[action];
  status.textContent = tr(labels[action]);

  // 做完的事要留下去處：這一項的狀態改了、下次檢視是哪一天也寫出來，回到佇列看得到。
  const body = await response.json().catch(() => ({}));
  if (body.item) Object.assign(item, body.item);
  const when = body.item?.followUp?.nextReviewAt;
  if (when) {
    const chinese = document.documentElement.lang.startsWith('zh');
    const day = new Date(when).toLocaleDateString(chinese ? 'zh-TW' : 'en-GB', { month: 'short', day: 'numeric' });
    status.textContent = chinese
      ? `${tr(labels[action])}，下次檢視 ${day}`
      : `${tr(labels[action])} · next review ${day}`;
  }
}

function renderCurrentPage() {
  renderStats();
  renderQueue();
  renderFollowUp();
  renderBodyOverview();
  const id = currentRecordId();
  if (!id) return;
  const item = items.find((entry) => entry.id === id);
  const target = document.querySelector('#person-detail') || document.querySelector('#plan-detail');
  if (!item) {
    renderMissingRecordState(target);
    return;
  }
  renderPerson(item);
  renderPlan(item);
}

function renderMissingRecordState(target) {
  const title = document.querySelector('#person-name') || document.querySelector('#plan-name');
  const summary = document.querySelector('#person-summary');
  if (title) title.textContent = tr('Record unavailable');
  if (summary) summary.textContent = tr('This link points to an older or unavailable demo record.');
  if (target) replaceContent(target, node('p', 'empty-state', tr('This demo record was not found.')), restartDemoLink());
}

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  renderQueue();
}));

document.addEventListener('dailyable:languagechange', renderCurrentPage);

function renderLoadError() {
  const title = document.querySelector('#person-name') || document.querySelector('#plan-name');
  const summary = document.querySelector('#person-summary');
  if (title) title.textContent = tr('Record unavailable');
  if (summary) summary.textContent = tr('The selected demo record could not be loaded.');
}

function loadData() {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeout;
  const id = currentRecordId();
  const endpoint = id ? `/api/supporter/queue/${encodeURIComponent(id)}` : '/api/supporter/queue';
  return Promise.race([
    fetch(endpoint, controller ? { signal: controller.signal } : {}),
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller?.abort();
        reject(new Error('Queue request timed out'));
      }, 8000);
    })
  ])
  .then((response) => {
    if ([403, 404].includes(response.status) && id) {
      const target = document.querySelector('#person-detail') || document.querySelector('#plan-detail');
      renderMissingRecordState(target);
      return null;
    }
    if (!response.ok) throw new Error('Could not load queue');
    return response.json();
  })
  .then((body) => {
    if (!body) return;
    items = body.item ? [body.item] : body.items;
    renderCurrentPage();
  })
  .catch(() => {
    renderLoadError();
    const target = document.querySelector('#queue-list') || document.querySelector('#person-detail') || document.querySelector('#plan-detail') || document.querySelector('#follow-up-list');
    if (target) {
      const message = node('p', 'empty-state', tr('The demo queue could not load.'));
      const retry = node('button', 'button secondary', tr('Retry'));
      retry.type = 'button';
      retry.addEventListener('click', loadData);
      replaceContent(target, message, retry);
    }
  })
  .finally(() => clearTimeout(timeout));
}

loadData();
