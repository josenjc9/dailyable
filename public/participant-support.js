(() => {
  const state = { loading: true, error: false, update: null };

  function language() {
    return window.DailyAbleI18n?.getLanguage?.() === 'zh-TW' ? 'zh-TW' : 'en';
  }

  function words() {
    return language() === 'zh-TW'
      ? {
          loading: '正在載入 Jordan 的支持進度…',
          none: 'Jordan 尚未記錄後續支持。',
          contacted: (name) => `${name} 已記錄聯絡。`,
          scheduled: (name) => `${name} 已安排後續追蹤。`,
          closed: (name) => `${name} 已完成這次支持。`,
          review: (day) => `下次檢視：${day}`,
          error: '目前無法載入支持進度，請重新整理再試。'
        }
      : {
          loading: 'Loading Jordan’s support update…',
          none: 'Jordan has not recorded a follow-up yet.',
          contacted: (name) => `${name} recorded contact.`,
          scheduled: (name) => `${name} scheduled a follow-up.`,
          closed: (name) => `${name} completed this support item.`,
          review: (day) => `Next review: ${day}`,
          error: 'The support update could not load. Refresh to try again.'
        };
  }

  function render() {
    const status = document.querySelector('#support-update-status');
    const messageHost = document.querySelector('#support-update-message');
    const review = document.querySelector('#support-update-review');
    if (!status || !messageHost || !review) return;

    const copy = words();
    messageHost.hidden = true;
    messageHost.textContent = '';
    review.hidden = true;
    review.textContent = '';

    if (state.loading) {
      status.textContent = copy.loading;
      return;
    }
    if (state.error) {
      status.textContent = copy.error;
      return;
    }

    const followUp = state.update?.followUp;
    const supporter = state.update?.supporterName || 'Jordan';
    if (!followUp) {
      status.textContent = copy.none;
      return;
    }

    const message = {
      contacted: copy.contacted,
      scheduled: copy.scheduled,
      closed: copy.closed
    }[followUp.status];
    status.textContent = message ? message(supporter) : copy.none;
    if (followUp.message) {
      messageHost.textContent = followUp.message;
      messageHost.hidden = false;
    }

    const timestamp = Date.parse(followUp.nextReviewAt || '');
    if (Number.isFinite(timestamp)) {
      const locale = language() === 'zh-TW' ? 'zh-TW' : 'en-GB';
      const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(timestamp);
      review.textContent = copy.review(day);
      review.hidden = false;
    }
  }

  async function loadUpdate() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/participant/support-status', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Support status returned ${response.status}`);
      state.update = await response.json();
    } catch {
      state.error = true;
    } finally {
      clearTimeout(timeout);
      state.loading = false;
      render();
    }
  }

  function init() {
    render();
    loadUpdate();
  }

  document.addEventListener('dailyable:languagechange', render);
  document.addEventListener('DOMContentLoaded', init);
})();
