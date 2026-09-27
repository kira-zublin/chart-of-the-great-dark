import {
  attributes, pools, conditionName, factions, origins, professions, talents as talentBook, ranges, weaponFeatures, suitFeatures, weights,
  findOrigin, findProfession, findTalent, talentMax, raiseCost, maxima, penalty, attributeIssues, carryLimit, carried, talentSource,
  splitFeatures, joinFeatures, today
} from './explorer-rules.js';

// The Explorer sheet: an always-visible header (portrait, Health/Hope/Heart, conditions)
// over four tabs. The sheet keeps its own working copy of the character and reports every
// change through the change handler; app.js decides when to save.
const $ = id => document.getElementById(id);
const OTHER = '__other';
const blankPortrait = 'assets/characters/anonymous-explorer.png';
const defaultStats = { strength: 4, agility: 4, logic: 4, insight: 4, perception: 4, empathy: 4 };
const handlers = { change() {}, roll() {}, image() {} };
export function setSheetHandlers(next) { Object.assign(handlers, next); }

let character = blankCharacter();
let adjusting = false;
const emit = () => handlers.change();

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function button(label, className, onClick, aria) {
  const element = node('button', className, label); element.type = 'button';
  if (aria) element.setAttribute('aria-label', aria);
  element.addEventListener('click', onClick);
  return element;
}
const clampInt = (value, max) => Math.max(0, Math.min(max, Math.trunc(Number(value)) || 0));

function blankCharacter() {
  return { kind: 'pc', name: '', profession: '', origin: '', faction: '', appearance: '', motivation: '', description: '', attributes: { ...defaultStats }, sheet: normalizeSheet({}, defaultStats) };
}
// Older sheets kept injuries, trauma and Blight as free text; they become a single card.
function wounds(value) {
  if (typeof value === 'string') return value.trim() ? [{ name: 'Notes', effect: value.trim(), heal: '', lethal: false }] : [];
  return (value || []).map(item => ({ name: item.name || '', effect: item.effect || '', heal: item.heal || '', lethal: Boolean(item.lethal) }));
}
function normalizeSheet(raw = {}, stats) {
  const max = maxima(stats);
  const rows = (list, blank) => (list || []).map(item => ({ ...blank, ...item }));
  return {
    specialty: raw.specialty ?? '', quirk: raw.quirk ?? '', contacts: raw.contacts ?? '', keepsake: raw.keepsake ?? '',
    experience: raw.experience ?? 0, supply: raw.supply ?? 0, rukh: raw.rukh ?? 0,
    vitality: Object.fromEntries(pools.map(pool => [pool.key, raw.vitality?.[pool.key] ?? max[pool.key]])),
    conditions: [...(raw.conditions || [])],
    injuries: wounds(raw.injuries), trauma: wounds(raw.trauma), blight: wounds(raw.blight),
    keepsakeUsedOn: raw.keepsakeUsedOn || '',
    talents: rows(raw.talents, { name: '', level: 1 }),
    weapons: rows(raw.weapons, { name: '', bonus: 0, damage: 0, crit: 0, range: '', features: '' }),
    armor: rows(raw.armor, { name: '', rating: 0, blight: 0, features: '' }),
    equipment: rows(raw.equipment, { name: '', weight: 'Regular', bonus: 0, features: '' }),
    tinyItems: rows(raw.tinyItems, { name: '' })
  };
}

/* Tabs */
const tabButtons = [...document.querySelectorAll('#characterTabs [role="tab"]')];
export function setSheetTab(name, focus = false) {
  for (const tab of tabButtons) {
    const active = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !active;
    if (active && focus) tab.focus();
  }
}
for (const tab of tabButtons) {
  tab.addEventListener('click', () => setSheetTab(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    const index = tabButtons.indexOf(tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabButtons.length : event.key === 'ArrowLeft' ? (index + tabButtons.length - 1) % tabButtons.length : -1;
    if (next >= 0) { event.preventDefault(); setSheetTab(tabButtons[next].dataset.tab, true); }
  });
}

/* Header */
function renderHeader() {
  $('characterHeading').textContent = character.name.trim() || 'New character';
  const calling = [character.profession, character.sheet.specialty].filter(Boolean).join(' · ');
  $('explorerCalling').textContent = calling || (character.kind === 'npc' ? 'NPC' : 'Explorer');
  const place = findOrigin(character.origin)?.place || character.origin;
  $('explorerPlace').textContent = [place, character.faction].filter(Boolean).join(' · ');
}
function renderTracks() {
  const host = $('vitalityTracks'); host.replaceChildren();
  const max = maxima(character.attributes);
  for (const pool of pools) {
    const now = Math.min(character.sheet.vitality[pool.key], max[pool.key]);
    const row = node('div', `track track-${pool.key}${now === 0 ? ' broken' : ''}`);
    row.append(node('span', 'track-name', pool.name));
    const boxes = node('div', 'track-boxes'); boxes.setAttribute('role', 'group'); boxes.setAttribute('aria-label', `${pool.name} ${now} of ${max[pool.key]}`);
    for (let value = 1; value <= max[pool.key]; value++) {
      // Clicking the highest lit diamond takes one point; any other sets the value.
      const next = value === now ? value - 1 : value;
      boxes.append(button('', `track-box${value <= now ? ' on' : ''}`, () => setVitality(pool.key, next), `Set ${pool.name} to ${next}`));
    }
    const number = node('span', 'track-num');
    if (now === 0) number.append(node('span', 'broken-tag', 'Broken'), button('Recover', 'text-button link-button', () => setVitality(pool.key, 1)));
    else { number.append(String(now)); number.append(node('small', '', ` / ${max[pool.key]}`)); }
    row.append(boxes, number); host.append(row);
  }
}
function setVitality(key, value) { character.sheet.vitality[key] = value; renderTracks(); emit(); }
function renderChips() {
  const host = $('conditionChips'); host.replaceChildren();
  const active = attributes.filter(item => character.sheet.conditions.includes(item.condition));
  if (!active.length) { host.append(node('span', 'xchips-none', 'No conditions')); return; }
  for (const item of active) {
    const chip = node('span', 'xchip', conditionName(item.condition) + ' ');
    chip.append(node('b', '', `−2 ${item.abbr}`), button('×', 'xchip-clear', () => toggleCondition(item.condition), `Clear ${conditionName(item.condition)}`));
    host.append(chip);
  }
}
function toggleCondition(condition) {
  const list = character.sheet.conditions;
  character.sheet.conditions = list.includes(condition) ? list.filter(item => item !== condition) : [...list, condition];
  renderChips(); renderWheel(); renderConditionTiles(); emit();
}

/* Attribute wheel: six dials on a hexagon; the coloured edges join the pairs behind each pool. */
const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, parent) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (parent) parent.append(element);
  return element;
}
const CX = 206, CY = 184, R = 128, DIAL = 30;
const ANGLES = [240, 300, 0, 60, 120, 180];
const point = (degrees, radius) => [CX + radius * Math.cos(degrees * Math.PI / 180), CY + radius * Math.sin(degrees * Math.PI / 180)];
function arc(x, y, radius, from, to) {
  const start = [x + radius * Math.cos(from), y + radius * Math.sin(from)], end = [x + radius * Math.cos(to), y + radius * Math.sin(to)];
  return `M${start[0].toFixed(2)} ${start[1].toFixed(2)}A${radius} ${radius} 0 0 1 ${end[0].toFixed(2)} ${end[1].toFixed(2)}`;
}
const keyAttribute = () => findProfession(character.profession)?.key || null;
function star(x, y, size, parent, className) {
  const k = size * 0.32;
  return svg('path', { class: className, d: `M${x} ${y - size}L${x + k} ${y - k}L${x + size} ${y}L${x + k} ${y + k}L${x} ${y + size}L${x - k} ${y + k}L${x - size} ${y}L${x - k} ${y - k}Z` }, parent);
}
function renderWheel() {
  const wheel = $('attributeWheel'); wheel.replaceChildren(); wheel.classList.toggle('adjusting', adjusting);
  const defs = svg('defs', {}, wheel);
  const gradient = svg('radialGradient', { id: 'wheelDisc', cx: '50%', cy: '35%', r: '70%' }, defs);
  svg('stop', { offset: '0', 'stop-color': '#1f2c31' }, gradient); svg('stop', { offset: '1', 'stop-color': '#081014' }, gradient);
  const corners = ANGLES.map(angle => point(angle, R));
  svg('circle', { class: 'wheel-engraving', cx: CX, cy: CY, r: R + 44 }, wheel);
  svg('circle', { class: 'wheel-hub', cx: CX, cy: CY, r: 40 }, wheel);
  const max = maxima(character.attributes);
  for (let i = 0; i < 6; i++) {
    const [x1, y1] = corners[i], [x2, y2] = corners[(i + 1) % 6];
    svg('line', { class: 'wheel-spoke', x1: CX, y1: CY, x2: x1, y2: y1 }, wheel);
    const pool = i % 2 === 0 ? pools[i / 2] : null;
    svg('line', { class: pool ? `wheel-edge pool-${pool.key}` : 'wheel-edge', x1, y1, x2, y2 }, wheel);
    if (!pool) continue;
    const [lx, ly] = point(ANGLES[i] + 30, R * Math.cos(Math.PI / 6) + 32);
    svg('text', { class: `wheel-pool-name pool-${pool.key}`, x: lx, y: ly - 3 }, wheel).textContent = pool.name;
    svg('text', { class: 'wheel-pool-value', x: lx, y: ly + 12 }, wheel).textContent = max[pool.key];
  }
  const key = keyAttribute();
  attributes.forEach((item, i) => {
    const [x, y] = corners[i]; const value = character.attributes[item.key]; const minus = penalty(character.sheet.conditions, item.key);
    const label = `${item.name} ${value}${minus ? `, ${conditionName(item.condition)} −2` : ''}${item.key === key ? ', key attribute' : ''}`;
    const dial = svg('g', { class: `wheel-dial${minus ? ' weakened' : ''}`, tabindex: 0, role: 'button', 'aria-label': adjusting ? `${label}. Arrow keys change it.` : `Roll ${label}` }, wheel);
    svg('circle', { class: 'wheel-halo', cx: x, cy: y, r: DIAL + 14 }, dial);
    for (let step = 0; step < 6; step++) {
      const from = (-90 + step * 60 + 4) * Math.PI / 180, to = (-90 + (step + 1) * 60 - 4) * Math.PI / 180;
      svg('path', { class: `wheel-seg${step < value ? ' on' : ''}`, d: arc(x, y, DIAL + 7, from, to) }, dial);
      if (adjusting) {
        const hit = svg('path', { class: 'wheel-seg-hit', d: arc(x, y, DIAL + 7, from, to) }, dial);
        hit.addEventListener('click', event => { event.stopPropagation(); setAttribute(item.key, step + 1); });
      }
    }
    svg('circle', { class: 'wheel-disc', cx: x, cy: y, r: DIAL, fill: 'url(#wheelDisc)' }, dial);
    svg('circle', { class: 'wheel-disc-inner', cx: x, cy: y, r: DIAL - 4 }, dial);
    svg('text', { class: 'wheel-abbr', x, y: y - 11 }, dial).textContent = item.abbr;
    svg('text', { class: 'wheel-value', x, y: y + 11 }, dial).textContent = Math.max(0, value - minus);
    if (item.key === key) {
      const [sx, sy] = point(ANGLES[i], R + DIAL + 14);
      svg('title', {}, star(sx, sy, 5, dial, 'wheel-key')).textContent = 'Key attribute for your profession';
    }
    dial.addEventListener('click', () => { if (!adjusting) handlers.roll(item.key); });
    dial.addEventListener('keydown', event => {
      const up = event.key === 'ArrowUp' || event.key === 'ArrowRight', down = event.key === 'ArrowDown' || event.key === 'ArrowLeft';
      if (adjusting && (up || down)) { event.preventDefault(); setAttribute(item.key, value + (up ? 1 : -1), true); }
      else if (!adjusting && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handlers.roll(item.key); }
    });
    // The condition tag sits between the dial and the hub: vertically for the top and bottom dials, sideways for the side dials.
    const active = character.sheet.conditions.includes(item.condition); const name = conditionName(item.condition);
    const width = name.length * 5.6 + 16; const side = ANGLES[i] === 0 ? -1 : ANGLES[i] === 180 ? 1 : 0;
    const px = side ? x + side * (DIAL + 12 + width / 2) : x; const py = side ? y : y + (ANGLES[i] > 180 ? 1 : -1) * (DIAL + 20);
    const tag = svg('g', { class: `wheel-condition${active ? ' on' : ''}`, tabindex: 0, role: 'switch', 'aria-checked': String(active), 'aria-label': `${name}, −2 ${item.name}` }, wheel);
    svg('rect', { x: px - width / 2, y: py - 9, width, height: 18 }, tag);
    svg('text', { x: px, y: py + 3.5 }, tag).textContent = name;
    tag.addEventListener('click', () => toggleCondition(item.condition));
    tag.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCondition(item.condition); } });
  });
  const check = attributeIssues(character.attributes, key);
  $('wheelBudget').hidden = !adjusting; $('wheelBudgetNum').textContent = check.total;
  $('wheelBudget').classList.toggle('warn', !check.ok);
  if (!adjusting) { star(CX, CY, 16, wheel, 'wheel-rose'); svg('circle', { class: 'wheel-rose-dot', cx: CX, cy: CY, r: 2 }, wheel); }
  const keyName = attributes.find(item => item.key === key)?.name;
  $('wheelHint').textContent = !adjusting ? 'Select an attribute to roll it. Select a condition to mark it.'
    : check.ok ? 'Click a segment of a ring, or use the arrow keys, to set an attribute.'
    : `A new Explorer has 24 points, each attribute 2–5${keyName ? `, and ${keyName} (the key attribute) up to 6` : ''}. Now: ${check.total}.`;
}
function setAttribute(key, value, refocus = false) {
  const before = maxima(character.attributes);
  character.attributes[key] = Math.max(1, Math.min(6, value));
  const after = maxima(character.attributes);
  // A full pool stays full as its maximum changes; otherwise it is only capped.
  for (const pool of pools) {
    const now = character.sheet.vitality[pool.key];
    character.sheet.vitality[pool.key] = now >= before[pool.key] ? after[pool.key] : Math.min(now, after[pool.key]);
  }
  renderTracks(); renderWheel(); renderCarry(); emit();
  if (refocus) $('attributeWheel').querySelectorAll('.wheel-dial')[attributes.findIndex(item => item.key === key)]?.focus();
}
$('adjustSheet').addEventListener('click', () => setAdjusting(!adjusting));
function setAdjusting(on) {
  adjusting = on;
  $('adjustSheet').textContent = on ? 'Done' : 'Adjust'; $('adjustSheet').setAttribute('aria-pressed', String(on));
  renderWheel(); renderTalents();
}

/* Talents and experience */
function renderXP() {
  const xp = character.sheet.experience; $('xpNum').textContent = xp;
  const host = $('xpBoxes'); host.replaceChildren();
  for (let i = 0; i < Math.min(30, Math.max(10, xp)); i++) host.append(node('span', i < xp ? 'on' : ''));
}
function setXP(value) { character.sheet.experience = clampInt(value, 999999); renderXP(); renderTalents(); emit(); }
$('xpUp').addEventListener('click', () => setXP(character.sheet.experience + 1));
$('xpDown').addEventListener('click', () => setXP(character.sheet.experience - 1));
function renderTalents() {
  const host = $('talentRows'); host.replaceChildren();
  const context = { origin: character.origin, profession: character.profession, specialty: character.sheet.specialty };
  if (!character.sheet.talents.length) host.append(node('p', 'empty-note', 'No talents yet.'));
  character.sheet.talents.forEach((talent, index) => {
    const row = node('div', 'talent-row');
    const name = node('span', 'talent-name', talent.name || 'Unnamed talent');
    const source = talentSource(talent.name, context);
    if (source) name.append(node('span', `talent-source${source.includes('Key') ? ' key' : ''}`, source));
    const max = talentMax(talent.name);
    const levels = node('span', 'talent-levels'); levels.setAttribute('aria-label', `Level ${talent.level} of ${max}`);
    for (let level = 1; level <= 3; level++) levels.append(node('i', level > max ? 'none' : level <= talent.level ? 'on' : ''));
    const actions = node('span', 'talent-actions');
    if (adjusting) {
      actions.append(
        button('−', 'step-button', () => { talent.level = Math.max(1, talent.level - 1); renderTalents(); emit(); }, `Lower ${talent.name}`),
        button('+', 'step-button', () => { talent.level = Math.min(max, talent.level + 1); renderTalents(); emit(); }, `Raise ${talent.name}`),
        button('×', 'remove-button', () => { character.sheet.talents.splice(index, 1); renderTalents(); emit(); }, `Remove ${talent.name}`));
    } else {
      const cost = raiseCost(talent.level);
      const raise = button(talent.level >= max ? 'Max' : `Raise · ${cost} XP`, 'small-button', () => {
        character.sheet.experience -= cost; talent.level += 1; renderXP(); renderTalents(); emit();
      });
      raise.disabled = talent.level >= max || character.sheet.experience < cost;
      actions.append(raise);
    }
    row.append(name, levels, actions); host.append(row);
  });
  $('talentSearch').placeholder = adjusting ? 'Add a talent…' : 'Learn a talent (5 XP)…';
  $('talentHint').textContent = adjusting
    ? 'While adjusting, talents change without spending XP. A new Explorer gets a level from their origin, one from their specialty and three more among the profession\'s key talents, with no talent above 2.'
    : '';
}
function addTalent(name, spend) {
  const existing = character.sheet.talents.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (existing) { existing.level = Math.min(talentMax(existing.name), existing.level + 1); }
  else character.sheet.talents.push({ name: findTalent(name)?.name || name, level: 1 });
  if (spend) { character.sheet.experience -= raiseCost(0); renderXP(); }
  renderTalents(); renderGrants(); emit();
}
let optionIndex = 0;
function pickerOptions() {
  const query = $('talentSearch').value.trim().toLowerCase();
  const have = new Set(character.sheet.talents.map(item => item.name.toLowerCase()));
  const keys = findProfession(character.profession)?.talents || [];
  const open = talentBook.filter(item => !have.has(item.name.toLowerCase()) && item.name.toLowerCase().includes(query));
  const groups = [];
  const key = open.filter(item => keys.includes(item.name));
  if (key.length) groups.push([`Key talents for ${character.profession}`, key]);
  const rest = open.filter(item => !keys.includes(item.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (rest.length) groups.push([key.length ? 'Other talents' : 'Talents', rest]);
  const custom = query && !talentBook.some(item => item.name.toLowerCase() === query) && !have.has(query) ? $('talentSearch').value.trim() : null;
  return { groups, custom };
}
function renderPicker() {
  const list = $('talentOptions'); list.replaceChildren();
  const { groups, custom } = pickerOptions();
  const short = !adjusting && character.sheet.experience < raiseCost(0);
  if (short) list.append(node('div', 'talent-option-note', `Learning a talent costs ${raiseCost(0)} XP. Use Adjust to add one without spending XP.`));
  for (const [label, items] of groups) {
    list.append(node('div', 'talent-option-group', label));
    for (const item of items) {
      const option = button(item.name, 'talent-option', () => chooseTalent(item.name)); option.setAttribute('role', 'option'); option.disabled = short;
      option.append(node('span', '', `${item.group}${item.max === 1 ? ' · one level' : ''}`));
      option.addEventListener('mousedown', event => event.preventDefault());
      list.append(option);
    }
  }
  if (custom) {
    const option = button(`Add “${custom}”`, 'talent-option', () => chooseTalent(custom)); option.setAttribute('role', 'option'); option.disabled = short;
    option.addEventListener('mousedown', event => event.preventDefault());
    list.append(option);
  }
  if (!list.querySelector('.talent-option')) list.append(node('div', 'talent-option-note', 'No matching talent.'));
  const all = [...list.querySelectorAll('.talent-option:not(:disabled)')];
  optionIndex = Math.min(optionIndex, Math.max(0, all.length - 1));
  all.forEach((option, index) => option.classList.toggle('active', index === optionIndex));
}
function chooseTalent(name) { addTalent(name, !adjusting); $('talentSearch').value = ''; closePicker(); }
function closePicker() { $('talentOptions').hidden = true; $('talentSearch').setAttribute('aria-expanded', 'false'); }
function openPicker() {
  optionIndex = 0; renderPicker(); $('talentOptions').hidden = false; $('talentSearch').setAttribute('aria-expanded', 'true');
  $('talentOptions').scrollIntoView({ block: 'nearest' });
}
$('talentSearch').addEventListener('focus', openPicker);
$('talentSearch').addEventListener('input', openPicker);
$('talentSearch').addEventListener('blur', closePicker);
$('talentSearch').addEventListener('keydown', event => {
  const all = [...$('talentOptions').querySelectorAll('.talent-option:not(:disabled)')];
  if (event.key === 'Escape') { closePicker(); return; }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault(); if (!all.length) return;
    optionIndex = (optionIndex + (event.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length;
    all.forEach((option, index) => option.classList.toggle('active', index === optionIndex));
    all[optionIndex].scrollIntoView({ block: 'nearest' });
  }
  if (event.key === 'Enter') { event.preventDefault(); all[optionIndex]?.click(); }
});

/* Condition tab */
function renderConditionTiles() {
  const host = $('conditionTiles'); host.replaceChildren();
  for (const item of attributes) {
    const tile = button(conditionName(item.condition), 'condition-tile', () => toggleCondition(item.condition));
    tile.setAttribute('aria-pressed', String(character.sheet.conditions.includes(item.condition)));
    tile.append(node('small', '', `−2 ${item.name}`)); host.append(tile);
  }
}
const woundLists = { injuries: { host: 'injuryRows', name: 'Injury', heal: true, lethal: true }, trauma: { host: 'traumaRows', name: 'Trauma', heal: true }, blight: { host: 'blightRows', name: 'Manifestation' } };
function field(value, className, placeholder, maxLength, onInput) {
  const input = node('input', className); input.value = value; input.placeholder = placeholder; input.maxLength = maxLength;
  input.setAttribute('aria-label', placeholder);
  input.addEventListener('input', () => { onInput(input.value); emit(); });
  return input;
}
function renderWounds(kind) {
  const spec = woundLists[kind]; const host = $(spec.host); host.replaceChildren();
  const list = character.sheet[kind];
  if (!list.length) host.append(node('p', 'empty-note', 'None.'));
  list.forEach((wound, index) => {
    const card = node('div', `wound-card${wound.lethal ? ' lethal' : ''}`);
    const head = node('div', 'wound-head');
    head.append(field(wound.name, 'card-title-input', `${spec.name} name`, 200, value => { wound.name = value; }));
    if (spec.lethal) {
      const lethal = button('Lethal', 'wound-lethal', () => { wound.lethal = !wound.lethal; renderWounds(kind); emit(); });
      lethal.setAttribute('aria-pressed', String(wound.lethal)); head.append(lethal);
    }
    head.append(button('Healed', 'small-button', () => { list.splice(index, 1); renderWounds(kind); emit(); }, `Mark ${wound.name || spec.name.toLowerCase()} healed`));
    const meta = node('div', 'wound-meta');
    meta.append(field(wound.effect, 'ink-input', 'Effect', 500, value => { wound.effect = value; }));
    if (spec.heal) meta.append(field(wound.heal, 'ink-input wound-heal', 'Heals in', 200, value => { wound.heal = value; }));
    if (wound.lethal) card.append(node('p', 'wound-warning', 'Lethal: dies after one shift unless stabilized.'));
    card.prepend(head); card.append(meta); host.append(card);
  });
}
for (const add of document.querySelectorAll('[data-add-wound]')) add.addEventListener('click', () => {
  const kind = add.dataset.addWound;
  character.sheet[kind].push({ name: '', effect: '', heal: '', lethal: false }); renderWounds(kind); emit();
  $(woundLists[kind].host).lastElementChild?.querySelector('input')?.focus();
});

/* Gear tab */
for (const key of ['Supply', 'Rukh']) {
  const input = $(`sheet${key}`);
  input.addEventListener('input', () => { character.sheet[key.toLowerCase()] = clampInt(input.value, 999999); emit(); });
  input.addEventListener('blur', () => { input.value = character.sheet[key.toLowerCase()]; });
}
for (const step of document.querySelectorAll('[data-step]')) step.addEventListener('click', () => {
  const input = $(step.dataset.step); const key = step.dataset.step.replace('sheet', '').toLowerCase();
  character.sheet[key] = clampInt(character.sheet[key] + Number(step.dataset.by), 999999); input.value = character.sheet[key]; emit();
});
function renderCarry() {
  const limit = carryLimit(character.attributes); const used = carried(character.sheet.equipment);
  $('carryText').textContent = `${used % 1 ? used.toFixed(1) : used} of ${limit} rows · Strength + 4`;
  $('carryText').classList.toggle('over', used > limit);
  const bar = $('carryBar'); bar.replaceChildren(); const slots = Math.max(limit, Math.ceil(used), 1);
  bar.style.setProperty('--slots', slots);
  for (let i = 0; i < slots; i++) bar.append(node('i', i >= limit && i < used ? 'over' : i + 1 <= used ? 'full' : i < used ? 'half' : ''));
}
function numberCell(label, value, max, onInput) {
  const cell = node('label', 'stat-cell'); cell.append(node('small', '', label));
  const input = node('input', 'stat-input'); input.type = 'number'; input.min = 0; input.max = max; input.value = value; input.inputMode = 'numeric';
  input.addEventListener('input', () => { onInput(clampInt(input.value, max)); emit(); });
  cell.append(input); return cell;
}
function choiceCell(label, value, options, onChange) {
  const cell = node('label', 'stat-cell'); cell.append(node('small', '', label));
  const select = node('select', 'stat-select');
  select.append(new Option('—', ''));
  for (const option of value && !options.includes(value) ? [...options, value] : options) select.append(new Option(option, option));
  select.value = value;
  select.addEventListener('change', () => { onChange(select.value); emit(); });
  cell.append(select); return cell;
}
// Features are stored as comma-separated text and shown as chips.
function featureEditor(entry, options, listId) {
  const host = node('div', 'feature-chips');
  const draw = () => {
    host.replaceChildren();
    splitFeatures(entry.features).forEach((feature, index, all) => {
      const chip = node('span', 'feature-chip', feature);
      chip.append(button('×', 'xchip-clear', () => { all.splice(index, 1); entry.features = joinFeatures(all); draw(); emit(); }, `Remove ${feature}`));
      host.append(chip);
    });
    const add = node('input', 'feature-add'); add.placeholder = '+ Feature'; add.setAttribute('list', listId); add.setAttribute('aria-label', 'Add a feature'); add.maxLength = 40;
    const commit = () => {
      const value = add.value.trim(); if (!value) return;
      const next = joinFeatures([...splitFeatures(entry.features), value]);
      if (next.length <= 200) { entry.features = next; draw(); emit(); host.querySelector('.feature-add')?.focus(); }
    };
    add.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } });
    add.addEventListener('change', () => { if (options.includes(add.value.trim())) commit(); });
    host.append(add);
  };
  draw(); return host;
}
function datalist(id, options) {
  if ($(id)) return;
  const list = node('datalist'); list.id = id;
  for (const option of options) list.append(new Option(option, option));
  document.body.append(list);
}
datalist('weaponFeatureOptions', weaponFeatures); datalist('suitFeatureOptions', suitFeatures);
function gearCard(list, index, entry, title, removeLabel, tag) {
  const card = node('div', 'gear-card'); const head = node('div', 'gear-head');
  head.append(field(entry.name, 'card-title-input', title, 200, value => { entry.name = value; }));
  if (tag) head.append(node('span', 'gear-tag', tag));
  head.append(button('×', 'remove-button', () => { list.splice(index, 1); renderGear(); emit(); }, `${removeLabel} ${entry.name}`.trim()));
  card.append(head); return card;
}
function renderGear() {
  const weapons = $('weaponRows'); weapons.replaceChildren();
  if (!character.sheet.weapons.length) weapons.append(node('p', 'empty-note', 'No weapons.'));
  character.sheet.weapons.forEach((weapon, index, list) => {
    const card = gearCard(list, index, weapon, 'Weapon name', 'Remove');
    const stats = node('div', 'statline');
    stats.append(numberCell('Bonus', weapon.bonus, 99, value => { weapon.bonus = value; }), numberCell('Damage', weapon.damage, 99, value => { weapon.damage = value; }),
      numberCell('Crit', weapon.crit, 99, value => { weapon.crit = value; }), choiceCell('Range', weapon.range, ranges, value => { weapon.range = value; }));
    card.append(stats, featureEditor(weapon, weaponFeatures, 'weaponFeatureOptions')); weapons.append(card);
  });
  const armor = $('armorRows'); armor.replaceChildren();
  if (!character.sheet.armor.length) armor.append(node('p', 'empty-note', 'No armor or suit.'));
  character.sheet.armor.forEach((suit, index, list) => {
    const card = gearCard(list, index, suit, 'Armor or suit', 'Remove', 'Worn');
    const stats = node('div', 'statline two');
    stats.append(numberCell('Armor rating', suit.rating, 99, value => { suit.rating = value; }), numberCell('Blight protection', suit.blight, 99, value => { suit.blight = value; }));
    card.append(stats, featureEditor(suit, suitFeatures, 'suitFeatureOptions')); armor.append(card);
  });
  const items = $('equipmentRows'); items.replaceChildren();
  if (!character.sheet.equipment.length) items.append(node('p', 'empty-note', 'Nothing carried.'));
  character.sheet.equipment.forEach((item, index, list) => {
    const row = node('div', 'item-row');
    row.append(field(item.name, 'ink-input', 'Item', 200, value => { item.name = value; }));
    const weight = node('select', 'item-weight'); weight.setAttribute('aria-label', `Weight of ${item.name || 'item'}`);
    for (const option of item.weight && !(item.weight in weights) ? [...Object.keys(weights), item.weight] : Object.keys(weights)) weight.append(new Option(option, option));
    weight.value = item.weight || 'Regular';
    weight.addEventListener('change', () => { item.weight = weight.value; renderCarry(); emit(); });
    const bonus = node('input', 'item-bonus'); bonus.type = 'number'; bonus.min = 0; bonus.max = 99; bonus.value = item.bonus; bonus.title = 'Gear bonus'; bonus.setAttribute('aria-label', `Gear bonus of ${item.name || 'item'}`);
    bonus.addEventListener('input', () => { item.bonus = clampInt(bonus.value, 99); emit(); });
    row.append(weight, bonus, button('×', 'remove-button', () => { list.splice(index, 1); renderGear(); emit(); }, `Remove ${item.name}`.trim()));
    items.append(row);
  });
  renderCarry();
  const tiny = $('tinyItemRows'); tiny.replaceChildren();
  character.sheet.tinyItems.forEach((item, index, list) => {
    const chip = node('span', 'tiny-chip', item.name);
    chip.append(button('×', 'xchip-clear', () => { list.splice(index, 1); renderGear(); emit(); }, `Remove ${item.name}`));
    tiny.append(chip);
  });
  const add = node('input', 'feature-add tiny-add'); add.placeholder = '+ Tiny item'; add.maxLength = 200; add.setAttribute('aria-label', 'Add a tiny item');
  add.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return; event.preventDefault();
    if (!add.value.trim()) return;
    character.sheet.tinyItems.push({ name: add.value.trim() }); renderGear(); emit(); $('tinyItemRows').querySelector('.tiny-add')?.focus();
  });
  tiny.append(add);
}
const blanks = {
  weapons: { name: '', bonus: 0, damage: 0, crit: 0, range: '', features: '' },
  armor: { name: '', rating: 0, blight: 0, features: '' },
  equipment: { name: '', weight: 'Regular', bonus: 0, features: '' }
};
for (const add of document.querySelectorAll('[data-add-entry]')) add.addEventListener('click', () => {
  const kind = add.dataset.addEntry;
  character.sheet[kind].push({ ...blanks[kind] }); renderGear(); emit();
  $(`${kind === 'equipment' ? 'equipment' : kind === 'armor' ? 'armor' : 'weapon'}Rows`).lastElementChild?.querySelector('input')?.focus();
});
function renderKeepsake() {
  const used = character.sheet.keepsakeUsedOn === today();
  $('keepsakeUse').textContent = used ? 'Undo' : 'Recover 1 Hope';
  $('keepsakeNote').textContent = used ? 'Used this session.' : 'Once per session, play out a small scene with your keepsake.';
}
$('keepsakeUse').addEventListener('click', () => {
  const used = character.sheet.keepsakeUsedOn === today(); const max = maxima(character.attributes).hope;
  character.sheet.vitality.hope = Math.max(0, Math.min(max, character.sheet.vitality.hope + (used ? -1 : 1)));
  character.sheet.keepsakeUsedOn = used ? '' : today();
  renderKeepsake(); renderTracks(); emit();
});

/* Profile tab: book choices with a write-your-own fallback, and free text. */
const books = {
  origin: { select: 'originChoice', input: 'characterOrigin', options: () => origins.map(item => item.name), get: () => character.origin, set: value => { character.origin = value; } },
  faction: { select: 'factionChoice', input: 'characterFaction', options: () => factions, get: () => character.faction, set: value => { character.faction = value; } },
  profession: { select: 'professionChoice', input: 'characterProfession', options: () => professions.map(item => item.name), get: () => character.profession, set: value => { character.profession = value; } },
  specialty: { select: 'specialtyChoice', input: 'sheetSpecialty', options: () => findProfession(character.profession)?.specialties.map(([name]) => name) || [], get: () => character.sheet.specialty, set: value => { character.sheet.specialty = value; } }
};
function fillChoice(key) {
  const book = books[key]; const select = $(book.select); const input = $(book.input);
  const value = book.get(); const options = book.options();
  select.replaceChildren(new Option('Not chosen', ''), ...options.map(option => new Option(option, option)), new Option('Something else…', OTHER));
  const custom = Boolean(value) && !options.includes(value);
  select.value = custom ? OTHER : value; input.hidden = !custom; input.value = custom ? value : '';
}
for (const [key, book] of Object.entries(books)) {
  $(book.select).addEventListener('change', () => {
    const select = $(book.select); const input = $(book.input);
    const previousJob = findProfession(character.profession);
    if (select.value === OTHER) { input.hidden = false; book.set(input.value.trim()); input.focus(); }
    else { input.hidden = true; input.value = ''; book.set(select.value); }
    // A specialty from another profession no longer applies.
    if (key === 'profession' && previousJob?.specialties.some(([name]) => name === character.sheet.specialty)) character.sheet.specialty = '';
    if (key === 'profession') fillChoice('specialty');
    profileChanged();
  });
  $(book.input).addEventListener('input', () => { book.set($(book.input).value.trim()); profileChanged(); });
}
function profileChanged() { renderHeader(); renderGrants(); renderWheel(); renderTalents(); emit(); }
function grant(host, parts) {
  host.replaceChildren();
  for (const part of parts) {
    if (typeof part === 'string') host.append(part);
    else if (part.strong) host.append(node('b', '', part.strong));
    else if (part.action) host.append(' ', button(part.action, 'text-button link-button', part.run));
  }
}
function renderGrants() {
  const origin = findOrigin(character.origin); const job = findProfession(character.profession);
  const has = name => character.sheet.talents.find(item => item.name === name);
  const originParts = [];
  if (origin) {
    originParts.push('Talent ', { strong: `${origin.talent} 1` }, ' · faction ', origin.faction ? { strong: origin.faction } : 'of your choice', ` · starting rukh ${origin.rukh}.`);
    if (!has(origin.talent)) originParts.push({ action: `Add ${origin.talent}`, run: () => addTalent(origin.talent, false) });
  } else if (character.origin) originParts.push('Agree on a talent and a contact with the GM.');
  grant($('originGrants'), originParts);
  const factionParts = [];
  if (origin?.faction && character.faction !== origin.faction) factionParts.push('Your origin suggests ', { strong: origin.faction }, '.', { action: 'Use it', run: () => { character.faction = origin.faction; fillChoice('faction'); profileChanged(); } });
  grant($('factionGrants'), factionParts);
  const keyName = attributes.find(item => item.key === job?.key)?.name;
  grant($('professionGrants'), job ? ['Key attribute ', { strong: keyName }, ' · key talents ', job.talents.length > 4 ? 'any weapon talent, Commander, Evasive, Medic' : job.talents.join(', '), '.'] : []);
  const free = job?.specialties.find(([name]) => name === character.sheet.specialty)?.[1];
  const specialtyParts = [];
  if (free) {
    const doubled = origin?.talent === free; const held = has(free);
    specialtyParts.push('Free talent ', { strong: free }, doubled ? ', the same as your origin talent, so it goes to level 2.' : '.');
    if (!held) specialtyParts.push({ action: `Add ${free}`, run: () => addTalent(free, false) });
    else if (doubled && held.level < 2) specialtyParts.push({ action: 'Raise to 2', run: () => addTalent(free, false) });
  }
  grant($('specialtyGrants'), specialtyParts);
}
const textFields = {
  characterName: [() => character.name, value => { character.name = value; renderHeader(); }],
  characterMotivation: [() => character.motivation, value => { character.motivation = value; }],
  characterAppearance: [() => character.appearance, value => { character.appearance = value; }],
  characterDescription: [() => character.description, value => { character.description = value; }],
  sheetQuirk: [() => character.sheet.quirk, value => { character.sheet.quirk = value; }],
  sheetContacts: [() => character.sheet.contacts, value => { character.sheet.contacts = value; }],
  sheetKeepsake: [() => character.sheet.keepsake, value => { character.sheet.keepsake = value; }]
};
for (const [id, [, set]] of Object.entries(textFields)) $(id).addEventListener('input', () => { set($(id).value); emit(); });
$('characterKind').addEventListener('change', () => { character.kind = $('characterKind').value; renderHeader(); emit(); });

/* Images: the header medallion and the Profile frames share one hidden file input. */
let imageSlot = 'portrait';
for (const frame of document.querySelectorAll('[data-image-slot]')) frame.addEventListener('click', () => { imageSlot = frame.dataset.imageSlot; $('characterImageInput').click(); });
$('characterImageInput').addEventListener('change', () => {
  const file = $('characterImageInput').files[0]; $('characterImageInput').value = '';
  if (file) handlers.image(imageSlot, file);
});
const imageTargets = { portrait: ['portraitPreview', 'portraitFrame'], standup: ['standupPreview'], delve_suit: ['delveSuitPreview'] };
export function setSheetImage(slot, url) {
  for (const id of imageTargets[slot]) {
    const img = $(id);
    if (id === 'portraitPreview') { img.src = url || blankPortrait; continue; }
    img.hidden = !url; if (url) img.src = url; else img.removeAttribute('src');
    img.closest('.image-frame')?.classList.toggle('has-image', Boolean(url));
  }
}

/* Loading and collecting */
export function renderCharacter(source = null) {
  const stats = { ...defaultStats, ...(source?.attributes || {}) };
  character = {
    kind: source?.kind || 'pc', name: source?.name || '', profession: source?.profession || '', origin: source?.origin || '', faction: source?.faction || '',
    appearance: source?.appearance || '', motivation: source?.motivation || '', description: source?.description || '',
    attributes: stats, sheet: normalizeSheet(structuredClone(source?.sheet || {}), stats)
  };
  for (const [id, [get]] of Object.entries(textFields)) $(id).value = get();
  $('characterKind').value = character.kind;
  $('sheetSupply').value = character.sheet.supply; $('sheetRukh').value = character.sheet.rukh;
  for (const key of Object.keys(books)) fillChoice(key);
  // A new character opens ready for creation; an existing one opens ready for play.
  adjusting = !source; $('adjustSheet').textContent = adjusting ? 'Done' : 'Adjust'; $('adjustSheet').setAttribute('aria-pressed', String(adjusting));
  $('talentSearch').value = ''; closePicker();
  renderHeader(); renderTracks(); renderChips(); renderWheel(); renderXP(); renderTalents(); renderConditionTiles();
  for (const kind of Object.keys(woundLists)) renderWounds(kind);
  renderGear(); renderKeepsake(); renderGrants();
  setSheetTab(source ? 'Abilities' : 'Profile');
}
export function collectCharacter() {
  const copy = structuredClone(character);
  copy.name = copy.name.trim();
  copy.sheet.talents = copy.sheet.talents.filter(item => item.name.trim());
  copy.sheet.tinyItems = copy.sheet.tinyItems.filter(item => item.name.trim());
  return copy;
}
