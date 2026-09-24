const $ = id => document.getElementById(id);
const roles = ['delver', 'burrower', 'scout', 'guard', 'archaeologist'];
const sections = {
  bird: [['name', 'Name'], ['type', 'Type'], ['appearance', 'Appearance', 'long'], ['description', 'Description', 'long'], ['health', 'Health', 'number'], ['energy', 'Energy', 'number'], ['powers', 'Powers']],
  rover: [['name', 'Name'], ['model', 'Model'], ['hull', 'Hull', 'number'], ['armor', 'Armor', 'number'], ['blight', 'Blight protection', 'number'], ['speed', 'Speed'], ['range', 'Range'], ['upgrades', 'Upgrades'], ['cargo', 'Cargo', 'long']],
  shuttle: [['name', 'Name'], ['model', 'Model'], ['hull', 'Hull', 'number'], ['armor', 'Armor', 'number'], ['blight', 'Blight protection', 'number'], ['speed', 'Travel speed'], ['range', 'Range'], ['upgrades', 'Upgrades'], ['cargo', 'Cargo', 'long']]
};
export function initCrewUI(request, profile, canLeaveCharacter) {
  let crew = null; let characters = []; let timer = null; let loading = false;
  const panel = $('crewPanel');
  const message = text => { $('crewMessage').textContent = text; };
  const tabs = ['Info', 'Maneuvers', 'Bird', 'Rover', 'Shuttle'];
  function selectTab(name) {
    for (const tab of tabs) {
      const active = tab === name;
      $('crewTab' + tab).setAttribute('aria-selected', String(active));
      $('crewTab' + tab).tabIndex = active ? 0 : -1;
      $('crewPane' + tab).hidden = !active;
    }
  }
  for (const [index, tab] of tabs.entries()) {
    const button = $('crewTab' + tab);
    button.addEventListener('click', () => selectTab(tab));
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : -1;
      if (next < 0) return;
      event.preventDefault(); selectTab(tabs[next]); $('crewTab' + tabs[next]).focus();
    });
  }
  function renderPortrait(slot) {
    const prefix = slot === 'crew' ? 'crew' : 'bird';
    const preview = $(prefix + 'Portrait');
    preview.hidden = !crew.images?.[slot];
    $('remove' + prefix[0].toUpperCase() + prefix.slice(1) + 'Portrait').hidden = !crew.images?.[slot];
    if (!preview.hidden) preview.src = `/api/crew-image?slot=${slot}&v=${Date.now()}`;
    else preview.removeAttribute('src');
  }
  function maneuverValues() { return [...$('crewManeuverRows').querySelectorAll('input')].map(input => input.value.trim()).filter(Boolean); }
  function addManeuver(value = '') {
    const row = document.createElement('div'); row.className = 'entry-row';
    const input = document.createElement('input'); input.maxLength = 120; input.value = value; input.setAttribute('aria-label', 'Crew maneuver');
    input.addEventListener('change', () => saveField('maneuvers', maneuverValues()));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => { row.remove(); saveField('maneuvers', maneuverValues()); });
    row.append(input, remove); $('crewManeuverRows').append(row);
    return input;
  }
  function render() {
    if (!crew) return;
    $('crewName').value = crew.name; $('crewPoints').value = crew.crew_points;
    $('crewManeuverRows').replaceChildren();
    for (const value of crew.maneuvers) addManeuver(value);
    renderPortrait('crew'); renderPortrait('bird');
    const roleRows = $('crewRoleRows'); roleRows.replaceChildren();
    for (const role of roles) {
      const assigned = crew.roles.find(item => item.role === role);
      const row = document.createElement('div'); row.className = 'entry-row';
      const label = document.createElement('label'); label.textContent = role[0].toUpperCase() + role.slice(1);
      const select = document.createElement('select'); select.setAttribute('aria-label', `Assign ${role}`);
      const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Unassigned'; select.append(empty);
      if (assigned?.character_id && !characters.some(item => item.id === assigned.character_id)) {
        const other = document.createElement('option'); other.value = assigned.character_id; other.textContent = assigned.character_name || 'Other player character'; select.append(other);
      }
      for (const character of characters.filter(item => item.kind === 'pc')) {
        const option = document.createElement('option'); option.value = character.id; option.textContent = character.name; select.append(option);
      }
      select.value = assigned?.character_id || '';
      select.addEventListener('change', async () => {
        const next = select.value || null;
        if (next === assigned?.character_id) return;
        try {
          const data = await request('/api/crew', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'assign', role, characterId: next, expectedId: assigned?.character_id || null }) });
          crew = data.crew; message('Crew role saved.'); render();
        } catch (cause) { message(cause.message); select.value = assigned?.character_id || ''; }
      });
      label.append(select); row.append(label); roleRows.append(row);
    }
    for (const [section, fields] of Object.entries(sections)) {
      const box = $('crew' + section[0].toUpperCase() + section.slice(1)); box.replaceChildren();
      for (const [key, title, type] of fields) {
        const label = document.createElement('label'); label.textContent = title;
        const input = document.createElement(type === 'long' ? 'textarea' : 'input'); input.dataset.crewSection = section; input.dataset.crewKey = key;
        if (type === 'number') { input.type = 'number'; input.min = '0'; input.max = '999'; }
        else input.maxLength = type === 'long' ? 2000 : 500;
        if (type === 'long') label.classList.add('wide-field');
        input.value = crew[section]?.[key] ?? (type === 'number' ? 0 : ''); label.append(input); box.append(label);
      }
    }
  }
  async function load(force = false) {
    if (loading || panel.hidden) return;
    if (!force && panel.contains(document.activeElement)) return;
    loading = true;
    try {
      const [data, list] = await Promise.all([request('/api/crew'), request('/api/characters')]);
      characters = list.characters;
      if (!crew || data.crew.revision !== crew.revision || JSON.stringify(data.crew.roles) !== JSON.stringify(crew.roles) || JSON.stringify(data.crew.images) !== JSON.stringify(crew.images) || force) { crew = data.crew; render(); }
    } catch (cause) { message(cause.message); }
    finally { loading = false; }
  }
  async function saveField(field, value) {
    if (!crew || JSON.stringify(value) === JSON.stringify(crew[field])) return;
    try {
      const data = await request('/api/crew', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value, revision: crew.revision }) });
      crew = data.crew; message('Crew change saved.'); render();
    } catch (cause) { message(cause.message + ' Your entry has not been saved.'); }
  }
  for (const [id, field, numeric] of [['crewName', 'name', false], ['crewPoints', 'crew_points', true]]) {
    $(id).addEventListener('change', () => saveField(field, numeric ? Number($(id).value) : $(id).value));
  }
  $('addCrewManeuver').addEventListener('click', () => {
    if ($('crewManeuverRows').children.length >= 30) { message('Maximum 30 maneuvers.'); return; }
    addManeuver().focus();
  });
  for (const slot of ['crew', 'bird']) {
    const prefix = slot === 'crew' ? 'crew' : 'bird';
    $(prefix + 'PortraitInput').addEventListener('change', async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2 MB');
        const response = await fetch(`/api/crew-image?slot=${slot}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!response.ok) throw new Error((await response.json()).error || 'Image upload failed');
        crew.images[slot] = true; renderPortrait(slot); message('Portrait saved.');
      } catch (cause) { message(cause.message); }
      finally { event.target.value = ''; }
    });
    $('remove' + prefix[0].toUpperCase() + prefix.slice(1) + 'Portrait').addEventListener('click', async () => {
      try {
        const response = await fetch(`/api/crew-image?slot=${slot}`, { method: 'DELETE' });
        if (!response.ok) throw new Error((await response.json()).error || 'Could not remove portrait');
        delete crew.images[slot]; renderPortrait(slot); message('Portrait removed.');
      } catch (cause) { message(cause.message); }
    });
  }
  for (const section of Object.keys(sections)) $('crew' + section[0].toUpperCase() + section.slice(1)).addEventListener('change', () => {
    const value = {};
    for (const input of document.querySelectorAll(`[data-crew-section="${section}"]`)) value[input.dataset.crewKey] = input.type === 'number' ? Number(input.value) : input.value;
    saveField(section, value);
  });
  function close() { panel.hidden = true; clearInterval(timer); timer = null; crew = null; }
  $('closeCrew').addEventListener('click', close);
  $('openCrew').addEventListener('click', () => {
    if (!profile()) return;
    if (!canLeaveCharacter()) return;
    $('characterPanel').hidden = true;
    panel.hidden = false; selectTab('Info'); message(''); load(true);
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden) load(); }, 4000);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  return { close };
}
