const $ = id => document.getElementById(id);
const conditions = ['Exhausted', 'Dazed', 'Confused', 'Distracted', 'Shaken', 'Disheartened'];
const entryTypes = {
  talents: { target: 'talentRows', fields: [['name', 'Talent'], ['level', 'Level', 'number']] },
  weapons: { target: 'weaponRows', fields: [['name', 'Weapon'], ['bonus', 'Bonus', 'number'], ['damage', 'Damage', 'number'], ['crit', 'Crit', 'number'], ['range', 'Range'], ['features', 'Features']] },
  armor: { target: 'armorRows', fields: [['name', 'Armor or suit'], ['rating', 'Armor rating', 'number'], ['blight', 'Blight protection', 'number'], ['features', 'Features']] },
  equipment: { target: 'equipmentRows', fields: [['name', 'Item'], ['weight', 'Weight'], ['bonus', 'Bonus', 'number'], ['features', 'Features']] },
  tinyItems: { target: 'tinyItemRows', fields: [['name', 'Tiny item']] }
};
let markDirty = () => {};
export function setSheetDirtyHandler(handler) { markDirty = handler; }
export function setSheetTab(name, focus = false) {
  for (const button of document.querySelectorAll('.sheet-tabs [role="tab"]')) {
    const active = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    $(button.getAttribute('aria-controls')).hidden = !active;
    if (active && focus) button.focus();
  }
}
for (const button of document.querySelectorAll('.sheet-tabs [role="tab"]')) {
  button.addEventListener('click', () => setSheetTab(button.dataset.tab));
  button.addEventListener('keydown', event => {
    const tabs = [...document.querySelectorAll('.sheet-tabs [role="tab"]')];
    const index = tabs.indexOf(button);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
    if (next >= 0) { event.preventDefault(); setSheetTab(tabs[next].dataset.tab, true); }
  });
}
const checks = $('conditionChecks');
for (const item of conditions) {
  const label = document.createElement('label');
  const input = document.createElement('input'); input.type = 'checkbox'; input.value = item.toLowerCase();
  label.append(input, document.createTextNode(item)); checks.append(label);
}
function entryRow(type, entry = {}) {
  const schema = entryTypes[type]; const row = document.createElement('div'); row.className = 'entry-row';
  const fields = document.createElement('div'); fields.className = 'character-grid';
  for (const [key, title, kind] of schema.fields) {
    const label = document.createElement('label'); label.textContent = title;
    const input = document.createElement('input'); input.dataset.field = key;
    if (kind === 'number') { input.type = 'number'; input.min = '0'; input.max = '99'; input.value = entry[key] ?? 0; }
    else { input.maxLength = 200; input.value = entry[key] ?? ''; }
    label.append(input); fields.append(label);
  }
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
  remove.addEventListener('click', () => { row.remove(); markDirty(); });
  row.append(fields, remove); $(schema.target).append(row);
}
for (const button of document.querySelectorAll('[data-add-entry]')) button.addEventListener('click', () => { entryRow(button.dataset.addEntry); markDirty(); });
$('addTalent').addEventListener('click', () => { entryRow('talents'); markDirty(); });
function maxima() {
  const n = id => Number($(id).value) || 0;
  const result = { health: n('statStrength') + n('statAgility'), hope: n('statLogic') + n('statEmpathy'), heart: n('statInsight') + n('statPerception') };
  $('vitalityMax').textContent = `Maximums — Health ${result.health}, Hope ${result.hope}, Heart ${result.heart}`;
  const total = ['Strength', 'Agility', 'Logic', 'Insight', 'Perception', 'Empathy'].reduce((sum, key) => sum + n(`stat${key}`), 0);
  $('attributeHint').textContent = `Attribute total: ${total} (a new Explorer starts with 24; usually 2–5 per attribute, or 6 for the profession's key attribute).`;
  return result;
}
for (const input of document.querySelectorAll('.stat-grid input[id^="stat"]')) input.addEventListener('input', maxima);
export function renderSheet(sheet = {}, attributes = {}) {
  setSheetTab('Profile');
  for (const key of ['Specialty', 'Quirk', 'Contacts', 'Keepsake', 'Experience', 'Supply', 'Rukh', 'Injuries', 'Trauma', 'Blight']) {
    $('sheet' + key).value = sheet[key[0].toLowerCase() + key.slice(1)] ?? (['Experience', 'Supply', 'Rukh'].includes(key) ? 0 : '');
  }
  const max = maxima();
  for (const key of ['health', 'hope', 'heart']) $('sheet' + key[0].toUpperCase() + key.slice(1)).value = sheet.vitality?.[key] ?? max[key];
  for (const input of checks.querySelectorAll('input')) input.checked = (sheet.conditions ?? []).includes(input.value);
  for (const [type, schema] of Object.entries(entryTypes)) {
    $(schema.target).replaceChildren(); for (const entry of sheet[type] ?? []) entryRow(type, entry);
  }
}
export function collectSheet() {
  const value = key => $('sheet' + key).value;
  const num = key => Number(value(key));
  const result = {
    specialty: value('Specialty'), quirk: value('Quirk'), contacts: value('Contacts'), keepsake: value('Keepsake'),
    experience: num('Experience'), supply: num('Supply'), rukh: num('Rukh'),
    vitality: { health: num('Health'), hope: num('Hope'), heart: num('Heart') },
    conditions: [...checks.querySelectorAll('input:checked')].map(input => input.value),
    injuries: value('Injuries'), trauma: value('Trauma'), blight: value('Blight')
  };
  for (const [type, schema] of Object.entries(entryTypes)) result[type] = [...$(schema.target).querySelectorAll('.entry-row')].map(row => Object.fromEntries(schema.fields.map(([key, , kind]) => [key, kind === 'number' ? Number(row.querySelector(`[data-field="${key}"]`).value) : row.querySelector(`[data-field="${key}"]`).value])));
  return result;
}
