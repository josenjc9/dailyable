const form = document.querySelector('#session-form');
const currentSession = document.querySelector('#current-session');
const localized = (english, traditionalChinese) => document.documentElement?.lang?.startsWith('zh') ? traditionalChinese : english;

function destinationFor(role) {
  const requested = new URLSearchParams(location.search).get('next');
  const supporterInvite = role === 'supporter' && /^\/connect\?invite=[A-Z0-9]{8}$/.test(requested || '');
  if (supporterInvite) return requested;
  const allowedPrefix = role === 'participant' ? '/app' : '/supporter';
  return requested?.startsWith(allowedPrefix) ? requested : role === 'participant' ? '/app' : '/supporter';
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Text created here is injected after the page has already been translated, so it has to
// carry both languages: i18n.js watches for new nodes and swaps them when the toggle is
// used. Without the attributes the panel stays frozen in whichever language loaded first.
function bilingual(tag, className, english, traditionalChinese) {
  const node = element(tag, className, localized(english, traditionalChinese));
  node.dataset.en = english;
  node.dataset.zh = traditionalChinese;
  return node;
}

async function showCurrentSession() {
  const response = await fetch('/api/session', { credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (!response.ok) return;
  const body = await response.json();
  const user = body.user;
  const isParticipant = user.role === 'participant';
  const message = bilingual('p', '',
    `${user.displayName} is already signed in as ${isParticipant ? 'participant' : 'supporter'}.`,
    `${user.displayName} 已經以${isParticipant ? '參與者' : '支持者'}身分登入。`);
  const actions = element('div', 'link-row');
  const continueLink = bilingual('a', 'button primary', 'Continue this session', '繼續目前使用階段');
  continueLink.href = destinationFor(user.role);
  // In the demo the way to see the other role is to pick a different demo person, so the
  // button says that plainly instead of offering a sign-out that leads nowhere useful.
  const signOut = body.demoData
    ? bilingual('button', 'button secondary', 'Switch to another demo person', '換一位展示人物')
    : bilingual('button', 'button secondary', 'Sign out and use another role', '登出並改用其他角色');
  const signOutError = element('p', 'empty-state');
  signOut.type = 'button';
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    signOutError.textContent = '';
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeout;
    try {
      const result = await Promise.race([
        fetch('/api/session', {
          method: 'DELETE',
          credentials: 'same-origin',
          signal: controller?.signal
        }),
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller?.abort();
            reject(new Error(localized('Signing out is taking longer than expected. Please retry.', '登出花費較久，請再試一次。')));
          }, 5000);
        })
      ]);
      if (!result.ok) throw new Error(localized('Could not sign out. Please retry.', '目前無法登出，請再試一次。'));
      // A demo visitor came here to see the other role, so send them where they can pick it.
      if (body.demoData) location.assign('/demo');
      else location.reload();
    } catch (error) {
      signOutError.textContent = error.name === 'AbortError'
        ? localized('Signing out is taking longer than expected. Please retry.', '登出花費較久，請再試一次。')
        : error.message || localized('Could not sign out. Please retry.', '目前無法登出，請再試一次。');
    } finally {
      clearTimeout(timeout);
      signOut.disabled = false;
    }
  });
  actions.append(continueLink, signOut, signOutError);
  currentSession.append(message, actions);
  currentSession.hidden = false;
  form.hidden = true;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const output = document.querySelector('#session-error');
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  submit.disabled = true;
  output.textContent = '';
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeout;
  try {
    const values = new FormData(form);
    const response = await Promise.race([
      fetch('/api/session', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller?.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(values))
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller?.abort();
          reject(new Error(localized('Starting your session is taking longer than expected. Please retry.', '建立使用階段花費較久，請再試一次。')));
        }, 5000);
      })
    ]);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(localized(body.error || 'Could not start the session.', '目前無法建立使用階段，請確認名稱與角色後再試一次。'));
    location.assign(destinationFor(values.get('role')));
  } catch (error) {
    output.textContent = error.name === 'AbortError'
      ? localized('Starting your session is taking longer than expected. Please retry.', '建立使用階段花費較久，請再試一次。')
      : error.message || localized('Could not start the session. Please review your choices and retry.', '目前無法建立使用階段，請確認選擇後再試一次。');
  } finally {
    clearTimeout(timeout);
    submit.disabled = false;
  }
});

showCurrentSession().catch(() => {});
