// 首頁那一條「這幾天」。
//
// 原本 hero 右邊是一大片空白——標題靠左、按鈕靠右，中間什麼都沒有。空白本身不是問題，
// 問題是這片空白剛好在使用者打開 app 第一眼看的位置，而他第一個想知道的是「我最近怎麼樣」。
// 拿裝飾去填只是把空白換成噪音，所以填的是他自己的七天。
//
// 刻意不畫成折線圖：折線暗示連續的量測，但「精神」是四選一的選項，不是連續值。
// 一天一格、格子高度代表當天的精神，讀起來是「這幾天」而不是「你的曲線」。
(() => {
  const host = document.querySelector('#home-strip');
  if (!host) return;

  const zh = () => document.documentElement.lang.startsWith('zh');

  // 精神四階對應高度。顏色不單獨表意——高度已經帶了同一份資訊，
  // 色弱的人靠高度也讀得出來（WCAG 1.4.1）。
  const ENERGY = {
    steady: { height: 100, zh: '還可以', en: 'steady' },
    low: { height: 62, zh: '偏低', en: 'low' },
    'very-low': { height: 32, zh: '很低', en: 'very low' }
  };

  const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);

  function build(checkIns) {
    // 最近七天，一天一格。同一天有多筆就取最新的那筆。
    const byDay = new Map();
    for (const entry of checkIns) {
      const key = dayKey(entry.createdAt);
      if (!byDay.has(key)) byDay.set(key, entry);
    }

    const days = [];
    const today = new Date();
    for (let back = 6; back >= 0; back -= 1) {
      const when = new Date(today);
      when.setDate(today.getDate() - back);
      const key = when.toISOString().slice(0, 10);
      days.push({ key, when, entry: byDay.get(key) || null });
    }
    return days;
  }

  function render(days) {
    const chinese = zh();
    host.textContent = '';

    const label = document.createElement('p');
    label.className = 'strip-label';
    label.textContent = chinese ? '這七天' : 'THE PAST SEVEN DAYS';
    host.append(label);

    const row = document.createElement('ol');
    row.className = 'strip-days';

    for (const day of days) {
      const cell = document.createElement('li');
      const bar = document.createElement('span');
      bar.className = 'strip-bar';

      if (day.entry) {
        const level = ENERGY[day.entry.energy] || ENERGY.low;
        bar.style.height = `${level.height}%`;
        bar.classList.add(`strip-${day.entry.energy}`);
        // 沒回報跟回報了「很低」在畫面上必須分得開，所以空白那天走的是另一個 class
        cell.title = chinese ? level.zh : level.en;
      } else {
        bar.classList.add('strip-blank');
        cell.title = chinese ? '這天沒有記錄' : 'nothing written down';
      }

      const tick = document.createElement('b');
      tick.textContent = String(day.when.getDate());
      cell.append(bar, tick);
      row.append(cell);
    }
    host.append(row);

    // 一句讀法。沒有這句的話，七根長短不一的柱子只是圖案。
    const written = days.filter((day) => day.entry).length;
    const reading = document.createElement('p');
    reading.className = 'strip-reading';
    if (written === 0) {
      reading.textContent = chinese
        ? '這七天還沒有紀錄。記一次就會開始有東西可以看。'
        : 'Nothing written down this week. One entry is enough to start.';
    } else if (written === 7) {
      reading.textContent = chinese
        ? '這七天你每天都記了。'
        : 'You wrote something down every day this week.';
    } else {
      reading.textContent = chinese
        ? `這七天你記了 ${written} 次。空白的那幾天不用補。`
        : `You wrote something down on ${written} of these days. The blank ones do not need filling in.`;
    }
    host.append(reading);

    // 同一個畫面上的兩個數字必須是同一個來源算的。
    // 原本卡片寫死「3」而柱狀圖算出 4，一個螢幕上兩個數字互相打臉——
    // 這種矛盾比沒有數字更傷，因為它讓人不確定哪一個能信。
    const card = document.querySelector('#week-count');
    if (card) card.textContent = String(written);
  }

  let days = null;

  async function load() {
    try {
      const response = await fetch('/api/check-ins', { credentials: 'same-origin' });
      if (!response.ok) return;
      const payload = await response.json();
      days = build(payload.checkIns || []);
      render(days);
    } catch {
      // 拿不到就整塊不出現。首頁少一塊沒關係，掛掉的一塊有關係。
    }
  }

  document.addEventListener('dailyable:languagechange', () => { if (days) render(days); });
  load();
})();
