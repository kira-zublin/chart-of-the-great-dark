import { collectSheet, renderSheet, setSheetDirtyHandler, setSheetTab } from './sheet-ui.js';
import { initCrewUI } from './crew-ui.js';
import { initChatUI } from './chat-ui.js';
import { initWorldUI } from './world-ui.js';
import { initSidePanel } from './side-panel.js';
const $ = id => document.getElementById(id);
$('mapStage').append(document.querySelector('.hud'));
const state = { profile: null, characters: [], selected: null, registering: false };
const stats = ['strength', 'agility', 'logic', 'insight', 'perception', 'empathy'];
let characterDirty = false;
setSheetDirtyHandler(() => { characterDirty = true; });
$('characterForm').addEventListener('input', () => { characterDirty = true; });
$('characterForm').addEventListener('change', () => { characterDirty = true; });
const crewUI = initCrewUI(request, () => state.profile);
const sidePanel = initSidePanel({
  isGM: () => state.profile?.role === 'gm',
  canClose: confirmDiscard,
  onChange: tab => crewUI.setActive(tab === 'Crew')
});
const chatUI = initChatUI(request, () => state.profile, () => {
  const id = state.selected?.id || (state.profile && localStorage.getItem(`active-character:${state.profile.id}`));
  return state.characters.find(item => item.id === id) || null;
});
const worldUI = initWorldUI(request, () => state.profile, () => {
  const id = state.selected?.id || (state.profile && localStorage.getItem(`active-character:${state.profile.id}`));
  return state.characters.find(item => item.id === id && item.kind === 'pc') || null;
});

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function setError(id, message = '') { $(id).textContent = message; }
function showApp(profile) {
  state.profile = profile;
  $('loginScreen').hidden = Boolean(profile);
  $('mapStage').hidden = !profile;
  document.body.classList.toggle('signed-in', Boolean(profile));
  $('chatDock').hidden = !profile;
  if (profile) {
    $('accountButton').textContent = profile.name + ' ▾';
    $('accountRole').textContent = profile.role === 'gm' ? 'Game Master' : 'Player';
    $('filterRow').hidden = profile.role !== 'gm';
    $('characterKindRow').hidden = profile.role !== 'gm';
    sidePanel.setRole();
    loadCharacters();
    chatUI.start();
    worldUI.start();
  } else {
    chatUI.stop();
    worldUI.stop();
    state.characters = []; state.selected = null;
    characterDirty = false; showEditor(false); sidePanel.hide();
    $('accountMenu').hidden = true;
    $('characterMenu').hidden = true;
  }
}
function toggleMenu(button, menu) {
  const open = menu.hidden;
  $('accountMenu').hidden = true; $('characterMenu').hidden = true;
  $('accountButton').setAttribute('aria-expanded', 'false');
  $('characterButton').setAttribute('aria-expanded', 'false');
  menu.hidden = !open; button.setAttribute('aria-expanded', String(open));
}
function registerMode(on) {
  state.registering = on;
  $('inviteRow').hidden = !on; $('roleRow').hidden = !on;
  $('authInvite').required = on;
  $('authPassword').autocomplete = on ? 'new-password' : 'current-password';
  $('authSubmit').textContent = on ? 'Create profile' : 'Sign in';
  $('authToggle').textContent = on ? 'Already have a profile? Sign in' : 'Create a profile';
  $('authLead').textContent = on ? 'Create your profile to join the expedition.' : 'Sign in to open your chart.';
  setError('authMessage');
}
$('authToggle').addEventListener('click', () => registerMode(!state.registering));
$('authForm').addEventListener('submit', async event => {
  event.preventDefault(); setError('authMessage');
  const button = $('authSubmit'); button.disabled = true;
  try {
    const data = await request('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: state.registering ? 'register' : 'login', name: $('authName').value, password: $('authPassword').value, inviteCode: $('authInvite').value, role: $('authRole').value }) });
    $('authPassword').value = ''; $('authInvite').value = '';
    showApp(data.profile);
  } catch (cause) { setError('authMessage', cause.message); }
  finally { button.disabled = false; }
});
$('accountButton').addEventListener('click', () => toggleMenu($('accountButton'), $('accountMenu')));
$('characterButton').addEventListener('click', () => toggleMenu($('characterButton'), $('characterMenu')));
$('logoutButton').addEventListener('click', async () => {
  try { await request('/api/auth', { method: 'DELETE' }); showApp(null); }
  catch (cause) { alert(cause.message); }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.account-wrap')) { $('accountMenu').hidden = true; $('accountButton').setAttribute('aria-expanded', 'false'); }
  if (!event.target.closest('.character-wrap')) { $('characterMenu').hidden = true; $('characterButton').setAttribute('aria-expanded', 'false'); }
});

async function loadCharacters() {
  try {
    const filter = state.profile.role === 'gm' ? $('characterFilter').value : 'all';
    const data = await request('/api/characters' + (filter === 'all' ? '' : `?kind=${filter}`));
    state.characters = data.characters;
    renderList();
    chatUI.refreshIdentity();
    worldUI.characterChanged();
    const remembered = localStorage.getItem(`active-character:${state.profile.id}`);
    const active = state.characters.find(item => item.id === remembered);
    if (active && !state.selected) $('characterButton').textContent = active.name;
  } catch (cause) { $('characterList').textContent = cause.message; }
}
function renderList() {
  const list = $('characterList'); list.replaceChildren();
  const none = document.createElement('button'); none.type = 'button'; none.textContent = 'No active character';
  none.addEventListener('click', () => {
    if (!confirmDiscard()) return;
    state.selected = null; showEditor(false);
    localStorage.removeItem(`active-character:${state.profile.id}`);
    $('characterMenu').hidden = true;
    $('characterButton').textContent = 'Select character'; chatUI.refreshIdentity();
    worldUI.characterChanged();
  });
  list.append(none);
  if (!state.characters.length) {
    const empty = document.createElement('div'); empty.className = 'menu-note'; empty.textContent = 'No characters in this view yet.'; list.append(empty);
  }
  for (const character of state.characters) {
    const row = document.createElement('div'); row.className = 'menu-row';
    const pick = document.createElement('button'); pick.type = 'button';
    pick.textContent = `${character.name}${state.profile.role === 'gm' ? ` · ${character.kind.toUpperCase()} · ${character.owner_name}` : ''}`;
    pick.addEventListener('click', () => editCharacter(character));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-character'; remove.textContent = '×'; remove.setAttribute('aria-label', `Delete ${character.name}`);
    remove.addEventListener('click', () => deleteCharacter(character));
    row.append(pick, remove); list.append(row);
  }
}
$('characterFilter').addEventListener('change', loadCharacters);
async function deleteCharacter(character) {
  if (!confirm(`Delete ${character.name}? This permanently removes the character and both images.`)) return;
  if (state.selected?.id === character.id && characterDirty && !confirm('Discard unsaved character changes?')) return;
  if (state.selected?.id === character.id) characterDirty = false;
  try {
    await request(`/api/characters?id=${encodeURIComponent(character.id)}`, { method: 'DELETE' });
    if (localStorage.getItem(`active-character:${state.profile.id}`) === character.id) localStorage.removeItem(`active-character:${state.profile.id}`);
    if (state.selected?.id === character.id) { state.selected = null; showEditor(false); }
    $('characterButton').textContent = 'Select character';
    await loadCharacters();
  } catch (cause) { alert(cause.message); }
}
function imageUrl(id, slot) { return `/api/image?id=${encodeURIComponent(id)}&slot=${slot}&v=${Date.now()}`; }
function showPreview(slot, character) {
  const img = $(slot === 'portrait' ? 'portraitPreview' : 'standupPreview');
  const has = character && (slot === 'portrait' ? character.has_portrait : character.has_standup);
  img.hidden = !has; img.src = has ? imageUrl(character.id, slot) : '';
}
// The Characters tab shows either the editor (an existing or new character) or an empty state.
function showEditor(on) {
  $('characterEditor').hidden = !on; $('characterEmpty').hidden = on;
  if (!on) $('characterHeading').textContent = 'No character open';
}
function confirmDiscard() {
  if (!characterDirty) return true;
  if (!confirm('Discard unsaved character changes?')) return false;
  characterDirty = false;
  if (state.selected) fillCharacter(state.selected); else showEditor(false);
  return true;
}
function editCharacter(character = null) {
  if (!confirmDiscard()) return;
  state.selected = character;
  if (character) localStorage.setItem(`active-character:${state.profile.id}`, character.id);
  chatUI.refreshIdentity();
  worldUI.characterChanged();
  $('characterMenu').hidden = true;
  $('characterButton').setAttribute('aria-expanded', 'false');
  showEditor(true); fillCharacter(character);
  sidePanel.open('Characters');
  setError('characterMessage'); $('characterName').focus();
}
function fillCharacter(character) {
  $('characterHeading').textContent = character ? character.name : 'New character';
  $('characterButton').textContent = character ? character.name : 'Select character';
  $('characterName').value = character?.name || '';
  $('characterKind').value = character?.kind || 'pc';
  for (const key of ['profession', 'origin', 'faction', 'appearance', 'motivation', 'description']) {
    $(`character${key[0].toUpperCase()}${key.slice(1)}`).value = character?.[key] || '';
  }
  for (const stat of stats) $(`stat${stat[0].toUpperCase()}${stat.slice(1)}`).value = character?.attributes?.[stat] ?? 4;
  renderSheet(character?.sheet, character?.attributes);
  $('characterPortrait').value = ''; $('characterStandup').value = '';
  showPreview('portrait', character); showPreview('standup', character);
  characterDirty = false;
}
$('createCharacter').addEventListener('click', () => editCharacter());
$('panelCreateCharacter').addEventListener('click', () => editCharacter());
$('cancelCharacter').addEventListener('click', () => sidePanel.close());
$('openCrew').addEventListener('click', () => { if (state.profile) sidePanel.toggle('Crew'); });
$('openGMTools').addEventListener('click', () => { if (state.profile?.role === 'gm') sidePanel.toggle('Mapping'); });
for (const slot of ['portrait', 'standup']) {
  const input = $(slot === 'portrait' ? 'characterPortrait' : 'characterStandup');
  input.addEventListener('change', () => {
    const file = input.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('characterMessage', 'Use a JPEG, PNG, or WebP image under 2 MB.'); input.value = ''; return; }
    const img = $(slot === 'portrait' ? 'portraitPreview' : 'standupPreview');
    img.src = URL.createObjectURL(file); img.hidden = false;
  });
}
$('characterForm').addEventListener('submit', async event => {
  event.preventDefault(); setError('characterMessage');
  const save = $('saveCharacter'); save.disabled = true;
  const payload = { id: state.selected?.id, kind: state.profile.role === 'gm' ? $('characterKind').value : 'pc', name: $('characterName').value, attributes: {}, sheet: collectSheet() };
  if (!payload.name.trim()) { setSheetTab('Profile'); setError('characterMessage', 'Enter a character name.'); save.disabled = false; return; }
  for (const key of ['profession', 'origin', 'faction', 'appearance', 'motivation', 'description']) payload[key] = $(`character${key[0].toUpperCase()}${key.slice(1)}`).value;
  for (const stat of stats) payload.attributes[stat] = Number($(`stat${stat[0].toUpperCase()}${stat.slice(1)}`).value);
  try {
    const method = state.selected ? 'PUT' : 'POST';
    const saved = await request('/api/characters', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const id = payload.id || saved.id;
    for (const [slot, inputId] of [['portrait', 'characterPortrait'], ['standup', 'characterStandup']]) {
      const file = $(inputId).files[0]; if (!file) continue;
      await request(`/api/image?id=${encodeURIComponent(id)}&slot=${slot}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    }
    await loadCharacters();
    const character = state.characters.find(item => item.id === id);
    characterDirty = false;
    if (character) editCharacter(character);
    setError('characterMessage', 'Character saved.');
  } catch (cause) { setError('characterMessage', cause.message); }
  finally { save.disabled = false; }
});

try {
  const session = await request('/api/auth');
  showApp(session.profile);
} catch (cause) { setError('authMessage', cause.message); }
