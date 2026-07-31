const form = document.querySelector('#checkin-form');
const steps = [...document.querySelectorAll('.step')];
const nextButton = document.querySelector('#next-button');
const backButton = document.querySelector('#back-button');
const finishButton = document.querySelector('#finish-button');
const progressLabel = document.querySelector('#progress-label');
const progressBar = document.querySelector('#progress-bar');
const error = document.querySelector('#form-error');
const result = document.querySelector('#result');
const resultSteps = document.querySelector('#result-steps');
const adaptivePanel = document.querySelector('#adaptive-follow-up');
const adaptiveContinue = document.querySelector('#adaptive-continue');
const adaptiveSkip = document.querySelector('#adaptive-skip');
const adaptiveBack = document.querySelector('#adaptive-back');
let current = 0;
let currentSupport = null;
let adaptiveReady = false;
const tr = (value) => window.DailyAbleI18n?.t(value) || value;
const SHARE_CONFIRMATION = 'Demo confirmed: Jordan would receive the observable reason and Alex’s request—not unrestricted records.';
const SHARE_FAILURE = 'We could not share this check-in. Nothing was sent. Try again.';
const ANALYSIS_FIELDS = ['energy', 'mood', 'sleep', 'nourishment', 'taskLoad', 'thinking', 'helpRoute', 'moodDuration', 'selfHarmThoughts', 'memoryImpact', 'perceptionSafety'];

function replaceContent(target, nodes) {
  while (target.firstChild) target.removeChild(target.firstChild);
  nodes.forEach((node) => target.appendChild(node));
}

function selectedForStep() {
  // The numbers step is optional on purpose: leaving it blank must not block the check-in.
  if (steps[current].dataset.optional === 'true') return true;
  return steps[current].querySelector('input:checked');
}

// 回報要有往前走的感覺：每次確認只前進一題、進度看得出來、每一步進場有動作。
// 動效一律讓系統的「減少動態」關掉——這個產品的使用者裡有人一看到移動就不舒服。
const calmMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function renderStep({ focusQuestion = true, direction = 'forward' } = {}) {
  steps.forEach((step, index) => {
    const active = index === current;
    step.classList.toggle('active', active);
    if (active && !calmMotion) {
      step.classList.remove('step-enter-back', 'step-enter');
      // 重新觸發動畫：讀一次版面尺寸，瀏覽器才會把上面那次移除當成一輪結束
      void step.offsetWidth;
      step.classList.add(direction === 'back' ? 'step-enter-back' : 'step-enter');
    }
  });
  progressLabel.textContent = document.documentElement.lang.startsWith('zh')
    ? `第 ${current + 1} 步，共 ${steps.length} 步`
    : `Step ${current + 1} of ${steps.length}`;
  progressBar.style.width = `${((current + 1) / steps.length) * 100}%`;
  backButton.hidden = current === 0;
  nextButton.hidden = current === steps.length - 1;
  finishButton.hidden = current !== steps.length - 1;
  error.textContent = '';
  const first = steps[current].querySelector('input');
  if (first && focusQuestion) first.focus();
}

nextButton.addEventListener('click', () => {
  if (!selectedForStep()) {
    error.textContent = tr('Choose the closest answer before continuing.');
    return;
  }
  current += 1;
  renderStep();
});

backButton.addEventListener('click', () => {
  current = Math.max(0, current - 1);
  renderStep({ direction: 'back' });
});

async function csrfToken() {
  try {
    const response = await fetch('/api/csrf', { credentials: 'same-origin' });
    return response.ok ? (await response.json()).token || '' : '';
  } catch {
    return '';
  }
}

// The numbers typed on the last step belong to the body and medicine records, not to the
// check-in itself, so they are posted to their own endpoints. Blank stays blank.
function adaptiveDomains(data) {
  const domains = [];
  if (data.mood === 'very-low') domains.push('mood-duration', 'mood-safety');
  if (data.thinking === 'forgetful') domains.push('memory');
  if (data.thinking === 'perception') domains.push('perception');
  return domains.slice(0, 3);
}

function showAdaptive(domains) {
  for (const question of adaptivePanel.querySelectorAll('[data-adaptive-domain]')) {
    question.hidden = !domains.includes(question.dataset.adaptiveDomain);
  }
  form.hidden = true;
  adaptivePanel.hidden = false;
  progressLabel.textContent = document.documentElement.lang.startsWith('zh') ? '選擇性延伸關心' : 'Optional follow-up';
  progressBar.style.width = '100%';
  adaptivePanel.focus?.();
}

adaptiveContinue.addEventListener('click', () => {
  adaptiveReady = true;
  form.requestSubmit();
});

adaptiveSkip.addEventListener('click', () => {
  for (const input of adaptivePanel.querySelectorAll('input:checked')) input.checked = false;
  adaptiveReady = true;
  form.requestSubmit();
});

adaptiveBack.addEventListener('click', () => {
  adaptiveReady = false;
  adaptivePanel.hidden = true;
  form.hidden = false;
  current = steps.length - 1;
  renderStep();
});

async function saveNumbers(data) {
  const vital = {};
  for (const key of ['systolic', 'diastolic', 'pulse', 'glucose', 'waterMl']) {
    if (data[key]) vital[key] = data[key];
  }
  if (data.glucose && data.glucoseContext) vital.glucoseContext = data.glucoseContext;

  const token = await csrfToken();
  const send = (path, body) => fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify(body)
  });

  const pending = [];
  if (Object.keys(vital).length) pending.push(send('/api/vitals', vital));
  if (data.medicationName) pending.push(send('/api/medications', { name: data.medicationName }));
  await Promise.all(pending);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedForStep()) {
    error.textContent = tr('Choose the closest answer before continuing.');
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  for (const field of ANALYSIS_FIELDS) data[field] ||= null;
  if (!adaptiveReady) {
    const domains = adaptiveDomains(data);
    if (domains.length) {
      showAdaptive(domains);
      return;
    }
  }
  finishButton.disabled = true;
  finishButton.textContent = tr('Preparing…');
  error.textContent = '';
  try {
    const response = await fetch('/api/check-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Request failed');
    currentSupport = await response.json();
    // Numbers are saved after the check-in itself, and a failure here never costs the
    // check-in: someone who managed to report today should not be told they failed.
    await saveNumbers(data).catch(() => {});
    showResult(currentSupport);
  } catch {
    error.textContent = tr('We could not prepare the next step. Please try again.');
  } finally {
    finishButton.disabled = false;
    finishButton.textContent = tr('Show my next step');
  }
});

// 一句結論加兩條指示，讀起來像系統在下命令。這一段講的是「這個建議站在什麼立場」——
// 為什麼這樣建議、以及不照做也可以。今天發生了什麼，本人知道的比任何紀錄都多。
function renderContext(context) {
  const host = document.querySelector('#result-context');
  if (!host) return;
  if (!context) { host.hidden = true; host.textContent = ''; return; }
  host.hidden = false;
  host.textContent = document.documentElement.lang.startsWith('zh') ? context.zh : context.en;
}

// 依據攤開來講。一句「你的精神跟平常不同」沒有說是跟什麼比、看了幾天、根據哪幾筆；
// 這一段就是那些數得出來的事實，而且只跟本人自己前幾天比。
function renderBasis(basis) {
  const host = document.querySelector('#result-basis');
  if (!host) return;
  const chinese = document.documentElement.lang.startsWith('zh');
  host.textContent = '';
  if (!basis) { host.hidden = true; return; }
  host.hidden = false;

  const label = document.createElement('span');
  label.className = 'basis-label';
  label.textContent = chinese ? '這是根據什麼說的' : 'WHAT THIS IS BASED ON';
  host.append(label);

  // 把今天接回那條線上。
  //
  // 「最近五次有三次不一樣」是統計，讀起來像被歸檔。「你今天說的這個，已經連續第三次了」
  // 是有人記得。同一份資料，差別只在有沒有承認今天也算一次。
  if (basis.enough && basis.longestStreak >= 2) {
    const noticed = document.createElement('p');
    noticed.className = 'basis-noticed';
    noticed.textContent = chinese
      ? `今天不是單獨的一天——這已經連續第 ${basis.longestStreak} 次了，你一直有在記。`
      : `Today is not a day on its own — this makes ${basis.longestStreak} in a row, and you have kept writing it down.`;
    host.append(noticed);
  }

  if (!basis.enough) {
    const note = document.createElement('p');
    note.className = 'field-hint';
    note.textContent = chinese ? basis.note.zh : basis.note.en;
    host.append(note);
    return;
  }
  const list = document.createElement('ul');
  for (const observation of basis.observations) {
    const item = document.createElement('li');
    item.textContent = chinese ? observation.zh : observation.en;
    list.append(item);
  }
  const scope = document.createElement('p');
  scope.className = 'field-hint';
  scope.textContent = chinese
    ? '這些是拿你自己前兩週的紀錄比出來的，不跟別人比，也不是診斷。'
    : 'These come from your own entries over the past two weeks. Nothing here is compared with anyone else, and nothing here is a diagnosis.';
  host.append(list, scope);
}

// 官方衛教，接在他今天的紀錄後面。
//
// 這一段原本想放心理學理論，實測之後放棄了：庇護知識庫是寫給就服員看的，濾掉工作者口吻
// 之後剩下的是「正負是加入或移除，不是好壞」這種名詞解釋。對一個剛過完難受一週的人，
// 那不是幫助。改成衛福部的公開衛教——它本來就是寫給民眾看的，而且說得出出處。
//
// 原文一律加引號、一律標機關。不改寫成「你應該多喝水」，那會把政府的衛教變成我們的醫療建議。
function renderCare(care, helplines) {
  const host = document.querySelector('#result-understanding');
  if (!host) return;
  host.textContent = '';
  if (!care?.enough) { host.hidden = true; return; }
  host.hidden = false;
  const chinese = document.documentElement.lang.startsWith('zh');

  const label = document.createElement('p');
  label.className = 'basis-label';
  label.textContent = chinese ? '官方的說法，給你參考' : 'OFFICIAL GUIDANCE, FOR YOUR REFERENCE';
  host.append(label);

  for (const entry of care.entries) {
    const card = document.createElement('div');
    card.className = 'understanding-card';

    const title = document.createElement('p');
    title.className = 'understanding-plain';
    // 標題翻得動，引號裡的原文不翻——翻譯官方衛教等於改寫它，出處就對不上了
    title.textContent = chinese ? entry.title : (entry.titleEn || entry.title);
    card.append(title);

    for (const quote of entry.quotes) {
      const line = document.createElement('p');
      line.className = 'understanding-note';
      line.textContent = quote.text;
      card.append(line);
    }
    // 這一句不能跟上面拆開——腎臟病患者照一般建議喝水是會出事的。
    if (entry.caution) {
      const caution = document.createElement('p');
      caution.className = 'understanding-caution';
      caution.textContent = entry.caution.text;
      card.append(caution);
    }
    if (entry.whenToSeek) {
      const seek = document.createElement('p');
      seek.className = 'understanding-note';
      seek.textContent = (chinese ? '什麼時候該找人看看：' : 'When to get it looked at: ') + entry.whenToSeek.text;
      card.append(seek);
    }
    const from = document.createElement('p');
    from.className = 'understanding-source';
    const org = entry.quotes[0].source;
    from.textContent = (chinese ? '出處：' : 'Source: ') + (chinese ? org.org : (org.orgEn || org.org));
    card.append(from);
    host.append(card);
  }

  // 電話放最後，而且寫清楚幾點打得通。把 1966 說成 24 小時免費專線，
  // 會害人在週日晚上抱著期待打過去。
  if (helplines?.length) {
    const lines = document.createElement('div');
    lines.className = 'helplines';
    for (const line of helplines.slice(0, 2)) {
      const item = document.createElement('p');
      item.className = 'helpline';
      const parts = [line.name.includes(line.number) ? line.name : `${line.name}　${line.number}`];
      if (line.hours) parts.push(line.hours);
      item.textContent = parts.join('　');
      lines.append(item);
    }
    host.append(lines);
  }

  const caveat = document.createElement('p');
  caveat.className = 'field-hint';
  // 收尾這句要把主導權還給他。前面整段都是別人說的話，最後一句得讓他知道自己還是那個決定的人。
  caveat.textContent = chinese
    ? '引號裡是政府網站的公開衛教原文，寫的是一般情況，放在這裡給你參考。你的身體你最清楚，覺得不太對就找醫師看看。'
    : 'The quoted lines are public health-education text from Taiwan government websites, describing general situations, offered here for reference. You know your own body best — if something feels off, have a doctor look at it.';
  host.append(caveat);
}

function renderOfficialResource(resource) {
  if (!resource?.url) return;
  const host = document.querySelector('#result-understanding');
  host.hidden = false;
  const card = document.createElement('div');
  card.className = 'understanding-card official-resource';
  const label = document.createElement('p');
  label.className = 'basis-label';
  label.textContent = tr('OFFICIAL RESOURCE · OPENS THE GOVERNMENT PAGE');
  const link = document.createElement('a');
  link.className = 'text-link';
  link.href = resource.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = `${resource.label} ↗`;
  const note = document.createElement('p');
  note.className = 'field-hint';
  note.textContent = tr('DailyAble does not copy, score, or diagnose from this resource.');
  card.append(label, link, note);
  host.append(card);
}

function showResult(support, shouldFocus = true) {
  form.hidden = true;
  adaptivePanel.hidden = true;
  result.hidden = false;
  document.querySelector('#result-level').textContent = tr(support.level === 'urgent' ? 'IMMEDIATE HUMAN HELP' : 'YOUR DAILY SUPPORT');
  document.querySelector('#result-headline').textContent = tr(support.headline);
  document.querySelector('#result-reason').textContent = tr(support.reason);
  const encouragement = document.querySelector('#result-encouragement');
  encouragement.hidden = !support.encouragement;
  encouragement.textContent = support.encouragement
    ? (document.documentElement.lang.startsWith('zh') ? support.encouragement.zh : support.encouragement.en)
    : '';
  renderContext(support.context);
  renderBasis(support.level === 'urgent' ? null : support.basis);
  renderCare(support.level === 'urgent' ? null : support.care);
  renderOfficialResource(support.officialResource);

  replaceContent(resultSteps, support.nextSteps.map((step) => {
    const item = document.createElement('li');
    item.textContent = tr(step);
    return item;
  }));
  const supportButton = document.querySelector('#support-button');
  supportButton.hidden = !support.supporterOption || support.shareConfirmed === true;
  if (support.supporterOption) supportButton.textContent = tr(support.supporterOption.label);
  document.querySelector('#support-status').textContent = support.shareConfirmed ? tr(SHARE_CONFIRMATION) : '';
  if (shouldFocus) result.focus();
}

document.querySelector('#support-button').addEventListener('click', async (event) => {
  if (!currentSupport?.supporterOption || !currentSupport.checkInId) return;
  const button = event.currentTarget;
  const status = document.querySelector('#support-status');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  button.disabled = true;
  try {
    const token = await csrfToken();
    const response = await fetch(`/api/check-ins/${encodeURIComponent(currentSupport.checkInId)}/share`, {
      method: 'POST',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ relationshipId: 'demo-rel-1' })
    });
    if (!response.ok) throw new Error('Share failed');
    currentSupport.shareConfirmed = true;
    button.hidden = true;
    status.textContent = tr(SHARE_CONFIRMATION);
  } catch {
    status.textContent = tr(SHARE_FAILURE);
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
  }
});

document.querySelector('#restart-button').addEventListener('click', () => {
  form.reset();
  current = 0;
  currentSupport = null;
  adaptiveReady = false;
  adaptivePanel.hidden = true;
  result.hidden = true;
  form.hidden = false;
  renderStep();
});

document.addEventListener('dailyable:languagechange', () => {
  renderStep({ focusQuestion: false });
  if (currentSupport && !result.hidden) showResult(currentSupport, false);
});

renderStep({ focusQuestion: false });
