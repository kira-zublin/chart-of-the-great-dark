import { ATTACK_NUMBERS, CATEGORY_LABELS, CREATURE_ATTRIBUTES, CREATURE_CATEGORIES, CREATURE_FOOTPRINTS, CREATURE_SIZES, attackSummary, blankStats, creatureIcon, sizeModifier } from './creature-stats.js';

const $ = id => document.getElementById(id);
const node = (tag, className = '', content = '') => { const el = document.createElement(tag); if (className) el.className = className; if (content !== '') el.textContent = content; return el; };
const button = (label, action, className = '') => { const el = node('button', className, label); el.type = 'button'; el.addEventListener('click', action); return el; };
const titleCase = word => word[0].toUpperCase() + word.slice(1);
const signed = value => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '+0');
const PLURALS = { blight: 'Blight Beings', construct: 'Constructs', beast: 'Beasts', echo: 'Echoes', adversary: 'Adversaries', other: 'Other' };
const ATTACK_LABELS = { dice: 'Dice', damage: 'Damage', crit: 'Crit', blightDice: 'Blight dice', blight: 'Blight', despair: 'Despair' };
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

export const portraitUrl = template => template.has_portrait ? `/api/creature-image?id=${encodeURIComponent(template.id)}&slot=portrait&v=${template.updated_at}` : creatureIcon(template.category);

// Words a palette search matches: name, category, abilities, attacks and talents.
export function searchText(template) {
  const { stats } = template;
  return [template.name, CATEGORY_LABELS[template.category], PLURALS[template.category], ...stats.abilities.map(item => item.name), ...stats.attacks.map(item => item.name), ...stats.talents.map(item => item.name)].join(' ').toLowerCase();
}

// One line under a palette entry's name.
export function templateMeta(template) {
  const { stats } = template;
  if (stats.type === 'adversary') return [`Health ${stats.health}`, stats.talents.map(t => `${t.name} ${t.level}`).join(', ')].filter(Boolean).join(' · ');
  return [`Ferocity ${stats.ferocity}`, `Health ${stats.health}`, `Armor ${stats.armor}`].join(' · ');
}

export function initCreatureUI(request) {
  let templates = null, filter = 'all', view = 'list', openId = null, editing = null, dirty = false, loading = null;
  const message = text => { $('creatureMessage').textContent = text || ''; };
  const find = id => templates?.find(item => item.id === id);

  // Each view starts at its top; the panel body is what scrolls.
  function show(next) {
    view = next;
    const body = $('paneCreatures').closest('.side-panel-body');
    if (body) body.scrollTop = 0;
    $('creatureBrowse').hidden = next !== 'list';
    $('creatureDetail').hidden = next !== 'detail';
    $('creatureForm').hidden = next !== 'edit';
  }
  function confirmLeave() {
    if (view !== 'edit' || !dirty) return true;
    if (!confirm('Discard unsaved creature changes?')) return false;
    dirty = false; return true;
  }
  function receive(data) { templates = data.templates; renderList(); }

  async function load() {
    loading ||= request('/api/creatures').then(receive).catch(cause => message(cause.message)).finally(() => { loading = null; });
    return loading;
  }

  // ---------- List ----------
  function renderFilters() {
    const wrap = $('creatureFilters'); wrap.replaceChildren();
    for (const [value, label] of [['all', 'All'], ...CREATURE_CATEGORIES.map(category => [category, PLURALS[category]]), ['custom', 'Custom']]) {
      const chip = button(label, () => { filter = value; renderFilters(); renderList(); }, 'creature-filter text-button');
      chip.setAttribute('aria-pressed', String(filter === value));
      wrap.append(chip);
    }
  }

  function renderList() {
    const list = $('creatureList'); list.replaceChildren();
    if (!templates) return;
    const query = $('creatureSearch').value.trim().toLowerCase();
    const shown = templates.filter(item => (filter === 'all' || item.category === filter || (filter === 'custom' && item.source === 'custom')) && (!query || searchText(item).includes(query)));
    if (!templates.length) {
      list.append(node('p', 'field-hint', 'The palette is empty. Create a creature, or ask whoever manages the database to run the creature import script to load the rulebook’s creatures and adversaries.'));
      return;
    }
    if (!shown.length) { list.append(node('p', 'field-hint', 'No creatures match.')); return; }
    for (const category of CREATURE_CATEGORIES) {
      const group = shown.filter(item => item.category === category);
      if (!group.length) continue;
      list.append(node('div', 'rule', `${PLURALS[category]} · ${group.length}`));
      for (const template of group) list.append(renderRow(template));
    }
  }

  function renderRow(template) {
    const row = node('div', 'creature-row');
    const open = node('button', 'creature-open text-button'); open.type = 'button';
    const icon = node('img', 'creature-icon'); icon.src = portraitUrl(template); icon.alt = ''; icon.loading = 'lazy';
    const info = node('span', 'creature-info');
    const name = node('span', 'creature-name', template.name);
    if (template.source === 'custom') name.append(node('span', 'creature-badge', 'Custom'));
    info.append(name, node('span', 'creature-meta', templateMeta(template)));
    open.append(icon, info);
    open.addEventListener('click', () => openDetail(template.id));
    open.setAttribute('aria-label', `${template.name}, ${CATEGORY_LABELS[template.category]}. Open stat block`);
    const copy = button('Duplicate', () => duplicate(template), 'text-button creature-duplicate');
    copy.setAttribute('aria-label', `Duplicate ${template.name}`);
    row.append(open, copy);
    return row;
  }

  // ---------- Stat block ----------
  function openDetail(id) {
    if (!confirmLeave()) return;
    openId = id; renderDetail(); show('detail'); message('');
  }

  function renderDetail() {
    const template = find(openId), wrap = $('creatureDetail');
    wrap.replaceChildren();
    if (!template) { show('list'); return; }
    const { stats } = template;
    wrap.append(button('← All creatures', () => { show('list'); message(''); }, 'text-button creature-back'));
    const head = node('div', 'creature-head');
    const portrait = node('img', 'creature-portrait'); portrait.src = portraitUrl(template); portrait.alt = template.has_portrait ? `${template.name} portrait` : '';
    const titles = node('div');
    titles.append(node('div', 'eyebrow', [CATEGORY_LABELS[template.category], stats.type === 'creature' ? `Identify ${signed(stats.rarity)}` : null, template.source === 'book' ? 'Rulebook' : 'Custom'].filter(Boolean).join(' · ')), node('h3', 'creature-title', template.name));
    head.append(portrait, titles);
    wrap.append(head);

    const numbers = node('div', 'creature-numbers');
    const add = (label, value) => { const tile = node('div', 'creature-number'); tile.append(node('span', '', label), node('strong', '', String(value))); numbers.append(tile); };
    if (stats.type === 'creature') add('Ferocity', stats.ferocity);
    add('Health', stats.health); add('Armor', stats.armor);
    for (const key of CREATURE_ATTRIBUTES) if (stats.attributes[key] !== undefined) add(titleCase(key), stats.attributes[key]);
    wrap.append(numbers);
    const size = [stats.size !== 'normal' ? `${titleCase(stats.size)}: attacks against it get ${signed(sizeModifier(stats.size))} base dice` : null, stats.footprint > 1 ? `Covers ${stats.footprint}×${stats.footprint} squares in Explorables` : null].filter(Boolean);
    if (size.length) wrap.append(node('p', 'field-hint', size.join('. ') + '.'));

    if (stats.description) { wrap.append(node('div', 'rule', 'Description')); for (const para of stats.description.split(/\n+/)) wrap.append(node('p', 'creature-text', para)); }
    if (stats.containment) { wrap.append(node('div', 'rule', 'Containment protocol')); wrap.append(node('p', 'creature-containment', stats.containment)); }
    if (stats.abilities.length) {
      wrap.append(node('div', 'rule', stats.abilities.length === 1 ? 'Ability' : 'Abilities'));
      for (const ability of stats.abilities) { const p = node('p', 'creature-text'); p.append(node('strong', '', `${ability.name}: `), document.createTextNode(ability.text)); wrap.append(p); }
    }
    if (stats.talents.length || stats.equipment) {
      wrap.append(node('div', 'rule', 'Talents & gear'));
      if (stats.talents.length) wrap.append(node('p', 'creature-text', stats.talents.map(t => `${t.name} ${t.level}`).join(', ')));
      if (stats.equipment) wrap.append(node('p', 'creature-text', stats.equipment));
    }
    if (stats.behavior.length) {
      wrap.append(node('div', 'rule', 'Behavior pattern'));
      const table = node('table', 'creature-table');
      table.append(node('caption', 'visually-hidden', 'Behavior by D6 roll'));
      for (const row of stats.behavior) {
        const tr = node('tr'); tr.append(node('th', '', row.from === row.to ? String(row.from) : `${row.from}–${row.to}`), node('td', '', row.text)); table.append(tr);
      }
      wrap.append(table);
    }
    if (stats.attacks.length) {
      wrap.append(node('div', 'rule', 'Signature attacks'));
      const list = node('ol', 'creature-attacks');
      for (const attack of stats.attacks) {
        const item = node('li');
        item.append(node('span', 'creature-attack-roll', String(attack.roll)));
        const body = node('div');
        body.append(node('div', 'creature-attack-name', attack.name));
        const summary = attackSummary(attack);
        if (summary) body.append(node('div', 'creature-attack-numbers', summary));
        if (attack.text) body.append(node('p', 'creature-text', attack.text));
        item.append(body); list.append(item);
      }
      wrap.append(list);
    }
    const actions = node('div', 'panel-actions creature-actions');
    actions.append(button('Edit', () => openEditor(template), 'primary-button'), button('Duplicate', () => duplicate(template)), button('Delete', () => remove(template), 'creature-delete'));
    wrap.append(actions);
  }

  // ---------- Actions ----------
  async function duplicate(template) {
    if (!confirmLeave()) return;
    try {
      const data = await request('/api/creatures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'duplicate', id: template.id }) });
      receive(data);
      openEditor(find(data.id));
      message(`Duplicated ${template.name}. Rename the copy and adjust it.`);
      $('creatureName').select();
    } catch (cause) { message(cause.message); }
  }
  async function remove(template) {
    if (!confirm(`Delete ${template.name} from the palette? Creatures already placed from it stay where they are.`)) return;
    try {
      receive(await request(`/api/creatures?id=${encodeURIComponent(template.id)}`, { method: 'DELETE' }));
      dirty = false; show('list'); message(`Deleted ${template.name}.`);
    } catch (cause) { message(cause.message); }
  }

  // ---------- Editor ----------
  const field = (label, input, className = '') => { const wrap = node('label', className, label); wrap.append(input); return wrap; };
  function input(type, value, attrs = {}) {
    const el = node(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') el.type = type;
    el.value = value ?? '';
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    return el;
  }
  function select(options, value) {
    const el = node('select');
    for (const [key, label] of options) { const option = node('option', '', label); option.value = key; el.append(option); }
    el.value = String(value); return el;
  }
  const numberValue = el => el.value.trim() === '' ? null : Number(el.value);

  // A repeatable list (abilities, behavior, attacks, talents) with add and remove buttons.
  function repeatable(title, key, rows, makeRow, blank, { hint = '', item }) {
    const section = node('div', 'creature-repeat'); section.dataset.list = key;
    section.append(node('div', 'rule', title));
    if (hint) section.append(node('p', 'field-hint', hint));
    const list = node('div', 'creature-repeat-list');
    const addRow = values => {
      const row = node('div', 'creature-repeat-row');
      row.append(...makeRow(values));
      const drop = button('Remove', () => { row.remove(); dirty = true; }, 'text-button creature-remove');
      drop.setAttribute('aria-label', `Remove this ${item}`);
      row.append(drop); list.append(row);
    };
    for (const values of rows) addRow(values);
    section.append(list, button(`Add ${item}`, () => { addRow(blank(list.children.length)); dirty = true; list.lastElementChild.querySelector('input, textarea')?.focus(); }));
    return section;
  }

  function imageField(slot, label, template) {
    const wrap = node('div', 'creature-image-field');
    const file = input('file', '', { accept: imageTypes.join(','), 'data-slot': slot, id: `creatureImage${titleCase(slot)}` });
    const preview = node('img', 'image-preview'); preview.alt = `${label} preview`;
    const has = template?.[`has_${slot}`];
    preview.hidden = !has;
    if (has) preview.src = `/api/creature-image?id=${encodeURIComponent(template.id)}&slot=${slot}&v=${template.updated_at}`;
    const clear = node('label', 'creature-clear'); const clearBox = input('checkbox', '', { 'data-clear': slot }); clear.append(clearBox, document.createTextNode(`Remove the current ${label.toLowerCase()}`));
    clear.hidden = !has;
    file.addEventListener('change', () => {
      const chosen = file.files[0]; if (!chosen) return;
      if (chosen.size > 2 * 1024 * 1024 || !imageTypes.includes(chosen.type)) { message('Use a JPEG, PNG, or WebP image under 2 MB.'); file.value = ''; return; }
      preview.src = URL.createObjectURL(chosen); preview.hidden = false; clearBox.checked = false;
    });
    wrap.append(field(`${label} (JPEG, PNG, or WebP; up to 2 MB)`, file), preview, clear);
    return wrap;
  }

  function openEditor(template = null) {
    if (template && !confirmLeave()) return;
    editing = template;
    const stats = template ? structuredClone(template.stats) : blankStats('creature');
    const form = $('creatureForm'); form.replaceChildren();
    form.append(button(template ? `← ${template.name}` : '← All creatures', () => { if (!confirmLeave()) return; if (template) openDetail(template.id); else show('list'); }, 'text-button creature-back'));
    form.append(node('h3', 'creature-title', template ? `Edit ${template.name}` : 'New creature'));
    if (template?.source === 'book') form.append(node('p', 'field-hint', 'This entry came from the rulebook. Your changes are kept; the import script only restores it when run with --overwrite.'));

    const name = input('text', template?.name, { id: 'creatureName', maxlength: '80' });
    const category = select(CREATURE_CATEGORIES.map(key => [key, CATEGORY_LABELS[key]]), template?.category || 'other');
    const type = select([['creature', 'Creature'], ['adversary', 'Adversary']], stats.type);
    category.id = 'creatureCategory'; type.id = 'creatureType';
    form.append(field('Name', name), node('div', 'character-grid'));
    form.lastElementChild.append(field('Category', category), field('Stat block', type));
    form.append(node('p', 'field-hint', 'Creatures have Ferocity, a behavior pattern and signature attacks. Adversaries are human NPCs with attributes, talents and gear.'));

    const numbers = node('div', 'stat-grid creature-number-grid');
    const numberInputs = {
      rarity: input('number', stats.rarity, { min: '-3', max: '3' }), ferocity: input('number', stats.ferocity, { min: '1', max: '10' }),
      health: input('number', stats.health, { min: '1', max: '99' }), armor: input('number', stats.armor, { min: '0', max: '20' })
    };
    numbers.append(field('Identify modifier', numberInputs.rarity, 'creature-only'), field('Ferocity', numberInputs.ferocity, 'creature-only'), field('Health', numberInputs.health), field('Armor', numberInputs.armor));
    form.append(node('div', 'rule', 'Numbers'), numbers);

    form.append(node('div', 'rule', 'Attributes'), node('p', 'field-hint', 'Leave an attribute blank if the creature does not have it. Most creatures list only Agility and Perception.'));
    const attributes = node('div', 'stat-grid');
    const attributeInputs = {};
    for (const key of CREATURE_ATTRIBUTES) { attributeInputs[key] = input('number', stats.attributes[key], { min: '0', max: '20' }); attributes.append(field(titleCase(key), attributeInputs[key])); }
    form.append(attributes);

    const size = select(CREATURE_SIZES.map(key => [key, key === 'normal' ? 'Normal' : `${titleCase(key)} (${signed(sizeModifier(key))} dice to hit it)`]), stats.size);
    const footprint = select(CREATURE_FOOTPRINTS.map(n => [String(n), `${n}×${n} square${n > 1 ? 's' : ''}`]), stats.footprint);
    const sizeGrid = node('div', 'character-grid'); sizeGrid.append(field('Size', size), field('Footprint in Explorables', footprint));
    form.append(node('div', 'rule', 'Size'), sizeGrid);

    const description = input('textarea', stats.description, { maxlength: '4000', rows: '5' });
    const containment = input('textarea', stats.containment, { maxlength: '1000', rows: '2' });
    form.append(node('div', 'rule', 'Lore'), field('Description', description), field('Containment protocol', containment, 'creature-only'));

    form.append(repeatable('Abilities', 'abilities', stats.abilities, values => [field('Name', input('text', values.name, { maxlength: '80', 'data-key': 'name' })), field('Rule', input('textarea', values.text, { maxlength: '1500', rows: '2', 'data-key': 'text' }), 'creature-wide')], () => ({ name: '', text: '' }), { item: 'ability' }));
    const behavior = repeatable('Behavior pattern', 'behavior', stats.behavior, values => [
      field('From', input('number', values.from, { min: '1', max: '6', 'data-key': 'from' })), field('To', input('number', values.to, { min: '1', max: '6', 'data-key': 'to' })),
      field('Behavior', input('text', values.text, { maxlength: '500', 'data-key': 'text' }), 'creature-wide')
    ], () => ({ from: 1, to: 1, text: '' }), { item: 'behavior', hint: 'D6 results and what the creature is doing when first encountered.' });
    const attacks = repeatable('Signature attacks', 'attacks', stats.attacks, values => [
      field('D6', input('number', values.roll, { min: '1', max: '6', 'data-key': 'roll' })), field('Name', input('text', values.name, { maxlength: '80', 'data-key': 'name' }), 'creature-wide'),
      ...ATTACK_NUMBERS.map(key => field(ATTACK_LABELS[key], input('number', values[key], { min: '0', max: '40', 'data-key': key }))),
      field('Rule', input('textarea', values.text, { maxlength: '1500', rows: '3', 'data-key': 'text' }), 'creature-wide')
    ], count => ({ roll: Math.min(6, count + 1), name: '', text: '' }), { item: 'signature attack', hint: 'Leave numbers blank when they do not apply. A damaging attack with Crit blank has no crit.' });
    const talents = repeatable('Talents', 'talents', stats.talents, values => [field('Talent', input('text', values.name, { maxlength: '80', 'data-key': 'name' }), 'creature-wide'), field('Level', input('number', values.level ?? 1, { min: '0', max: '9', 'data-key': 'level' }))], () => ({ name: '', level: 1 }), { item: 'talent' });
    behavior.classList.add('creature-only'); attacks.classList.add('creature-only'); talents.classList.add('adversary-only');
    const equipment = input('textarea', stats.equipment, { maxlength: '1000', rows: '2' });
    form.append(behavior, attacks, talents, field('Equipment', equipment, 'adversary-only'));

    form.append(node('div', 'rule', 'Images'), node('p', 'field-hint', 'Without a portrait the palette shows the category’s placeholder medallion.'), imageField('portrait', 'Portrait', template), imageField('standup', 'Stand-up', template));
    const actions = node('div', 'panel-actions creature-actions');
    const save = node('button', 'primary-button', template ? 'Save creature' : 'Create creature'); save.type = 'submit';
    actions.append(save, button('Cancel', () => { if (!confirmLeave()) return; if (template) openDetail(template.id); else show('list'); }));
    form.append(actions);

    const applyType = () => {
      for (const el of form.querySelectorAll('.creature-only')) el.hidden = type.value !== 'creature';
      for (const el of form.querySelectorAll('.adversary-only')) el.hidden = type.value !== 'adversary';
    };
    type.addEventListener('change', applyType); applyType();
    form.oninput = form.onchange = () => { dirty = true; };
    form.onsubmit = event => { event.preventDefault(); submit({ name, category, type, numberInputs, attributeInputs, size, footprint, description, containment, equipment }, save); };
    dirty = false; show('edit'); name.focus();
  }

  function collectRows(key, numeric) {
    return [...$('creatureForm').querySelectorAll(`[data-list="${key}"] .creature-repeat-row`)].map(row => {
      const values = {};
      for (const el of row.querySelectorAll('[data-key]')) values[el.dataset.key] = numeric.includes(el.dataset.key) ? numberValue(el) : el.value;
      return values;
    });
  }

  async function submit(fields, save) {
    const creature = fields.type.value === 'creature';
    const stats = {
      type: fields.type.value, health: numberValue(fields.numberInputs.health), armor: numberValue(fields.numberInputs.armor),
      rarity: creature ? numberValue(fields.numberInputs.rarity) : 0, ferocity: creature ? numberValue(fields.numberInputs.ferocity) : 1,
      attributes: Object.fromEntries(Object.entries(fields.attributeInputs).map(([key, el]) => [key, numberValue(el)]).filter(([, value]) => value !== null)),
      size: fields.size.value, footprint: Number(fields.footprint.value), description: fields.description.value,
      containment: creature ? fields.containment.value : '', equipment: creature ? '' : fields.equipment.value,
      abilities: collectRows('abilities', []).filter(row => row.name.trim() || row.text.trim()),
      behavior: creature ? collectRows('behavior', ['from', 'to']).filter(row => row.text.trim()) : [],
      attacks: creature ? collectRows('attacks', ['roll', ...ATTACK_NUMBERS]).filter(row => row.name.trim() || row.text.trim()) : [],
      talents: creature ? [] : collectRows('talents', ['level']).filter(row => row.name.trim())
    };
    if (!fields.name.value.trim()) { message('Give the creature a name.'); fields.name.focus(); return; }
    if (stats.health === null) { message('Enter the creature’s Health.'); fields.numberInputs.health.focus(); return; }
    if (stats.abilities.some(row => !row.name.trim())) { message('Give every ability a name.'); return; }
    if (stats.attacks.some(row => !row.name.trim() || row.roll === null)) { message('Give every signature attack a D6 number and a name.'); return; }
    if (stats.behavior.some(row => row.from === null || row.to === null || row.from > row.to)) { message('Check the behavior pattern’s D6 ranges.'); return; }
    save.disabled = true; message('');
    try {
      const payload = { name: fields.name.value, category: fields.category.value, stats };
      const saved = editing
        ? await request('/api/creatures', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...payload }) })
        : await request('/api/creatures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...payload }) });
      receive(saved);
      const id = saved.id;
      let imagesChanged = false;
      for (const el of $('creatureForm').querySelectorAll('input[type="file"][data-slot]')) {
        const file = el.files[0], slot = el.dataset.slot, clear = $('creatureForm').querySelector(`[data-clear="${slot}"]`)?.checked;
        if (file) { await request(`/api/creature-image?id=${encodeURIComponent(id)}&slot=${slot}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file }); imagesChanged = true; }
        else if (clear) { await request(`/api/creature-image?id=${encodeURIComponent(id)}&slot=${slot}`, { method: 'DELETE' }); imagesChanged = true; }
      }
      if (imagesChanged) await load();
      dirty = false; openDetail(id); message(`${fields.name.value.trim()} saved.`);
    } catch (cause) { message(cause.message); }
    finally { save.disabled = false; }
  }

  $('creatureSearch').addEventListener('input', renderList);
  $('creatureNew').addEventListener('click', () => { message(''); openEditor(); });
  renderFilters();

  return {
    // Loads the palette the first time the Creatures tab opens.
    setActive(active) { if (active && !templates) load(); },
    reset() { templates = null; filter = 'all'; openId = null; editing = null; dirty = false; $('creatureSearch').value = ''; renderFilters(); renderList(); show('list'); message(''); }
  };
}
