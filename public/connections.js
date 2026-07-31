const output = document.querySelector('#connection-output');
const inviteOutput = document.querySelector('#invite-output');
const role = document.body.dataset.connectionRole;
const localized = (english, traditionalChinese) => document.documentElement.lang.startsWith('zh') ? traditionalChinese : english;
// Set when an action ran but was not stored, so the next render can say so.
let demoNote = '';
const uiLocale = () => document.documentElement.lang.startsWith('zh') ? 'zh-TW' : 'en-US';

function replaceContent(target, ...nodes) {
  if (!target) return;
  while (target.firstChild) target.removeChild(target.firstChild);
  target.append(...nodes);
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

async function request(path, options = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeout;
  try {
    const response = await Promise.race([
      fetch(path, {
        ...options,
        credentials: 'same-origin',
        signal: controller?.signal,
        headers: {
          accept: 'application/json',
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller?.abort();
          reject(new Error('This is taking longer than expected. Check your connection and retry.'));
        }, 5000);
      })
    ]);
    if (response.status === 401) {
      location.assign(`/session?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
      throw new Error('Sign in to manage connections.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('This is taking longer than expected. Check your connection and retry.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function renderError(error, retry) {
  const message = textElement('p', 'empty-state', error.message || 'Could not load connections.');
  const button = textElement('button', 'button secondary', 'Retry');
  button.type = 'button';
  button.addEventListener('click', retry);
  replaceContent(output, message, button);
}

function sharedSummaryList(records) {
  if (!records.length) return textElement('p', 'empty-state', 'No shared check-in summaries yet.');
  const list = document.createElement('ul');
  list.className = 'shared-checkins';
  records.forEach((record) => {
    const item = document.createElement('li');
    const when = new Date(record.createdAt).toLocaleString(uiLocale());
    const message = record.summary?.message || record.summary?.level || 'Check-in completed';
    item.append(textElement('strong', '', when), textElement('span', '', message));
    list.append(item);
  });
  return list;
}

function relationshipCard(item) {
  const card = document.createElement('article');
  card.className = 'portal-card connection-card';
  const title = textElement('h2', '', item.otherPartyName || 'Your connection');
  const statusText = item.status === 'active'
    ? role === 'participant'
      ? localized('Connected. This supporter can view your check-in summaries; your original answers stay private.', '已完成連結。這位支持者可查看回報摘要，原始回答仍由你保留。')
      : localized('Connected with consent. You may view shared check-in summaries only.', '本人已同意連結；你只能查看對方選擇分享的回報摘要。')
    : item.status === 'pending_confirmation'
      ? role === 'participant'
        ? localized('Waiting for you. Confirming will share check-in summaries; original answers and private notes stay private.', '正在等你確認。確認後會分享回報摘要，原始回答與私人筆記仍不會分享。')
        : localized('Waiting for the participant to confirm.', '正在等待參與者本人確認。')
      : localized('This connection has ended.', '這段連結已結束。');
  const status = textElement('p', 'connection-status', statusText);
  card.append(title, status);

  const participantCanConfirm = role === 'participant' && item.status === 'pending_confirmation';
  const canEnd = ['active', 'pending_confirmation'].includes(item.status);

  if (role === 'supporter' && item.status === 'active') {
    const summaries = document.createElement('div');
    summaries.className = 'shared-summary-panel';
    const view = textElement('button', 'button primary', localized('View shared check-in summaries', '查看已分享的回報摘要'));
    view.type = 'button';
    view.addEventListener('click', async () => {
      view.disabled = true;
      try {
        const body = await request(`/api/relationships/${item.id}/check-ins`);
        replaceContent(summaries, sharedSummaryList(body.checkIns));
      } catch (error) {
        replaceContent(summaries, textElement('p', 'empty-state', error.message));
      } finally {
        view.disabled = false;
      }
    });
    card.append(view, summaries);
  }

  function relationshipAction(label, className, confirm) {
    const button = textElement('button', `button ${className}`, label);
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await request(`/api/pairing/relationships/${item.id}${confirm ? '/confirm' : ''}`, {
          method: confirm ? 'POST' : 'DELETE'
        });
        // The demo runs the step without storing it, which is the honest behaviour and was
        // also an invisible one: the list came back unchanged and the button read as broken.
        // If nothing was stored, the page has to say so rather than leave a person pressing it.
        demoNote = result?.saved === false
          ? localized(
            'Demo mode: the step ran and nothing was stored, so the connections stay as prepared.',
            '展示模式：這個步驟走完了，但不會真的存起來，所以連結會維持原本準備好的樣子。'
          )
          : '';
        await refresh();
      } catch (error) {
        renderError(error, refresh);
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  // 分享程度分三階，本人選一階，每一階包含前一階。「讓人知道我最近不太好」跟「讓人看到
  // 我的血壓數字」是兩件事，中間那一階就是為了這個而存在。
  if (role === 'participant' && item.status === 'active') {
    const LEVELS = [
      ['summary', 'Summary only', '只有摘要',
        'They read what changed, in words. No numbers.', '對方讀到的是文字說明，沒有任何數字。'],
      ['trend', 'Summary and the shape of my trend', '摘要，加上我的走勢形狀',
        'They see how it moves. The readings themselves are not sent.', '對方看得到變化的形狀，實際數值不會送出去。'],
      ['values', 'Summary, trend, and my actual readings', '摘要、走勢，加上我的實際數值',
        'They see each recorded number.', '對方看得到每一筆記下來的數字。']
    ];
    const current = item.sharingLevel || 'summary';
    const row = document.createElement('fieldset');
    row.className = 'sharing-levels';
    const legend = document.createElement('legend');
    legend.textContent = localized('How much of this do they see?', '要讓對方看到哪一階？');
    row.append(legend);
    const status = document.createElement('p');
    status.className = 'field-hint';
    for (const [value, labelEn, labelZh, hintEn, hintZh] of LEVELS) {
      const option = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `sharing-${item.id}`;
      input.value = value;
      input.checked = current === value;
      const copy = document.createElement('span');
      copy.append(
        Object.assign(document.createElement('strong'), { textContent: localized(labelEn, labelZh) }),
        Object.assign(document.createElement('small'), { textContent: localized(hintEn, hintZh) })
      );
      option.append(input, copy);
      input.addEventListener('change', async () => {
        if (!input.checked) return;
        const previous = item.sharingLevel;
        try {
          const result = await request(`/api/pairing/relationships/${item.id}/scopes`, {
            method: 'POST',
            body: JSON.stringify({ level: value })
          });
          item.sharingLevel = result.sharingLevel;
          item.scopes = result.scopes || [];
          status.textContent = localized('Updated. You can change this at any time.', '已更新。你隨時可以再改。');
        } catch (error) {
          item.sharingLevel = previous;
          status.textContent = error.message;
        }
      });
      row.append(option);
    }
    row.append(status);
    card.append(row);
  }

  if (participantCanConfirm) {
    const actions = document.createElement('div');
    actions.className = 'link-row';
    actions.append(
      relationshipAction(localized(`Confirm ${item.otherPartyName || 'this supporter'}`, `確認 ${item.otherPartyName || '這位支持者'}`), 'primary', true),
      relationshipAction(localized('Decline request', '拒絕連結要求'), 'secondary', false)
    );
    card.append(actions);
  } else if (canEnd) {
    card.append(relationshipAction(
      role === 'participant' ? localized('Revoke access', '停止授權') : localized('Leave connection', '離開這段連結'),
      'secondary',
      false
    ));
  }
  return card;
}

async function refresh() {
  if (!output) return;
  output.setAttribute('aria-busy', 'true');
  try {
    const body = await request('/api/pairing/relationships');
    if (!body.relationships.length) {
      replaceContent(output, textElement('p', 'empty-state', role === 'participant'
        ? localized('No supporters are connected yet. Create a short-lived code when you are ready.', '目前還沒有支持者。準備好時，再產生短效邀請碼。')
        : localized('No participant connections yet. Ask the participant to share an invitation code.', '目前還沒有參與者連結。請由參與者本人提供邀請碼。')));
      return;
    }
    const cards = body.relationships.map(relationshipCard);
    if (demoNote) {
      const note = textElement('p', 'confirmation', demoNote);
      note.setAttribute('role', 'status');
      cards.unshift(note);
    }
    replaceContent(output, ...cards);
  } catch (error) {
    renderError(error, refresh);
  } finally {
    output.removeAttribute('aria-busy');
  }
}

document.querySelector('#create-invite')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const body = await request('/api/pairing/invites', { method: 'POST' });
    const code = textElement('strong', 'invite-code', body.code);
    const qr = document.createElement('img');
    qr.className = 'invite-qr';
    qr.src = body.qrDataUrl;
    qr.width = 320;
    qr.height = 320;
    qr.alt = localized(`Invitation QR code. Backup code ${body.code}.`, `邀請 QR Code。備用邀請碼 ${body.code}。`);
    const fallback = textElement('a', 'invite-link', localized('Open invitation link', '開啟邀請連結'));
    fallback.href = body.inviteUrl;
    const expiry = new Date(body.expiresAt).toLocaleTimeString(
      document.documentElement.lang.startsWith('zh') ? 'zh-TW' : 'en-US',
      { hour: 'numeric', minute: '2-digit' }
    );
    const guidance = textElement('p', '', localized(
      `Scan the QR code or use the backup code. Valid until ${expiry}. The supporter sees only your display name until you confirm.`,
      `可掃描 QR Code 或使用備用邀請碼。有效至 ${expiry}。在你確認前，支持者只會看到你的顯示名稱。`
    ));
    replaceContent(
      inviteOutput || output,
      textElement('p', 'eyebrow', localized('ONE-TIME INVITATION', '一次性邀請')),
      qr,
      textElement('p', 'invite-code-label', localized('Backup 8-character code', '備用八位邀請碼')),
      code,
      fallback,
      guidance
    );
  } catch (error) {
    replaceContent(inviteOutput || output, textElement('p', 'empty-state', error.message));
  } finally {
    button.disabled = false;
  }
});

const inviteInput = document.querySelector('#invite-code');
const invite = new URLSearchParams(location.search).get('invite')?.trim().toUpperCase();
if (inviteInput && /^[A-Z0-9]{8}$/.test(invite || '')) inviteInput.value = invite;

document.querySelector('#claim-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await request('/api/pairing/claim', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    form.reset();
    await refresh();
  } catch (error) {
    renderError(error, refresh);
  } finally {
    button.disabled = false;
  }
});

let languageReady = false;
document.addEventListener('dailyable:languagechange', () => {
  languageReady = true;
  refresh();
});
document.addEventListener('DOMContentLoaded', () => {
  if (!languageReady) refresh();
}, { once: true });
