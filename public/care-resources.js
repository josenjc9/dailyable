// 「支持與資源」頁的長照那一區。
//
// 這頁原本只有兩條外連連結，點出去就是政府網站首頁，然後使用者自己在裡面繞。
// 對一個正在照顧失能家人、已經很累的人來說，那等於什麼都沒給。
//
// 這裡回答三個他真正會問的問題：有什麼可以申請、我算不算符合、要問誰。
// 刻意不寫金額——官方兩種說法互相矛盾，而且實際額度以各縣市長照中心核定為準，
// 我們寫得再精確都不是那個數字（理由寫在 care-knowledge.js）。
(() => {
  const host = document.querySelector('#care-resources');
  if (!host) return;

  const zh = () => document.documentElement.lang.startsWith('zh');
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  let data = null;

  function render() {
    if (!data) return;
    const chinese = zh();
    host.textContent = '';

    host.append(el('h2', '', chinese ? '長照可以申請什麼' : 'What long-term care covers'));
    host.append(el('p', 'field-hint', chinese
      ? '這四類是長照 2.0 的給付項目。實際能申請多少由各縣市長照管理中心評估後核定，這裡不列金額。'
      : 'These four categories are what Long-Term Care 2.0 covers. The amount is decided by each city or county care management centre after assessment, so no figures are listed here.'));

    const list = el('ul', 'care-benefits');
    for (const benefit of data.benefits) {
      const item = document.createElement('li');
      item.append(el('strong', '', chinese ? benefit.zh : benefit.en));
      item.append(el('p', '', chinese ? benefit.plain : benefit.plainEn));
      list.append(item);
    }
    host.append(list);

    // 「我算不算」是最常卡住的一題，所以資格條件逐字照官方寫，不改寫成我們的判斷
    host.append(el('h2', '', chinese ? '誰可以申請' : 'Who can apply'));
    host.append(el('p', 'care-quote', `「${data.eligibility.quote}」`));
    const who = el('ul', 'care-who');
    for (const line of data.eligibility.who) {
      who.append(el('li', '', chinese ? line.zh : line.en));
    }
    host.append(who);
    host.append(el('p', 'field-hint', chinese ? data.eligibility.levels : data.eligibility.levelsEn));

    // 電話最後，而且時段一定要寫。1966 只有上班時間通，寫成 24 小時會害人白打一趟
    host.append(el('h2', '', chinese ? '打哪一支' : 'Who to call'));
    const lines = el('div', 'care-helplines');
    for (const line of data.helplines) {
      const card = el('div', 'care-helpline');
      // 「長照專線 1966」名字裡已經有號碼了，再接一次會變成「1966　1966」
      const heading = line.name.includes(line.number) ? line.name : `${line.name}　${line.number}`;
      card.append(el('strong', '', heading));
      card.append(el('p', '', line.forWhat));
      if (line.hours) card.append(el('p', 'care-hours', (chinese ? '服務時間：' : 'Hours: ') + line.hours));
      card.append(el('p', 'care-quote-small', line.quote));
      lines.append(card);
    }
    host.append(lines);

    // 政府資料開放授權條款要求註明出處，這是條款要求不是禮貌
    host.append(el('p', 'care-attribution', chinese ? data.attribution.zh : data.attribution.en));
  }

  fetch('/api/care-resources', { credentials: 'same-origin' })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      if (!payload) return;
      data = payload;
      render();
    })
    .catch(() => {
      // 拿不到就整區不出現。這頁本來就有那兩條外連連結，少一區比壞一區好。
    });

  document.addEventListener('dailyable:languagechange', render);
})();
