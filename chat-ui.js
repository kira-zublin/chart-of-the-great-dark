import { creatureIcon } from './creature-stats.js';
import { attributes as attributeList, conditionName, penalty } from './explorer-rules.js';

const $ = id => document.getElementById(id);
const avatar = 'assets/characters/anonymous-explorer.png';
const attributes = ['strength', 'agility', 'logic', 'insight', 'perception', 'empathy'];
const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8] };

// Presentation model for a roll card; the dice and their interpretation come from the server.
export function rollCard(roll) {
  if (roll.type === 'simple') return { title: 'Rolled d6', dice: [{ value: roll.dice[0], gear: false }], result: null, costs: '' };
  // A creature's signature attack: base dice, then any Blight dice, with the attack's numbers and rule.
  if (roll.type === 'attack') {
    const result = [roll.baseDice.length ? `${roll.successes} ${roll.successes === 1 ? 'Success' : 'Successes'}` : null, roll.blightDice.length ? `${roll.blightSuccesses} Blight` : null].filter(Boolean).join(' · ');
    return {
      title: `Signature attack ${roll.roll} · ${roll.name}`,
      dice: [...roll.baseDice.map(value => ({ value, gear: false })), ...roll.blightDice.map(value => ({ value, gear: true, blight: true }))],
      result: result || null, costs: roll.summary || '', note: roll.text || '', hits: roll.successes + roll.blightSuccesses
    };
  }
  const attribute = roll.attribute ? roll.attribute[0].toUpperCase() + roll.attribute.slice(1) : 'Dice pool';
  const talent = roll.talent ? ` + ${roll.talent} (${roll.talentLevel})` : '';
  return {
    title: `${roll.type === 'push' ? `Push ${roll.pushCount} · ` : ''}${roll.purpose ? `${roll.purpose} · ` : ''}${attribute}${talent}`,
    dice: [...roll.baseDice.map(value => ({ value, gear: false })), ...roll.gearDice.map(value => ({ value, gear: true }))],
    result: roll.successes ? `${roll.successes} ${roll.successes === 1 ? 'Success' : 'Successes'}` : 'No successes',
    costs: roll.type === 'push' ? `${roll.hopeLoss} Hope loss · ${roll.gearWear} gear wear` : ''
  };
}

function dieFace(die, value) {
  die.classList.toggle('six', value === 6); die.classList.toggle('one', value === 1);
  if (value === 6) { die.innerHTML = '<svg><use href="#die-six"/></svg>'; return; }
  die.replaceChildren(...Array.from({ length: 9 }, (_, index) => {
    const pip = document.createElement('span'); if (pips[value]?.includes(index)) pip.className = 'on'; return pip;
  }));
}

function renderRollCard(body, roll, animate) {
  const card = rollCard(roll);
  body.classList.add('roll-card');
  const summary = document.createElement('span'); summary.className = 'visually-hidden'; summary.textContent = rollText(roll);
  const title = document.createElement('div'); title.className = 'roll-title'; title.setAttribute('aria-hidden', 'true'); title.textContent = card.title;
  const tray = document.createElement('div'); tray.className = 'roll-dice'; tray.setAttribute('aria-hidden', 'true');
  const dice = card.dice.map((entry, index) => {
    if (entry.gear && !card.dice[index - 1]?.gear) tray.append(Object.assign(document.createElement('span'), { className: 'roll-sep' }));
    const die = document.createElement('span'); die.className = `roll-die${entry.gear ? ' gear' : ''}${entry.blight ? ' blight' : ''}`;
    dieFace(die, entry.value); tray.append(die);
    return die;
  });
  body.append(summary, title, tray);
  if (card.result) {
    const result = document.createElement('div'); result.className = 'roll-result'; result.setAttribute('aria-hidden', 'true');
    const total = document.createElement('b'); total.textContent = card.result; if (!(card.hits ?? roll.successes)) total.className = 'none';
    result.append(total);
    if (card.costs) result.append(Object.assign(document.createElement('span'), { className: 'roll-cost', textContent: card.costs }));
    body.append(result);
  } else if (card.costs) body.append(Object.assign(document.createElement('div'), { className: 'roll-result roll-cost', textContent: card.costs }));
  if (card.note) { const note = document.createElement('p'); note.className = 'roll-note'; note.setAttribute('aria-hidden', 'true'); note.textContent = card.note; body.append(note); }
  if (!animate || !document.getElementById('app')?.classList.contains('motion')) return;
  // New rolls tumble in and settle on the server's result.
  dice.forEach((die, index) => {
    const value = card.dice[index].value, spin = (Math.random() < .5 ? -1 : 1) * (180 + Math.random() * 200);
    die.animate([{ transform: `translate(${-22 - Math.random() * 26}px, ${-14 + Math.random() * 8}px) rotate(${spin}deg)`, opacity: 0 }, { opacity: 1, offset: .25 }, { transform: 'none', opacity: 1 }], { duration: 560 + index * 70, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    const tumble = setInterval(() => dieFace(die, 1 + Math.floor(Math.random() * 6)), 70);
    setTimeout(() => { clearInterval(tumble); dieFace(die, value); if (value === 6) die.classList.add('glint'); }, 380 + index * 70);
  });
}

function rollText(roll) {
  if (roll.type === 'simple') return `Rolled d6: ${roll.dice[0]}`;
  if (roll.type === 'attack') return [`Signature attack ${roll.roll}, ${roll.name}`, roll.summary, roll.baseDice.length ? `Base [${roll.baseDice.join(', ')}] · ${roll.successes} ${roll.successes === 1 ? 'success' : 'successes'}` : null, roll.blightDice.length ? `Blight [${roll.blightDice.join(', ')}] · ${roll.blightSuccesses} ${roll.blightSuccesses === 1 ? 'success' : 'successes'}` : null, roll.text].filter(Boolean).join('. ');
  const label = roll.attribute ? `${roll.attribute}${roll.talent ? ` + ${roll.talent} (${roll.talentLevel})` : ''}` : 'dice pool';
  const base = roll.baseDice.join(', '); const gear = roll.gearDice.length ? ` · Gear [${roll.gearDice.join(', ')}]` : '';
  const push = roll.type === 'push' ? `Push ${roll.pushCount}: ` : 'Rolled ';
  const costs = roll.type === 'push' ? ` · ${roll.hopeLoss} Hope loss · ${roll.gearWear} gear wear` : '';
  return `${push}${label} · Base [${base}]${gear} · ${roll.successes} ${roll.successes === 1 ? 'success' : 'successes'}${costs}`;
}

// The picture beside a chat line: a character's portrait, a creature's palette art or category medallion, or the
// anonymous explorer.
export function messageAvatar(item) {
  if (item.creature_image) return `/api/creature-image?id=${encodeURIComponent(item.creature_image)}&slot=portrait&v=${item.creature_image_version}`;
  if (item.creature_category) return creatureIcon(item.creature_category);
  return item.has_portrait && item.character_id ? `/api/image?id=${encodeURIComponent(item.character_id)}&slot=portrait` : avatar;
}

// onMessages(messages, initial) hears every message shown, flagging the first batch of history after sign-in.
export function initChatUI(request, profile, character, onMessages = () => {}) {
  let lastId = 0; let timer = null; let loading = false; let first = true;
  // A placed creature the GM is speaking as ({ id, name }); it takes the place of the selected character.
  let creature = null;
  let lastViewedId = 0; let hasViewedBefore = false;
  let pushId = null; let pushCount = 0; let secondPush = false;
  const list = $('chatMessages');
  const message = $('chatMessage');
  const toggle = $('chatToggle');

  function setUnread(unread) {
    toggle.dataset.unread = String(unread);
    toggle.setAttribute('aria-label', $('chatContent').hidden ? unread ? 'Show chat, new messages' : 'Show chat' : 'Hide chat');
  }
  function markViewed() {
    lastViewedId = Math.max(lastViewedId, lastId);
    if (profile()) localStorage.setItem(`chat-viewed:${profile().id}`, String(lastViewedId));
    hasViewedBefore = true;
    setUnread(false);
  }

  function identity() {
    const picked = creature ? null : character();
    $('chatIdentity').textContent = creature ? `${creature.name} <${profile()?.name}>` : picked ? `${picked.name} <${profile()?.name}>` : profile()?.name || '';
    if (creature) {
      const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'text-button chat-identity-clear'; stop.textContent = 'Stop speaking as creature';
      stop.addEventListener('click', () => speakAs(null));
      $('chatIdentity').append(' ', stop);
    }
    const select = $('chatTalent'); select.replaceChildren(new Option('No talent', ''));
    for (const talent of picked?.sheet?.talents || []) select.add(new Option(`${talent.name} (+${talent.level})`, talent.name));
    $('chatRollType').querySelector('option[value="skill"]').disabled = !picked;
    if (!picked && $('chatRollType').value === 'skill') $('chatRollType').value = 'pool';
    if (picked && $('chatRollType').value === 'skill') $('chatBase').value = suggestedBase();
    updateRollPreview();
  }
  function addText(parent, value) {
    const parts = value.split(/(https?:\/\/[^\s<>]+)/g);
    for (const part of parts) {
      if (/^https?:\/\//.test(part)) {
        const link = document.createElement('a'); link.href = part; link.textContent = part;
        link.target = '_blank'; link.rel = 'noopener noreferrer'; parent.append(link);
      } else parent.append(document.createTextNode(part));
    }
  }
  function render(item) {
    if (list.querySelector(`[data-id="${item.id}"]`)) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const row = document.createElement('article'); row.className = 'chat-entry'; row.dataset.id = item.id;
    const img = document.createElement('img'); img.className = 'chat-avatar'; img.alt = '';
    img.src = messageAvatar(item);
    img.onerror = () => { img.onerror = null; img.src = avatar; };
    const content = document.createElement('div');
    const heading = document.createElement('div'); heading.className = 'chat-entry-head';
    const name = document.createElement('strong'); name.textContent = item.character_name ? `${item.character_name} <${item.player_name}>` : item.player_name;
    const time = document.createElement('time'); time.dateTime = new Date(Number(item.created_at) * 1000).toISOString();
    time.textContent = new Date(Number(item.created_at) * 1000).toLocaleString(); heading.append(name, time);
    const body = document.createElement('div'); body.className = item.kind === 'roll' ? 'chat-roll' : 'chat-body';
    if (item.kind === 'roll') renderRollCard(body, item.roll, !first); else addText(body, item.body);
    content.append(heading, body); row.append(img, content); list.append(row);
    lastId = Math.max(lastId, Number(item.id));
    if (nearBottom || first) list.scrollTop = list.scrollHeight;
  }
  async function poll() {
    if (loading || !profile() || document.hidden) return;
    loading = true;
    try {
      const data = await request(`/api/chat${lastId ? `?after=${lastId}` : ''}`);
      for (const item of data.messages) render(item);
      onMessages(data.messages, first);
      const historyReset = first && lastId < lastViewedId;
      if (historyReset) lastViewedId = lastId;
      if ((first && !hasViewedBefore) || historyReset || !$('chatContent').hidden) markViewed();
      else if (data.messages.some(item => Number(item.id) > lastViewedId && item.player_name !== profile()?.name)) setUnread(true);
      $('chatStatus').textContent = '';
      first = false;
    } catch (cause) { $('chatStatus').textContent = cause.message; }
    finally { loading = false; }
  }
  function speakAs(next) { creature = next ? { id: next.id, name: next.name } : null; identity(); }
  async function send(payload) {
    $('chatStatus').textContent = '';
    const selected = creature ? null : character();
    // A push keeps its roll's speaker, and an attack names its own creature.
    const speaker = payload.type === 'push' || payload.creatureId ? {} : creature ? { creatureId: creature.id } : { characterId: selected?.id || null };
    try {
      const data = await request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...speaker }) });
      render(data.message); onMessages([data.message], false); if (!$('chatContent').hidden) markViewed(); return data.message;
    } catch (cause) {
      // A removed creature can no longer speak.
      if (creature && cause.message === 'Creature unavailable') speakAs(null);
      $('chatStatus').textContent = cause.message; return null;
    }
  }
  $('chatForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!message.value.trim()) return;
    $('chatSend').disabled = true;
    if (await send({ type: 'text', text: message.value })) message.value = '';
    $('chatSend').disabled = false; message.focus();
  });
  const rollDialog = $('chatRollDialog'); const exportDialog = $('chatExportDialog');
  const rollMode = $('chatRollType');
  function suggestedBase() {
    const picked = character();
    const talent = picked?.sheet?.talents?.find(item => item.name === $('chatTalent').value);
    const attribute = $('chatAttribute').value;
    // A condition takes 2 dice from the attribute it weakens.
    return Math.max(1, Math.min(30, Number(picked?.attributes?.[attribute] || 0) + Number(talent?.level || 0) - penalty(picked?.sheet?.conditions || [], attribute)));
  }
  function updateRollPreview() {
    const skill = rollMode.value === 'skill';
    $('chatSkillFields').hidden = !skill;
    const base = Number($('chatBase').value); const gear = Number($('chatGear').value);
    const weakened = skill ? attributeList.find(item => item.key === $('chatAttribute').value && penalty(character()?.sheet?.conditions || [], item.key)) : null;
    $('chatRollPreview').textContent = Number.isInteger(base) && Number.isInteger(gear) ? `Roll ${base} base dice and ${gear} gear dice.${weakened ? ` ${conditionName(weakened.condition)}: −2 ${weakened.name}.` : ''}` : '';
  }
  rollMode.addEventListener('change', () => { if (rollMode.value === 'skill') $('chatBase').value = suggestedBase(); updateRollPreview(); });
  for (const id of ['chatAttribute', 'chatTalent']) $(id).addEventListener('change', () => { if (rollMode.value === 'skill') $('chatBase').value = suggestedBase(); updateRollPreview(); });
  for (const id of ['chatBase', 'chatGear']) $(id).addEventListener('input', updateRollPreview);
  $('chatRollOpen').addEventListener('click', () => { identity(); rollDialog.showModal(); });
  $('chatRollClose').addEventListener('click', () => rollDialog.close());
  $('chatExportOpen').addEventListener('click', () => exportDialog.showModal());
  $('chatExportClose').addEventListener('click', () => exportDialog.close());
  $('chatRollForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('chatRollSubmit'); button.disabled = true; $('chatRollStatus').textContent = '';
    const shared = { base: Number($('chatBase').value), gear: Number($('chatGear').value) };
    const payload = rollMode.value === 'skill' ? { type: 'skill', attribute: $('chatAttribute').value, talent: $('chatTalent').value, ...shared } : { type: 'pool', ...shared };
    const result = await send(payload);
    if (result) {
      pushId = result.id; pushCount = 0;
      secondPush = payload.type === 'skill' && payload.attribute === 'empathy' && (character()?.sheet?.talents || []).some(item => item.name === 'Renowned');
      $('chatPush').hidden = false; $('chatRollResult').textContent = rollText(result.roll);
    } else $('chatRollStatus').textContent = $('chatStatus').textContent;
    button.disabled = false;
  });
  $('chatPush').addEventListener('click', async () => {
    if (!pushId) return;
    const button = $('chatPush'); button.disabled = true; $('chatRollStatus').textContent = '';
    const result = await send({ type: 'push', messageId: pushId });
    if (result) {
      pushId = result.id; pushCount = result.roll.pushCount;
      button.hidden = pushCount >= (secondPush ? 2 : 1);
      $('chatRollResult').textContent += `\n${rollText(result.roll)}`;
    } else $('chatRollStatus').textContent = $('chatStatus').textContent;
    button.disabled = false;
  });
  toggle.addEventListener('click', () => {
    const open = $('chatContent').hidden;
    $('chatContent').hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide' : 'Show';
    if (open) { markViewed(); poll(); list.scrollTop = list.scrollHeight; }
    else setUnread(false);
  });
  $('chatExportForm').addEventListener('submit', async event => {
    event.preventDefault();
    const from = $('chatFrom').value; const through = $('chatThrough').value;
    if (!from || !through || from > through) { $('chatExportStatus').textContent = 'Choose a valid date range.'; return; }
    const button = $('chatExport'); button.disabled = true; $('chatExportStatus').textContent = '';
    try {
      const response = await fetch(`/api/chat?export=text&from=${encodeURIComponent(from)}&through=${encodeURIComponent(through)}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error((await response.json()).error || 'Export failed');
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
      link.href = url; link.download = `campaign-chat-${from}-to-${through}.txt`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      exportDialog.close();
    } catch (cause) { $('chatExportStatus').textContent = cause.message; }
    finally { button.disabled = false; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  for (const name of attributes) $('chatAttribute').add(new Option(name[0].toUpperCase() + name.slice(1), name));
  const today = new Date().toISOString().slice(0, 10); $('chatFrom').value = today; $('chatThrough').value = today;
  const dock = $('chatDock'); const resize = $('chatResize');
  const savedHeight = Number(localStorage.getItem('campaignChatHeight'));
  function setHeight(value) {
    const height = Math.max(170, Math.min(Math.round(window.innerHeight * .85), Math.round(value)));
    dock.style.setProperty('--chat-height', `${height}px`); resize.setAttribute('aria-valuenow', String(height));
    localStorage.setItem('campaignChatHeight', String(height));
  }
  if (savedHeight) setHeight(savedHeight);
  resize.addEventListener('pointerdown', event => {
    const startY = event.clientY; const startHeight = dock.getBoundingClientRect().height;
    resize.setPointerCapture(event.pointerId);
    const move = next => setHeight(startHeight + startY - next.clientY);
    const onMove = next => move(next);
    const end = () => { resize.removeEventListener('pointermove', onMove); resize.removeEventListener('pointerup', end); resize.removeEventListener('pointercancel', end); };
    resize.addEventListener('pointermove', onMove); resize.addEventListener('pointerup', end); resize.addEventListener('pointercancel', end);
  });
  resize.addEventListener('keydown', event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setHeight(dock.getBoundingClientRect().height + (event.key === 'ArrowUp' ? 24 : -24)); } });
  return {
    start() { lastId = 0; first = true; const saved = localStorage.getItem(`chat-viewed:${profile().id}`); hasViewedBefore = saved !== null; lastViewedId = Math.max(0, Number(saved) || 0); $('chatContent').hidden = true; toggle.textContent = 'Show'; toggle.setAttribute('aria-expanded', 'false'); setUnread(false); list.replaceChildren(); identity(); poll(); clearInterval(timer); timer = setInterval(poll, 2000); },
    stop() { clearInterval(timer); timer = null; lastId = 0; creature = null; pushId = null; pushCount = 0; secondPush = false; $('chatPush').hidden = true; $('chatRollResult').textContent = ''; list.replaceChildren(); rollDialog.close(); exportDialog.close(); },
    refreshIdentity: identity,
    // Rolls for the crew sheet (commanding the Bird, losing control), posted like any other roll.
    // Each resolves to the chat message, or null with the reason shown in chat.
    rollFor: payload => send({ gear: 0, ...payload }),
    push: messageId => send({ type: 'push', messageId }),
    // Opens the roll window for an attribute of the selected character, from the sheet.
    rollAttribute(attribute, talent = '') {
      identity(); rollMode.value = 'skill'; $('chatAttribute').value = attribute;
      $('chatTalent').value = [...$('chatTalent').options].some(option => option.value === talent) ? talent : '';
      $('chatGear').value = 0; $('chatBase').value = suggestedBase();
      pushId = null; $('chatPush').hidden = true; $('chatRollResult').textContent = ''; $('chatRollStatus').textContent = '';
      updateRollPreview(); if (!rollDialog.open) rollDialog.showModal();
    },
    speakAs,
    speakingAs: () => creature?.id || null,
    // Posts a placed creature's signature attack (chosen by the GM) with its dice rolled on the server.
    async attack(creatureId, roll) {
      const sent = await send({ type: 'attack', creatureId, attack: roll });
      if (!sent) throw new Error($('chatStatus').textContent || 'The attack could not be sent.');
      return sent;
    }
  };
}
