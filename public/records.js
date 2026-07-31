const zh = () => document.documentElement?.lang?.startsWith('zh');
const say = (english, traditionalChinese) => (zh() ? traditionalChinese : english);

// A blank cell has to read as "not recorded", never as a zero reading. Every formatter
// below returns a dash rather than inventing a value.
const BLANK = '—';

const POSTURE_LABEL = {
  sitting: ['sitting', '坐姿'],
  lying: ['lying', '躺姿'],
  standing: ['standing', '站姿'],
  unspecified: ['not noted', '未註明']
};

const GLUCOSE_LABEL = {
  fasting: ['fasting', '空腹'],
  'post-meal-2h': ['2h after an ordinary meal', '一般吃飯後兩小時'],
  'ogtt-2h': ['glucose tolerance test, 2nd hour', '葡萄糖耐受試驗第二小時'],
  random: ['any other time', '其他時間'],
  unspecified: ['timing not noted', '未註明時機']
};

const MEAL_LABEL = {
  breakfast: ['Breakfast', '早餐'],
  lunch: ['Lunch', '午餐'],
  dinner: ['Dinner', '晚餐'],
  snack: ['Snack', '點心'],
  unspecified: ['Not noted', '未註明']
};

const pick = (table, key) => {
  const pair = table[key] || table.unspecified;
  return zh() ? pair[1] : pair[0];
};

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return BLANK;
  return date.toLocaleString(zh() ? 'zh-TW' : 'en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPressure(record) {
  if (record.systolic === null || record.diastolic === null) return BLANK;
  const posture = pick(POSTURE_LABEL, record.posture);
  return `${record.systolic}/${record.diastolic} mmHg · ${posture}`;
}

function formatGlucose(record) {
  if (record.glucose === null || record.glucose === undefined) return BLANK;
  return `${record.glucose} mg/dL · ${pick(GLUCOSE_LABEL, record.glucoseContext)}`;
}

function cell(row, text, className) {
  const td = document.createElement('td');
  td.textContent = text ?? BLANK;
  if (className) td.className = className;
  row.append(td);
}

function renderVitals(records) {
  const body = document.querySelector('#vital-rows');
  if (!body) return;
  body.textContent = '';
  if (!records.length) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'empty-state';
    td.textContent = say('Nothing recorded yet. Add one reading above.', '還沒有紀錄。在上面加一筆就好。');
    row.append(td);
    body.append(row);
    return;
  }
  for (const record of records) {
    const row = document.createElement('tr');
    cell(row, formatWhen(record.measuredAt));
    cell(row, formatPressure(record));
    cell(row, record.pulse === null || record.pulse === undefined ? BLANK : `${record.pulse} bpm`);
    cell(row, formatGlucose(record));
    cell(row, record.waterMl === null || record.waterMl === undefined ? BLANK : `${record.waterMl} mL`);
    cell(row, record.note || BLANK);
    body.append(row);
  }
}

function renderMeals(records) {
  const body = document.querySelector('#meal-rows');
  if (!body) return;
  body.textContent = '';
  if (!records.length) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'empty-state';
    td.textContent = say('No meals recorded yet.', '還沒有飲食紀錄。');
    row.append(td);
    body.append(row);
    return;
  }
  for (const record of records) {
    const row = document.createElement('tr');
    cell(row, formatWhen(record.eatenAt));
    cell(row, pick(MEAL_LABEL, record.mealSlot));
    cell(row, record.description || BLANK);
    body.append(row);
  }
}

// 之前的回報：那天說了什麼、當時給的下一步。照存的樣子顯示，不重算——
// 重算等於改寫歷史，而「它記得當時跟我說過什麼」正是被記得的感覺的來源。
const tr = (value) => window.DailyAbleI18n?.t(value) || value;
const ENERGY_WORDS = { steady: ['Steady', '還可以'], low: ['Low', '偏低'], 'very-low': ['Very low', '很低'] };
const ROUTINE_WORDS = { 'on-track': ['As usual', '照常'], changed: ['Changed', '有變動'], 'off-track': ['Paused', '停擺'] };

function renderCheckIns(records) {
  const body = document.querySelector('#checkin-rows');
  if (!body) return;
  body.textContent = '';
  if (!records.length) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'empty-state';
    td.textContent = say('No check-ins yet. Today’s counts as the first.', '還沒有回報。今天記一筆就是第一筆。');
    row.append(td);
    body.append(row);
    return;
  }
  for (const record of records) {
    const row = document.createElement('tr');
    cell(row, formatWhen(record.createdAt));
    cell(row, pick(ENERGY_WORDS, record.energy));
    cell(row, pick(ROUTINE_WORDS, record.routine));
    // 下一步跟備註都是英文原句存的，字典翻成中文
    const step = record.nextStep ? tr(record.nextStep) : BLANK;
    cell(row, record.note ? `${step}（${tr(record.note)}）` : step);
    body.append(row);
  }
}

const GLUCOSE_CONTEXT_ORDER = ['fasting', 'post-meal-2h', 'ogtt-2h', 'random'];

function referenceEntry(title, detail, note, source) {
  const wrap = document.createElement('div');
  wrap.className = 'reference-item';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const value = document.createElement('span');
  value.className = 'reference-value';
  value.textContent = detail;
  wrap.append(heading, value);
  if (note) {
    const p = document.createElement('p');
    p.textContent = note;
    wrap.append(p);
  }
  if (source) {
    const link = document.createElement('a');
    link.href = source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = say('Official source', '官方出處');
    wrap.append(link);
  }
  return wrap;
}

// The ranges are rendered from the server payload rather than written into this file, so a
// clinical number is never duplicated in the client where it could drift out of step.
function renderReference(reference) {
  const body = document.querySelector('#reference-body');
  const disclaimer = document.querySelector('#reference-disclaimer');
  const attribution = document.querySelector('#reference-attribution');
  if (!body || !reference) return;
  const lang = zh() ? 'zh' : 'en';
  // 官方區間的原文是中文的，但英文介面上不能夾一段中文。兩種語言各有一份，照介面挑。
  const quoteOf = (entry) => (typeof entry?.quote === 'string' ? entry.quote : entry?.quote?.[lang] || null);
  if (disclaimer) disclaimer.textContent = reference.disclaimer?.[lang] || '';
  if (attribution) attribution.textContent = reference.attribution?.[lang] || '';
  body.textContent = '';

  const bp = reference.bloodPressure;
  if (bp) {
    body.append(referenceEntry(
      say('Blood pressure', '血壓'),
      quoteOf(bp),
      bp.measurement?.[lang],
      bp.source
    ));
  }

  for (const key of GLUCOSE_CONTEXT_ORDER) {
    const entry = reference.glucose?.[key];
    if (!entry) continue;
    body.append(referenceEntry(
      `${say('Glucose', '血糖')} · ${pick(GLUCOSE_LABEL, key)}`,
      // A missing band is the point, not an omission: say so plainly.
      quoteOf(entry) || say('No published general-adult range', '查無公開的成人一般區間'),
      entry.note?.[lang],
      entry.source
    ));
  }

  const pulse = reference.pulse;
  if (pulse) body.append(referenceEntry(say('Resting pulse', '靜止脈搏'), quoteOf(pulse), pulse.measurement?.[lang], pulse.source));

  const water = reference.water;
  if (water) body.append(referenceEntry(say('Water', '飲水'), quoteOf(water), water.caveat?.[lang], water.source));
}

// Grouped by day, because "how many times today" is the thing a clinician asks about and
// the count should come from the entries rather than from someone remembering.
function renderMedications(records) {
  const body = document.querySelector('#medication-rows');
  if (!body) return;
  body.textContent = '';
  if (!records.length) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'empty-state';
    td.textContent = say('Nothing recorded yet.', '還沒有紀錄。');
    row.append(td);
    body.append(row);
    return;
  }
  const byDay = new Map();
  for (const record of records) {
    const date = new Date(record.takenAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toLocaleDateString(zh() ? 'zh-TW' : 'en-GB');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(record);
  }
  for (const [day, entries] of byDay) {
    const row = document.createElement('tr');
    cell(row, day);
    cell(row, say(`${entries.length} time${entries.length === 1 ? '' : 's'}`, `${entries.length} 次`));
    const detail = entries
      .map((entry) => {
        const at = new Date(entry.takenAt).toLocaleTimeString(zh() ? 'zh-TW' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
        return `${at} ${entry.name || BLANK}`;
      })
      .join(' · ');
    cell(row, detail);
    body.append(row);
  }
}

function renderPlans(plans) {
  const list = document.querySelector('#plan-list');
  if (!list) return;
  list.textContent = '';
  if (!plans.length) {
    const item = document.createElement('li');
    item.textContent = say('No plan written down yet.', '還沒有登記用藥計畫。');
    list.append(item);
    return;
  }
  for (const plan of plans) {
    const item = document.createElement('li');
    const times = plan.timesPerDay ? say(`${plan.timesPerDay} a day`, `一天 ${plan.timesPerDay} 次`) : say('times a day not noted', '未註明一天幾次');
    item.textContent = [plan.name, times, plan.instructions].filter(Boolean).join(' · ');
    list.append(item);
  }
}

// Doses against the plan, so the count means something. This states the days that matched
// and the days that came up short, and stops there — no score, no advice.
function renderMedicationAgainstPlan(records, plans) {
  const body = document.querySelector('#medication-rows');
  if (!body) return;
  const expected = plans
    .filter((plan) => Number.isFinite(Number(plan.timesPerDay)))
    .reduce((total, plan) => total + Number(plan.timesPerDay), 0);
  const rows = body.querySelectorAll('tr');
  if (!expected || !rows.length) return;
  for (const row of rows) {
    const countCell = row.children[1];
    if (!countCell) continue;
    const taken = Number(String(countCell.textContent).replace(/[^0-9]/g, ''));
    if (!Number.isFinite(taken)) continue;
    countCell.textContent = taken === expected
      ? say(`${taken} of ${expected}`, `${taken} / ${expected} 次`)
      : say(`${taken} of ${expected} — fewer than the plan`, `${taken} / ${expected} 次 — 比計畫少`);
  }
}

async function load() {
  const get = (path) => fetch(path, { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : { records: [] }))
    .catch(() => ({ records: [] }));
  const [vitals, meals, medications, plans, reference, checkIns] = await Promise.all([
    get('/api/vitals'),
    get('/api/meals'),
    get('/api/medications'),
    get('/api/medication-plans'),
    fetch('/api/reference-ranges').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    get('/api/check-ins')
  ]);
  renderVitals(vitals.records || []);
  renderMeals(meals.records || []);
  renderCheckIns(checkIns.checkIns || []);
  renderMedications(medications.records || []);
  renderPlans(plans.plans || []);
  renderMedicationAgainstPlan(medications.records || [], plans.plans || []);
  renderReference(reference);
}

async function csrfToken() {
  try {
    const response = await fetch('/api/csrf', { credentials: 'same-origin' });
    if (!response.ok) return '';
    return (await response.json()).token || '';
  } catch {
    return '';
  }
}

function readForm(form) {
  const payload = {};
  for (const [key, raw] of new FormData(form).entries()) {
    const value = String(raw).trim();
    if (value) payload[key] = value;
  }
  // The search box is how the food was chosen; the server needs it under the name it
  // expects so it can work the figures out from the portion.
  if (payload.foodSearch) {
    payload.foodName = payload.foodSearch;
    delete payload.foodSearch;
  }
  return payload;
}

function wire(formSelector, statusSelector, endpoint, emptyMessage) {
  const form = document.querySelector(formSelector);
  const status = document.querySelector(statusSelector);
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = readForm(form);
    // "unspecified" is the default on both selects, so a form holding only those is empty.
    const meaningful = Object.entries(payload).filter(([, value]) => value !== 'unspecified');
    if (!meaningful.length) {
      status.textContent = emptyMessage();
      return;
    }
    status.textContent = '';
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': await csrfToken() },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || say('Could not save. Please retry.', '目前無法儲存，請再試一次。'));
      status.textContent = body.saved === false
        ? say('Shown as saved in the demo. Nothing is stored.', '展示模式：畫面已更新，但不會儲存。')
        : say('Saved.', '已儲存。');
      form.reset();
      await load();
    } catch (error) {
      status.textContent = error.message || say('Could not save. Please retry.', '目前無法儲存，請再試一次。');
    } finally {
      if (button) button.disabled = false;
    }
  });
}

wire('#vital-form', '#vital-status', '/api/vitals', () => say('Add at least one measurement first.', '請至少填一項再儲存。'));
wire('#meal-form', '#meal-status', '/api/meals', () => say('Write what you ate first.', '請先寫下吃了什麼。'));
wire('#medication-form', '#medication-status', '/api/medications', () => say('Write what you took first.', '請先寫下吃了什麼藥。'));
wire('#plan-form', '#plan-status', '/api/medication-plans', () => say('Write which medicine first.', '請先寫下是哪一種藥。'));

// Food lookup: type a few characters, pick from the list, tap a portion, and the figures
// are worked out from the same table the earlier project used.
//
// Picking a food used to leave the portion box empty, so the preview said "155 kcal per
// 100g. Add a portion to work out the total." and stopped there — the one number a person
// does not know is how many grams their egg was, and that was exactly what they were being
// asked for. The portions come from the food table itself (a bowl of rice, one egg), so the
// numbers on the buttons can be corrected in one place and this file never holds a second
// copy of them.
(() => {
  const search = document.querySelector('input[name="foodSearch"]');
  const quantity = document.querySelector('input[name="quantity"]');
  const options = document.querySelector('#food-options');
  const preview = document.querySelector('#food-preview');
  const portionRow = document.querySelector('#food-portions');
  if (!search || !options) return;

  let matches = [];
  let chosen = null;
  let timer;

  // Filled in from the table, and still yours to change: anything typed by hand stays put,
  // because someone may be reading an actual label.
  const NUTRITION_FIELDS = { kcal: 'kcal', carbG: 'carb', proteinG: 'protein', fatG: 'fat' };
  const nutritionInputs = Object.fromEntries(
    Object.keys(NUTRITION_FIELDS).map((name) => [name, document.querySelector(`input[name="${name}"]`)])
  );
  for (const input of Object.values(nutritionInputs)) {
    input?.addEventListener('input', () => { delete input.dataset.fromTable; });
  }

  // Rounded to one decimal, the same as the server works it out from the same table, so the
  // figure in the box is the figure that gets saved.
  const scaled = (value, factor) => Math.round(value * factor * 10) / 10;

  function fillNutrition(food, amount) {
    if (!food || !Number.isFinite(amount) || amount <= 0) return;
    const factor = amount / 100;
    for (const [name, source] of Object.entries(NUTRITION_FIELDS)) {
      const input = nutritionInputs[name];
      // Only ours to overwrite. A figure the person typed is theirs.
      if (!input || (input.value && input.dataset.fromTable !== 'true')) continue;
      input.value = String(scaled(food[source], factor));
      input.dataset.fromTable = 'true';
    }
  }

  function clearOurNutrition() {
    for (const input of Object.values(nutritionInputs)) {
      if (input?.dataset.fromTable === 'true') {
        input.value = '';
        delete input.dataset.fromTable;
      }
    }
  }

  // The portions a food actually comes in, as buttons. Each one says how much it is in
  // grams or millilitres, so nobody is agreeing to a number they cannot see, and the box
  // stays editable for a bowl that was fuller than usual.
  function showPortions(food) {
    if (!portionRow) return;
    portionRow.textContent = '';
    if (!food || !Array.isArray(food.portions) || !food.portions.length) return;
    const current = Number(quantity?.value);
    for (const portion of food.portions) {
      const button = document.createElement('button');
      button.type = 'button';
      const chosenNow = Number.isFinite(current) && current === portion.qty;
      button.className = chosenNow ? 'filter active' : 'filter';
      button.setAttribute('aria-pressed', chosenNow ? 'true' : 'false');
      button.dataset.en = `${portion.en} · ${portion.qty}${food.unit}`;
      button.dataset.zh = `${portion.zh} · ${portion.qty}${food.unit}`;
      button.textContent = zh() ? button.dataset.zh : button.dataset.en;
      button.addEventListener('click', () => {
        chosen = food;
        search.value = food.name;
        if (quantity) quantity.value = String(portion.qty);
        // A new portion replaces the figures this file put there, not the ones you typed.
        for (const input of Object.values(nutritionInputs)) {
          if (input?.dataset.fromTable === 'true') input.value = '';
        }
        fillNutrition(food, portion.qty);
        showPortions(food);
        showPreview();
      });
      portionRow.append(button);
    }
  }

  function closeList() {
    options.hidden = true;
    options.textContent = '';
    search.setAttribute('aria-expanded', 'false');
  }

  // A native <datalist> was the first attempt and it did not show: browsers often will not
  // reopen the dropdown when options arrive after the person has already started typing.
  // This draws the suggestions itself, so what appears is not left to the browser.
  function showList() {
    options.textContent = '';
    if (!matches.length) {
      closeList();
      return;
    }
    for (const food of matches) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'food-option';
      button.textContent = `${food.name} · ${food.kcal} kcal / 100${food.unit}`;
      button.addEventListener('click', () => {
        search.value = food.name;
        chosen = food;
        if (quantity && !quantity.value && food.defQty) quantity.value = food.defQty;
        closeList();
        showPortions(food);
        showPreview();
      });
      item.append(button);
      options.append(item);
    }
    options.hidden = false;
    search.setAttribute('aria-expanded', 'true');
  }

  const currentFood = () => chosen || matches.find((entry) => entry.name === search.value.trim()) || null;

  async function lookup() {
    const term = search.value.trim();
    chosen = null;
    if (!term) {
      matches = [];
      closeList();
      showPortions(null);
      clearOurNutrition();
      if (preview) preview.textContent = '';
      return;
    }
    try {
      const response = await fetch(`/api/foods?q=${encodeURIComponent(term)}`);
      if (!response.ok) return;
      matches = (await response.json()).foods || [];
      showList();
      showPortions(currentFood());
      showPreview();
    } catch {
      /* the manual fields still work, so a failed lookup is not worth an error message */
    }
  }

  function showPreview() {
    if (!preview) return;
    const food = currentFood();
    if (!food) {
      preview.textContent = '';
      return;
    }
    if (quantity && !quantity.value && food.defQty) quantity.value = String(food.defQty);
    const amount = Number(quantity?.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      preview.textContent = say(
        `${food.name}: ${food.kcal} kcal per 100${food.unit}. Tap a portion above, or type how much.`,
        `${food.name}：每 100${food.unit} ${food.kcal} 大卡。點上面的份量，或自己填數字。`
      );
      return;
    }
    fillNutrition(food, amount);
    const factor = amount / 100;
    preview.textContent = say(
      `${food.name} ${amount}${food.unit} — ${scaled(food.kcal, factor)} kcal, ${scaled(food.carb, factor)} g carbohydrate, ${scaled(food.protein, factor)} g protein, ${scaled(food.fat, factor)} g fat`,
      `${food.name} ${amount}${food.unit} — ${scaled(food.kcal, factor)} 大卡、醣類 ${scaled(food.carb, factor)} 克、蛋白質 ${scaled(food.protein, factor)} 克、脂肪 ${scaled(food.fat, factor)} 克`
    );
  }

  search.addEventListener('input', () => {
    // The moment the search text changes, the portions and the figures on screen belong to a
    // food that is no longer the one being written down. Left there for the fifth of a second
    // the lookup takes, they are clickable — tap "two eggs" while the box already says 白飯 and
    // a bowl of rice gets saved with the figures for two eggs. They go now and come back with
    // the new food; anything typed by hand is left alone.
    showPortions(null);
    clearOurNutrition();
    clearTimeout(timer);
    timer = setTimeout(lookup, 180);
  });
  quantity?.addEventListener('input', () => {
    showPortions(currentFood());
    showPreview();
  });
  // The preview is written by this file, so the language toggle has to reach it too —
  // otherwise it stays in whichever language it was first drawn in.
  document.addEventListener('dailyable:languagechange', showPreview);
  // A saved meal empties the form; the portions and the preview belong to the meal that was
  // just saved, so they go with it rather than sitting over an empty form.
  document.querySelector('#meal-form')?.addEventListener('reset', () => {
    chosen = null;
    matches = [];
    closeList();
    showPortions(null);
    for (const input of Object.values(nutritionInputs)) delete input?.dataset.fromTable;
    if (preview) preview.textContent = '';
  });
})();

// 兩個進入點都會成立（defer 腳本執行時文件已經是 interactive），所以第一次載入抓了兩次
// 資料。只跑一次。
let loadedOnce = false;
const loadOnce = () => { if (loadedOnce) return; loadedOnce = true; load(); };
document.addEventListener('DOMContentLoaded', loadOnce);
// The event is 'dailyable:languagechange'. Listening for the wrong name meant the tables
// kept whatever language they were first drawn in.
document.addEventListener('dailyable:languagechange', load);
if (document.readyState !== 'loading') loadOnce();
