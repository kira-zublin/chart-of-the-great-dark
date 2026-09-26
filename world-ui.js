const $ = id => document.getElementById(id);
const node = (tag, className = '', content = '') => { const el = document.createElement(tag); if (className) el.className = className; if (content) el.textContent = content; return el; };
const button = (label, action, className = '') => { const el = node('button', className, label); el.type = 'button'; el.addEventListener('click', action); return el; };
const field = (label, input) => { const wrapper = node('label'); wrapper.append(label, input); return wrapper; };
const kindName = kind => ({ star: 'Star Chart', settlement: 'Hub', delve: 'Explorable', diorama: 'Vista', poi: 'Point of interest' })[kind] || kind;
const sampleArt = {
  'ship-city': 'assets/ship-city-map.jpg',
  chasm: 'assets/chasm-map.png',
  'aluminum-bay': 'assets/aluminum-bay-map.png',
  'bazaar-bizarre': 'assets/bazaar-bizarre-scene.png',
  'bird-market': 'assets/bird-market-scene.png',
  'vermilion-house': 'assets/vermilion-house-scene.png',
  'lost-garuda': 'assets/lost-garuda-scene.png',
  'lotus-ring': 'assets/lotus-ring-scene.png',
  'warehouse-nine': 'assets/warehouse-nine-scene.png',
  'astrolaab-tower': 'assets/astrolaab-tower-scene.png',
  'warehouse-murk': 'assets/warehouse-murk-map.png',
  dockside: 'assets/dio-marketplace.png',
  choir: 'assets/choir-below-map.png',
  'choir-depths': 'assets/choir-depths-map.png'
};
const locationArt = item => item.has_image
  ? `/api/location-image?id=${encodeURIComponent(item.id)}&v=${item.image_version}`
  : sampleArt[item.id] || null;

export function sceneDropPosition(pointer, drag, bounds) {
  const x = pointer.x - drag.offsetX + drag.width / 2;
  const y = pointer.y - drag.offsetY + drag.height;
  return [
    Math.max(0, Math.min(1000, Math.round((x - bounds.left) / bounds.width * 1000))),
    Math.max(0, Math.min(1000, Math.round((y - bounds.top) / bounds.height * 1000)))
  ];
}

export function initWorldUI(request, profile, activeCharacter) {
  let world = null, current = 'star-map', incomingLink = null, selectedStar = null, selectedLocal = null, timer = null, previousPosition = null, signature = '', draggingToken = false;
  let editingLinkId = null, editExpanded = false, draggingMarker = false;
  const settlementViews = new Map();
  const isGM = () => profile()?.role === 'gm';
  const location = id => world?.locations.find(item => item.id === id);
  const canEnter = item => item && item.kind !== 'poi' && (isGM() || item.access_level === 'accessible');
  const accessName = item => item.access_level === 'invisible' ? 'Invisible' : item.access_level === 'inaccessible' ? 'Restricted' : 'Accessible';
  const active = () => activeCharacter();
  const myPosition = () => world?.positions.find(item => item.character_id === active()?.id);
  const linksHere = () => world?.links.filter(item => item.from_id === current) || [];
  let statusTimer;
  const status = message => {
    clearTimeout(statusTimer);
    $('worldStatus').textContent = message || '';
    if (message) statusTimer = setTimeout(() => { $('worldStatus').textContent = ''; }, 5000);
  };
  const send = (action, values = {}) => request('/api/world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) });

  async function refresh(force = false) {
    if (!profile()) return;
    const requestingProfile = profile().id;
    try {
      const latest = await request('/api/world');
      if (profile()?.id !== requestingProfile) return;
      const nextPosition = latest.positions.find(item => item.character_id === active()?.id);
      const changedByOther = previousPosition && nextPosition && (previousPosition.location_id !== nextPosition.location_id);
      world = latest;
      if (changedByOther) { current = nextPosition.location_id; incomingLink = null; status(`The GM moved ${active()?.name || 'your character'} to ${location(current)?.title || 'a location'}.`); }
      previousPosition = nextPosition ? { ...nextPosition } : null;
      const viewed = location(current);
      if (!viewed || (!isGM() && viewed.access_level !== 'accessible')) current = location(viewed?.parent_id)?.access_level === 'accessible' ? viewed.parent_id : 'star-map';
      const nextSignature = JSON.stringify(world) + current + selectedStar;
      if (force || nextSignature !== signature) {
        signature = nextSignature;
        if (!draggingToken && !draggingMarker && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) render();
      }
    } catch (cause) { status(cause.message); }
  }

  function open(id, linkId = null) {
    const destination = location(id);
    if (!destination) return status('That location is not visible.');
    if (!canEnter(destination)) return status('This location is not open for entry.');
    current = id; incomingLink = linkId; selectedStar = null;
    editingLinkId = null; editExpanded = false;
    closeLocalDossier();
    $('dossier').classList.remove('open'); $('dossier').setAttribute('aria-hidden', 'true');
    render();
  }

  function closeLocalDossier() {
    selectedLocal = null;
    const dossier = $('worldLocationDossier');
    dossier.classList.remove('open'); dossier.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.settlement-marker.selected').forEach(marker => marker.classList.remove('selected'));
  }

  function inspectLocation(link) {
    const destination = location(link.to_id); if (!destination) return;
    selectedLocal = link.id;
    document.querySelectorAll('.settlement-marker').forEach(marker => marker.classList.toggle('selected', marker.dataset.linkId === link.id));
    $('worldLocationKind').textContent = `${kindName(destination.kind)} · ${destination.kind === 'poi' ? location(destination.parent_id)?.title || 'Ship City' : accessName(destination)}`;
    $('worldLocationTitle').textContent = destination.title;
    $('worldLocationTeaser').textContent = destination.teaser || '';
    $('worldLocationTeaser').hidden = !destination.teaser;
    $('worldLocationDescription').textContent = destination.description || 'No description has been recorded yet.';
    $('worldLocationQuote').textContent = destination.quote ? `“${destination.quote}”` : '';
    $('worldLocationSpeaker').textContent = destination.quote_speaker ? `— ${destination.quote_speaker}` : '';
    $('worldLocationQuoteBlock').hidden = !destination.quote;
    const ownArt = destination.has_card_image ? `/api/location-image?id=${encodeURIComponent(destination.id)}&slot=card&v=${destination.card_image_version}` : locationArt(destination);
    const cardArt = ownArt || locationArt(location(link.from_id));
    const artPanel = $('worldLocationArt');
    artPanel.style.backgroundImage = cardArt ? `url("${cardArt}")` : '';
    artPanel.style.backgroundPosition = cardArt && !ownArt ? `${link.x}% ${link.y}%` : 'center';
    artPanel.style.backgroundSize = cardArt && !ownArt ? '400% auto' : 'cover';
    const actions = $('worldLocationActions'); actions.replaceChildren();
    if (destination.kind !== 'poi') {
      const enter = button(canEnter(destination) ? 'Enter location' : 'Entry restricted', () => open(destination.id, link.id), 'primary-button');
      enter.disabled = !canEnter(destination);
      if (enter.disabled) enter.title = 'The GM has not opened this location for entry.';
      actions.append(enter);
    }
    const dossier = $('worldLocationDossier'); dossier.classList.add('open'); dossier.setAttribute('aria-hidden', 'false');
    if (isGM() && editingLinkId !== link.id) {
      editingLinkId = link.id; editExpanded = true;
      renderPanel(location(current));
    }
  }

  function renderStarMarkers() {
    for (const [key, id] of [['choir', 'choir'], ['shipcity', 'ship-city']]) {
      const marker = document.querySelector(`[data-key="${key}"]`);
      if (marker) {
        const destination = location(id);
        marker.style.display = destination ? '' : 'none';
        marker.classList.toggle('unavailable', Boolean(destination && destination.access_level !== 'accessible'));
        if (destination) marker.setAttribute('aria-label', `${destination.title}${destination.access_level !== 'accessible' ? `, ${accessName(destination).toLowerCase()}` : ''}`);
      }
    }
    const svg = $('map');
    svg.querySelectorAll('.world-marker-svg').forEach(item => item.remove());
    for (const link of world.links.filter(item => item.from_id === 'star-map' && !['choir', 'ship-city'].includes(item.to_id))) {
      const to = location(link.to_id); if (!to) continue;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'world-marker-svg'); group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', `Inspect ${to.title}${to.access_level !== 'accessible' ? `, ${accessName(to).toLowerCase()}` : ''}`); group.setAttribute('transform', `translate(${link.x} ${link.y})`);
      group.classList.toggle('unavailable', to.access_level !== 'accessible');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('r', '13');
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.setAttribute('x', '19'); label.setAttribute('y', '4'); label.textContent = `${to.title}${to.access_level === 'accessible' ? '' : ` · ${accessName(to)}`}`;
      group.append(circle, label);
      const go = () => { $('dossier').classList.remove('open'); $('worldOpenSelected').hidden = true; selectedStar = null; inspectLocation(link); };
      group.addEventListener('click', go); group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(); } });
      svg.append(group);
    }
    const selected = location(selectedStar);
    const visit = $('worldOpenSelected');
    visit.hidden = !selected;
    visit.disabled = Boolean(selected && !canEnter(selected));
    visit.textContent = visit.disabled ? 'Entry unavailable' : 'Open location';
    visit.title = visit.disabled ? 'The GM has not opened this location for entry.' : '';
  }

  function render() {
    if (!world) return;
    const item = location(current) || location('star-map'); if (!item) return;
    const star = item.kind === 'star';
    $('worldHeadingTitle').textContent = item.title;
    $('worldHeadingDescription').textContent = item.description;
    if (!['settlement', 'star'].includes(item.kind) && selectedLocal) closeLocalDossier();
    $('worldView').hidden = star; $('worldChrome').hidden = false; $('worldPanel').hidden = !isGM();
    $('worldBack').disabled = !canEnter(location(item.parent_id));
    renderStarMarkers();
    if (!star) renderLocal(item);
    renderMoveDock(item);
    if (isGM()) renderPanel(item);
    if (selectedLocal && ['settlement', 'star'].includes(item.kind)) {
      const selected = linksHere().find(link => link.id === selectedLocal);
      if (selected) inspectLocation(selected); else closeLocalDossier();
    }
  }

  function renderMoveDock(item) {
    const dock = $('worldMoveDock'); dock.replaceChildren();
    if (item.kind === 'poi' || item.access_level !== 'accessible') { dock.hidden = true; return; }
    const character = active();
    if (!character) {
      dock.hidden = false;
      dock.append(button('Select Character to Move', event => {
        event.stopPropagation();
        if ($('characterMenu').hidden) $('characterButton').click();
        ($('characterList').querySelector('.menu-row button') || $('createCharacter')).focus();
      }, 'primary-button'));
      return;
    }
    const canMove = (myPosition()?.location_id || 'star-map') !== item.id;
    dock.hidden = !canMove;
    if (!canMove) return;
    dock.append(button('Move Here', async () => {
      try { await send('move', { characterId: character.id, locationId: item.id, linkId: incomingLink }); previousPosition = { location_id: item.id }; status(`${character.name} moved here.`); await refresh(true); }
      catch (cause) { status(cause.message); }
    }, 'primary-button'));
  }

  function renderLocal(item) {
    const view = $('worldView'); view.replaceChildren();
    view.classList.toggle('settlement-view', item.kind === 'settlement');
    const scene = node('div', `world-scene ${item.kind}-scene`);
    const art = locationArt(item);
    if (art && !['delve', 'settlement'].includes(item.kind)) { scene.classList.add('has-art'); scene.style.backgroundImage = `linear-gradient(#08101922,#08101933),url("${art}")`; }
    const map = item.kind === 'settlement' ? renderSettlement(scene, item, art) : null;
    if (item.kind === 'delve') renderDelve(scene, item);
    if (item.kind === 'diorama') renderDiorama(scene, item);
    view.append(scene);
    if (map) setupSettlementNavigation(scene, map, item, art);
  }

  function renderSettlement(scene, item, art) {
    const map = node('div', 'settlement-map');
    if (art) map.style.backgroundImage = `linear-gradient(#08101915,#08101926),url("${art}")`;
    scene.append(map);
    const here = world.positions.filter(pos => pos.location_id === item.id);
    const presence = node('aside', 'world-presence');
    presence.setAttribute('aria-label', 'Characters in this hub');
    const presenceHead = node('div', 'world-presence-head');
    presenceHead.append(node('span', 'world-presence-label', 'Characters here'), node('span', 'world-presence-count', String(here.length).padStart(2, '0')));
    presence.append(presenceHead);
    if (here.length) {
      const names = node('ul', 'world-presence-list');
      for (const pos of here) {
        const entry = node('li');
        entry.append(node('span', 'world-presence-symbol', '✦'), node('span', '', pos.name));
        names.append(entry);
      }
      presence.append(names);
    } else presence.append(node('p', 'world-presence-empty', 'No characters are here yet.'));
    scene.append(presence);
    for (const link of linksHere()) {
      const to = location(link.to_id); if (!to) continue;
      const marker = node('button', 'settlement-marker'); marker.type = 'button';
      let suppressClick = false;
      marker.addEventListener('click', event => {
        if (suppressClick) { event.preventDefault(); suppressClick = false; return; }
        inspectLocation(link);
      });
      marker.dataset.linkId = link.id; marker.dataset.kind = to.kind;
      marker.dataset.access = to.access_level;
      marker.setAttribute('aria-label', `Inspect ${to.title}${to.access_level !== 'accessible' ? `, ${accessName(to).toLowerCase()}` : ''}`);
      if (selectedLocal === link.id) marker.classList.add('selected');
      const sigil = node('span', 'marker-sigil'); sigil.setAttribute('aria-hidden', 'true');
      sigil.append(node('span', 'marker-symbol', ({ settlement: '✧', delve: '⌘', diorama: '◇', poi: '✦' })[to.kind] || '✦'));
      const plate = node('span', 'marker-label'); plate.append(node('small', '', `${kindName(to.kind)}${to.access_level === 'accessible' ? '' : ` · ${accessName(to)}`}`), node('span', '', to.title));
      marker.append(sigil, plate);
      marker.style.left = `${Math.max(5, Math.min(95, link.x))}%`; marker.style.top = `${Math.max(5, Math.min(95, link.y))}%`;
      if (isGM()) {
        marker.classList.add('gm-draggable');
        marker.title = `Inspect or drag to reposition ${to.title}`;
        marker.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          marker.setPointerCapture(event.pointerId); draggingMarker = true;
          const startX = event.clientX, startY = event.clientY;
          const originX = Math.max(5, Math.min(95, link.x)), originY = Math.max(5, Math.min(95, link.y));
          let moved = false, x = originX, y = originY;
          const move = next => {
            if (next.pointerId !== event.pointerId) return;
            if (Math.abs(next.clientX - startX) + Math.abs(next.clientY - startY) > 5) moved = true;
            if (!moved) return;
            const bounds = map.getBoundingClientRect();
            x = Math.round(Math.max(5, Math.min(95, originX + (next.clientX - startX) / bounds.width * 100)) * 10) / 10;
            y = Math.round(Math.max(5, Math.min(95, originY + (next.clientY - startY) / bounds.height * 100)) * 10) / 10;
            marker.style.left = `${x}%`; marker.style.top = `${y}%`;
            marker.classList.add('repositioning');
          };
          const cleanup = () => {
            draggingMarker = false; marker.classList.remove('repositioning');
            marker.removeEventListener('pointermove', move); marker.removeEventListener('pointerup', drop); marker.removeEventListener('pointercancel', cancel);
          };
          const cancel = () => { cleanup(); marker.style.left = `${originX}%`; marker.style.top = `${originY}%`; };
          const drop = async up => {
            if (up.pointerId !== event.pointerId) return;
            cleanup();
            if (!moved) return;
            suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
            editingLinkId = link.id; editExpanded = true;
            try { await send('marker', { linkId: link.id, x, y }); status('Marker repositioned.'); await refresh(true); }
            catch (cause) { status(cause.message); await refresh(true); }
          };
          marker.addEventListener('pointermove', move); marker.addEventListener('pointerup', drop); marker.addEventListener('pointercancel', cancel);
        });
      }
      map.append(marker);
    }
    return map;
  }

  function setupSettlementNavigation(scene, map, item, art) {
    let width = 2029, height = 1566;
    let state = settlementViews.get(item.id);
    const bounds = () => scene.getBoundingClientRect();
    const cover = () => Math.max(bounds().width / width, bounds().height / height);
    const contain = () => Math.min(bounds().width / width, bounds().height / height);
    const clamp = () => {
      const { width: viewportWidth, height: viewportHeight } = bounds();
      const scaledWidth = width * state.scale, scaledHeight = height * state.scale;
      state.x = scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : Math.min(0, Math.max(viewportWidth - scaledWidth, state.x));
      state.y = scaledHeight <= viewportHeight ? (viewportHeight - scaledHeight) / 2 : Math.min(0, Math.max(viewportHeight - scaledHeight, state.y));
    };
    const draw = () => {
      clamp();
      map.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
      settlementViews.set(item.id, state);
    };
    const reset = () => {
      state = { art, scale: cover(), x: 0, y: 0 };
      state.x = (bounds().width - width * state.scale) / 2;
      state.y = (bounds().height - height * state.scale) / 2;
      draw();
    };
    if (!state || state.art !== art) reset(); else draw();
    if (art) {
      const image = new Image();
      image.onload = () => {
        if (!scene.isConnected) return;
        width = image.naturalWidth; height = image.naturalHeight;
        map.style.width = `${width}px`; map.style.height = `${height}px`;
        if (width !== 2029 || height !== 1566) reset(); else draw();
      };
      image.src = art;
    }
    let pointer = null;
    scene.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button, .world-heading, .world-presence')) return;
      event.preventDefault();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      scene.setPointerCapture(event.pointerId);
      scene.classList.add('panning');
    });
    scene.addEventListener('pointermove', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      state.x += event.clientX - pointer.x; state.y += event.clientY - pointer.y;
      pointer.x = event.clientX; pointer.y = event.clientY;
      draw();
    });
    const endPan = event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      pointer = null; scene.classList.remove('panning');
    };
    scene.addEventListener('pointerup', endPan);
    scene.addEventListener('pointercancel', endPan);
    scene.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = bounds();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const nextScale = Math.max(contain(), Math.min(cover() * 4, state.scale * Math.exp(-event.deltaY * .0012)));
      const ratio = nextScale / state.scale;
      state.x = x - (x - state.x) * ratio;
      state.y = y - (y - state.y) * ratio;
      state.scale = nextScale;
      draw();
    }, { passive: false });
  }

  function startDrag(token, onDrop) {
    token.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); token.setPointerCapture(event.pointerId);
      draggingToken = true;
      const bounds = token.getBoundingClientRect();
      const offsetX = event.clientX - bounds.left, offsetY = event.clientY - bounds.top;
      const ghost = token.cloneNode(true);
      ghost.classList.add('world-drag-ghost');
      ghost.style.width = `${bounds.width}px`; ghost.style.height = `${bounds.height}px`;
      document.body.append(ghost);
      token.style.opacity = '.25';
      let hovered = null, moved = false;
      const move = next => {
        moved ||= Math.abs(next.clientX - event.clientX) + Math.abs(next.clientY - event.clientY) > 4;
        ghost.style.left = `${next.clientX - offsetX}px`; ghost.style.top = `${next.clientY - offsetY}px`;
        const cell = document.elementFromPoint(next.clientX, next.clientY)?.closest('.world-cell');
        if (hovered !== cell) { hovered?.classList.remove('drop-target'); hovered = cell; hovered?.classList.add('drop-target'); }
      };
      const cleanup = () => {
        draggingToken = false;
        token.style.opacity = '';
        hovered?.classList.remove('drop-target'); ghost.remove();
        token.removeEventListener('pointermove', move); token.removeEventListener('pointerup', finish); token.removeEventListener('pointercancel', cancel);
      };
      const finish = async up => {
        const target = document.elementFromPoint(up.clientX, up.clientY);
        cleanup();
        if (target && moved) await onDrop(target, up, { offsetX, offsetY, width: bounds.width, height: bounds.height });
        else refresh(true);
      };
      const cancel = () => { cleanup(); refresh(true); };
      token.addEventListener('pointermove', move);
      token.addEventListener('pointerup', finish); token.addEventListener('pointercancel', cancel);
      move(event);
    });
  }

  function renderDelve(scene, item) {
    const grid = item.grid, shown = world.visibleRooms[item.id] || {};
    const blocked = new Set(grid.blocked.map(pair => pair.join(',')));
    const roomFor = (x, y) => grid.rooms.find(room => room.squares.some(pair => pair[0] === x && pair[1] === y))?.id || '_unassigned';
    const board = node('div', 'world-grid'); board.style.setProperty('--cols', grid.width);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      const cell = node('div', 'world-cell'); cell.dataset.x = x; cell.dataset.y = y;
      const room = roomFor(x, y), fogged = !isGM() && shown[room] === false;
      if (blocked.has(`${x},${y}`)) cell.classList.add('blocked');
      if (fogged) cell.classList.add('fogged');
      if (locationArt(item) && !fogged) {
        cell.style.backgroundImage = `url("${locationArt(item)}")`;
        cell.style.backgroundSize = `${grid.width * 100}% ${grid.height * 100}%`;
        cell.style.backgroundPosition = `${grid.width === 1 ? 0 : x / (grid.width - 1) * 100}% ${grid.height === 1 ? 0 : y / (grid.height - 1) * 100}%`;
      }
      if (isGM() && !fogged) cell.title = `${x}, ${y} · ${room}`;
      const door = linksHere().find(link => link.kind === 'door' && link.x === x && link.y === y);
      if (door && (!fogged || isGM())) cell.append(button('Door', () => open(door.to_id, door.id), 'world-marker door'));
      for (const pos of world.positions.filter(row => row.location_id === item.id && row.x === x && row.y === y && (!fogged || isGM()))) {
        const token = node('img', 'world-token' + (pos.character_id === active()?.id ? ' own' : ''));
        token.alt = pos.name; token.title = pos.name; token.src = pos.has_portrait ? `/api/image?id=${encodeURIComponent(pos.character_id)}&slot=portrait` : 'assets/characters/anonymous-explorer.png';
        token.addEventListener('error', () => { token.src = 'assets/characters/anonymous-explorer.png'; }, { once: true });
        if (pos.character_id === active()?.id || isGM()) startDrag(token, async target => {
          const destination = target.closest('.world-cell'); if (!destination || destination.classList.contains('blocked')) return;
          try { await send('position', { characterId: pos.character_id, x: Number(destination.dataset.x), y: Number(destination.dataset.y) }); status(''); await refresh(true); }
          catch (cause) { status(cause.message); await refresh(true); }
        });
        cell.append(token);
      }
      board.append(cell);
    }
    scene.append(board);
  }

  function renderDiorama(scene, item) {
    const layer = node('div', 'world-standups'); scene.append(layer);
    for (const pos of world.positions.filter(row => row.location_id === item.id && !row.hidden)) {
      const img = node('img', 'world-standup' + (pos.character_id === active()?.id ? ' own' : ''));
      img.draggable = false;
      img.alt = pos.name; img.title = pos.name;
      img.src = pos.has_standup ? `/api/image?id=${encodeURIComponent(pos.character_id)}&slot=standup` : pos.has_portrait ? `/api/image?id=${encodeURIComponent(pos.character_id)}&slot=portrait` : 'assets/characters/anonymous-explorer.png';
      img.addEventListener('error', () => { img.src = 'assets/characters/anonymous-explorer.png'; }, { once: true });
      img.style.left = `${(pos.x ?? 500) / 10}%`; img.style.top = `${(pos.y ?? 800) / 10}%`;
      if (pos.character_id === active()?.id || isGM()) startDrag(img, async (target, up, drag) => {
        const [x, y] = sceneDropPosition({ x: up.clientX, y: up.clientY }, drag, layer.getBoundingClientRect());
        try { await send('position', { characterId: pos.character_id, x, y }); await refresh(true); } catch (cause) { status(cause.message); }
      });
      layer.append(img);
    }
  }

  function renderPanel(item) {
    const panel = $('worldPanel'); panel.replaceChildren(); panel.append(node('h3', '', 'GM controls'));
    renderGMControls(panel, item);
  }

  function renderGMControls(panel, item) {
    panel.append(node('div', 'rule', item.title));
    if (item.kind !== 'poi') {
      if (item.access_level !== 'accessible') panel.append(node('p', 'world-empty-note', 'Set this location to Accessible before pulling characters here.'));
      else if (!world.positions.length) panel.append(node('p', 'world-empty-note', 'No player characters are available to pull.'));
      else {
        const pull = node('details'); pull.append(node('summary', '', 'Pull Characters'));
        const list = node('div');
        for (const pos of world.positions) {
          const check = node('input'); check.type = 'checkbox'; check.value = pos.character_id;
          list.append(field(pos.name, check));
        }
        const pullButton = button('Pull selected', async () => {
          const ids = [...list.querySelectorAll('input:checked')].map(input => input.value);
          if (!ids.length) return;
          try { const result = await send('pull', { characterIds: ids, locationId: item.id }); status(`${result.moved.length} characters moved.`); await refresh(true); }
          catch (cause) { status(cause.message); await refresh(true); }
        });
        pullButton.disabled = true;
        list.addEventListener('change', () => { pullButton.disabled = !list.querySelector('input:checked'); });
        pull.append(list, pullButton); panel.append(pull);
      }
    }
    if (item.kind === 'delve') {
      const fog = node('input'); fog.type = 'checkbox'; fog.checked = Boolean(item.fog_enabled);
      fog.addEventListener('change', async () => { try { await send('fog', { locationId: item.id, enabled: fog.checked }); await refresh(true); } catch (cause) { status(cause.message); } });
      panel.append(field('Enable fog of war', fog));
      for (const room of [...item.grid.rooms, { id: '_unassigned', name: 'Other squares' }]) {
        const row = node('div', 'room-row'); row.append(node('span', '', room.name));
        const select = node('select'); const selected = world.overrides.find(entry => entry.location_id === item.id && entry.room_id === room.id)?.visibility || 'automatic';
        for (const value of ['automatic', 'show', 'hide']) { const option = node('option', '', value); option.value = value; option.selected = selected === value; select.append(option); }
        select.addEventListener('change', async () => { try { await send('room', { locationId: item.id, roomId: room.id, visibility: select.value }); await refresh(true); } catch (cause) { status(cause.message); } });
        row.append(select); panel.append(row);
      }
    }
    const choices = [];
    if (item.kind !== 'star') choices.push({ key: 'self', target: item, link: null });
    if (['star', 'settlement'].includes(item.kind)) for (const link of linksHere().filter(row => row.kind === 'marker')) {
      const target = location(link.to_id);
      if (target) choices.push({ key: link.id, target, link });
    }
    if (choices.length) {
      const choice = choices.find(row => row.key === editingLinkId) || choices[0];
      const edit = node('details', 'world-edit-details'); edit.open = editExpanded;
      edit.addEventListener('toggle', () => { editExpanded = edit.open; });
      edit.append(node('summary', '', 'Edit location'));
      const targetSelect = node('select');
      for (const row of choices) {
        const option = node('option', '', `${row.link ? 'Marker' : 'Current'}: ${row.target.title}`);
        option.value = row.key; option.selected = row.key === choice.key; targetSelect.append(option);
      }
      targetSelect.addEventListener('change', () => { editingLinkId = targetSelect.value === 'self' ? null : targetSelect.value; editExpanded = true; renderPanel(item); });
      const title = node('input'); title.value = choice.target.title;
      const description = node('textarea'); description.value = choice.target.description;
      const teaser = node('input'); teaser.value = choice.target.teaser || ''; teaser.maxLength = 220;
      const quote = node('textarea'); quote.value = choice.target.quote || ''; quote.maxLength = 280;
      const quoteSpeaker = node('input'); quoteSpeaker.value = choice.target.quote_speaker || ''; quoteSpeaker.maxLength = 100;
      const access = node('select');
      for (const value of ['invisible', 'inaccessible', 'accessible']) {
        const option = node('option', '', value[0].toUpperCase() + value.slice(1)); option.value = value; option.selected = value === choice.target.access_level; access.append(option);
      }
      const image = node('input'); image.type = 'file'; image.accept = 'image/png,image/jpeg,image/webp';
      const cardImage = node('input'); cardImage.type = 'file'; cardImage.accept = image.accept;
      edit.append(field('Location', targetSelect), field('Title', title), field('One-line impression (optional)', teaser), field('Description', description), field('In-world quote (optional)', quote), field('Quote speaker (optional)', quoteSpeaker), field('Party access', access));
      const positionable = choice.link && !['star-choir', 'star-ship-city'].includes(choice.link.id);
      let x, y;
      if (positionable) {
        x = node('input'); y = node('input'); x.type = y.type = 'number'; x.step = y.step = '0.1';
        x.min = y.min = '0'; x.max = item.kind === 'star' ? '900' : '100'; y.max = item.kind === 'star' ? '600' : '100';
        x.value = choice.link.x; y.value = choice.link.y;
        edit.append(field(item.kind === 'star' ? 'Chart X (0–900)' : 'Marker X (0–100%)', x), field(item.kind === 'star' ? 'Chart Y (0–600)' : 'Marker Y (0–100%)', y));
        if (item.kind === 'settlement') edit.append(node('p', 'world-edit-hint', 'Drag this marker on the map to reposition it.'));
      }
      edit.append(field('Replace background image (up to 6 MB)', image), field('Card illustration (optional)', cardImage), button('Save changes', async () => {
        try {
          await send('edit', { locationId: choice.target.id, title: title.value, teaser: teaser.value, description: description.value, quote: quote.value, quoteSpeaker: quoteSpeaker.value, accessLevel: access.value, ...(positionable ? { linkId: choice.link.id, x: Number(x.value), y: Number(y.value) } : {}) });
          if (image.files[0]) await upload(choice.target.id, image.files[0]);
          if (cardImage.files[0]) await upload(choice.target.id, cardImage.files[0], 'card');
          status('Location saved.'); await refresh(true);
        } catch (cause) { status(cause.message); }
      }));
      panel.append(edit);
    }
    if (['star', 'settlement'].includes(item.kind)) {
      const create = node('details'); create.append(node('summary', '', 'Create location'));
      const title = node('input'), description = node('textarea'), teaser = node('input'), quote = node('textarea'), quoteSpeaker = node('input'), kind = node('select'), image = node('input'), cardImage = node('input');
      teaser.maxLength = 220; quote.maxLength = 280; quoteSpeaker.maxLength = 100;
      for (const value of ['settlement', 'delve', 'diorama', 'poi']) { const option = node('option', '', kindName(value)); option.value = value; kind.append(option); }
      image.type = 'file'; image.accept = 'image/png,image/jpeg,image/webp';
      cardImage.type = 'file'; cardImage.accept = image.accept;
      const x = node('input'), y = node('input'); x.type = y.type = 'number'; x.value = item.kind === 'star' ? '450' : '50'; y.value = item.kind === 'star' ? '300' : '50';
      create.append(field('Title', title), field('Type', kind), field('One-line impression (optional)', teaser), field('Description', description), field('In-world quote (optional)', quote), field('Quote speaker (optional)', quoteSpeaker), field(item.kind === 'star' ? 'Chart X (0–900)' : 'Marker X (0–100%)', x), field(item.kind === 'star' ? 'Chart Y (0–600)' : 'Marker Y (0–100%)', y), field('Background image (up to 6 MB)', image), field('Card illustration (optional)', cardImage), button('Create', async () => {
        try {
          const created = await send('create', { parentId: item.id, title: title.value, kind: kind.value, teaser: teaser.value, description: description.value, quote: quote.value, quoteSpeaker: quoteSpeaker.value, x: Number(x.value), y: Number(y.value) });
          if (image.files[0]) await upload(created.id, image.files[0]);
          if (cardImage.files[0]) await upload(created.id, cardImage.files[0], 'card');
          editingLinkId = created.linkId; editExpanded = true;
          await refresh(true); status('Location created. Select its marker to inspect it, or drag it into place.');
        } catch (cause) { status(cause.message); }
      })); panel.append(create);
    }
  }

  async function upload(id, file, slot = 'map') {
    if (file.size > 6 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG, or WebP image under 6 MB.');
    await request(`/api/location-image?id=${encodeURIComponent(id)}${slot === 'card' ? '&slot=card' : ''}`, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  }

  $('worldBack').addEventListener('click', () => { const parent = location(current)?.parent_id; if (parent) open(parent); });
  $('worldStar').addEventListener('click', () => open('star-map'));
  $('worldLocationClose').addEventListener('click', closeLocalDossier);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLocalDossier(); });
  new ResizeObserver(() => document.documentElement.style.setProperty('--chat-offset', `${$('chatDock').getBoundingClientRect().height + 12}px`)).observe($('chatDock'));
  new ResizeObserver(() => document.documentElement.style.setProperty('--world-chrome-bottom', `${$('worldChrome').getBoundingClientRect().bottom}px`)).observe($('worldChrome'));
  $('worldOpenSelected').addEventListener('click', () => { if (canEnter(location(selectedStar))) open(selectedStar, world?.links.find(link => link.from_id === 'star-map' && link.to_id === selectedStar)?.id); });
  document.addEventListener('chart-marker', event => {
    closeLocalDossier();
    selectedStar = ({ choir: 'choir', shipcity: 'ship-city' })[event.detail.key] || null;
    const selected = location(selectedStar), visit = $('worldOpenSelected');
    visit.hidden = !selected;
    visit.disabled = Boolean(selected && !canEnter(selected));
    visit.textContent = visit.disabled ? 'Entry unavailable' : 'Open location';
    visit.title = visit.disabled ? 'The GM has not opened this location for entry.' : '';
    if (selected && isGM()) { editingLinkId = world.links.find(link => link.from_id === 'star-map' && link.to_id === selected.id)?.id || null; editExpanded = true; }
    signature = ''; if (location('star-map') && isGM()) renderPanel(location('star-map'));
  });
  return {
    start() { current = 'star-map'; previousPosition = null; $('worldChrome').hidden = false; refresh(true).then(() => { if (myPosition()?.location_id) open(myPosition().location_id); }); clearInterval(timer); timer = setInterval(() => { if (!document.hidden) refresh(); }, 1000); },
    stop() { clearInterval(timer); clearTimeout(statusTimer); status(''); timer = null; world = null; closeLocalDossier(); $('worldChrome').hidden = true; $('worldView').hidden = true; $('worldPanel').hidden = true; $('worldMoveDock').hidden = true; },
    characterChanged() { previousPosition = null; refresh(true).then(() => open(myPosition()?.location_id || 'star-map')); }
  };
}
