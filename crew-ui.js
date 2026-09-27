import {
  roles as ROLES, rosterOrder, bookManeuvers, startingManeuvers, maneuverCost, roleFit, birdTypes, basicPowers, advancedPowers, freePowers, powerCost,
  birdMaximumCost, controlOutcome, commandDice, paints, vehicles, findUpgrade, levelName, slotsUsed, nextLevel, vehicleFromModel, vehicleStatKeys, debriefQuestions
} from './crew-rules.js';
import { penalty } from './explorer-rules.js';

// The shared Crew sheet: a header that stays in view (emblem, crew points, the five delve roles and the Bird)
// over five tabs. Every change saves at once through /api/crew; changes that cost crew points save together
// with the spend, and the server refuses either if someone else changed the crew in the meantime.
const $ = id => document.getElementById(id);
const ABBR = { strength: 'STR', agility: 'AGL', logic: 'LOG', insight: 'INS', perception: 'PER', empathy: 'EMP' };
const crewEmblem = 'assets/ui/crew-emblem.svg', birdEmblem = 'assets/ui/bird-emblem.svg';
function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== '') element.textContent = text;
  return element;
}
function button(label, className, onClick, aria) {
  const element = node('button', className, label); element.type = 'button';
  if (aria) element.setAttribute('aria-label', aria);
  element.addEventListener('click', onClick);
  return element;
}
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
const portraitUrl = id => `/api/image?id=${encodeURIComponent(id)}&slot=portrait`;
function face(explorer, className) {
  const element = node('span', className);
  if (explorer?.has_portrait) { const img = node('img'); img.src = portraitUrl(explorer.id); img.alt = ''; element.append(img); }
  else element.textContent = explorer ? initials(explorer.name) : '+';
  if (!explorer) element.classList.add('empty');
  return element;
}
// A track of diamonds, as on the Explorer sheet: clicking the highest lit one takes one point.
function track(host, name, color, now, max, set) {
  const row = node('div', 'track'); row.style.setProperty('--c', color);
  row.append(node('span', 'track-name', name));
  const boxes = node('div', 'track-boxes'); boxes.setAttribute('role', 'group'); boxes.setAttribute('aria-label', `${name} ${now} of ${max}`);
  for (let value = 1; value <= max; value++) {
    const next = value === now ? value - 1 : value;
    boxes.append(button('', `track-box${value <= now ? ' on' : ''}`, () => set(next), `Set ${name} to ${next}`));
  }
  const number = node('span', 'track-num'); number.append(String(now), node('small', '', ` / ${max}`));
  row.append(boxes, number); host.append(row);
}
// A destructive button that asks once more before acting.
function confirmButton(label, confirmLabel, className, onConfirm, aria) {
  const element = button(label, className, () => {
    if (element.dataset.armed) { onConfirm(); return; }
    element.dataset.armed = '1'; element.textContent = confirmLabel;
    setTimeout(() => { if (element.isConnected) { delete element.dataset.armed; element.textContent = label; } }, 3000);
  }, aria);
  return element;
}

export function normalizeBird(raw = {}) {
  // Older sheets typed the type freely; match it without caring about case.
  const type = Object.keys(birdTypes).find(name => name.toLowerCase() === String(raw.type || '').trim().toLowerCase()) || '';
  const base = birdTypes[type] || { health: 0, energy: 0 };
  const maxHealth = raw.maxHealth ?? Math.max(raw.health ?? 0, base.health);
  const maxEnergy = raw.maxEnergy ?? Math.max(raw.energy ?? 0, base.energy);
  return {
    name: raw.name || '', type, appearance: raw.appearance || '', description: raw.description || '',
    powerNotes: raw.powerNotes || (typeof raw.powers === 'string' ? raw.powers : ''), powers: Array.isArray(raw.powers) ? raw.powers : [],
    maxHealth, maxEnergy, health: Math.min(raw.health ?? maxHealth, maxHealth), energy: Math.min(raw.energy ?? maxEnergy, maxEnergy),
    companion: raw.companion || '', device: raw.device || ''
  };
}
export function normalizeVehicle(kind, raw = {}) {
  const book = vehicles[kind].models[raw.model]?.stats || {};
  const number = key => { const value = typeof raw[key] === 'string' ? Number.parseInt(raw[key], 10) : raw[key]; return Number.isInteger(value) && value > 0 ? value : book[key] ?? 0; };
  const stats = Object.fromEntries(vehicleStatKeys.map(key => [key, number(key)]));
  return {
    name: raw.name || '', model: raw.model || '', paint: raw.paint || '', upgrades: raw.upgrades || '', cargo: raw.cargo || '',
    ...stats, hullNow: Math.min(raw.hullNow ?? stats.hull, stats.hull), supply: raw.supply || 0, installed: Array.isArray(raw.installed) ? raw.installed : []
  };
}

export function initCrewUI(request, profile, { activeCharacter = () => null, chat = () => null } = {}) {
  let crew = null; let timer = null; let loading = false; let active = false; let pendingRender = false;
  let saveQueue = Promise.resolve();
  const rules = new Map();
  const ui = { chooser: null, debrief: new Set(), tray: null, modelPrompt: {}, imageSlot: 'crew' };
  const panel = $('paneCrew');
  const status = (text, state = '') => { $('crewMessage').textContent = text; $('crewMessage').dataset.state = state; };
  const rule = (kind, name) => rules.get(`${kind}:${String(name).toLowerCase()}`);
  const isGM = () => profile()?.role === 'gm';
  const explorer = id => crew?.explorers?.find(item => item.id === id) || null;
  const seated = key => explorer(crew.roles.find(item => item.role === key)?.character_id);
  const mine = person => isGM() || person?.owner_id === profile()?.id;

  /* Tabs */
  const tabs = ['Info', 'Maneuvers', 'Bird', 'Rover', 'Shuttle'];
  function selectTab(name) {
    for (const tab of tabs) {
      const on = tab === name;
      $('crewTab' + tab).setAttribute('aria-selected', String(on)); $('crewTab' + tab).tabIndex = on ? 0 : -1;
      $('crewPane' + tab).hidden = !on;
    }
  }
  for (const [index, tab] of tabs.entries()) {
    $('crewTab' + tab).addEventListener('click', () => selectTab(tab));
    $('crewTab' + tab).addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : -1;
      if (next < 0) return;
      event.preventDefault(); selectTab(tabs[next]); $('crewTab' + tabs[next]).focus();
    });
  }

  /* Saving */
  // Changes apply on screen at once and save in order; each save carries the latest revision.
  function save(field, value, points = null) {
    if (!crew) return saveQueue;
    if (field) crew[field] = value;
    if (points) crew.crew_points += points.change;
    render(); status('Saving…', 'saving');
    saveQueue = saveQueue.then(async () => {
      try {
        const payload = { revision: crew.revision, ...(field ? { field, value: crew[field] } : {}), ...(points ? { points } : {}) };
        const data = await request('/api/crew', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        crew = data.crew; status('Saved', 'saved'); render();
      } catch (cause) { status(`Not saved: ${cause.message}`, 'error'); await load(true); }
    });
    return saveQueue;
  }
  const spend = (cost, reason) => ({ change: -cost, reason });
  const canAfford = cost => (crew?.crew_points ?? 0) >= cost;

  /* Rendering. A focused text field is never redrawn under the cursor; the redraw waits until it loses focus. */
  function render() {
    if (!crew) return;
    const focused = document.activeElement;
    if (panel.contains(focused) && focused.matches('input:not([type="number"]), textarea')) { pendingRender = true; renderHeader(); return; }
    pendingRender = false;
    renderHeader(); renderInfo(); renderManeuvers(); renderBird(); renderVehicle('rover'); renderVehicle('shuttle');
  }
  panel.addEventListener('focusout', () => setTimeout(() => { if (pendingRender && !panel.contains(document.activeElement)) render(); }, 0));

  function renderHeader() {
    $('crewHeading').textContent = crew.name || 'Our crew';
    $('crewPointsBadge').textContent = crew.crew_points;
    const filled = crew.roles.filter(item => item.character_id).length;
    const bird = normalizeBird(crew.bird);
    $('crewSub').textContent = `${filled} of 5 roles filled${bird.name ? ` · ${bird.name} the Bird` : ''}`;
    $('crewPortrait').src = crew.images?.crew ? `/api/crew-image?slot=crew&v=${crew.revision}` : crewEmblem;
    $('removeCrewPortrait').hidden = !crew.images?.crew;
    const roster = $('crewRoster'); roster.replaceChildren();
    for (const key of rosterOrder) {
      const role = ROLES.find(item => item.key === key); const person = seated(key);
      const seat = button('', 'rseat', () => { selectTab('Info'); }, `${role.name}: ${person ? person.name : 'open'}`);
      const portrait = face(person, 'rface'); if (person && crew.engagement[person.id]) portrait.classList.add('used');
      seat.append(portrait, node('small', '', role.name), node('em', '', person ? person.name.split(' ')[0] : 'Open'));
      roster.append(seat);
    }
    const bar = $('crewBirdBar'); bar.replaceChildren();
    const name = node('div', 'bname', bird.name || 'The Bird'); if (bird.type) name.append(node('small', '', bird.type));
    const tracks = node('div', 'tracks');
    track(tracks, 'Health', 'var(--health)', bird.health, bird.maxHealth, value => save('bird', { ...bird, health: value }));
    track(tracks, 'Energy', 'var(--energy)', bird.energy, bird.maxEnergy, value => save('bird', { ...bird, energy: value }));
    bar.append(name, tracks);
  }

  /* Crew tab */
  function renderInfo() {
    if (document.activeElement !== $('crewName')) $('crewName').value = crew.name;
    if (document.activeElement !== $('crewPoints')) $('crewPoints').value = crew.crew_points;
    renderFormation(); renderDebrief(); renderHistory();
  }
  function seatCard(role, compact) {
    const person = seated(role.key);
    const wrap = node('div', `seat-wrap${compact ? ' compact' : ''}`);
    const card = node('button', 'seat'); card.type = 'button'; card.setAttribute('aria-haspopup', 'listbox'); card.setAttribute('aria-expanded', String(ui.chooser === role.key));
    const body = node('span', 'seat-body');
    body.append(node('span', 'seat-role', role.name), node('span', 'seat-who', person ? person.name : 'No one yet'));
    const fit = node('span', 'seat-fit');
    if (person) {
      fit.append(role.attributes.map(key => `${ABBR[key]} ${person.attributes[key] ?? 0}`).join(' · ') + ' = ', node('b', '', String(roleFit(person.attributes, role))));
      const best = [...crew.explorers].sort((a, b) => roleFit(b.attributes, role) - roleFit(a.attributes, role))[0];
      if (best && best.id !== person.id && roleFit(best.attributes, role) > roleFit(person.attributes, role)) fit.append(' ', node('span', 'better', `${best.name.split(' ')[0]} ${roleFit(best.attributes, role)}`));
    } else fit.textContent = role.attributes.map(key => ABBR[key]).join(' + ');
    body.append(fit, node('span', 'seat-item', compact ? role.item : `Carries the ${role.item.toLowerCase()}`));
    card.append(face(person, 'sface'), body);
    card.addEventListener('click', event => { event.stopPropagation(); ui.chooser = ui.chooser === role.key ? null : role.key; renderFormation(); });
    wrap.append(card);
    if (ui.chooser === role.key) wrap.append(chooser(role, person));
    return wrap;
  }
  function chooser(role, current) {
    const box = node('div', 'seat-chooser'); box.setAttribute('role', 'listbox'); box.setAttribute('aria-label', `Choose the ${role.name}`);
    box.addEventListener('click', event => event.stopPropagation());
    box.append(node('div', 'chooser-group', `${role.name} · ${role.attributes.map(key => ABBR[key]).join(' + ')}`));
    if (current && !mine(current)) { box.append(node('p', 'chooser-note', `Only ${current.name}'s player or the GM can change this seat.`)); return box; }
    const sorted = [...crew.explorers].sort((a, b) => roleFit(b.attributes, role) - roleFit(a.attributes, role));
    if (!sorted.length) box.append(node('p', 'chooser-note', 'No player characters yet.'));
    sorted.forEach((person, index) => {
      const holding = ROLES.find(item => crew.roles.find(r => r.role === item.key)?.character_id === person.id);
      const option = button(person.name, 'chooser-option', () => assign(role, person));
      option.setAttribute('role', 'option');
      const tail = [String(roleFit(person.attributes, role)), index === 0 ? 'best fit' : '', holding && holding.key !== role.key ? `now ${holding.name}` : '', !mine(person) ? "another player's" : ''].filter(Boolean).join(' · ');
      option.append(node('span', index === 0 ? 'best' : '', tail));
      option.disabled = !mine(person) || holding?.key === role.key;
      box.append(option);
    });
    if (current) box.append(button('Leave this seat open', 'chooser-option', () => assign(role, null)));
    return box;
  }
  document.addEventListener('click', () => { if (ui.chooser) { ui.chooser = null; if (crew) renderFormation(); } });
  async function assignRequest(role, characterId, expectedId) {
    const data = await request('/api/crew', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'assign', role, characterId, expectedId }) });
    crew = data.crew;
  }
  async function assign(role, person) {
    ui.chooser = null;
    const current = crew.roles.find(item => item.role === role.key)?.character_id || null;
    try {
      // Someone moving seats leaves their old seat first, since an Explorer holds one role at a time.
      const old = person && crew.roles.find(item => item.character_id === person.id && item.role !== role.key);
      if (old) await assignRequest(old.role, null, person.id);
      await assignRequest(role.key, person?.id || null, current);
      status('Saved', 'saved');
    } catch (cause) { status(cause.message, 'error'); await load(true); return; }
    render();
  }
  function renderFormation() {
    const host = $('crewFormation'); host.replaceChildren();
    const [scout, delver, guard, burrower, archaeologist] = ROLES;
    const top = node('div', 'into-dark'); top.append(node('span', 'into-dark-mark'), node('span', '', 'Into the dark'));
    const split = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    split.setAttribute('class', 'formation-split'); split.setAttribute('viewBox', '0 0 412 22'); split.setAttribute('preserveAspectRatio', 'none'); split.setAttribute('aria-hidden', 'true');
    split.innerHTML = '<path d="M206 0V9H103V22M206 9H309V22" fill="none" stroke="rgba(205,184,125,.45)" vector-effect="non-scaling-stroke"/>';
    const pair = node('div', 'seat-pair'); pair.append(seatCard(burrower, true), seatCard(archaeologist, true));
    host.append(top, seatCard(scout), node('div', 'formation-link dashed'), seatCard(delver), node('div', 'formation-link'), seatCard(guard), split, pair);
  }
  function renderDebrief() {
    const host = $('crewDebrief'); host.replaceChildren();
    host.append(node('div', 'mini-label', 'Session debrief · 1 CP for each yes'));
    const list = node('div', 'debrief-questions');
    debriefQuestions.forEach((question, index) => {
      const label = node('label'); const box = node('input'); box.type = 'checkbox'; box.checked = ui.debrief.has(index);
      box.addEventListener('change', () => { box.checked ? ui.debrief.add(index) : ui.debrief.delete(index); renderDebrief(); });
      label.append(box, document.createTextNode(question)); list.append(label);
    });
    const count = ui.debrief.size;
    const award = button(`Award ${count} CP`, 'small-button', () => { ui.debrief.clear(); save(null, null, { change: count, reason: `Session debrief (${count} of 6)` }); });
    award.disabled = !count;
    const row = node('div', 'debrief-row'); row.append(node('span', 'field-hint', count ? `${count} CP to award` : 'Tick what the crew did this session.'), award);
    host.append(list, row);
  }
  function renderHistory() {
    const host = $('crewHistory'); host.replaceChildren();
    host.append(node('div', 'mini-label', 'Where our points went'));
    const log = [...(crew.points_log || [])].reverse().slice(0, 8);
    if (!log.length) { host.append(node('p', 'empty-note', 'Nothing yet.')); return; }
    for (const entry of log) {
      const row = node('div', 'cp-entry');
      const when = new Date(entry.at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      row.append(node('span', '', entry.reason), node('small', '', `${entry.by} · ${when}`), node('b', entry.change < 0 ? 'neg' : '', `${entry.change > 0 ? '+' : ''}${entry.change}`));
      host.append(row);
    }
  }
  $('crewName').addEventListener('change', () => save('name', $('crewName').value.trim()));
  $('crewPoints').addEventListener('change', () => {
    const value = Math.max(0, Math.min(999, Math.trunc(Number($('crewPoints').value)) || 0));
    if (value !== crew.crew_points) save('crew_points', value);
  });

  /* Maneuvers */
  const learned = () => new Set(crew.maneuvers.map(item => item.name));
  function renderManeuvers() {
    const engagement = $('crewEngagement'); engagement.replaceChildren();
    const head = node('div', 'engagement-head'); head.append(node('span', 'mini-label', 'This engagement · one maneuver each'));
    head.append(button('New engagement', 'text-button link-button', () => save('engagement', {})));
    const strip = node('div', 'engagement-strip');
    for (const key of rosterOrder) {
      const role = ROLES.find(item => item.key === key); const person = seated(key); const used = person && crew.engagement[person.id];
      const cell = node('div', `engaged${used ? ' used' : ''}`);
      cell.append(face(person, 'eface'), node('small', '', used || (person ? 'Ready' : role.name)));
      strip.append(cell);
    }
    engagement.append(head, strip);

    const board = $('crewManeuverBoard'); board.replaceChildren();
    const known = learned();
    if (!bookManeuvers.some(name => known.has(name))) {
      const starter = node('div', 'starter');
      starter.append(node('span', 'field-hint', 'A new crew knows one maneuver per role: Rally, Situational Awareness, Flank, Destabilize and Analyze.'),
        button('Add the starting five', 'small-button', () => save('maneuvers', [...crew.maneuvers, ...startingManeuvers.map(name => ({ name, description: '' }))])));
      board.append(starter);
    }
    for (const role of ROLES) {
      const person = seated(role.key);
      const block = node('div', 'role-block');
      const title = node('div', 'role-head'); title.append(node('h3', '', role.name), node('span', '', person ? person.name : 'No one in this role'));
      const grid = node('div', 'maneuver-grid');
      for (const name of role.maneuvers) {
        const has = known.has(name);
        const tile = node('div', `maneuver${has ? ' learned' : ''}`);
        const top = node('div', 'maneuver-name', name);
        if (name === role.start) top.append(node('span', 'crew-tag dim', 'Start'));
        tile.append(top);
        const text = rule('maneuver', name)?.text;
        if (text) tile.append(node('p', '', text));
        const actions = node('div', 'maneuver-actions');
        if (has) {
          const used = person && crew.engagement[person.id];
          const use = button(used === name ? 'Used' : 'Use', 'text-button link-button', () => save('engagement', { ...crew.engagement, [person.id]: name }));
          use.disabled = !person || Boolean(used);
          actions.append(use, confirmButton('×', 'Forget?', 'remove-button', () => save('maneuvers', crew.maneuvers.filter(item => item.name !== name)), `Forget ${name} (no refund)`));
        } else {
          const learn = button(`Learn · ${maneuverCost} CP`, 'text-button link-button', () => save('maneuvers', [...crew.maneuvers, { name, description: '' }], spend(maneuverCost, `Learned ${name}`)));
          learn.disabled = !canAfford(maneuverCost);
          actions.append(learn);
        }
        tile.append(actions); grid.append(tile);
      }
      block.append(title, grid); board.append(block);
    }
    renderCustomManeuvers();
  }
  // Maneuvers that aren't in the book: a name and a description the crew writes.
  function customManeuvers() { return crew.maneuvers.filter(item => !bookManeuvers.includes(item.name)); }
  function saveCustom(list) { save('maneuvers', [...crew.maneuvers.filter(item => bookManeuvers.includes(item.name)), ...list.filter(item => item.name || item.description)]); }
  function renderCustomManeuvers() {
    const host = $('crewManeuverRows'); host.replaceChildren();
    const list = customManeuvers().map(item => ({ ...item }));
    if (!list.length) host.append(node('p', 'empty-note', 'None.'));
    list.forEach((item, index) => {
      const card = node('div', 'wound-card');
      const head = node('div', 'wound-head');
      const name = node('input', 'card-title-input'); name.value = item.name; name.maxLength = 120; name.placeholder = 'Maneuver name'; name.setAttribute('aria-label', 'Maneuver name');
      const text = node('textarea', 'ink-input'); text.value = item.description; text.maxLength = 2000; text.rows = 2; text.placeholder = 'What it does'; text.setAttribute('aria-label', 'What the maneuver does');
      name.addEventListener('change', () => { list[index].name = name.value.trim(); saveCustom(list); });
      text.addEventListener('change', () => { list[index].description = text.value.trim(); saveCustom(list); });
      head.append(name, confirmButton('×', 'Remove?', 'remove-button', () => { list.splice(index, 1); saveCustom(list); }, `Remove ${item.name || 'maneuver'}`));
      card.append(head, text); host.append(card);
    });
  }
  $('addCrewManeuver').addEventListener('click', () => {
    if (crew.maneuvers.length >= 40) { status('Maximum 40 maneuvers.', 'error'); return; }
    const host = $('crewManeuverRows'); host.querySelector('.empty-note')?.remove();
    const card = node('div', 'wound-card'); const name = node('input', 'card-title-input'); name.maxLength = 120; name.placeholder = 'Maneuver name'; name.setAttribute('aria-label', 'Maneuver name');
    name.addEventListener('change', () => { if (name.value.trim()) saveCustom([...customManeuvers(), { name: name.value.trim(), description: '' }]); });
    card.append(name); host.append(card); name.focus();
  });

  /* Bird */
  function renderBird() {
    const bird = normalizeBird(crew.bird);
    const saveBird = changes => save('bird', { ...bird, ...changes });
    const host = $('crewBird'); host.replaceChildren();
    const card = node('div', 'bird-card');
    const portrait = button('', 'medallion bird-medallion', () => pickImage('bird'), 'Replace the Bird\'s portrait');
    const img = node('img'); img.alt = ''; img.src = crew.images?.bird ? `/api/crew-image?slot=bird&v=${crew.revision}` : birdEmblem; portrait.append(img);
    const text = node('div', 'bird-text');
    const name = node('input', 'bird-name'); name.value = bird.name; name.maxLength = 500; name.placeholder = 'Name the Bird'; name.setAttribute('aria-label', 'Bird name');
    name.addEventListener('change', () => saveBird({ name: name.value.trim() }));
    const look = node('input', 'ink-input'); look.value = bird.appearance; look.maxLength = 2000; look.placeholder = 'Colour, body and personality'; look.setAttribute('aria-label', 'Appearance and personality');
    look.addEventListener('change', () => saveBird({ appearance: look.value.trim() }));
    text.append(node('div', 'eyebrow', "The crew's Bird"), name, look);
    card.append(portrait, text); host.append(card);
    $('removeBirdPortrait').hidden = !crew.images?.bird;

    const types = node('div', 'segmented teal');
    for (const [type, info] of Object.entries(birdTypes)) {
      const choice = button(type, '', () => {
        if (type === bird.type) return;
        const old = birdTypes[bird.type];
        const powers = bird.powers.filter(power => power !== old?.special);
        // Points bought with CP carry over; the type's own starting values change.
        const maxHealth = old ? bird.maxHealth + info.health - old.health : info.health;
        const maxEnergy = old ? bird.maxEnergy + info.energy - old.energy : info.energy;
        saveBird({ type, maxHealth, maxEnergy, health: old ? Math.min(bird.health, maxHealth) : maxHealth, energy: old ? Math.min(bird.energy, maxEnergy) : maxEnergy, powers: [...new Set([...powers, info.special])] });
      });
      choice.setAttribute('aria-pressed', String(bird.type === type));
      choice.append(node('small', '', `Health ${info.health} · Energy ${info.energy} · ${info.special}`));
      types.append(choice);
    }
    host.append(types);
    const tracks = node('div', 'tracks bird-tracks');
    track(tracks, 'Health', 'var(--health)', bird.health, bird.maxHealth, value => saveBird({ health: value }));
    track(tracks, 'Energy', 'var(--energy)', bird.energy, bird.maxEnergy, value => saveBird({ energy: value }));
    const rest = node('div', 'row-between'); rest.append(node('span', 'field-hint', bird.health === 0 ? 'Broken: no powers except Phoenix Engine until the next shift.' : 'Energy returns after a shift of complete rest.'), button('Rest a shift', 'small-button', () => saveBird({ energy: bird.maxEnergy })));
    host.append(tracks, rest);

    const picks = node('div', 'pick-row');
    for (const [key, label] of [['companion', 'Companion (+1 die)'], ['device', 'Garuda device']]) {
      const field = node('label', 'book-field', label); const select = node('select');
      select.append(new Option('No one', ''), ...crew.explorers.map(person => new Option(`${person.name} · INS ${person.attributes.insight ?? 0}${person.birdHandler ? ` · Bird Handler ${person.birdHandler}` : ''}`, person.id)));
      select.value = bird[key]; select.addEventListener('change', () => saveBird({ [key]: select.value }));
      field.append(select); picks.append(field);
    }
    host.append(picks);

    const command = button('Command the Bird', 'primary-button', () => { ui.tray = ui.tray ? null : { energy: Math.min(1, bird.energy), power: '' }; renderBird(); $('crewBird').querySelector('.bird-tray')?.scrollIntoView({ block: 'nearest' }); });
    command.disabled = !bird.type;
    host.append(command);
    if (!bird.type) host.append(node('p', 'field-hint', 'Choose the Bird\'s type first.'));
    if (ui.tray) host.append(birdTray(bird));

    host.append(node('div', 'rule', 'Garuda powers'));
    const list = node('div', 'powers');
    const known = new Set([...basicPowers, ...bird.powers]);
    for (const power of [...basicPowers.map(name => ({ name, type: 'Basic' })), ...advancedPowers]) {
      const has = known.has(power.name);
      const row = node('div', `power${has ? ' known' : ''}`);
      const left = node('div'); const title = node('div', 'power-name', power.name);
      title.append(node('span', `crew-tag${power.type === bird.type ? ' teal' : ' dim'}`, power.type));
      left.append(title);
      const text = rule('power', power.name)?.text; if (text) left.append(node('p', '', text));
      const right = node('div', 'power-actions');
      if (power.type === 'Basic') right.append(node('span', 'known-mark', 'Always'));
      else if (has) right.append(node('span', 'known-mark', power.name === birdTypes[bird.type]?.special ? 'Type power' : 'Known'),
        confirmButton('×', 'Forget?', 'remove-button', () => saveBird({ powers: bird.powers.filter(item => item !== power.name) }), `Forget ${power.name} (no refund)`));
      else {
        const cost = powerCost(power.name, bird.type);
        const learn = button(`Learn · ${cost} CP`, 'text-button link-button', () => save('bird', { ...bird, powers: [...bird.powers, power.name] }, spend(cost, `Taught the Bird ${power.name}`)));
        learn.disabled = !canAfford(cost) || !bird.type; right.append(learn);
      }
      row.append(left, right); list.append(row);
    }
    host.append(list);
    const strengthen = node('div', 'row-between');
    const more = node('span', 'bird-more');
    for (const [key, label] of [['Health', 'Health'], ['Energy', 'Energy']]) {
      const raise = button(`+1 ${label} · ${birdMaximumCost} CP`, 'small-button', () => save('bird', { ...bird, [`max${key}`]: bird[`max${key}`] + 1, [key.toLowerCase()]: bird[key.toLowerCase()] + 1 }, spend(birdMaximumCost, `Bird +1 maximum ${label}`)));
      raise.disabled = !canAfford(birdMaximumCost) || !bird.type; more.append(raise);
    }
    strengthen.append(node('span', 'field-hint', 'Raise the Bird\'s maximums.'), more);
    host.append(node('div', 'rule', 'Strengthen the Bird'), strengthen);
    host.append(node('div', 'rule', 'Notes'));
    const description = node('textarea', 'ink-input'); description.value = bird.description; description.maxLength = 2000; description.rows = 2; description.placeholder = 'Anything else about the Bird'; description.setAttribute('aria-label', 'Notes about the Bird');
    description.addEventListener('change', () => saveBird({ description: description.value.trim() }));
    host.append(description);
    if (bird.powerNotes) {
      const notes = node('textarea', 'ink-input'); notes.value = bird.powerNotes; notes.maxLength = 2000; notes.rows = 2; notes.setAttribute('aria-label', 'Earlier power notes');
      notes.addEventListener('change', () => saveBird({ powerNotes: notes.value.trim() }));
      host.append(node('div', 'mini-label', 'Earlier power notes'), notes);
    }
  }
  // Commanding the Bird: INSIGHT (Bird Handler) with the Energy spent as extra base dice, rolled in chat.
  function birdTray(bird) {
    const tray = node('div', 'bird-tray'); const state = ui.tray;
    const commander = activeCharacter();
    const head = node('div', 'row-between'); head.append(node('h3', '', 'Command the Bird'), button('Close', 'text-button link-button', () => { ui.tray = null; renderBird(); }));
    tray.append(head);
    if (!commander) { tray.append(node('p', 'field-hint', 'Choose your active character in the character menu to command the Bird.')); return tray; }
    const powers = [...basicPowers, ...bird.powers];
    state.power ||= powers.includes(birdTypes[bird.type]?.special) ? birdTypes[bird.type].special : powers[0];
    const free = freePowers.includes(state.power);
    const energy = free ? 0 : Math.max(0, Math.min(state.energy, bird.energy));
    const handler = (commander.sheet?.talents || []).find(item => item.name === 'Bird Handler')?.level || 0;
    const companion = bird.companion === commander.id;
    const weakened = penalty(commander.sheet?.conditions || [], 'insight') > 0;
    const dice = commandDice({ insight: commander.attributes?.insight || 0, handler, companion, energy, weakened });
    const grid = node('div', 'tray-grid');
    const powerField = node('label', 'book-field', 'Power'); const select = node('select');
    select.append(...powers.map(name => new Option(name, name))); select.value = state.power;
    select.addEventListener('change', () => { state.power = select.value; renderBird(); });
    powerField.append(select);
    const energyField = node('div', 'book-field'); energyField.append(node('span', '', 'Energy to spend'));
    const stepper = node('div', 'stepper');
    const down = button('−', '', () => { state.energy = Math.max(0, energy - 1); renderBird(); }, 'Spend less Energy'); down.disabled = free || energy <= 0;
    const up = button('+', '', () => { state.energy = energy + 1; renderBird(); }, 'Spend more Energy'); up.disabled = free || energy >= bird.energy;
    stepper.append(down, node('output', '', String(energy)), up); energyField.append(stepper);
    grid.append(powerField, energyField); tray.append(grid);
    const parts = [`Insight ${commander.attributes?.insight || 0}`]; if (weakened) parts.push('Shaken −2'); if (handler) parts.push(`Bird Handler +${handler}`); if (companion) parts.push('companion +1'); if (energy) parts.push(`Energy +${energy}`);
    const sum = node('p', 'tray-sum'); sum.append(`${commander.name}: ${parts.join(' · ')} = `, node('strong', '', `${dice} base dice`));
    tray.append(sum);
    const powerText = rule('power', state.power)?.text; if (powerText) tray.append(node('p', 'field-hint', powerText));
    const actions = node('div', 'row-between');
    actions.append(node('span', 'field-hint', free ? 'Blight Scan costs no Energy.' : bird.health === 0 ? 'The Bird is broken.' : 'Spent Energy is gone until the Bird rests.'));
    const roll = button('Roll', 'primary-button', async () => {
      roll.disabled = true;
      const message = await chat()?.rollFor({ type: 'skill', attribute: 'insight', talent: handler ? 'Bird Handler' : '', base: dice, purpose: `Command the Bird · ${state.power}` });
      if (!message) { roll.disabled = false; status($('chatStatus')?.textContent || 'The roll could not be sent.', 'error'); return; }
      Object.assign(state, { messageId: message.id, roll: message.roll, spent: energy, pushed: false, lost: false, control: null });
      if (energy) save('bird', { ...bird, energy: bird.energy - energy }); else renderBird();
    });
    roll.disabled = (!free && bird.energy < energy) || (bird.health === 0 && state.power !== 'Phoenix Engine');
    actions.append(roll); tray.append(actions);
    if (state.roll) tray.append(trayResult(state));
    return tray;
  }
  function trayResult(state) {
    const out = node('div', 'tray-result');
    const dice = node('div', 'roll-dice'); dice.setAttribute('aria-hidden', 'true');
    for (const value of state.roll.baseDice) { const die = node('span', `tray-die${value === 6 ? ' six' : value === 1 ? ' one' : ''}`, String(value)); dice.append(die); }
    const successes = state.roll.successes;
    const line = node('div', 'row-between');
    line.append(node('span', 'roll-result', successes ? `${successes} ${successes === 1 ? 'success' : 'successes'}${state.pushed ? ' after the push' : ''}` : state.pushed ? 'No successes after the push' : 'No successes'));
    if (!state.pushed) line.append(button('Push', 'small-button', async () => {
      const message = await chat()?.push(state.messageId); if (!message) return;
      Object.assign(state, { messageId: message.id, roll: message.roll, pushed: true, lost: message.roll.baseDice.includes(1) });
      renderBird();
    }));
    out.append(dice, line);
    if (state.lost) {
      const warn = node('div', 'control-warning');
      const ones = state.roll.baseDice.filter(value => value === 1).length;
      warn.append(node('p', '', `A one on the push: the Bird slips out of control, and the commander loses ${ones} Hope. Roll a D6${successes ? `, plus the ${state.spent} Energy spent` : ''}.`));
      if (!state.control) warn.append(button('Roll for control', 'small-button', async () => {
        const message = await chat()?.rollFor({ type: 'pool', base: 1, purpose: 'Losing control of the Bird' }); if (!message) return;
        const die = message.roll.baseDice[0]; const total = die + (successes ? state.spent : 0);
        state.control = { die, total, key: controlOutcome(total) }; renderBird();
      }));
      else {
        const outcome = [...rules.values()].find(entry => entry.kind === 'control' && entry.key === state.control.key);
        const result = node('p', 'control-result');
        result.append(`D6 ${state.control.die}${successes ? ` + ${state.control.total - state.control.die}` : ''} = ${state.control.total}: `, node('b', '', outcome?.name || state.control.key.replace(/-/g, ' ')), outcome?.text ? ` ${outcome.text}` : '');
        warn.append(result);
      }
      out.append(warn);
    }
    return out;
  }

  /* Vehicles */
  const vehicleHosts = { rover: 'crewRover', shuttle: 'crewShuttle' };
  function renderVehicle(kind) {
    const book = vehicles[kind]; const vehicle = normalizeVehicle(kind, crew[kind]);
    const saveVehicle = (changes, points) => save(kind, { ...vehicle, ...changes }, points);
    const host = $(vehicleHosts[kind]); host.replaceChildren();
    const models = node('div', 'segmented');
    for (const [model, info] of Object.entries(book.models)) {
      const choice = button(model, '', () => {
        if (model === vehicle.model) return;
        const fresh = vehicleFromModel(kind, model);
        const current = vehicle.installed.map(item => item.name).sort().join('|');
        const stock = (book.models[vehicle.model]?.starts || []).slice().sort().join('|');
        // Custom upgrades are worth asking about; an empty or stock fit simply follows the new model.
        if (vehicle.installed.length && current !== stock) { ui.modelPrompt[kind] = model; renderVehicle(kind); return; }
        saveVehicle({ model, ...fresh, hullNow: fresh.hull });
      });
      choice.setAttribute('aria-pressed', String(vehicle.model === model)); choice.append(node('small', '', info.note)); models.append(choice);
    }
    host.append(models);
    const prompt = ui.modelPrompt[kind];
    if (prompt) {
      const fresh = vehicleFromModel(kind, prompt);
      const ask = node('div', 'model-prompt');
      ask.append(node('p', '', `Switch to the ${prompt}? Its stats replace the current ones. What about the upgrades you've installed?`));
      const row = node('div', 'model-prompt-actions');
      row.append(button('Keep our upgrades', 'small-button', () => { delete ui.modelPrompt[kind]; saveVehicle({ model: prompt, ...fresh, installed: vehicle.installed, hullNow: fresh.hull }); }),
        button(`Use the ${prompt}'s`, 'small-button', () => { delete ui.modelPrompt[kind]; saveVehicle({ model: prompt, ...fresh, hullNow: fresh.hull }); }),
        button('Cancel', 'text-button link-button', () => { delete ui.modelPrompt[kind]; renderVehicle(kind); }));
      ask.append(row); host.append(ask);
    }

    const plate = node('div', 'spec-plate');
    const head = node('div', 'plate-head');
    const title = node('div');
    const name = node('input', 'vehicle-name'); name.value = vehicle.name; name.maxLength = 500; name.placeholder = `Name the ${book.label.toLowerCase()}`; name.setAttribute('aria-label', `${book.label} name`);
    name.addEventListener('change', () => saveVehicle({ name: name.value.trim() }));
    title.append(node('div', 'vehicle-model', `${book.label}${vehicle.model ? ` · ${vehicle.model}` : ''}`), name);
    const swatches = node('div', 'swatches');
    for (const [paint, color] of paints) {
      const swatch = button('', 'swatch', () => saveVehicle({ paint: vehicle.paint === paint ? '' : paint }), paint);
      swatch.style.background = color; swatch.title = paint; swatch.setAttribute('aria-pressed', String(vehicle.paint === paint)); swatches.append(swatch);
    }
    head.append(title, swatches);
    plate.append(head, node('div', 'field-hint', vehicle.paint ? `Coat of paint: ${vehicle.paint}` : 'Choose a coat of paint.'));
    const labels = kind === 'rover'
      ? [['maneuverability', 'Maneuver', '+'], ['speed', 'Speed'], ['armor', 'Armor'], ['blight', 'Blight prot.'], ['passengers', 'Passengers'], ['cargoCapacity', 'Cargo', '', 'supply'], ['slots', 'Slots'], ['hull', 'Hull']]
      : [['maneuverability', 'Maneuver', '+'], ['speed', 'Combat speed'], ['armor', 'Armor'], ['hull', 'Hull'], ['travel', 'Travel', '', 'AD/day'], ['range', 'Range', '', 'AD'], ['passengers', 'Passengers'], ['cargoCapacity', 'Cargo', '', 'supply'], ['slots', 'Slots']];
    const stats = node('div', `vehicle-stats${labels.length === 9 ? ' three' : ''}`);
    for (const [key, label, prefix = '', unit = ''] of labels) {
      const cell = node('label', 'stat-cell'); cell.append(node('small', '', label));
      const line = node('span', 'stat-line'); if (prefix) line.append(prefix);
      const input = node('input', 'stat-input'); input.type = 'number'; input.min = 0; input.max = key === 'cargoCapacity' ? 99999 : 999; input.value = vehicle[key]; input.setAttribute('aria-label', label);
      input.addEventListener('change', () => {
        const value = Math.max(0, Math.min(Number(input.max), Math.trunc(Number(input.value)) || 0));
        saveVehicle({ [key]: value, ...(key === 'hull' ? { hullNow: Math.min(vehicle.hullNow, value) } : {}) });
      });
      line.append(input); if (unit) line.append(node('small', '', unit));
      cell.append(line); stats.append(cell);
    }
    plate.append(stats);
    if (vehicle.hull) { const hull = node('div', 'tracks'); track(hull, 'Hull', 'var(--hull)', vehicle.hullNow, vehicle.hull, value => saveVehicle({ hullNow: value })); plate.append(hull); }
    host.append(plate);

    const used = slotsUsed(kind, vehicle.installed);
    host.append(node('div', 'rule', `Upgrade slots · ${used} of ${vehicle.slots}`));
    const slots = node('div', 'slots');
    const removeUpgrade = item => saveVehicle({ installed: vehicle.installed.filter(entry => entry !== item) });
    const label = item => { const upgrade = findUpgrade(kind, item.name); return `${item.name}${upgrade ? ` ${levelName(item.level, upgrade.costs.length)}` : ''}`.trim(); };
    for (const item of vehicle.installed.filter(entry => (findUpgrade(kind, entry.name)?.slots || 0) > 0)) {
      const slot = node('div', 'slot'); slot.append(node('span', '', label(item)));
      const text = rule('upgrade', item.name)?.text; if (text) { slot.title = text; slot.append(node('small', '', text)); }
      slot.append(confirmButton('×', '?', 'slot-remove', () => removeUpgrade(item), `Remove ${item.name} (no refund)`));
      slots.append(slot);
    }
    for (let index = used; index < vehicle.slots; index++) slots.append(node('div', 'slot empty', 'Empty slot'));
    if (used > vehicle.slots) slots.append(node('p', 'field-hint over', `${used - vehicle.slots} more upgrade slot${used - vehicle.slots > 1 ? 's' : ''} in use than the ${book.label.toLowerCase()} has.`));
    host.append(slots);
    const addons = vehicle.installed.filter(entry => (findUpgrade(kind, entry.name)?.slots || 0) === 0);
    host.append(node('div', 'mini-label', 'Add-ons (no slot)'));
    const chips = node('div', 'feature-chips');
    for (const item of addons) {
      const chip = node('span', 'feature-chip', label(item));
      const text = rule('upgrade', item.name)?.text; if (text) { chip.title = text; chip.classList.add('has-rule'); }
      chip.append(confirmButton('×', '?', 'xchip-clear', () => removeUpgrade(item), `Remove ${item.name} (no refund)`)); chips.append(chip);
    }
    host.append(addons.length ? chips : node('p', 'empty-note', 'None installed.'));
    if (!vehicle.installed.length && vehicle.model) host.append(button(`Add the ${vehicle.model}'s starting upgrades`, 'small-button', () => saveVehicle({ installed: vehicleFromModel(kind, vehicle.model).installed })));

    host.append(node('div', 'rule', 'Install an upgrade'));
    const picker = node('div', 'upgrade-picker');
    const hover = book.models[vehicle.model]?.hover;
    for (const [name] of book.upgrades) {
      const next = nextLevel(kind, vehicle.installed, name); if (!next) continue;
      const upgrade = findUpgrade(kind, name);
      const noSlot = next.level === 1 && upgrade.slots > 0 && used + upgrade.slots > vehicle.slots;
      const blocked = upgrade.hoverOnly && !hover;
      const title = `${name}${upgrade.costs.length > 1 ? ` ${levelName(next.level, upgrade.costs.length)}` : ''}`;
      const option = button(title, 'upgrade-option', () => {
        const installed = next.level === 1 ? [...vehicle.installed, { name, level: 1 }] : vehicle.installed.map(item => item.name === name ? { ...item, level: next.level } : item);
        saveVehicle({ installed }, spend(next.cost, `Installed ${title} on ${vehicle.name || `the ${book.label.toLowerCase()}`}`));
      });
      option.disabled = !canAfford(next.cost) || noSlot || blocked;
      option.append(node('span', 'upgrade-cost', `${upgrade.slots ? `${upgrade.slots} slot · ` : ''}${next.cost} CP`));
      const text = blocked ? 'Hover rovers only.' : noSlot ? 'No free slot.' : rule('upgrade', name)?.text || '';
      if (text) option.append(node('em', '', text));
      picker.append(option);
    }
    host.append(picker);

    host.append(node('div', 'rule', 'Cargo'));
    const cargo = node('div', 'cargo');
    const line = node('div', 'row-between');
    const amount = node('input', 'stat-input cargo-amount'); amount.type = 'number'; amount.min = 0; amount.max = 99999; amount.value = vehicle.supply; amount.setAttribute('aria-label', 'Supply aboard');
    amount.addEventListener('change', () => saveVehicle({ supply: Math.max(0, Math.min(99999, Math.trunc(Number(amount.value)) || 0)) }));
    const stepper = node('span', 'stepper');
    stepper.append(button('−', '', () => saveVehicle({ supply: Math.max(0, vehicle.supply - 10) }), 'Unload 10 supply'), button('+', '', () => saveVehicle({ supply: Math.min(99999, vehicle.supply + 10) }), 'Load 10 supply'));
    const count = node('span', 'cargo-count'); count.append(amount, node('span', 'field-hint', ` of ${vehicle.cargoCapacity.toLocaleString()} supply aboard`));
    line.append(count, stepper);
    const bar = node('div', 'cargo-bar'); const fill = node('i'); fill.style.width = `${vehicle.cargoCapacity ? Math.min(100, vehicle.supply / vehicle.cargoCapacity * 100) : 0}%`;
    if (vehicle.supply > vehicle.cargoCapacity) bar.classList.add('over');
    bar.append(fill);
    const notes = node('textarea', 'ink-input'); notes.value = vehicle.cargo; notes.maxLength = 2000; notes.rows = 2; notes.placeholder = 'What else is aboard'; notes.setAttribute('aria-label', 'Cargo notes');
    notes.addEventListener('change', () => saveVehicle({ cargo: notes.value.trim() }));
    cargo.append(line, bar, notes); host.append(cargo);
    if (vehicle.upgrades) {
      const old = node('input', 'ink-input'); old.value = vehicle.upgrades; old.maxLength = 500; old.setAttribute('aria-label', 'Earlier upgrade notes');
      old.addEventListener('change', () => saveVehicle({ upgrades: old.value.trim() }));
      host.append(node('div', 'mini-label', 'Earlier upgrade notes'), old);
    }
  }

  /* Images: the crew emblem and the Bird's portrait */
  function pickImage(slot) { ui.imageSlot = slot; $('crewImageInput').click(); }
  panel.querySelector('[data-crew-image="crew"]').addEventListener('click', () => pickImage('crew'));
  $('crewImageInput').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const slot = ui.imageSlot;
    try {
      if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG, or WebP image under 2 MB.');
      status('Uploading image…', 'saving');
      const response = await fetch(`/api/crew-image?slot=${slot}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error((await response.json()).error || 'Image upload failed');
      crew.images[slot] = true; status('Saved', 'saved'); await load(true);
    } catch (cause) { status(cause.message, 'error'); }
  });
  for (const [id, slot] of [['removeCrewPortrait', 'crew'], ['removeBirdPortrait', 'bird']]) $(id).addEventListener('click', async () => {
    try {
      const response = await fetch(`/api/crew-image?slot=${slot}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not remove the picture');
      delete crew.images[slot]; status('Picture removed.', 'saved'); render();
    } catch (cause) { status(cause.message, 'error'); }
  });

  /* Loading */
  async function load(force = false) {
    if (loading || !active) return;
    if (!force && panel.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')) return;
    loading = true;
    try {
      const data = await request('/api/crew');
      if (force || !crew || data.crew.revision !== crew.revision || JSON.stringify(data.crew.roles) !== JSON.stringify(crew.roles) || JSON.stringify(data.crew.images) !== JSON.stringify(crew.images) || JSON.stringify(data.crew.explorers) !== JSON.stringify(crew.explorers)) { crew = data.crew; render(); }
    } catch (cause) { status(cause.message, 'error'); }
    finally { loading = false; }
  }
  // Called by the side panel whenever the Crew tab becomes visible or hidden.
  function setActive(on) {
    if (on === active) return;
    active = on; clearInterval(timer); timer = null;
    if (!on) { crew = null; ui.tray = null; ui.chooser = null; return; }
    if (!profile()) { active = false; return; }
    status(''); load(true);
    timer = setInterval(() => { if (!document.hidden) load(); }, 4000);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  function setRulesLibrary(entries = []) {
    rules.clear();
    for (const entry of entries) if (['maneuver', 'power', 'control', 'upgrade'].includes(entry.kind)) {
      const value = { kind: entry.kind, key: entry.key, name: entry.name, ...entry.data };
      rules.set(`${entry.kind}:${entry.name.toLowerCase()}`, value);
    }
    if (crew) render();
  }
  return { setActive, close: () => setActive(false), setRulesLibrary };
}
