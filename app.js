import { collectCharacter, renderCharacter, setSheetHandlers, setSheetImage, setSheetTab } from './sheet-ui.js';
import { initCrewUI } from './crew-ui.js';
import { initChatUI } from './chat-ui.js';
import { initWorldUI } from './world-ui.js';
import { initSidePanel } from './side-panel.js';
import { initJukeboxUI } from './jukebox-ui.js';
import { initStarChart } from './star-chart.js';
import { initVistaDialog } from './vista-dialog.js';
import { initCreatureUI } from './creature-ui.js';
const $ = id => document.getElementById(id);
$('mapStage').append(document.querySelector('.hud'));
initStarChart();
const state = { profile: null, characters: [], selected: null, registering: false };
// The sheet saves itself: each change schedules a save of the whole character shortly after.
// characterDirty means there are changes the server doesn't have yet.
let characterDirty = false;
let saveTimer = null, saveQueue = Promise.resolve(), inFlight = 0, changeCount = 0;
const pendingImages = {};
setSheetHandlers({ change: sheetChanged, roll: rollFromSheet, image: chooseImage });
const crewUI = initCrewUI(request, () => state.profile);
const jukeboxUI = initJukeboxUI(request, () => state.profile);
const creatureUI = initCreatureUI(request, {
  place: id => worldUI.placeCreature(id), drag: template => worldUI.paletteDrag(template),
  update: (id, values) => worldUI.updateCreature(id, values), stats: (id, values) => worldUI.creatureStats(id, values),
  remove: id => worldUI.removeCreature(id), select: id => worldUI.selectCreature(id),
  attack: (id, roll) => chatUI.attack(id, roll), speakAs: creature => chatUI.speakAs(creature), speakingAs: () => chatUI.speakingAs()
});
const sidePanel = initSidePanel({
  isGM: () => state.profile?.role === 'gm',
  canClose: confirmDiscard,
  onChange: tab => { crewUI.setActive(tab === 'Crew'); creatureUI.setActive(tab === 'Creatures'); }
});
const vistaDialog = initVistaDialog(() => state.profile);
const chatUI = initChatUI(request, () => state.profile, () => {
  const id = state.selected?.id || (state.profile && localStorage.getItem(`active-character:${state.profile.id}`));
  return state.characters.find(item => item.id === id) || null;
}, vistaDialog.receive);
const worldUI = initWorldUI(request, () => state.profile, () => {
  const id = state.selected?.id || (state.profile && localStorage.getItem(`active-character:${state.profile.id}`));
  return state.characters.find(item => item.id === id && item.kind === 'pc') || null;
}, vistaDialog.setScene, {
  onArea: area => creatureUI.setArea(area),
  open: id => { sidePanel.open('Creatures'); creatureUI.openPlaced(id); },
  speakAs: creature => chatUI.speakAs(creature)
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
    jukeboxUI.start();
  } else {
    chatUI.stop();
    worldUI.stop();
    vistaDialog.reset();
    jukeboxUI.stop();
    creatureUI.reset();
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
  try { if (saveTimer) await saveCharacter(); await request('/api/auth', { method: 'DELETE' }); showApp(null); }
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
const imageSlots = ['portrait', 'standup', 'delve_suit'];
function showImages(character) {
  for (const slot of imageSlots) setSheetImage(slot, character?.[`has_${slot}`] ? imageUrl(character.id, slot) : null);
}
function saveStatus(message = '', kind = '') { const status = $('characterMessage'); status.textContent = message; status.dataset.state = kind; }
// The Characters tab shows either the editor (an existing or new character) or an empty state.
function showEditor(on) { $('characterEditor').hidden = !on; $('characterEmpty').hidden = on; }
function payloadFor(data) {
  return { kind: state.profile.role === 'gm' ? data.kind : 'pc', name: data.name, profession: data.profession, origin: data.origin, faction: data.faction, appearance: data.appearance, motivation: data.motivation, description: data.description, attributes: data.attributes, sheet: data.sheet };
}
// Keeps the loaded copies of a character in step with the sheet, so chat rolls see its conditions and talents.
function syncLocal(id, values) {
  for (const item of new Set([state.selected, ...state.characters])) if (item?.id === id) Object.assign(item, values);
}
function sheetChanged() {
  characterDirty = true; changeCount += 1;
  if (!state.selected) return; // a new character is saved with Create character
  saveStatus('Saving…', 'saving');
  clearTimeout(saveTimer); saveTimer = setTimeout(saveCharacter, 800);
}
// Saves are queued in order; each carries the sheet as it was when the save was asked for.
function saveCharacter() {
  clearTimeout(saveTimer); saveTimer = null;
  const target = state.selected; if (!target) return saveQueue;
  const data = collectCharacter(); const version = changeCount;
  if (!data.name) { saveStatus('Enter a character name to save your changes.', 'error'); return saveQueue; }
  inFlight += 1;
  saveQueue = saveQueue.then(async () => {
    try {
      const values = payloadFor(data); const renamed = target.name !== values.name;
      await request('/api/characters', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: target.id, ...values }) });
      syncLocal(target.id, values);
      if (state.selected?.id === target.id && version === changeCount) { characterDirty = false; saveStatus('Saved', 'saved'); }
      if (renamed) { renderList(); if (state.selected?.id === target.id) $('characterButton').textContent = values.name; worldUI.characterChanged(); }
      chatUI.refreshIdentity();
    } catch (cause) { if (state.selected?.id === target.id) saveStatus(`Not saved: ${cause.message}`, 'error'); }
    finally { inFlight -= 1; }
  });
  return saveQueue;
}
function confirmDiscard() {
  if (saveTimer) { saveCharacter(); characterDirty = false; return true; }
  if (!characterDirty || inFlight) return true;
  if (!confirm('Discard unsaved character changes?')) return false;
  characterDirty = false;
  if (state.selected) fillCharacter(state.selected); else showEditor(false);
  return true;
}
function rollFromSheet(attribute) {
  if (!state.selected) { saveStatus('Create the character first to roll from the sheet.', 'error'); return; }
  syncLocal(state.selected.id, payloadFor(collectCharacter()));
  chatUI.rollAttribute(attribute);
}
async function chooseImage(slot, file) {
  if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { saveStatus('Use a JPEG, PNG, or WebP image under 2 MB.', 'error'); return; }
  setSheetImage(slot, URL.createObjectURL(file));
  const target = state.selected;
  if (!target) { pendingImages[slot] = file; return; }
  saveStatus('Uploading image…', 'saving');
  try {
    await request(`/api/image?id=${encodeURIComponent(target.id)}&slot=${slot}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    syncLocal(target.id, { [`has_${slot}`]: true });
    if (state.selected?.id === target.id) saveStatus('Saved', 'saved');
    worldUI.characterChanged(); chatUI.refreshIdentity();
  } catch (cause) {
    if (state.selected?.id !== target.id) return;
    saveStatus(`Image not saved: ${cause.message}`, 'error'); showImages(target);
  }
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
  if (!character) $('characterName').focus();
}
function fillCharacter(character) {
  $('characterButton').textContent = character ? character.name : 'Select character';
  for (const slot of Object.keys(pendingImages)) delete pendingImages[slot];
  renderCharacter(character); showImages(character);
  $('saveCharacter').hidden = Boolean(character);
  saveStatus(character ? 'Saved' : '', character ? 'saved' : '');
  characterDirty = false;
}
$('createCharacter').addEventListener('click', () => editCharacter());
$('panelCreateCharacter').addEventListener('click', () => editCharacter());
$('cancelCharacter').addEventListener('click', () => sidePanel.close());
$('openCrew').addEventListener('click', () => { if (state.profile) sidePanel.toggle('Crew'); });
$('openGMTools').addEventListener('click', () => { if (state.profile?.role === 'gm') sidePanel.toggle('Mapping'); });
$('characterForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.selected) { saveCharacter(); return; }
  const data = collectCharacter();
  if (!data.name) { setSheetTab('Profile'); saveStatus('Enter a character name.', 'error'); $('characterName').focus(); return; }
  const save = $('saveCharacter'); save.disabled = true; saveStatus('Creating…', 'saving');
  try {
    const created = await request('/api/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadFor(data)) });
    for (const [slot, file] of Object.entries(pendingImages)) {
      await request(`/api/image?id=${encodeURIComponent(created.id)}&slot=${slot}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    }
    await loadCharacters();
    const character = state.characters.find(item => item.id === created.id);
    characterDirty = false;
    if (character) editCharacter(character);
    saveStatus('Character created.', 'saved');
  } catch (cause) { saveStatus(cause.message, 'error'); }
  finally { save.disabled = false; }
});

try {
  const session = await request('/api/auth');
  showApp(session.profile);
} catch (cause) { setError('authMessage', cause.message); }
