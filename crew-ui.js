const $ = id => document.getElementById(id);
const roles = ['delver', 'burrower', 'scout', 'guard', 'archaeologist'];
const sections = {
  bird: [['name', 'Name'], ['type', 'Type'], ['appearance', 'Appearance'], ['health', 'Health', 'number'], ['energy', 'Energy', 'number'], ['powers', 'Powers']],
  rover: [['name', 'Name'], ['model', 'Model'], ['hull', 'Hull', 'number'], ['armor', 'Armor', 'number'], ['blight', 'Blight protection', 'number'], ['speed', 'Speed'], ['range', 'Range'], ['upgrades', 'Upgrades'], ['cargo', 'Cargo']],
  shuttle: [['name', 'Name'], ['model', 'Model'], ['hull', 'Hull', 'number'], ['armor', 'Armor', 'number'], ['blight', 'Blight protection', 'number'], ['speed', 'Travel speed'], ['range', 'Range'], ['upgrades', 'Upgrades'], ['cargo', 'Cargo']]
};
export function initCrewUI(request, profile, canLeaveCharacter) {
  let crew = null; let characters = []; let timer = null; let loading = false;
  const panel = $('crewPanel');
  const message = text => { $('crewMessage').textContent = text; };
  function render() {
    if (!crew) return;
    $('crewName').value = crew.name; $('crewPoints').value = crew.crew_points;
    $('crewManeuvers').value = crew.maneuvers.join('\n');
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
        const input = document.createElement('input'); input.dataset.crewSection = section; input.dataset.crewKey = key;
        if (type === 'number') { input.type = 'number'; input.min = '0'; input.max = '999'; }
        else input.maxLength = 500;
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
      if (!crew || data.crew.revision !== crew.revision || JSON.stringify(data.crew.roles) !== JSON.stringify(crew.roles) || force) { crew = data.crew; render(); }
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
  for (const [id, field, numeric] of [['crewName', 'name', false], ['crewPoints', 'crew_points', true], ['crewManeuvers', 'maneuvers', false]]) {
    $(id).addEventListener('change', () => saveField(field, field === 'maneuvers' ? $(id).value.split('\n').map(x => x.trim()).filter(Boolean) : numeric ? Number($(id).value) : $(id).value));
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
    panel.hidden = false; message(''); load(true);
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden) load(); }, 4000);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  return { close };
}
