const $ = id => document.getElementById(id);
const avatar = 'assets/characters/anonymous-explorer.png';
const attributes = ['strength', 'agility', 'logic', 'insight', 'perception', 'empathy'];

export function initChatUI(request, profile, character) {
  let lastId = 0; let timer = null; let loading = false; let first = true;
  const list = $('chatMessages');
  const message = $('chatMessage');
  const controls = $('chatRollControls');
  const toggle = $('chatToggle');

  function identity() {
    const picked = character();
    $('chatIdentity').textContent = picked ? `${picked.name} <${profile()?.name}>` : profile()?.name || '';
    const select = $('chatTalent'); select.replaceChildren(new Option('No talent', ''));
    for (const talent of picked?.sheet?.talents || []) select.add(new Option(`${talent.name} (+${talent.level})`, talent.name));
    $('chatSkillButton').disabled = !picked;
    $('chatSkillButton').title = picked ? '' : 'Select a character to roll an action';
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
    const base = roll.baseDice.join(', '); const gear = roll.gearDice.length ? ` · Gear [${roll.gearDice.join(', ')}]` : '';
    return `${roll.attribute}${roll.talent ? ` + ${roll.talent} (${roll.talentLevel})` : ''}${roll.modifier ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}` : ''} · Base [${base}]${gear} · ${roll.successes} ${roll.successes === 1 ? 'success' : 'successes'}`;
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
      render(data.message); return true;
    } catch (cause) { $('chatStatus').textContent = cause.message; return false; }
  }
  $('chatForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!message.value.trim()) return;
    $('chatSend').disabled = true;
    if (await send({ type: 'text', text: message.value })) message.value = '';
    $('chatSend').disabled = false; message.focus();
  });
  $('chatSimpleButton').addEventListener('click', () => send({ type: 'simple' }));
  $('chatSkillButton').addEventListener('click', () => { controls.hidden = !controls.hidden; });
  $('chatRollForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('chatRollSubmit'); button.disabled = true;
    await send({ type: 'skill', attribute: $('chatAttribute').value, talent: $('chatTalent').value, modifier: Number($('chatModifier').value), gear: Number($('chatGear').value) });
    button.disabled = false;
  });
  toggle.addEventListener('click', () => {
    const open = $('chatContent').hidden;
    $('chatContent').hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide' : 'Show';
    if (open) { poll(); list.scrollTop = list.scrollHeight; }
  });
  $('chatExport').addEventListener('click', async () => {
    const from = $('chatFrom').value; const through = $('chatThrough').value;
    if (!from || !through || from > through) { $('chatStatus').textContent = 'Choose a valid date range.'; return; }
    try {
      const response = await fetch(`/api/chat?export=text&from=${encodeURIComponent(from)}&through=${encodeURIComponent(through)}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error((await response.json()).error || 'Export failed');
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
      link.href = url; link.download = `campaign-chat-${from}-to-${through}.txt`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { $('chatStatus').textContent = cause.message; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  for (const name of attributes) $('chatAttribute').add(new Option(name[0].toUpperCase() + name.slice(1), name));
  const today = new Date().toISOString().slice(0, 10); $('chatFrom').value = today; $('chatThrough').value = today;
  if (matchMedia('(max-width: 700px)').matches) { $('chatContent').hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Show'; }
  return {
    start() { lastId = 0; first = true; list.replaceChildren(); identity(); poll(); clearInterval(timer); timer = setInterval(poll, 2000); },
    stop() { clearInterval(timer); timer = null; lastId = 0; list.replaceChildren(); },
    refreshIdentity: identity
  };
}
