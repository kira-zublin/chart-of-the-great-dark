const $ = id => document.getElementById(id);

// The right-hand console. Players see Characters and Crew; GMs also get the
// tabs marked data-gm-only. Switching tabs only hides panes, so drafts survive.
export function initSidePanel({ isGM, canClose, onChange }) {
  const panel = $('sidePanel');
  const tabs = [...panel.querySelectorAll('#panelTabs [role="tab"]')];
  let current = 'Characters';
  const available = () => tabs.filter(tab => !tab.hidden);
  const isOpen = () => !panel.hidden;

  function select(name, focus = false) {
    if (!available().some(tab => tab.dataset.panel === name)) name = 'Characters';
    current = name;
    for (const tab of tabs) {
      const active = tab.dataset.panel === name;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) tab.focus();
    }
    onChange(isOpen() ? current : null);
  }
  function open(name) { panel.hidden = false; select(name); }
  function hide() { panel.hidden = true; onChange(null); }
  function close() { if (!canClose()) return false; hide(); return true; }
  function toggle(name) { if (isOpen() && current === name) close(); else open(name); }
  function setRole() {
    for (const tab of tabs) if ('gmOnly' in tab.dataset) tab.hidden = !isGM();
    $('openGMTools').hidden = !isGM();
    if (!available().some(tab => tab.dataset.panel === current)) select('Characters');
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab.dataset.panel));
    tab.addEventListener('keydown', event => {
      const list = available(), index = list.indexOf(tab);
      const next = event.key === 'ArrowRight' ? (index + 1) % list.length : event.key === 'ArrowLeft' ? (index - 1 + list.length) % list.length : -1;
      if (next < 0) return;
      event.preventDefault(); select(list[next].dataset.panel, true);
    });
  }
  $('closePanel').addEventListener('click', close);
  return { open, close, hide, toggle, setRole, isOpen, current: () => (isOpen() ? current : null) };
}
