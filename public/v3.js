const methodTabs = [...document.querySelectorAll('[data-method-step]')];
const methodPanels = [...document.querySelectorAll('[data-method-panel]')];

function selectMethod(tab, focus = false) {
  const name = tab?.dataset.methodStep;
  if (!name) return;
  for (const item of methodTabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  }
  for (const panel of methodPanels) panel.hidden = panel.dataset.methodPanel !== name;
  if (focus) tab.focus();
}

methodTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectMethod(tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % methodTabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + methodTabs.length) % methodTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = methodTabs.length - 1;
    selectMethod(methodTabs[next], true);
  });
});

if (methodTabs.length) selectMethod(methodTabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || methodTabs[0]);
