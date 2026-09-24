const $ = id => document.getElementById(id);
const avatar = 'assets/characters/anonymous-explorer.png';
const attributes = ['strength', 'agility', 'logic', 'insight', 'perception', 'empathy'];

export function initChatUI(request, profile, character) {
  let lastId = 0; let timer = null; let loading = false; let first = true;
  let pushId = null; let pushCount = 0; let secondPush = false;
  const list = $('chatMessages');
  const message = $('chatMessage');
  const toggle = $('chatToggle');

  function identity() {
    const picked = character();
    $('chatIdentity').textContent = picked ? `${picked.name} <${profile()?.name}>` : profile()?.name || '';
    const select = $('chatTalent'); select.replaceChildren(new Option('No talent', ''));
    for (const talent of picked?.sheet?.talents || []) select.add(new Option(`${talent.name} (+${talent.level})`, talent.name));
    $('chatRollType').querySelector('option[value="skill"]').disabled = !picked;
    if (!picked && $('chatRollType').value === 'skill') $('chatRollType').value = 'pool';
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
  function rollText(roll) {
    if (roll.type === 'simple') return `Rolled d6: ${roll.dice[0]}`;
    const label = roll.attribute ? `${roll.attribute}${roll.talent ? ` + ${roll.talent} (${roll.talentLevel})` : ''}` : 'dice pool';
    const base = roll.baseDice.join(', '); const gear = roll.gearDice.length ? ` · Gear [${roll.gearDice.join(', ')}]` : '';
    const push = roll.type === 'push' ? `Push ${roll.pushCount}: ` : 'Rolled ';
    const costs = roll.type === 'push' ? ` · ${roll.hopeLoss} Hope loss · ${roll.gearWear} gear wear` : '';
    return `${push}${label} · Base [${base}]${gear} · ${roll.successes} ${roll.successes === 1 ? 'success' : 'successes'}${costs}`;
  }
  function render(item) {
    if (list.querySelector(`[data-id="${item.id}"]`)) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const row = document.createElement('article'); row.className = 'chat-entry'; row.dataset.id = item.id;
    const img = document.createElement('img'); img.className = 'chat-avatar'; img.alt = '';
    img.src = item.has_portrait && item.character_id ? `/api/image?id=${encodeURIComponent(item.character_id)}&slot=portrait` : avatar;
    img.onerror = () => { img.onerror = null; img.src = avatar; };
    const content = document.createElement('div');
    const heading = document.createElement('div'); heading.className = 'chat-entry-head';
    const name = document.createElement('strong'); name.textContent = item.character_name ? `${item.character_name} <${item.player_name}>` : item.player_name;
    const time = document.createElement('time'); time.dateTime = new Date(Number(item.created_at) * 1000).toISOString();
    time.textContent = new Date(Number(item.created_at) * 1000).toLocaleString(); heading.append(name, time);
    const body = document.createElement('div'); body.className = item.kind === 'roll' ? 'chat-roll' : 'chat-body';
    if (item.kind === 'roll') body.textContent = rollText(item.roll); else addText(body, item.body);
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
      $('chatStatus').textContent = '';
      first = false;
    } catch (cause) { $('chatStatus').textContent = cause.message; }
    finally { loading = false; }
  }
  async function send(payload) {
    $('chatStatus').textContent = '';
    const selected = character();
    try {
      const data = await request('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, characterId: selected?.id || null }) });
      render(data.message); return data.message;
    } catch (cause) { $('chatStatus').textContent = cause.message; return null; }
  }
  $('chatForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!message.value.trim()) return;
    $('chatSend').disabled = true;
    if (await send({ type: 'text', text: message.value })) message.value = '';
    $('chatSend').disabled = false; message.focus();
  });
  const rollDialog = $('chatRollDialog'); const exportDialog = $('chatExportDialog');
  const rollMode = $('chatRollType');
  function updateRollPreview() {
    const skill = rollMode.value === 'skill';
    $('chatPoolFields').hidden = skill; $('chatSkillFields').hidden = !skill;
    const picked = character();
    const talent = picked?.sheet?.talents?.find(item => item.name === $('chatTalent').value);
    const base = skill ? Number(picked?.attributes?.[$('chatAttribute').value] || 0) + Number(talent?.level || 0) : Number($('chatBase').value);
    const modifier = Number($('chatModifier').value); const gear = Number($('chatGear').value);
    $('chatRollPreview').textContent = Number.isFinite(base + modifier + gear) ? `Roll ${Math.max(1, Math.min(30, base + modifier))} base dice and ${gear} gear dice. Modifier changes base dice only.` : '';
  }
  for (const id of ['chatRollType', 'chatBase', 'chatAttribute', 'chatTalent', 'chatModifier', 'chatGear']) $(''+id).addEventListener('input', updateRollPreview);
  $('chatRollOpen').addEventListener('click', () => { identity(); rollDialog.showModal(); });
  $('chatRollClose').addEventListener('click', () => rollDialog.close());
  $('chatExportOpen').addEventListener('click', () => exportDialog.showModal());
  $('chatExportClose').addEventListener('click', () => exportDialog.close());
  $('chatRollForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('chatRollSubmit'); button.disabled = true; $('chatRollStatus').textContent = '';
    const shared = { modifier: Number($('chatModifier').value), gear: Number($('chatGear').value) };
    const payload = rollMode.value === 'skill' ? { type: 'skill', attribute: $('chatAttribute').value, talent: $('chatTalent').value, ...shared } : { type: 'pool', base: Number($('chatBase').value), ...shared };
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
    if (open) { poll(); list.scrollTop = list.scrollHeight; }
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
  if (matchMedia('(max-width: 700px)').matches) { $('chatContent').hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Show'; }
  return {
    start() { lastId = 0; first = true; list.replaceChildren(); identity(); poll(); clearInterval(timer); timer = setInterval(poll, 2000); },
    stop() { clearInterval(timer); timer = null; lastId = 0; list.replaceChildren(); rollDialog.close(); exportDialog.close(); },
    refreshIdentity: identity
  };
}
