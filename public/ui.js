(() => {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function prepareReveals() {
    const targets = [...document.querySelectorAll('main > section, .page-heading, .portal-card, .queue-table, .timeline-list')];
    if (reducedMotion || typeof IntersectionObserver !== 'function') return;

    const nearViewport = targets.filter((target) => {
      const rect = target.getBoundingClientRect();
      return rect.bottom >= -120 && rect.top <= window.innerHeight + 120;
    });
    if (!nearViewport.length) return;

    nearViewport.forEach((target) => target.setAttribute('data-reveal', 'pending'));
    document.documentElement.classList.add('js-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-reveal', 'visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '120px 0px', threshold: 0.01 });
    nearViewport.forEach((target) => observer.observe(target));
    requestAnimationFrame(() => nearViewport.forEach((target) => {
      const rect = target.getBoundingClientRect();
      if (rect.bottom >= 0 && rect.top <= window.innerHeight) target.setAttribute('data-reveal', 'visible');
    }));
  }

  // 中文標題的斷行控制
  //
  // 中文字與字之間沒有空白，瀏覽器可以在任何一個字後面換行。所以大標會出現「你允許的位
  // 置」這種把詞拆開、最後一行只剩一個字的畫面——中文網站最容易被一眼看出外行的地方，
  // 首頁三個大標全中招。
  //
  // 這裡用 U+2060（word joiner，零寬、不換行）把不該拆開的地方黏起來：句尾三個字一定同
  // 行，另外幾組常見的量詞短語也不拆開。只增加「不能斷」的點、不新增可斷點，所以無論多
  // 窄的螢幕都不會把版面撐破——最壞的情況只是某一行短一點。
  const WORD_JOINER = '⁠';
  // 沒有斷詞器時的備案：最常出現在標題裡、拆開特別難看的幾組
  const KEEP_TOGETHER = ['一個', '一天', '一步', '一件', '一次', '兩個', '三個', '哪些', '什麼', '怎麼', '為什麼'];
  const HEADINGS = 'h1, h2, h3, .lead, .metric, .thread-steps strong, blockquote strong';
  // 瀏覽器內建的中文斷詞。手工維護「不可拆開的詞」清單永遠追不完（第一版就漏了
  // 「看得懂」「權責」「安全價值」），交給斷詞器才是真的解法。
  const segmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh-Hant', { granularity: 'word' })
    : null;

  function typeset(raw) {
    const text = raw.replace(/⁠/g, '');
    const noBreakAfter = new Set();
    // 句尾三個字綁在一起，最後一行就不會只剩一兩個字
    if (text.length >= 8) {
      for (let index = text.length - 3; index < text.length - 1; index += 1) noBreakAfter.add(index);
    }
    if (segmenter) {
      // 詞的內部不准斷，詞與詞之間照常可以斷——所以再窄的螢幕也排得下
      for (const { segment, index } of segmenter.segment(text)) {
        for (let at = index; at < index + segment.length - 1; at += 1) noBreakAfter.add(at);
      }
      // 斷詞器會把「看得懂」切成「看」＋「得懂」，於是標題斷在「都應該看／得懂」。
      // 這種「動詞＋得＋結果」的說法在中文裡是一口氣講完的，補起來。
      // 「的」不該出現在行首（「一個清楚／的下一步」），所以它前面不准斷
      for (let at = 1; at < text.length; at += 1) {
        if (text[at] === '的' && /[一-鿿]/.test(text[at - 1])) noBreakAfter.add(at - 1);
      }
      for (let at = 1; at < text.length - 1; at += 1) {
        if (text[at] !== '得') continue;
        if (!/[一-鿿]/.test(text[at - 1]) || !/[一-鿿]/.test(text[at + 1])) continue;
        noBreakAfter.add(at - 1);
        noBreakAfter.add(at);
      }
    } else {
      for (const phrase of KEEP_TOGETHER) {
        let at = text.indexOf(phrase);
        while (at !== -1) {
          for (let index = at; index < at + phrase.length - 1; index += 1) noBreakAfter.add(index);
          at = text.indexOf(phrase, at + 1);
        }
      }
    }
    let output = '';
    for (let index = 0; index < text.length; index += 1) {
      output += text[index] + (noBreakAfter.has(index) ? WORD_JOINER : '');
    }
    return output;
  }

  function typesetHeadings() {
    const chinese = document.documentElement.lang.startsWith('zh');
    document.querySelectorAll(HEADINGS).forEach((heading) => {
      if (heading.closest('[data-i18n-ignore]')) return;
      // 標題的字常常包在 <span> 裡（翻譯用），所以要走到真正裝字的那一層
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const plain = node.nodeValue.replace(/⁠/g, '');
        const body = plain.trim();
        if (!body) continue;
        const leading = plain.slice(0, plain.indexOf(body[0]));
        const trailing = plain.slice(leading.length + body.length);
        // 英文有詞距，本來就不會發生這個問題，切回英文時把黏著拿掉
        const wanted = leading + (chinese && /[一-鿿]/.test(body) ? typeset(body) : body) + trailing;
        if (node.nodeValue !== wanted) node.nodeValue = wanted;
      }
    });
  }

  // 導覽加圖示。
  //
  // 純文字的側邊選單要一行一行讀才知道哪個是哪個；配一個圖示之後是掃一眼就找到。對認知負
  // 荷高、或每天要用好幾次的人，這個差別是真的。
  //
  // 圖示永遠配著文字，而且自己 aria-hidden——不拿圖示當唯一的說明，看不懂圖的人靠文字，
  // 讀螢幕的人也不會聽到多餘的東西。在這裡注入而不是寫進十三份 HTML，是為了讓對應關係只
  // 有一份，不會有哪一頁漏掉或對錯。
  const NAV_ICONS = new Map([
    ['/app', 'icon-home'],
    ['/app/check-in', 'icon-checkin'],
    ['/check-in', 'icon-checkin'],
    ['/app/records', 'icon-body'],
    ['/app/summary', 'icon-summary'],
    ['/app/insights', 'icon-trend'],
    ['/app/support', 'icon-support'],
    ['/app/privacy', 'icon-permission'],
    ['/app/connections', 'icon-connections'],
    ['/supporter', 'icon-home'],
    ['/supporter/queue', 'icon-queue'],
    ['/supporter/follow-up', 'icon-summary'],
    ['/supporter/method', 'icon-method'],
    ['/supporter/connections', 'icon-connections']
  ]);

  function addNavigationIcons() {
    document.querySelectorAll('.participant-dock nav a, .ops-rail nav a, [data-role-shell] aside nav a').forEach((link) => {
      if (link.querySelector('svg')) return;
      let path;
      try { path = new URL(link.href, location.href).pathname; } catch { return; }
      const id = NAV_ICONS.get(path);
      if (!id) return;
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon nav-icon');
      icon.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `/icons.svg#${id}`);
      icon.append(use);
      link.prepend(icon);
    });
  }

  // 首頁流程圖的滑鼠視差。十幾行，不用外部動畫庫——這站的資源政策擋外部 CDN，那是寫在
  // 文件裡對評審的承諾，不會為了做效果自己破掉。
  // 幅度刻意很小（最多 4 度），而且系統要求減少動態時完全不裝。
  function wireFlowParallax() {
    // 首頁的服務流程圖跟運作方式頁的判斷路徑圖用同一套。共用的是手法不是圖——
    // 兩張畫的是不同的東西，把同一張複製到每一頁只會變成重複的裝飾。
    const maps = document.querySelectorAll('.flow-map, .decision-map');
    if (!maps.length || reducedMotion) return;
    if (window.matchMedia?.('(max-width: 900px)').matches) return;
    const pairs = [...maps]
      .map((map) => ({ map, nodes: map.querySelector('.flow-map-nodes, .decision-map-nodes') }))
      .filter((pair) => pair.nodes);
    if (!pairs.length) return;

    let queued = false;
    window.addEventListener('pointermove', (event) => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        for (const { map, nodes } of pairs) {
          const box = map.getBoundingClientRect();
          // 已經捲出畫面的就不用算，省下沒人看得到的那幾次計算
          if (box.bottom < 0 || box.top > window.innerHeight) continue;
          const fromCentreX = (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
          const fromCentreY = (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
          nodes.style.setProperty('--tilt-y', (fromCentreX * 8).toFixed(2));
          nodes.style.setProperty('--tilt-x', (-fromCentreY * 5).toFixed(2));
        }
      });
    }, { passive: true });
  }

  // 長表格收起來。
  //
  // 藥物、飲食、量測這幾張表會一路長到二三十列，把後面的東西全推到看不見的地方——想看
  // 趨勢圖得先捲過三十筆吃藥紀錄。但預設整個收起來也不對：看不到內容的標題只是一道門，
  // 不知道值不值得推開。所以留前六列看得見，其餘收起來，並且明講還有幾列。
  //
  // 用 CSS 限高而不是刪 DOM：列印時可以整份攤開，搜尋頁面文字也找得到被收起來的內容。
  const ROWS_SHOWN = 6;

  function foldLongTables() {
    document.querySelectorAll('.table-scroll').forEach((box) => {
      if (box.dataset.foldReady) return;
      const rows = box.querySelectorAll('tbody tr');
      if (rows.length <= ROWS_SHOWN + 2) return;   // 只多一兩列的話，收合比不收還煩
      box.dataset.foldReady = 'true';
      box.classList.add('is-folded');

      const chinese = () => document.documentElement.lang.startsWith('zh');
      const hidden = rows.length - ROWS_SHOWN;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'table-fold-toggle';
      const label = () => (box.classList.contains('is-folded')
        ? (chinese() ? `看全部 ${rows.length} 筆（還有 ${hidden} 筆收起來）` : `Show all ${rows.length} (${hidden} more)`)
        : (chinese() ? '收起來' : 'Show fewer'));
      toggle.textContent = label();
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        box.classList.toggle('is-folded');
        toggle.setAttribute('aria-expanded', box.classList.contains('is-folded') ? 'false' : 'true');
        toggle.textContent = label();
      });
      document.addEventListener('dailyable:languagechange', () => { toggle.textContent = label(); });
      box.after(toggle);
    });
  }

  function setCurrentNavigation() {
    document.querySelectorAll('nav a').forEach((link) => {
      let active = false;
      try { active = new URL(link.href, location.href).pathname === location.pathname; } catch {}
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function toast(message) {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.append(region);
    }
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.remove(), reducedMotion ? 2200 : 3200);
  }

  function wireFormStates() {
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.classList.add('is-submitting');
      form.setAttribute('aria-busy', 'true');
      window.setTimeout(() => { form.classList.remove('is-submitting'); form.removeAttribute('aria-busy'); }, 8000);
    });
    document.addEventListener('invalid', (event) => event.target?.classList.add('is-invalid'), true);
    document.addEventListener('input', (event) => event.target?.classList.remove('is-invalid'));
  }

  let sessionDisplayName = '';

  function renderSessionIdentity() {
    if (!sessionDisplayName) return;
    document.querySelectorAll('[data-session-display-name]').forEach((element) => { element.textContent = sessionDisplayName; });
    document.querySelectorAll('[data-session-greeting]').forEach((element) => {
      const greetingMode = element.dataset.sessionGreeting || 'morning';
      const chinese = document.documentElement.lang === 'zh-TW';
      element.textContent = greetingMode === 'morning'
        ? (chinese ? `早安，${sessionDisplayName}。` : `Good morning, ${sessionDisplayName}.`)
        : sessionDisplayName;
    });
  }

  async function loadSessionIdentity() {
    if (!document.querySelector('[data-session-display-name], [data-session-greeting]')) return;
    try {
      const response = await fetch('/api/session', { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const body = await response.json();
      const session = body.user || body.session || body;
      const displayName = (body.user && body.user.displayName) || session.displayName;
      if (session.role !== 'participant' || !displayName) return;
      sessionDisplayName = displayName;
      renderSessionIdentity();
    } catch {}
  }

  // In the demo, switching role means becoming the other demo person. Left pointing at
  // /session it landed on a sign-in screen that could only offer to change persona, so the
  // link looked like it threw you out instead of taking you to the other side.
  async function wireDemoRoleSwitch() {
    const links = [...document.querySelectorAll('[data-role-switch]')];
    if (!links.length) return;
    try {
      const response = await fetch('/api/session', { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const body = await response.json();
      if (!body.demoData) return;
      for (const link of links) link.href = '/demo/switch';
    } catch {
      /* leaving the original link in place is the safe fallback */
    }
  }

  document.addEventListener('dailyable:toast', (event) => toast(event.detail?.message || event.detail || 'Done'));
  // 表格是資料回來之後才長出來的，DOMContentLoaded 當下還是空的。盯著它，一有列就收合。
  function watchForTables() {
    if (typeof MutationObserver !== 'function') return;
    const host = document.querySelector('.participant-main, .supporter-main');
    if (!host) return;
    let pending = null;
    new MutationObserver(() => {
      clearTimeout(pending);
      pending = setTimeout(foldLongTables, 120);
    }).observe(host, { childList: true, subtree: true });
  }

  document.addEventListener('dailyable:languagechange', () => { renderSessionIdentity(); typesetHeadings(); });
  document.addEventListener('DOMContentLoaded', () => {
    addNavigationIcons(); setCurrentNavigation(); prepareReveals(); wireFormStates();
    typesetHeadings(); wireFlowParallax(); foldLongTables(); watchForTables();
    loadSessionIdentity(); wireDemoRoleSwitch();
  });
  window.DailyAbleUI = { toast };
})();
