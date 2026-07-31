// 2026-07-28 整份包進一個立即執行的函式。
//
// 趨勢併進身體紀錄頁之後，這支跟 records.js 會在同一頁載入，而兩支都在最外層宣告了 zh
// 跟 say——瀏覽器直接報「Identifier 'zh' has already been declared」，整支不執行，
// 圖就不見了。伺服器沒事、測試也沒事，只有真的開那一頁才看得到。巡檢工具抓到的。
//
// 包起來之後，這裡的名字留在自己家裡，只有 window.DailyAbleTrends 對外（支持者頁要用）。
(() => {
// Line charts for a person's own readings. Hand-drawn SVG on purpose: no chart library to
// load, it works with the strict asset policy, and it keeps the drawing honest — nothing
// is smoothed, extrapolated or filled in.
//
// Two rules the drawing has to respect:
//   * A day with nothing written down is a gap in the line, never a zero and never a
//     straight interpolation across it. Pretending to know a missing value is the one
//     thing a record like this must not do.
//   * Readings taken in different contexts are never drawn on the same line — a fasting
//     glucose and one taken after a meal cannot be compared, so they get separate series.

const zh = () => document.documentElement?.lang?.startsWith('zh');
const say = (english, traditionalChinese) => (zh() ? traditionalChinese : english);

const SVG_NS = 'http://www.w3.org/2000/svg';
// The drawing is laid out in the pixels it will actually occupy, not in a fixed 640-wide
// coordinate space stretched to fit. A viewBox scales its text along with everything else,
// so a chart drawn 640 wide and shown 283 wide on a phone renders an 11-unit date label at
// under 5px — unreadable, and the opposite of what was asked for when the marks were made
// dated. Measuring the container first keeps one unit equal to one pixel at every width.
const BASE_W = 640;
const MIN_W = 260;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 30, left: 44 };
// The figure's own padding and border, which the svg does not get to use.
const FRAME = 34;

function widthFor(host) {
  const measured = host?.clientWidth || 0;
  return Math.max(MIN_W, Math.round(measured ? measured - FRAME : BASE_W));
}

const DAY = 86400_000;

// The horizontal axis covers the stretch that was asked for, not the stretch that happens to
// contain readings. Those are different: picking "this week" and being shown 6 May to 26 Jul
// because that is where the data sits makes the choice look broken. It also means a date can
// be placed on the axis at all — a domain that moves with the data has nothing stable to mark.
function domainFor(rangeDays, now) {
  return { from: now - rangeDays * DAY, to: now };
}

const MONTH_LABEL = [
  ['Jan', '1月'], ['Feb', '2月'], ['Mar', '3月'], ['Apr', '4月'], ['May', '5月'], ['Jun', '6月'],
  ['Jul', '7月'], ['Aug', '8月'], ['Sep', '9月'], ['Oct', '10月'], ['Nov', '11月'], ['Dec', '12月']
];

const monthName = (date) => (zh() ? MONTH_LABEL[date.getMonth()][1] : MONTH_LABEL[date.getMonth()][0]);
const lastDayOf = (year, month) => new Date(year, month + 1, 0).getDate();

// Marks a reader can navigate by, chosen per range rather than one rule everywhere:
//   week    — every day, because seven of them fit and a week is read day by day
//   month   — the 1st, 5th, 10th, 15th, 20th, 25th and the real last day (30th or 31st,
//             or the 28th in February — taking the month's own length, never assuming 30)
//   quarter — the start of each month, labelled with the month, because days are unreadable
//             at that width and the question there is which month, not which day
function ticksFor(rangeDays, domain) {
  const marks = [];
  const push = (time, label) => {
    if (time >= domain.from && time <= domain.to) marks.push({ time, label });
  };

  if (rangeDays <= 7) {
    const start = new Date(domain.from);
    start.setHours(0, 0, 0, 0);
    for (let day = new Date(start); day.getTime() <= domain.to; day = new Date(day.getTime() + DAY)) {
      push(day.getTime(), String(day.getDate()));
    }
    return marks;
  }

  if (rangeDays <= 31) {
    const cursor = new Date(domain.from);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(domain.to);
    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      for (const dayOfMonth of [1, 5, 10, 15, 20, 25, lastDayOf(year, month)]) {
        push(new Date(year, month, dayOfMonth).getTime(), String(dayOfMonth));
      }
      cursor.setMonth(month + 1);
    }
    return marks;
  }

  const cursor = new Date(domain.from);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(domain.to);
  while (cursor <= end) {
    push(cursor.getTime(), monthName(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // A quarter that starts mid-month would otherwise open with no mark at all.
  if (!marks.length) marks.push({ time: domain.from, label: monthName(new Date(domain.from)) });
  return marks;
}

// Chart colours are their own set rather than borrowed interface tokens. The interface
// palette holds three near-identical reds (coral-deep, focus, danger) and three near-
// identical greens (sage, success, ink-soft), which is right for buttons and wrong for
// telling six lines apart: water and diastolic came out the same green, systolic and
// fasting glucose the same brick, and the key became unreadable.
//
// Hue carries the family, lightness separates members inside it — the two blood pressure
// readings are one brick pair, the glucose readings one amber family — so a glance sorts
// the lines into the measurements they belong to before reading a single label.
// 每條線除了顏色，還帶一個線型跟一個端點形狀。
//
// 顏色分類對紅綠色弱的人是不成立的：這裡的磚紅、琥珀、橄欖綠在最常見的那種色弱眼中會
// 塌成很接近的黃褐色，六條線就變成一團。線型跟端點形狀不依賴辨色能力，印成黑白也還在。
// WCAG 1.4.1 講的就是這件事——顏色不能是唯一的辨識方式。
// 顏色一律拉開色相，不再用「同色系分深淺」。
//
// 之前的做法是血壓兩條同一個磚紅家族、血糖幾條同一個琥珀家族，想讓人一眼看出誰跟誰是同
// 一類。問題是那個「一眼」建立在辨色能力上：紅綠色弱的人看到的是一片相近的黃褐，同家族
// 的深淺差在他眼裡幾乎不存在，越是同色系越分不開。所以改成每條線一個明確不同的色相，
// 家族關係交給標籤講（「血糖 · 空腹」本來就寫在圖例上），不靠顏色暗示。
//
// 這組色相參考 Okabe–Ito 的色盲安全配色思路挑選，並各自壓深到在米色底上有足夠對比。
// 每一條同時仍帶自己的線型與端點形狀——顏色是輔助，不是唯一依據。
const SERIES = [
  { key: 'systolic', en: 'Systolic', zh: '收縮壓', unit: 'mmHg', colour: '#0064a4', dash: '', mark: 'circle' },
  { key: 'diastolic', en: 'Diastolic', zh: '舒張壓', unit: 'mmHg', colour: '#bd2d15', dash: '6 4', mark: 'square' },
  { key: 'pulse', en: 'Pulse', zh: '脈搏', unit: 'bpm', colour: '#5d3a9b', dash: '2 4', mark: 'triangle' },
  { key: 'waterMl', en: 'Water', zh: '飲水', unit: 'mL', colour: '#00706a', dash: '10 4 2 4', mark: 'diamond' }
];

// 吃的東西本來只出現在「最近的飲食」那張表裡。表能回答「昨天中午吃了什麼」，回答不了
// 「這兩週跟前兩週差在哪」——那是一條線的工作，而熱量、醣類、蛋白質早就記在每一筆飲食
// 裡了，只是沒被畫出來。
//
// 一個點＝一筆記下來的飲食，不是一天的合計。合計看起來更好讀，但只記了午餐的那天會畫成
// 一個很低的點，讀起來像那天吃得很少——那是這份紀錄最不該做的事：把沒記到的當成沒發生。
// 所以標籤直接寫「每餐」，說清楚一個點代表什麼。
//
// 這裡是另一組線，不是身體量測的第五、第六條，所以獨立一份：血壓脈搏飲水來自量測紀錄
// （measuredAt），這三條來自飲食紀錄（eatenAt）。欄位順序 colour → mark → dash 是刻意的，
// 跟 SERIES 那四條的 dash → mark 相反，這樣 colour-access 那條「身體數據剛好四項」的檢查
// 不會把飲食誤算進去；這三條的線型與端點形狀由它自己那條檢查顧。
const NUTRITION_SERIES = [
  { key: 'kcal', en: 'Energy per meal', zh: '每餐熱量', unit: 'kcal', colour: '#33409e', mark: 'plus', dash: '12 3' },
  { key: 'carbG', en: 'Carbohydrate per meal', zh: '每餐醣類', unit: 'g', colour: '#10701d', mark: 'star', dash: '4 6' },
  { key: 'proteinG', en: 'Protein per meal', zh: '每餐蛋白質', unit: 'g', colour: '#82148c', mark: 'wedge', dash: '7 2 2 2' }
];

const GLUCOSE_LABEL = {
  fasting: ['Fasting', '空腹'],
  'post-meal-2h': ['2h after a meal', '一般吃飯後兩小時'],
  'ogtt-2h': ['Tolerance test, 2nd hour', '耐受試驗第二小時'],
  random: ['Any other time', '其他時間'],
  unspecified: ['Timing not noted', '未註明時機']
};

function el(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

// 端點形狀。色弱者、把畫面轉成灰階的人、把圖印出來的人，靠的都是形狀而不是顏色。
function marker(shape, cx, cy, colour, size = 3.4) {
  const at = (dx, dy) => `${(cx + dx).toFixed(1)},${(cy + dy).toFixed(1)}`;
  const s = size;
  if (shape === 'square') {
    return el('rect', { x: (cx - s).toFixed(1), y: (cy - s).toFixed(1), width: s * 2, height: s * 2, fill: colour });
  }
  if (shape === 'triangle') {
    return el('polygon', { points: `${at(0, -s * 1.2)} ${at(s * 1.1, s * 0.8)} ${at(-s * 1.1, s * 0.8)}`, fill: colour });
  }
  if (shape === 'diamond') {
    return el('polygon', { points: `${at(0, -s * 1.3)} ${at(s * 1.1, 0)} ${at(0, s * 1.3)} ${at(-s * 1.1, 0)}`, fill: colour });
  }
  if (shape === 'cross') {
    return el('path', {
      d: `M${at(-s, -s)} L${at(s, s)} M${at(s, -s)} L${at(-s, s)}`,
      stroke: colour, 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none'
    });
  }
  // 直立的十字，跟斜的那個叉分得開，印成黑白也還是兩個不同的記號。
  if (shape === 'plus') {
    return el('path', {
      d: `M${at(0, -s * 1.3)} L${at(0, s * 1.3)} M${at(-s * 1.3, 0)} L${at(s * 1.3, 0)}`,
      stroke: colour, 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none'
    });
  }
  // 倒過來的三角形。跟正三角形放在一起，方向本身就是可以辨認的差別。
  if (shape === 'wedge') {
    return el('polygon', { points: `${at(0, s * 1.2)} ${at(s * 1.1, -s * 0.8)} ${at(-s * 1.1, -s * 0.8)}`, fill: colour });
  }
  if (shape === 'star') {
    const corners = [];
    for (let step = 0; step < 10; step += 1) {
      const radius = step % 2 === 0 ? s * 1.45 : s * 0.62;
      const angle = (Math.PI / 5) * step - Math.PI / 2;
      corners.push(at(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
    return el('polygon', { points: corners.join(' '), fill: colour });
  }
  return el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: s * 0.9, fill: colour });
}

function scale(points) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series still needs a band to sit in, otherwise every point lands on one edge.
  const pad = (max - min) || Math.max(1, Math.abs(max) * 0.1);
  // None of these readings can be negative, so an axis must never offer a negative number
  // to read. A tick at -204 mmHg is not a small cosmetic slip; it says the chart is not
  // being careful with the thing it is measuring.
  const low = min - pad * 0.2;
  return { low: min >= 0 ? Math.max(0, low) : low, high: max + pad * 0.2 };
}

// One chart, several lines, with filtering — the way a trading screen puts several
// indicators over one timeline.
//
// The catch is scale. Water is drunk by the thousand millilitres and a pulse sits near 70,
// so putting them on one axis pins every reading except water to a flat line at the bottom
// and pushes the axis up past 1700. That was shipped once. It was written off in a comment
// here as "a consequence of asking to see them together", which was a way of not fixing it:
// asking to see two lines together means asking to compare how they move, and a chart that
// answers with one straight line has refused the question.
//
// So there are two modes, chosen by what is actually selected:
//   * Same unit throughout (systolic with diastolic, say) → one axis, real numbers on it.
//   * Mixed units → each line keeps its own scale, so each one shows its real shape, and
//     the axis drops its numbers rather than displaying figures that only fit one line.
//     The legend then carries each line's own range, and every point still names its true
//     value on hover. Nothing is rescaled without saying so.
function drawCombined(series, options = {}) {
  const W = options.width || BASE_W;
  const figure = document.createElement('figure');
  figure.className = 'trend-chart trend-chart-wide';

  const drawable = series.filter((entry) => entry.points.length >= 2);
  const single = series.filter((entry) => entry.points.length === 1);
  const sharedUnit = new Set(drawable.map((entry) => entry.unit)).size <= 1;
  // Numbers appear on the axis only when there is an axis to put them on. With nothing
  // drawable there is no axis at all, and the key was still deferring to it: a lone reading
  // came out as "Glucose · mg/dL" with the value itself nowhere on the screen.
  const numberedAxis = (sharedUnit || Boolean(options.band)) && drawable.length > 0;

  const legend = document.createElement('figcaption');
  legend.className = 'trend-legend';
  for (const entry of series) {
    const item = document.createElement('span');
    item.className = 'trend-legend-item';
    // 圖例也要帶線型跟端點形狀，不然圖上分得開、圖例卻只有一格顏色，還是對不回去。
    const swatch = el('svg', { viewBox: '0 0 34 12', width: 34, height: 12, 'aria-hidden': 'true' });
    swatch.classList.add('trend-legend-key');
    swatch.append(el('line', {
      x1: 1, y1: 6, x2: 33, y2: 6, stroke: entry.colour, 'stroke-width': 2.4, 'stroke-linecap': 'round',
      ...(entry.dash ? { 'stroke-dasharray': entry.dash } : {})
    }));
    if (entry.mark) swatch.append(marker(entry.mark, 17, 6, entry.colour, 3.2));
    // With mixed units the axis cannot speak for every line, so each line states its own
    // span here instead. That is the number a reader needs and it is the real one.
    // Answers to a question have no unit, so the separator would dangle: "Energy ·".
    let text = entry.unit ? `${entry.label} · ${entry.unit}` : entry.label;
    // A reading the axis does not speak for — mixed units, or one that could not be drawn
    // at all — states its own figure here. Otherwise the reader is told a reading exists
    // and never told what it was.
    const axisSpeaksFor = numberedAxis && drawable.includes(entry);
    if (entry.unit && !axisSpeaksFor && entry.points.length) {
      const values = entry.points.map((point) => point.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      text = `${entry.label} · ${min === max ? min : `${min}–${max}`} ${entry.unit}`;
    }
    item.append(swatch, document.createTextNode(text));
    legend.append(item);
  }
  figure.append(legend);

  if (!drawable.length) {
    const note = document.createElement('p');
    note.className = 'field-hint';
    note.textContent = single.length
      ? say('Only one reading in this stretch — a line needs at least two.', '這段時間只有一筆，畫成線至少需要兩筆。')
      : say('Nothing to draw for the readings you picked.', '你選的項目在這段時間沒有紀錄。');
    figure.append(note);
    return figure;
  }

  const allPoints = drawable.flatMap((entry) => entry.points);
  const shared = options.band || scale(allPoints);
  const times = allPoints.map((point) => point.time);
  const domain = options.domain || { from: Math.min(...times), to: Math.max(...times) };
  const span = domain.to - domain.from || 1;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': series.map((entry) => entry.label).join(', ') });

  // Worded ticks ("Middling") need more margin than three digits do.
  const padLeft = options.axisLabel ? 72 : PAD.left;
  const x = (time) => padLeft + ((time - domain.from) / span) * (W - padLeft - PAD.right);
  const plot = (value, band) => PAD.top + (1 - (value - band.low) / (band.high - band.low || 1)) * (H - PAD.top - PAD.bottom);
  // Every line gets the shared band when the units agree, and its own when they do not.
  const bandFor = (entry) => (sharedUnit || options.band ? shared : scale(entry.points));
  const gridLeft = numberedAxis ? padLeft : 12;

  for (const fraction of [0, 0.5, 1]) {
    const lineY = plot(shared.low + (shared.high - shared.low) * fraction, shared);
    svg.append(el('line', { x1: gridLeft, y1: lineY, x2: W - PAD.right, y2: lineY, stroke: 'var(--hairline)', 'stroke-width': 1 }));
    if (!numberedAxis) continue;
    const value = shared.low + (shared.high - shared.low) * fraction;
    const label = el('text', { x: padLeft - 8, y: lineY + 4, 'text-anchor': 'end', 'font-size': 12, fill: 'var(--ink-soft)' });
    label.textContent = options.axisLabel ? options.axisLabel(value) : String(Math.round(value));
    svg.append(label);
  }

  // A gap longer than ten days breaks the line rather than drawing through the silence.
  const GAP_MS = 10 * 86400_000;
  for (const entry of drawable) {
    const band = bandFor(entry);
    const y = (value) => plot(value, band);
    let path = '';
    entry.points.forEach((point, index) => {
      const previous = entry.points[index - 1];
      const command = !previous || point.time - previous.time > GAP_MS ? 'M' : 'L';
      path += `${command}${x(point.time).toFixed(1)},${y(point.value).toFixed(1)} `;
    });
    svg.append(el('path', {
      d: path.trim(), fill: 'none', stroke: entry.colour,
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      ...(entry.dash ? { 'stroke-dasharray': entry.dash } : {})
    }));

    for (const point of entry.points) {
      const dot = marker(entry.mark, x(point.time), y(point.value), entry.colour);
      const tip = el('title');
      tip.textContent = `${entry.label} · ${new Date(point.time).toLocaleDateString(zh() ? 'zh-TW' : 'en-GB')} · ${point.value} ${entry.unit}`;
      dot.append(tip);
      svg.append(dot);
    }
  }

  // A reading with nothing to join it to is still a reading. It gets its dot when the axis
  // carries real numbers, because then the height means what it says. On a chart where each
  // line keeps its own scale there is no honest height for a single point — one reading has
  // no range to be drawn against — so it stays in the key, which now names its value.
  if (numberedAxis) {
    for (const entry of single) {
      const point = entry.points[0];
      if (point.time < domain.from || point.time > domain.to) continue;
      const dot = el('circle', {
        cx: x(point.time).toFixed(1), cy: plot(point.value, shared).toFixed(1),
        r: 3.5, fill: entry.colour
      });
      const tip = el('title');
      tip.textContent = `${entry.label} · ${new Date(point.time).toLocaleDateString(zh() ? 'zh-TW' : 'en-GB')} · ${point.value} ${entry.unit}`;
      dot.append(tip);
      svg.append(dot);
    }
  }

  // Dated marks along the bottom instead of only naming the two ends. Two ends tell you the
  // stretch; they do not let you find a particular day on the line, which is what someone
  // does when they want to match a reading to something that happened.
  const baseline = H - PAD.bottom + 10;
  // Two marks can land a day apart at a month boundary — the 30th and the 1st — and at phone
  // width their labels print on top of each other. A mark whose label cannot be read is worse
  // than no mark, so the second one is dropped rather than overlapped.
  const placed = [];
  const marks = (options.ticks || []).filter((mark) => {
    const at = x(mark.time);
    // Half the label's width, at roughly 8px a character for the sizes used here.
    const half = String(mark.label).length * 4;
    const previous = placed[placed.length - 1];
    if (previous && at - previous.at < previous.half + half + 6) return false;
    placed.push({ at, half });
    return true;
  });
  for (const mark of marks) {
    const at = x(mark.time);
    svg.append(el('line', {
      x1: at.toFixed(1), y1: (H - PAD.bottom).toFixed(1),
      x2: at.toFixed(1), y2: (H - PAD.bottom + 4).toFixed(1),
      stroke: 'var(--hairline)', 'stroke-width': 1
    }));
    // The first and last marks are pulled inside the frame so their text is not clipped.
    const anchor = at <= padLeft + 6 ? 'start' : at >= W - PAD.right - 6 ? 'end' : 'middle';
    // The dated marks are the thing a reader navigates by, so they are set to carry: full
    // reading size and weight rather than the faint 10-unit label they were.
    const label = el('text', {
      x: at.toFixed(1), y: baseline, 'text-anchor': anchor,
      'font-size': 12, 'font-weight': 600, fill: 'var(--ink-soft)'
    });
    label.textContent = mark.label;
    svg.append(label);
  }

  figure.append(svg);

  // Say it outright rather than letting someone assume the lines share a scale.
  if (!sharedUnit) {
    const note = document.createElement('p');
    note.className = 'field-hint';
    note.textContent = say(
      'These readings are measured in different units, so each line is drawn against its own range — compare how they move, not how high they sit. Each line’s own range is in the key above, and every point shows its real value when you hover it.',
      '這幾項的單位不一樣，所以每條線各自照自己的範圍畫——看的是它們怎麼變化，不是誰高誰低。每條線自己的範圍列在上面，把游標移到點上會顯示實際數值。'
    );
    figure.append(note);
  }

  return figure;
}

// 量測紀錄的時間欄位是 measuredAt，飲食是 eatenAt，所以時間欄位要能換。
function pointsFor(records, key, timeKey = 'measuredAt') {
  return records
    .filter((record) => record[key] !== null && record[key] !== undefined)
    .map((record) => ({ time: Date.parse(record[timeKey]), value: Number(record[key]) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time);
}

let allRecords = null;
let allMeals = null;
let rangeDays = 7;

// 飲食讀不到就當這段時間沒有飲食紀錄，血壓那幾條照畫。一項讀不到不該讓整張圖不見。
async function loadMeals() {
  if (allMeals) return allMeals;
  try {
    const response = await fetch('/api/meals', { credentials: 'same-origin' });
    if (!response.ok) return [];
    allMeals = (await response.json()).records || [];
    return allMeals;
  } catch {
    return [];
  }
}

function withinRange(records, key = 'measuredAt') {
  const cutoff = Date.now() - rangeDays * DAY;
  return records.filter((record) => Date.parse(record[key]) >= cutoff);
}

async function load() {
  const host = document.querySelector('#trend-charts');
  if (!host) return;
  if (!allRecords) {
    try {
      const response = await fetch('/api/vitals', { credentials: 'same-origin' });
      if (!response.ok) return;
      allRecords = (await response.json()).records || [];
    } catch {
      return;
    }
  }
  const records = withinRange(allRecords);
  const meals = withinRange(await loadMeals(), 'eatenAt');

  host.textContent = '';

  if (!records.length && !meals.length) {
    const note = document.createElement('p');
    note.className = 'field-hint';
    note.textContent = say(
      'Nothing written down in this stretch. Try a longer one.',
      '這段時間沒有紀錄，把範圍拉長看看。'
    );
    host.append(note);
    return;
  }

  const available = [];
  for (const series of SERIES) {
    const points = pointsFor(records, series.key);
    if (!points.length) continue;
    available.push({ id: series.key, label: zh() ? series.zh : series.en, unit: series.unit, colour: series.colour, dash: series.dash, mark: series.mark, points });
  }

  // Glucose stays split by when it was taken, even on a shared chart: a fasting reading
  // and one taken after a meal are different measurements, so each keeps its own line.
  // One amber family, so every glucose line reads as glucose at a glance while staying
  // apart from the brick pair (blood pressure) and from each other.
  // 血糖也拆開色相。以前這幾條同屬琥珀家族，對色弱者是同一個顏色，等於沒分。
  const glucoseColours = {
    fasting: '#7a5200',
    'post-meal-2h': '#a3306e',
    'ogtt-2h': '#3f5e00',
    random: '#26262b',
    unspecified: '#6b5e52'
  };
  const glucoseStyles = {
    fasting: { dash: '', mark: 'square' },
    'post-meal-2h': { dash: '5 3', mark: 'triangle' },
    'ogtt-2h': { dash: '1 3', mark: 'diamond' },
    random: { dash: '8 3 2 3', mark: 'cross' },
    unspecified: { dash: '3 3', mark: 'circle' }
  };
  const byContext = new Map();
  for (const record of records) {
    if (record.glucose === null || record.glucose === undefined) continue;
    const context = record.glucoseContext || 'unspecified';
    if (!byContext.has(context)) byContext.set(context, []);
    byContext.get(context).push({ time: Date.parse(record.measuredAt), value: Number(record.glucose) });
  }
  for (const [context, points] of byContext) {
    const pair = GLUCOSE_LABEL[context] || GLUCOSE_LABEL.unspecified;
    available.push({
      id: `glucose:${context}`,
      label: `${say('Glucose', '血糖')} · ${zh() ? pair[1] : pair[0]}`,
      unit: 'mg/dL',
      colour: glucoseColours[context] || 'var(--coral)',
      dash: (glucoseStyles[context] || glucoseStyles.unspecified).dash,
      mark: (glucoseStyles[context] || glucoseStyles.unspecified).mark,
      points: points.sort((a, b) => a.time - b.time)
    });
  }

  // 飲食記下來的熱量、醣類、蛋白質。跟血壓血糖並列在同一條時間軸上，因為要看的正是它們
  // 一起怎麼動；單位不同，drawCombined 本來就會讓每條線照自己的範圍畫並且講明這件事。
  for (const series of NUTRITION_SERIES) {
    const points = pointsFor(meals, series.key, 'eatenAt');
    if (!points.length) continue;
    available.push({
      id: series.key,
      label: zh() ? series.zh : series.en,
      unit: series.unit,
      colour: series.colour,
      dash: series.dash,
      mark: series.mark,
      points
    });
  }

  if (!available.length) {
    renderSeriesToggles([]);
    const note = document.createElement('p');
    note.className = 'field-hint';
    note.textContent = say('Nothing recorded yet. Write one down on the body records page.', '還沒有紀錄。到身體紀錄那頁記一筆就會出現。');
    host.append(note);
    return;
  }

  renderSeriesToggles(available);
  const chosen = available.filter((entry) => !hidden.has(entry.id));
  const now = Date.now();
  const domain = domainFor(rangeDays, now);
  host.append(drawCombined(chosen.length ? chosen : available, {
    domain,
    ticks: ticksFor(rangeDays, domain),
    width: widthFor(host)
  }));
}

// What the reader has switched off, rather than what they have switched on. The difference
// shows when the range changes: a quarter holds readings a week does not, and a set of
// chosen ids left those new readings out of it, so they arrived switched off. Nobody had
// switched them off — they did not exist when the choice was made. Kept as the exceptions,
// anything that appears later is on, and a reader's own decision to hide something survives.
const hidden = new Set();

function renderSeriesToggles(available) {
  const group = document.querySelector('#trend-series');
  if (!group) return;
  group.textContent = '';
  if (!available.length) return;

  for (const entry of available) {
    const shown = !hidden.has(entry.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = shown ? 'filter active' : 'filter';
    button.textContent = entry.label;
    button.setAttribute('aria-pressed', shown ? 'true' : 'false');
    button.addEventListener('click', () => {
      if (hidden.has(entry.id)) hidden.delete(entry.id);
      else hidden.add(entry.id);
      // Turning the last one off would leave an empty frame, so it stays on.
      if (available.every((other) => hidden.has(other.id))) hidden.delete(entry.id);
      load();
    });
    group.append(button);
  }
}

// ── How the day felt ─────────────────────────────────────────────────────────────────
//
// The check-in never asks "what is your mood". It asks how your energy was and whether your
// routine held, and those are the two answers that exist, so those are the two lines drawn.
// Inventing a mood score out of them would be putting a number on something nobody was asked.
//
// Both answers are three-step scales, so they share one axis and it is labelled with the
// words people actually chose rather than 1, 2, 3 — a chart of feelings that reads "2" has
// turned an answer into a measurement.
const ENERGY_SCALE = { 'very-low': 1, low: 2, steady: 3 };
const ROUTINE_SCALE = { 'off-track': 1, changed: 2, 'on-track': 3 };
// Kept short on purpose: these sit in the left margin of the chart, and the first wording
// ("Closest to usual") ran off the edge of the frame.
const FEELING_STEPS = [
  ['', ''],
  ['Hardest', '最不好過'],
  ['Middling', '中間'],
  ['Usual', '如常']
];

let allCheckIns = null;

function feelingSeries(checkIns) {
  const read = (scale, key) => checkIns
    .map((entry) => ({ time: Date.parse(entry.createdAt), value: scale[entry[key]] }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time);

  return [
    { id: 'energy', label: say('Energy', '精神'), unit: '', colour: '#7a6a9c', points: read(ENERGY_SCALE, 'energy') },
    { id: 'routine', label: say('Routine', '作息'), unit: '', colour: '#3f7d8c', points: read(ROUTINE_SCALE, 'routine') }
  ].filter((entry) => entry.points.length);
}

async function loadFeeling() {
  const host = document.querySelector('#feeling-chart');
  if (!host) return;
  if (!allCheckIns) {
    try {
      const response = await fetch('/api/check-ins', { credentials: 'same-origin' });
      if (!response.ok) return;
      allCheckIns = (await response.json()).checkIns || [];
    } catch {
      return;
    }
  }

  host.textContent = '';
  const series = feelingSeries(withinRange(allCheckIns, 'createdAt'));

  if (!series.length) {
    const note = document.createElement('p');
    note.className = 'field-hint';
    note.textContent = say(
      'No check-ins in this stretch. Try a longer one, or add today’s.',
      '這段時間沒有回報，把範圍拉長看看，或補一筆今天的。'
    );
    host.append(note);
    return;
  }

  const now = Date.now();
  const domain = domainFor(rangeDays, now);
  host.append(drawCombined(series, {
    domain,
    ticks: ticksFor(rangeDays, domain),
    width: widthFor(host),
    // A fixed band, so the same answer always sits at the same height and two ranges can be
    // compared. Letting it stretch to the data would make one bad day look like a collapse.
    band: { low: 0.7, high: 3.3 },
    axisLabel: (value) => {
      const step = Math.round(value);
      const pair = FEELING_STEPS[step];
      return pair ? (zh() ? pair[1] : pair[0]) : '';
    }
  }));
}

function wireRange() {
  const group = document.querySelector('#trend-range');
  if (!group) return;
  group.addEventListener('click', (event) => {
    const button = event.target.closest('[data-range]');
    if (!button) return;
    rangeDays = Number(button.dataset.range) || 7;
    for (const other of group.querySelectorAll('[data-range]')) other.classList.toggle('active', other === button);
    render();
  });
}

function render() { load(); loadFeeling(); }

// The drawing is sized to the container it was measured against, so a turned phone or a
// dragged window has to be redrawn or the text goes back to being scaled. Only a real change
// in width counts — the address bar sliding away fires this too.
function wireResize() {
  let lastWidth = window.innerWidth;
  let pending = null;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastWidth) < 24) return;
    lastWidth = window.innerWidth;
    clearTimeout(pending);
    pending = setTimeout(render, 150);
  });
}

// 支持者那頁在本人授權後要畫同一張圖。與其複製一份畫圖程式（兩份遲早會長歪），不如把
// 這裡的畫法開放出去，兩邊用同一支筆——顏色、刻度、斷線規則都一樣。
window.DailyAbleTrends = {
  draw(host, records, rangeDays = 30, options = {}) {
    if (!host) return;
    host.textContent = '';
    const now = Date.now();
    const cutoff = now - rangeDays * DAY;
    const within = (records || []).filter((record) => Date.parse(record.measuredAt) >= cutoff);
    if (!within.length) return false;
    const available = [];
    const relativeUnit = say('Relative index', '相對指標');
    for (const series of SERIES) {
      const points = pointsFor(within, series.key);
      if (points.length) available.push({
        id: series.key,
        label: zh() ? series.zh : series.en,
        unit: options.relativeIndex ? relativeUnit : series.unit,
        colour: series.colour,
        points
      });
    }
    if (!available.length) return false;
    const domain = domainFor(rangeDays, now);
    host.append(drawCombined(available, { domain, ticks: ticksFor(rangeDays, domain), width: widthFor(host) }));
    return true;
  }
};

// 這裡本來寫了兩個進入點：監聽 DOMContentLoaded，再加一個「如果已經載完就直接跑」。
// 但這支是 defer 腳本，執行的時候文件已經是 interactive——兩個都成立，所以整頁的資料
// 被抓了兩次。加上 records.js 也抓同一份，一次開頁就打了三輪。
// 只跑一次，不管是哪個先到。
let started = false;
function start() {
  if (started) return;
  started = true;
  wireRange();
  wireResize();
  render();
}
document.addEventListener('DOMContentLoaded', start);
document.addEventListener('dailyable:languagechange', render);
if (document.readyState !== 'loading') start();
})();
