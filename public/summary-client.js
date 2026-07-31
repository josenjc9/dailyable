const zh = () => document.documentElement?.lang?.startsWith('zh');
const say = (english, traditionalChinese) => (zh() ? traditionalChinese : english);
const BLANK = '—';

const MEASURE_LABEL = {
  systolic: ['Systolic', '收縮壓', 'mmHg'],
  diastolic: ['Diastolic', '舒張壓', 'mmHg'],
  pulse: ['Pulse', '脈搏', 'bpm'],
  glucose: ['Blood glucose', '血糖', 'mg/dL'],
  waterMl: ['Water', '飲水', 'mL']
};

const CONTEXT_LABEL = {
  fasting: ['Fasting', '空腹'],
  'post-meal-2h': ['2h after an ordinary meal', '一般吃飯後兩小時'],
  'ogtt-2h': ['Glucose tolerance test, 2nd hour', '葡萄糖耐受試驗第二小時'],
  random: ['Any other time', '其他時間'],
  unspecified: ['Timing not noted', '未註明時機']
};

function cell(row, text, className) {
  const td = document.createElement('td');
  td.textContent = text ?? BLANK;
  if (className) td.className = className;
  row.append(td);
  return td;
}

// Phrased as a comparison with the person's own earlier days, never as a verdict, and it
// says so plainly when there is not enough of their own history to compare against.
function describeChange(measure, unit) {
  if (!measure.comparedWithOwnBaseline) {
    return measure.recordedInWindow
      ? say('Not enough earlier entries to compare yet', '先前的紀錄還不夠，暫時無法比較')
      : say('Nothing recorded', '沒有紀錄');
  }
  const { change, direction } = measure.comparedWithOwnBaseline;
  if (direction === 'same') return say('About the same as before', '跟先前差不多');
  const amount = `${Math.abs(change)} ${unit}`;
  return direction === 'higher'
    ? say(`About ${amount} higher than your earlier days`, `比先前高約 ${amount}`)
    : say(`About ${amount} lower than your earlier days`, `比先前低約 ${amount}`);
}

function render(summary, series = []) {
  const coverage = document.querySelector('#summary-coverage');
  if (coverage) {
    coverage.textContent = '';
    const heading = document.createElement('h2');
    heading.textContent = say('What this page covers', '這一頁涵蓋什麼');
    const text = document.createElement('p');
    const days = summary.coverage.daysWithAnyRecord;
    const window = summary.windowDays;
    text.textContent = say(
      `${days} days in the last ${window} have at least one entry. Days with nothing written down are left blank on purpose — they are not readings of zero.`,
      `過去 ${window} 天裡有 ${days} 天留下了紀錄。沒有寫的那幾天會留白，那代表沒有記錄，不是量到零。`
    );
    coverage.append(heading, text);
  }

  const measuresBody = document.querySelector('#summary-measures');
  if (measuresBody) {
    measuresBody.textContent = '';
    for (const [key, [en, zhLabel, unit]] of Object.entries(MEASURE_LABEL)) {
      const measure = summary.measures[key];
      if (!measure) continue;
      const row = document.createElement('tr');
      cell(row, zh() ? zhLabel : en);
      cell(row, String(measure.recordedInWindow));
      cell(row, measure.recentAverage === null ? BLANK : `${measure.recentAverage} ${unit}`);
      cell(row, describeChange(measure, unit));
      measuresBody.append(row);
    }
  }

  const glucoseBody = document.querySelector('#summary-glucose');
  if (glucoseBody) {
    glucoseBody.textContent = '';
    if (!summary.glucoseContexts.length) {
      const row = document.createElement('tr');
      const td = cell(row, say('No glucose readings recorded.', '沒有血糖紀錄。'), 'empty-state');
      td.colSpan = 3;
      glucoseBody.append(row);
    }
    for (const entry of summary.glucoseContexts) {
      const row = document.createElement('tr');
      const pair = CONTEXT_LABEL[entry.context] || CONTEXT_LABEL.unspecified;
      cell(row, zh() ? pair[1] : pair[0]);
      cell(row, String(entry.count));
      cell(row, entry.average === null ? BLANK : `${entry.average} mg/dL`);
      glucoseBody.append(row);
    }
  }

  const medication = document.querySelector('#summary-medication');
  if (medication) {
    medication.textContent = '';
    const text = document.createElement('p');
    text.textContent = summary.medication.dosesRecorded
      ? say(
        `${summary.medication.dosesRecorded} doses written down across ${summary.medication.daysRecorded} days.`,
        `這段期間記下了 ${summary.medication.dosesRecorded} 次用藥，分布在 ${summary.medication.daysRecorded} 天。`
      )
      : say(`No medicine entries in the last ${summary.windowDays} days.`, `過去 ${summary.windowDays} 天沒有用藥紀錄。`);
    medication.append(text);

    if (summary.medication.byDay.length) {
      // 一天一列排下去會吃掉將近十行，把這一頁擠到第二頁——而這頁的整個賣點就是
      // 「一頁，帶去看診就好」。改成同一段裡橫排，資訊一個字都沒少，高度剩兩三行。
      const list = document.createElement('ul');
      list.className = 'permission-items medication-days';
      for (const [day, count] of summary.medication.byDay.slice(0, 10)) {
        const item = document.createElement('li');
        item.textContent = say(`${day} · ${count} time${count === 1 ? '' : 's'}`, `${day} · ${count} 次`);
        list.append(item);
      }
      medication.append(list);
    }
  }

  const boundary = document.querySelector('#summary-boundary');
  if (boundary) {
    boundary.textContent = say(
      'Recorded values and this person’s own trend. No diagnosis, no risk score, no interpretation. Bring this to a clinician for that.',
      '以上是記錄下來的數值與這個人自己的變化。不含診斷、風險分數或任何判讀；那部分請帶去給醫療專業人員看。'
    );
  }

  const trend = document.querySelector('#summary-trend');
  if (trend) {
    trend.textContent = '';
    const drawn = window.DailyAbleTrends ? window.DailyAbleTrends.draw(trend, series, 90) : false;
    if (!drawn) trend.textContent = say('Not enough dated readings to draw a three-month trend.', '有日期的紀錄還不夠，暫時無法畫出三個月趨勢。');
  }
}

async function load() {
  try {
    const response = await fetch('/api/clinical-summary', { credentials: 'same-origin' });
    if (!response.ok) return;
    const body = await response.json();
    render(body.summary, body.series || []);
  } catch {
    /* leave the page as-is rather than showing an error where a summary should be */
  }
}

// 印出來的那張紙要說得出它是什麼、什麼時候印的、資料從哪來。一張沒有日期的健康紀錄，
// 醫生沒辦法拿它做任何判斷；一張沒說是本人自己記的紙，可能被當成檢驗報告。
function stampPrintFooter() {
  const main = document.querySelector('.participant-main');
  if (!main) return;
  const chinese = document.documentElement.lang.startsWith('zh');
  const when = new Date().toLocaleDateString(chinese ? 'zh-TW' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' });
  main.setAttribute('data-print-footer', chinese
    ? `DailyAble 就診摘要 · ${when} 列印 · 這些是本人自己記下的內容與他自己的變化，不是檢驗報告，也不是診斷。`
    : `DailyAble visit summary · printed ${when} · These are this person's own entries and their own trend. Not a lab report and not a diagnosis.`);
}

document.querySelector('#print-summary')?.addEventListener('click', () => { stampPrintFooter(); window.print(); });
// 用瀏覽器選單或快捷鍵列印時也要有頁尾，不是只有按那顆按鈕才有
window.addEventListener('beforeprint', stampPrintFooter);

// 兩個進入點在 defer 腳本下都會成立，會多抓一次資料。只跑一次。
let summaryLoaded = false;
const loadSummaryOnce = () => { if (summaryLoaded) return; summaryLoaded = true; load(); };
document.addEventListener('DOMContentLoaded', loadSummaryOnce);
document.addEventListener('dailyable:languagechange', load);
if (document.readyState !== 'loading') loadSummaryOnce();
