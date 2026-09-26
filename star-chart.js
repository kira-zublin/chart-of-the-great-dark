// The star map: an engraved chart of the Jumuah system, drawn from the Core Rules (chapter 10).
// Book content on the chart is static presentation data. World locations linked from the star map
// are drawn by world-ui.js with chartMarker(), in the same 900 x 600 chart space.
const NS = 'http://www.w3.org/2000/svg';
const ICONS = 'assets/icons/chart/';
export const CENTER = [450, 300];
const UNIT = 38; // chart units per square root of AD, so the outermost tributary fits the 600-unit height
export const orbitRadius = ad => UNIT * Math.sqrt(ad);
export const orbitPoint = (ad, deg) => { const r = orbitRadius(ad), t = deg * Math.PI / 180; return [CENTER[0] + r * Math.cos(t), CENTER[1] + r * Math.sin(t)]; };
const around = ([x, y], d, deg) => [x + d * Math.cos(deg * Math.PI / 180), y + d * Math.sin(deg * Math.PI / 180)];

const BODY = { jumuah: CENTER, nubi: orbitPoint(4, 330), shipcity: orbitPoint(7, 110), moubarra: orbitPoint(12, 20), amalum: orbitPoint(27, 250) };
const BODY_RADIUS = { jumuah: 15, nubi: 4.2, moubarra: 7.7, amalum: 9.8 };
const BODY_CLEARANCE = { jumuah: 17, nubi: 5, moubarra: 23, amalum: 20 }; // includes rings, so labels never cover them

// Where each world location kind appears on the chart, and which icon it uses.
export const KIND_ICON = { settlement: 'outpost', delve: 'shallows', diorama: 'poi', poi: 'poi' };
const HAZARDS = new Set(['rift-storm', 'meteor', 'gas-wights', 'wreckers']);
const RUINS = new Set(['structure', 'garden', 'shallows', 'vault', 'portal']);

// Every entry is described in the Core Rules, chapter 10. Positions around an orbit are chosen for legibility;
// the book gives each body's distance from Jumuah, not its place on the orbit.
export const JUMUAH = [
  { key: 'jumuah', at: BODY.jumuah, body: 'jumuah', name: 'Jumuah', sub: 'Red giant', chapter: 'Home star', chips: ['Red giant', 'Mother star'], text: 'The mother star of the Diaspora, burning dimly in the last cycle of a long life. Everything in the system turns around it.', facts: [['Class', 'Red giant'], ['Worlds', 'Nubi, Moubarra, Amalum']], side: 'b' },
  { key: 'portal', at: orbitPoint(1, 232), icon: 'portal', name: 'Arakvarat', sub: '1 AD · tomb portal', chapter: 'Builder ruin · structure', chips: ['Tomb portal', 'Middle era'], text: 'A dead portal of Builder origin, the first ever found. Master Moska studies it often, and dockside gossip says she has found a way to wake it.', facts: [['Distance', '1 AD'], ['Found', 'Year 3'], ['Ruin class', 'Structure']], note: 'Some believe the system’s rift storms come from within the portal.', side: 'l' },
  { key: 'nubi', at: BODY.nubi, body: 'nubi', name: 'Nubi', sub: '4 AD · scorched planet', chapter: 'Planet · the Core', chips: ['Scorched', 'No settlements'], text: 'Scorched and lifeless. Guild mining factories failed here in the 140s and now lie buried in dust.', facts: [['Distance', '4 AD'], ['Moon', 'Musharat']], side: 'r' },
  { key: 'musharat', at: around(BODY.nubi, 17, 300), moon: 'molten', name: 'Musharat', sub: 'Molten moon', chapter: 'Moon of Nubi', chips: ['Molten'], text: 'A molten moon locked in perpetual daylight on one side.', facts: [['Orbits', 'Nubi']], tier: 'near', side: 'r' },
  { key: 'sigra', at: around(BODY.nubi, 24, 200), icon: 'structure', name: 'Sigra Tower', sub: 'Builder pillar', chapter: 'Builder ruin · structure', chips: ['On Nubi'], text: 'A 600-meter stone pillar of Builder origin rising from the sand basin of Gelventer.', facts: [['Location', 'Gelventer basin, Nubi']], tier: 'near', side: 'l' },
  { key: 'josha', at: around(BODY.nubi, 24, 150), icon: 'mine', name: "Josha's Folly", sub: 'Abandoned', chapter: 'Mining platform', chips: ['On Nubi', 'Abandoned'], text: 'An abandoned mining platform in the Hollow Cluster, a range of porous, cavern-filled hills.', facts: [['Location', 'Hollow Cluster, Nubi']], tier: 'near', side: 'l', abandoned: true },
  { key: 'maghrib', at: around(BODY.nubi, 24, 42), icon: 'poi', name: 'Maghrib Oasis', sub: 'Lava lake', chapter: 'Point of interest', chips: ['On Nubi'], text: 'A molten lake at the equator. When Musharat passes overhead it pulls up a fiery rain of ash and molten droplets.', facts: [['Location', 'Equator of Nubi']], tier: 'near', side: 'r' },
  { key: 'shipcity', at: BODY.shipcity, icon: 'ship-city', name: 'Ship City', sub: '7 AD · capital of the Diaspora', chapter: 'Landmark · Jumuah system', chips: ['Asteroid metropolis', 'Home of the Diaspora', 'Explorers’ base'], text: 'Built through and around an asteroid, Ship City is the only true city of the Lost Horizon: hulls, stone, gardens, Guild palaces, workshops and docks, and the base from which expeditions push into the Great Dark.', facts: [['Distance', '7 AD'], ['Rulers', 'The Guilds and the Grand Council']], note: 'Known as the Dying City, yet still a beacon in the dark.', side: 'r' },
  { key: 'moubarra', at: BODY.moubarra, body: 'moubarra', name: 'Moubarra', sub: '12 AD · the yellow jewel', chapter: 'Gas giant · the Core', chips: ['Rings', 'Mining Combine'], text: 'A glittering yellow gas giant wrapped in rings, gravel and dust. The Mining Combine now leads the work around it.', facts: [['Distance', '12 AD'], ['Rings', 'Cassrat Division, the Scythe']], side: 'r' },
  { key: 'gilen', at: around(BODY.moubarra, 31, 75), moon: 'rock', icon: 'mine', name: "Moubarra 4 · Gilen's Point", sub: 'Mining Combine outpost', chapter: 'Moon and outpost', chips: ['Mining Combine'], text: 'A small rocky moon with a thin atmosphere and a scrappy Combine outpost.', facts: [['Orbits', 'Moubarra']], tier: 'near', side: 'r' },
  { key: 'whr6', at: orbitPoint(18, 186), icon: 'station', name: 'Refinery WHR-6', sub: 'White Fields of Albary', chapter: 'Mining Combine station', chips: ['Ice refinery', 'Armed patrol'], text: 'The Combine’s largest outpost and ore ship: 300 crew, a dozen ice tugs and, lately, an armed patrol vessel against Wreckers.', facts: [['Distance', '18 AD'], ['Region', 'White Fields of Albary']], tier: 'near', side: 'r' },
  { key: 'icehenge', at: orbitPoint(18.6, 203), icon: 'poi', name: 'Icehenge', sub: 'On the moonlet Charact-9', chapter: 'Point of interest', chips: ['Haunted', 'Death cult'], text: 'A human-made structure where desiccated bodies were found frozen in the ice. Miners say it is haunted and cursed.', facts: [['Region', 'White Fields of Albary']], tier: 'near', side: 'r' },
  { key: 'wrecker-row', at: orbitPoint(17.2, 166), icon: 'wreckers', name: 'Wrecker Row', sub: 'Rumored · moves often', chapter: 'Hazard · rumored', chips: ['Wreckers'], text: 'A hidden Wrecker colony said to live among the icebergs, shifting its base to stay ahead of the Defense Fleet.', facts: [['Region', 'White Fields of Albary']], tier: 'near', side: 'r', rumored: true },
  { key: 'rift', at: orbitPoint(20, 295), icon: 'rift-storm', name: 'Rift storms', sub: 'Memosan Gulf', chapter: 'Hazard', chips: ['Gravitational anomaly'], text: 'Gravitational anomalies that bend hulls and tear plates. In year 132 they ravaged ships crossing the Memosan Gulf.', facts: [['Region', 'Memosan Gulf']], side: 'r' },
  { key: 'birr', at: orbitPoint(23, 45), icon: 'meteor', name: 'Meteorite bursts', sub: 'The Black Birr', chapter: 'Hazard', chips: ['Meteorites'], text: 'Common in the Gulf, the Outer Fields and near the gas giants. Spacers fear the Black Birr, a coin-sized meteorite nothing can stop.', facts: [['Region', 'Memosan Gulf']], tier: 'near', side: 'r' },
  { key: 'amalum', at: BODY.amalum, body: 'amalum', name: 'Amalum', sub: '27 AD · the cerulean colossus', chapter: 'Gas giant · the Rim', chips: ['Rings', 'Three Moon Conflict'], text: 'The largest gas giant, dull cerulean streaked with cyan. Its broad rings hold pure metal fragments and the occasional drifting shard.', facts: [['Distance', '27 AD'], ['Moons', 'Ilum, Keif, Yuram, Kadra, Xenxu']], side: 'r' },
  { key: 'ilum', at: around(BODY.amalum, 32, 195), moon: 'rock', icon: 'garden', name: 'Ilum · The Red Garden', sub: 'Builder garden', chapter: 'Builder ruin · garden', chips: ['Blight bloom', 'Middle era'], text: 'A kilometers-long ravine filled with crimson Blight bloom, the most important ruin in the system. More Builder ruins may remain undiscovered.', facts: [['Orbits', 'Amalum'], ['Found', 'Year 145']], tier: 'near', side: 'l' },
  { key: 'trigonum', at: around(BODY.amalum, 35, 160), icon: 'station', name: 'Trigonum Post', sub: 'Being abandoned', chapter: 'Navigators Guild station', chips: ['Staging post for Ilum'], text: 'A staging ground for expeditions to Ilum, now slowly abandoned as the Navigators look elsewhere.', facts: [['Orbits', 'Amalum']], tier: 'near', side: 'l', abandoned: true },
  { key: 'keif', at: around(BODY.amalum, 28, 320), moon: 'rock', icon: 'mine', name: 'Keif', sub: 'Mining Combine stronghold', chapter: 'Moon · Three Moon Conflict', chips: ['Mining Combine'], text: 'The Combine’s stronghold, pressing the independent mining families on Yuram and Kadra.', facts: [['Orbits', 'Amalum']], tier: 'near', side: 'r' },
  { key: 'yuram', at: around(BODY.amalum, 35, 20), moon: 'rock', icon: 'outpost', name: 'Yuram', sub: 'Derrwin-Coulas homestead', chapter: 'Moon · Three Moon Conflict', chips: ['Mining families'], text: 'Home of independent mining families and the self-sufficient Derrwin-Coulas homestead.', facts: [['Orbits', 'Amalum']], tier: 'near', side: 'r' },
  { key: 'kadra', at: around(BODY.amalum, 35, 110), moon: 'rock', icon: 'mine', name: 'Kadra', sub: 'Independent miners', chapter: 'Moon · Three Moon Conflict', chips: ['Mining families'], text: 'Rich in khad deposits and magdan regolith, and caught between the Combine and the families.', facts: [['Orbits', 'Amalum']], tier: 'near', side: 'r' },
  { key: 'xenxu', at: around(BODY.amalum, 42, 270), moon: 'rock', icon: 'mine', name: 'Xenxu', sub: 'New private mine', chapter: 'Moon', chips: ['Private patron'], text: 'A new mine sponsored by the Coriolite din-Hrana-Masouf, one of the private patrons testing the Guilds.', facts: [['Orbits', 'Amalum']], tier: 'near', side: 'r' },
  { key: 'hermou', at: around(BODY.amalum, 25, 70), icon: 'outpost', name: "Hermou's Plate", sub: "Ruad's Luck", chapter: 'Asteroid and outpost', chips: ['Above the clouds'], text: 'A vast flat asteroid drifting above Amalum’s clouds. Only one outpost, Ruad’s Luck, has survived the storms.', facts: [['Orbits', 'Amalum']], tier: 'near', side: 'r' },
  { key: 'wights', at: around(BODY.amalum, 24, 235), icon: 'gas-wights', name: 'Gas wights', sub: 'Above the clouds', chapter: 'Hazard', chips: ['Amalum'], text: 'Pieces of Amalum’s clouds that break free and seem to move with intent. Some have pursued ships.', facts: [['Region', 'Upper clouds of Amalum']], tier: 'near', side: 'l' },
  { key: 'iron-mound', at: orbitPoint(35, 60), icon: 'mine', name: 'Iron Mound', sub: '35 AD · Combine base', chapter: 'Mining Combine base', chips: ['Waypoint'], text: 'A metallic chondrite that serves as the Combine’s main base in the far orbits and a waypoint for Greatships.', facts: [['Distance', '35 AD'], ['Region', 'The Outer Fields']], side: 'r' },
  { key: 'wreckers', at: orbitPoint(33, 128), icon: 'wreckers', name: 'Wreckers', sub: 'Outer Fields', chapter: 'Hazard', chips: ['Raiders'], text: 'Nomadic raiders now striking traders, outposts and even convoys. The Outer Fields hold the largest population.', facts: [['Region', 'The Outer Fields']], side: 'r' },
  { key: 'library', at: orbitPoint(41, 300), icon: 'station', name: 'Library Station', sub: 'Rumored · orbit changes', chapter: 'Navigators Guild station · rumored', chips: ['Secret'], text: 'A secret Guild facility said to hold forbidden knowledge and dangerous artifacts. Its orbit is moved to keep it hidden.', facts: [['Region', 'Between the Outer Fields and Barrabas']], tier: 'near', side: 'r', rumored: true },
  { key: 'barrabas', at: orbitPoint(48, 157), icon: 'lighthouse', name: 'Lighthouse Station Barrabas', sub: '48 AD · last port', chapter: 'Lighthouse station', chips: ['Last port of call'], text: 'A conglomerate of modules and old Greatship plates around a beacon that calls farther into the Great Dark than any Greatship.', facts: [['Distance', '48 AD'], ['Known for', 'The Canteen of Lost Mates']], side: 'b' },
  { key: 'pardotum', at: orbitPoint(50, 170), icon: 'slipstream', name: 'Pardotum Tributary', sub: '50 AD · to the Far Colonies & Gahand', chapter: 'Slipstream tributary', chips: ['Innermost tributary'], text: 'The innermost tributary, where Barrabas stands watch. The slow boat to Numa leaves this way.', facts: [['Distance', '50 AD'], ['Leads to', 'The Far Colonies and Gahand']], side: 'b', out: 176 },
  { key: 'harwa', at: orbitPoint(52, 285), icon: 'slipstream', name: 'Harwa Tributary', sub: '52 AD · to Gamaru', chapter: 'Slipstream tributary', chips: ['Slipstream'], text: 'The branch of the Slipstream that leads to Gamaru.', facts: [['Distance', '52 AD'], ['Leads to', 'Gamaru']], side: 'r', out: 285 },
  { key: 'arkhanen', at: orbitPoint(54, 328), icon: 'slipstream', name: 'Arkhanen Tributary', sub: '54 AD · to Kasserat', chapter: 'Slipstream tributary', chips: ['Slipstream'], text: 'The branch of the Slipstream that leads to Kasserat.', facts: [['Distance', '54 AD'], ['Leads to', 'Kasserat']], side: 'r', out: 328 },
  { key: 'yevyena', at: orbitPoint(54, 118), icon: 'poi', name: "Yevyena's Point", sub: 'Last rock before the Great Dark', chapter: 'Point of interest', chips: ['Eccentric orbit'], text: 'The last known rock before the Great Dark, named by the Coriolite seer Yevyena mir-Yastapol in an apocalyptic vision.', facts: [['Orbit', 'Swings outside Barrabas']], tier: 'near', side: 'r' }
];

const el = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, value);
  if (parent) parent.append(node);
  return node;
};
const serrated = (outer, inner, points = 24) => {
  let d = '';
  for (let i = 0; i < points; i++) { const r = i % 2 ? inner : outer, a = Math.PI * 2 * i / points - Math.PI / 2; d += `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`; }
  return d + 'Z';
};

// One chart symbol: a frame drawn here (so it can turn, dash or fade) around an icon image.
const FRAME_R = { 'ship-city': 15, site: 10, ruin: 10.5, hazard: 11 };
function symbol(parent, icon) {
  const kind = icon === 'ship-city' ? 'ship-city' : HAZARDS.has(icon) ? 'hazard' : RUINS.has(icon) ? 'ruin' : 'site';
  const r = FRAME_R[kind];
  if (kind === 'site') { el('circle', { class: 'star-plate', r }, parent); el('circle', { class: 'star-frame', r }, parent); el('path', { class: 'star-frame', d: `M0 ${-r}v-2.5M0 ${r}v2.5M${-r} 0h-2.5M${r} 0h2.5` }, parent); }
  if (kind === 'ruin') { el('circle', { class: 'star-plate', r }, parent); el('path', { class: 'star-frame star-seal', d: serrated(r + .9, r - .4) }, parent); el('circle', { class: 'star-frame', r: r - 2.5, opacity: .5 }, parent); }
  const half = kind === 'ship-city' ? r * 24 / 21 : kind === 'hazard' ? r * 16 / 13 : r * 11 / 13;
  el('image', { class: 'star-icon' + (icon === 'rift-storm' ? ' star-spin' : ''), href: ICONS + icon + '.svg', x: -half, y: -half, width: 2 * half, height: 2 * half }, parent);
  return r;
}

// A labelled, selectable chart item. world-ui.js also uses this for world locations on the star map.
export function chartMarker({ x, y, icon, name, sub, tier, side = 'r', hazard, rumored, abandoned, key, className = '', label }) {
  const wrap = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, class: `${className}${tier === 'near' ? ' lod lod-near' : ''}`.trim() || null });
  const item = el('g', { class: `star-item${hazard ? ' hazard' : ''}${rumored ? ' rumored' : ''}${abandoned ? ' abandoned' : ''}`, tabindex: 0, role: 'button', 'aria-label': label || `${name}, ${sub}`, 'data-key': key }, wrap);
  const ico = el('g', { class: 'star-ico' }, item);
  el('circle', { class: 'star-halo', r: 26 }, ico);
  const sweep = el('circle', { class: 'star-sweep', r: 18 }, ico);
  const survey = el('circle', { class: 'star-survey', r: 14, pathLength: 1 }, ico);
  const drawn = el('g', { class: 'star-sym' }, ico);
  const r = icon ? symbol(drawn, icon) : 0;
  const nameText = el('text', { class: 'star-name' }, ico); nameText.textContent = name.toUpperCase();
  const subText = el('text', { class: 'star-sub' }, ico); subText.textContent = sub.toUpperCase();
  const labels = { name: nameText, sub: subText, survey, sweep, side, r };
  placeLabels(labels, r + 4);
  return Object.assign(wrap, { starItem: item, starLabels: labels });
}

function placeLabels({ name, sub, survey, sweep, side }, clearance) {
  survey.setAttribute('r', clearance + 1); sweep.setAttribute('r', clearance);
  const gap = clearance + 5;
  let x = gap, y = -1, anchor = 'start';
  if (side === 'l') { x = -gap; anchor = 'end'; }
  if (side === 't') { x = 0; y = -gap - 13; anchor = 'middle'; }
  if (side === 'b') { x = 0; y = gap + 10; anchor = 'middle'; }
  for (const [text, dy] of [[name, 0], [sub, 10]]) { text.setAttribute('x', x); text.setAttribute('y', y + dy); text.setAttribute('text-anchor', anchor); }
}

function drawBody(key, g, pickId) {
  const r = BODY_RADIUS[key];
  if (key === 'jumuah') {
    el('circle', { r: 32, fill: 'url(#starCorona)' }, g);
    el('circle', { class: 'star-line firm star-spin', r: 20, 'stroke-dasharray': '1.5 3.5' }, g);
    el('circle', { class: 'star-line soft star-spin reverse', r: 24.5, 'stroke-dasharray': '.8 5' }, g);
    el('circle', { r, fill: 'url(#starRedGiant)' }, g);
    el('circle', { r, fill: 'none', stroke: '#f3d58c', 'stroke-width': .9 }, g);
    return;
  }
  if (key === 'nubi') {
    el('circle', { r, fill: '#9a5a36' }, g);
    [[-1.4, -.7, .9], [1.4, 1.4, .6], [.7, -2.1, .5]].forEach(([cx, cy, cr]) => el('circle', { cx, cy, r: cr, fill: '#4a2616', opacity: .8 }, g));
    el('circle', { r, fill: 'url(#starShade)' }, g);
    el('circle', { r, fill: 'none', stroke: '#d6bd7e', 'stroke-width': .6 }, g);
    return;
  }
  const moubarra = key === 'moubarra', color = moubarra ? '#e8c56a' : '#7fc4d6', tilt = moubarra ? -14 : 12;
  const rings = moubarra ? [[12.7, 3.7, .7], [15.1, 4.4, .45], [17.6, 5.1, .8], [21.8, 6.3, .35]] : [[15.5, 3.9, .45], [18, 4.5, .35]];
  const back = el('g', { transform: `rotate(${tilt})` }, g);
  rings.forEach(([rx, ry, o], i) => el('ellipse', { rx, ry, fill: 'none', stroke: color, 'stroke-width': moubarra && i === 2 ? 1.6 : .7, opacity: o, 'stroke-dasharray': moubarra && i === 3 ? '10 4 2 6' : null }, back));
  if (moubarra) el('ellipse', { rx: 16.4, ry: 4.7, fill: 'none', stroke: '#140f08', 'stroke-width': 1.4, opacity: .9 }, back);
  const clip = el('clipPath', { id: pickId }, g); el('circle', { r }, clip);
  const disc = el('g', { 'clip-path': `url(#${pickId})` }, g);
  el('circle', { r, fill: color }, disc);
  el('rect', { x: -r, y: -r, width: 2 * r, height: 2 * r, fill: 'url(#starBands)', transform: `rotate(${tilt})` }, disc);
  el('circle', { r, fill: 'url(#starShade)' }, disc);
  const front = el('g', { transform: `rotate(${tilt})` }, g);
  rings.slice(0, 3).forEach(([rx, ry, o]) => el('path', { d: `M${-rx} 0A${rx} ${ry} 0 0 0 ${rx} 0`, fill: 'none', stroke: color, 'stroke-width': .7, opacity: o }, front));
  el('circle', { r, fill: 'none', stroke: '#d6bd7e', 'stroke-width': .6 }, g);
}

export function initStarChart() {
  const $ = id => document.getElementById(id);
  const app = $('app'), chart = document.querySelector('.chart'), svg = $('map'), bgLayer = $('bgLayer'), dossier = $('dossier');
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  app.classList.toggle('motion', motion);
  let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const layer = id => $(id);
  const grat = layer('chartGraticule'), fields = layer('chartFields'), regions = layer('chartRegions'), routes = layer('chartRoutes'), bodies = layer('chartBodies'), items = layer('chartItems');

  // Graticule and orbits, centred on Jumuah.
  for (let a = 0; a < 360; a += 30) { const t = a * Math.PI / 180; el('line', { class: 'star-line faint draw', x1: CENTER[0] + 25 * Math.cos(t), y1: CENTER[1] + 25 * Math.sin(t), x2: CENTER[0] + 520 * Math.cos(t), y2: CENTER[1] + 520 * Math.sin(t), pathLength: 1, style: `--d:${.2 + a / 1000}s` }, grat); }
  [1, 4, 7, 12, 27, 48].forEach((ad, i) => el('circle', { class: 'star-line orbit draw', cx: CENTER[0], cy: CENTER[1], r: orbitRadius(ad), pathLength: 1, style: `--d:${.1 + i * .12}s` }, grat));
  el('ellipse', { class: 'star-line orbit draw', cx: CENTER[0] - 28, cy: CENTER[1] + 42, rx: 253, ry: 232, transform: `rotate(-30 ${CENTER[0] - 28} ${CENTER[1] + 42})`, pathLength: 1, style: '--d:.9s' }, grat);
  el('circle', { class: 'star-line faint draw', cx: CENTER[0], cy: CENTER[1], r: orbitRadius(54) + 6, pathLength: 1, style: '--d:.95s' }, grat);

  // Debris fields: the White Fields of Albary (ice) and the Outer Fields (rock).
  const shard = (g, [x, y], size, color, opacity) => { const a = rand() * 6.28, points = Array.from({ length: 5 }, (_, i) => { const r = size * (.6 + rand() * .6), t = a + i * 1.256; return `${(x + r * Math.cos(t)).toFixed(1)},${(y + r * Math.sin(t)).toFixed(1)}`; }).join(' '); el('polygon', { points, fill: color, opacity }, g); };
  const ice = el('g', { class: 'fade', style: '--d:1.1s' }, fields);
  for (let i = 0; i < 170; i++) shard(ice, orbitPoint(18 + (rand() - .5) * 2.4, 150 + rand() * 70), .7 + rand() ** 2 * 1.8, '#cfe3ea', .35 + rand() * .45);
  const rock = el('g', { class: 'fade', style: '--d:1.2s' }, fields);
  for (let i = 0; i < 260; i++) shard(rock, orbitPoint(35 + (rand() - .5) * 3.2, rand() * 360), .4 + rand() ** 2 * 1.5, '#d6bd7e', .18 + rand() * .3);

  // Region lettering along arcs.
  const arc = (id, r, a0, a1, visible) => {
    const p = a => [CENTER[0] + r * Math.cos(a * Math.PI / 180), CENTER[1] + r * Math.sin(a * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    el('path', { id, class: `star-line ${visible ? 'faint' : 'hidden-path'} draw`, d: `M${x0} ${y0} A${r} ${r} 0 0 ${a1 > a0 ? 1 : 0} ${x1} ${y1}`, pathLength: 1, style: '--d:1s' }, regions);
  };
  const letter = (href, text, tier, size, dy) => { const t = el('text', { class: `star-region lod ${tier}`, dy, style: `--d:1.6s;font-size:${size}px` }, regions); el('textPath', { href: '#' + href, startOffset: '50%', 'text-anchor': 'middle' }, t).textContent = text; };
  arc('arcCore', 106, -122, -78); letter('arcCore', 'THE CORE', 'lod-far', 14, -6);
  arc('arcRim', 211, 115, 70); letter('arcRim', 'THE RIM', 'lod-far', 17, 15);
  arc('arcGulf', 169, -46, 2, true); letter('arcGulf', 'MEMOSAN GULF', 'hide-far', 12, -4);
  arc('arcAlbary', 173, 150, 215); letter('arcAlbary', 'WHITE FIELDS OF ALBARY', 'hide-far', 9.5, -3);
  arc('arcOuter', 236, 12, 42); letter('arcOuter', 'THE OUTER FIELDS', 'hide-far', 9.5, -2);
  arc('arcDark', 331, -140, -40, true); letter('arcDark', 'THE GREAT DARK', 'lod-far only-far', 24, -9);

  // Routes: the book's ore traffic and Guild routes, and the Slipstream tributaries leaving the system.
  const routeEls = {};
  const route = (key, [x0, y0], [x1, y1], bend, cls, label) => {
    const cx = (x0 + x1) / 2 - (y1 - y0) * bend, cy = (y0 + y1) / 2 + (x1 - x0) * bend, id = 'route-' + key;
    routeEls[key] = el('path', { id, class: `star-line ${cls} fade`, d: `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`, style: '--d:1.4s' }, routes);
    if (label) { const t = el('text', { class: 'star-minor star-route-label lod lod-near', dy: -4 }, routes); el('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' }, t).textContent = label; }
  };
  route('moubarra', BODY.shipcity, BODY.moubarra, .18, 'route', 'ORE TRAFFIC');
  route('amalum', BODY.shipcity, BODY.amalum, -.28, 'route', 'GUILD ROUTE');
  route('barrabas', BODY.shipcity, orbitPoint(48, 157), .12, 'route', 'GUILD ROUTE');
  JUMUAH.filter(item => item.out != null).forEach(item => route(item.key, item.at, orbitPoint(90, item.out), 0, 'route slip'));

  // Bodies at chart scale.
  const bodyGroups = {};
  Object.keys(BODY_RADIUS).forEach((key, i) => { const g = el('g', { transform: `translate(${BODY[key][0]} ${BODY[key][1]})` }, bodies); drawBody(key, el('g', { class: 'star-sym', style: `--d:${1 + i * .15}s` }, g), 'clip-' + key); bodyGroups[key] = g; });
  JUMUAH.filter(item => item.moon).forEach(item => el('circle', { cx: item.at[0], cy: item.at[1], r: 1.8, fill: item.moon === 'molten' ? '#ff9a55' : '#cbc6b6', class: 'lod lod-near' }, bodies));
  [['CASSRAT DIVISION', -16.4, -1.5, 'end'], ['SCYTHE', 21, 6, 'start']].forEach(([text, dx, dy, anchor]) => { const w = el('g', { class: 'lod lod-near', transform: `translate(${BODY.moubarra[0] + dx} ${BODY.moubarra[1] + dy})` }, bodies); el('text', { class: 'star-minor star-ico', 'text-anchor': anchor }, w).textContent = text; });

  // Book items.
  const markers = {};
  JUMUAH.forEach((item, i) => {
    const marker = chartMarker({ x: item.at[0], y: item.at[1], icon: item.icon, name: item.name, sub: item.sub, tier: item.tier, side: item.side, hazard: HAZARDS.has(item.icon), rumored: item.rumored, abandoned: item.abandoned, key: item.key });
    marker.starItem.querySelector('.star-sym').style.setProperty('--d', `${(item.tier === 'near' ? 1.9 : 1.5) + i * .02}s`);
    marker.starItem.addEventListener('click', event => { event.stopPropagation(); select(item.key); });
    marker.starItem.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(item.key); } });
    items.append(marker); markers[item.key] = marker;
  });

  // ----- View: pan, zoom, parallax background and level of detail -----
  const DEFAULT = [-70, -47, 1040, 694], MIN_W = 170, MAX_W = 1500;
  const BG = { x: -600, y: -290, w: 2100, h: 1181 };
  let view = DEFAULT.slice(), raf = 0, lastScale = 0;
  const projection = () => { const r = chart.getBoundingClientRect(); const s = Math.max(r.width / view[2], r.height / view[3]); return { r, s, ox: (r.width - view[2] * s) / 2, oy: (r.height - view[3] * s) / 2 }; };
  // Layers drift at a fraction of the chart's movement: the wash slower, the dust faster.
  const layerOrigin = factor => { const cx = view[0] + view[2] / 2, cy = view[1] + view[3] / 2; return [CENTER[0] + (cx - CENTER[0]) * factor - view[2] / 2, CENTER[1] + (cy - CENTER[1]) * factor - view[3] / 2]; };
  function sync() {
    svg.setAttribute('viewBox', view.join(' '));
    const k = view[2] / DEFAULT[2];
    if (Math.abs(k - lastScale) > .001) {
      svg.style.setProperty('--k', k); lastScale = k;
      for (const item of JUMUAH) if (item.body) placeLabels(markers[item.key].starLabels, BODY_CLEARANCE[item.body] / k + 3);
    }
    const { r, s, ox, oy } = projection(); if (!r.width) return;
    const [bx, by] = layerOrigin(.6);
    Object.assign(bgLayer.style, { left: `${(BG.x - bx) * s + ox}px`, top: `${(BG.y - by) * s + oy}px`, width: `${BG.w * s}px`, height: `${BG.h * s}px` });
    const zoom = DEFAULT[2] / view[2];
    chart.dataset.lod = zoom < .8 ? 'far' : zoom > 1.9 ? 'near' : 'mid';
  }
  const setView = next => { view = next; sync(); };
  const frameOn = (cx, cy, w) => { w = Math.max(MIN_W, Math.min(MAX_W, w)); const h = w * DEFAULT[3] / DEFAULT[2]; return [cx - w / 2, cy - h / 2, w, h]; };
  function animateTo(target) {
    cancelAnimationFrame(raf);
    if (!motion) { setView(target); return; }
    const step = () => { let done = true; const next = view.map((value, i) => { const d = target[i] - value; if (Math.abs(d) > .1) { done = false; return value + d * .12; } return target[i]; }); setView(next); if (!done) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  let drag = null;
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.star-item')) return;
    event.preventDefault(); cancelAnimationFrame(raf);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; svg.setPointerCapture(event.pointerId); chart.classList.add('dragging');
  });
  svg.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { s } = projection();
    setView([view[0] - (event.clientX - drag.x) / s, view[1] - (event.clientY - drag.y) / s, view[2], view[3]]);
    drag.x = event.clientX; drag.y = event.clientY;
  });
  const endDrag = event => { if (drag && event.pointerId === drag.id) { drag = null; chart.classList.remove('dragging'); } };
  svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('wheel', event => {
    event.preventDefault(); cancelAnimationFrame(raf);
    const { r, s, ox, oy } = projection();
    const px = view[0] + (event.clientX - r.left - ox) / s, py = view[1] + (event.clientY - r.top - oy) / s;
    const w = Math.max(MIN_W, Math.min(MAX_W, view[2] * Math.exp(event.deltaY * .0012))), scale = w / view[2];
    setView([px - (px - view[0]) * scale, py - (py - view[1]) * scale, w, view[3] * scale]);
  }, { passive: false });
  svg.addEventListener('dblclick', event => {
    if (event.target.closest('.star-item')) return;
    const { r, s, ox, oy } = projection();
    animateTo(frameOn(view[0] + (event.clientX - r.left - ox) / s, view[1] + (event.clientY - r.top - oy) / s, view[2] * .6));
  });
  new ResizeObserver(sync).observe(chart);

  // ----- Selection and the dossier -----
  const text = (id, value) => { $(id).textContent = value; };
  function clearSelection() { svg.querySelectorAll('.star-item.selected').forEach(node => node.classList.remove('selected')); Object.values(routeEls).forEach(route => route.classList.remove('active')); }
  function select(key) {
    const item = JUMUAH.find(entry => entry.key === key); if (!item) return;
    clearSelection();
    const node = markers[key].starItem; node.classList.add('selected');
    routeEls[key]?.classList.add('active');
    const sweep = node.querySelector('.star-sweep'); sweep.classList.remove('go'); void sweep.getBBox(); sweep.classList.add('go');
    text('chapter', item.chapter); text('name', item.name); text('lede', item.text);
    $('chips').replaceChildren(...item.chips.map(chip => Object.assign(document.createElement('span'), { className: 'chip', textContent: chip })));
    $('chartFacts').replaceChildren(...item.facts.flatMap(([term, value]) => [Object.assign(document.createElement('dt'), { textContent: term }), Object.assign(document.createElement('dd'), { textContent: value })]));
    const note = item.note || (item.rumored ? 'Unconfirmed. Reports disagree on where it is, or whether it exists.' : item.abandoned ? 'Abandoned. Nobody is known to keep it running.' : '');
    text('chartNote', note); $('chartNote').hidden = !note;
    dossier.classList.add('open'); dossier.setAttribute('aria-hidden', 'false');
    const width = key === 'jumuah' ? DEFAULT[2] : item.tier === 'near' ? 230 : item.body ? 420 : 560;
    animateTo(key === 'jumuah' ? DEFAULT.slice() : frameOn(item.at[0] - width * .12, item.at[1] + width * .04, width));
    document.dispatchEvent(new CustomEvent('chart-marker', { detail: { key } }));
  }
  function closeDossier() { dossier.classList.remove('open'); dossier.setAttribute('aria-hidden', 'true'); clearSelection(); animateTo(DEFAULT.slice()); }
  $('closeDossier').addEventListener('click', closeDossier);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && dossier.classList.contains('open')) closeDossier(); });

  // ----- Draw-in: the chart inks itself the first time it is shown after the page loads -----
  let drawn = false;
  const stage = $('mapStage');
  const drawIn = () => {
    if (drawn || stage.hidden) return;
    drawn = true; sync();
    if (!motion) return;
    svg.classList.add('drawing'); setTimeout(() => svg.classList.remove('drawing'), 4600);
  };
  new MutationObserver(drawIn).observe(stage, { attributes: true, attributeFilter: ['hidden'] });
  drawIn();

  // ----- Dust drifting in front of the chart -----
  const canvas = $('dust'), context = canvas.getContext('2d');
  const motes = Array.from({ length: 90 }, () => ({ x: BG.x + rand() * BG.w, y: BG.y + rand() * BG.h, r: .4 + rand() ** 2 * 1.5, vx: (rand() - .5) * .04, vy: (rand() - .5) * .04, a: .12 + rand() * .3, phase: rand() * 6.3 }));
  let frame = 0;
  function resize() { const r = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.max(1, Math.round(r.width * ratio)); canvas.height = Math.max(1, Math.round(r.height * ratio)); context.setTransform(ratio, 0, 0, ratio, 0, 0); sync(); }
  function dust() {
    const { r, s, ox, oy } = projection(), [dx, dy] = layerOrigin(1.2);
    context.clearRect(0, 0, r.width, r.height);
    for (const mote of motes) {
      if (motion) { mote.x += mote.vx; mote.y += mote.vy; mote.phase += .012; if (mote.x < BG.x) mote.x += BG.w; if (mote.x > BG.x + BG.w) mote.x -= BG.w; if (mote.y < BG.y) mote.y += BG.h; if (mote.y > BG.y + BG.h) mote.y -= BG.h; }
      const sx = (mote.x - dx) * s + ox, sy = (mote.y - dy) * s + oy;
      if (sx < -6 || sy < -6 || sx > r.width + 6 || sy > r.height + 6) continue;
      context.beginPath(); context.arc(sx, sy, mote.r * Math.min(1.6, s), 0, 6.283);
      context.fillStyle = `rgba(255,226,176,${mote.a * (.7 + .3 * Math.sin(mote.phase))})`; context.fill();
    }
    frame = requestAnimationFrame(dust);
  }
  const updateDust = () => { const running = !stage.hidden && !document.hidden; if (running && !frame) { resize(); frame = requestAnimationFrame(dust); } if (!running && frame) { cancelAnimationFrame(frame); frame = 0; } };
  document.addEventListener('visibilitychange', updateDust);
  new MutationObserver(updateDust).observe(stage, { attributes: true, attributeFilter: ['hidden'] });
  new ResizeObserver(resize).observe(chart);
  resize(); updateDust();
}
