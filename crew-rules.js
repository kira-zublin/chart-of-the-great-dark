// Crew sheet rules from Core Rules chapters 2, 3, 5, 6 and 11: names and numbers only. Descriptions are
// book text and come from the local rules library (/api/rules). Pure data and helpers, shared by the crew
// sheet, the crew API and the tests.

// Delve roles in formation order: the Scout ranges ahead of the Delver, who leads; the Guard holds the middle.
export const roles = [
  { key: 'scout', name: 'Scout', attributes: ['perception', 'logic'], item: 'Deep scanner', maneuvers: ['Bait & Switch', 'Bird Call', 'One Step Ahead', 'Situational Awareness'], start: 'Situational Awareness' },
  { key: 'delver', name: 'Delver', attributes: ['agility', 'insight'], item: 'Basic climbing kit', maneuvers: ['Command', 'Escape Route', 'Rally', 'Rope Master'], start: 'Rally' },
  { key: 'guard', name: 'Guard', attributes: ['strength', 'perception'], item: 'Fusillard rifle', maneuvers: ['Concentrate Fire', 'Field Recovery', 'Flank', 'Protect'], start: 'Flank' },
  { key: 'burrower', name: 'Burrower', attributes: ['strength', 'logic'], item: 'Pickaxe and shovel', maneuvers: ['Demolition', 'Destabilize', 'Fearless', 'Smoke Screen'], start: 'Destabilize' },
  { key: 'archaeologist', name: 'Archaeologist', attributes: ['logic', 'insight'], item: 'The Book of Glyphs', maneuvers: ['Analyze', 'Feint', 'Find Weak Spot', 'See Pattern'], start: 'Analyze' }
];
export const rosterOrder = ['delver', 'scout', 'guard', 'burrower', 'archaeologist'];
export const bookManeuvers = roles.flatMap(role => role.maneuvers);
export const startingManeuvers = roles.map(role => role.start);
export const maneuverCost = 5;
export const roleFit = (attributes = {}, role) => role.attributes.reduce((sum, key) => sum + (Number(attributes[key]) || 0), 0);

export const birdTypes = { Ward: { health: 5, energy: 2, special: "Raptor's Call" }, Guide: { health: 4, energy: 3, special: 'Farsight' }, Specter: { health: 3, energy: 4, special: 'Enshroud' } };
export const basicPowers = ['Attack', 'Defend', 'Clear Blight', 'Blight Scan', 'Soak Blight', 'Glow'];
export const advancedPowers = [
  ['Fetch', 'All'], ['Farsight', 'Guide'], ['Dimensional Flitting', 'All'], ['Enshroud', 'Specter'], ['Flicker Field', 'All'], ['Glyph Warden', 'All'],
  ['Illusionary Veil', 'Guide'], ['Phoenix Engine', 'All'], ['Energy Bridge', 'Ward'], ["Raptor's Call", 'Ward'], ['Delve Dream', 'All'], ['Soul Delve', 'Specter']
].map(([name, type]) => ({ name, type }));
// Only Blight Scan works without spending Energy.
export const freePowers = ['Blight Scan'];
// A power for the Bird's own type (or any type) costs 5 CP; one for another type costs 10.
export function powerCost(power, birdType) {
  const entry = advancedPowers.find(item => item.name === power);
  return !entry || entry.type === 'All' || entry.type === birdType ? 5 : 10;
}
export const birdMaximumCost = 5;
// Losing control: D6, plus the Energy spent if the command succeeded, read against these upper bounds.
export const controlBands = [[2, 'mind-link-break'], [4, 'self-preservation-mode'], [6, 'lightstorm-display'], [7, 'temporal-drift'], [8, 'energy-drain'], [Infinity, 'energy-surge']];
export const controlOutcome = total => controlBands.find(([max]) => total <= max)[1];
export function commandDice({ insight = 0, handler = 0, companion = false, energy = 0, weakened = false }) {
  return Math.max(1, insight - (weakened ? 2 : 0) + handler + (companion ? 1 : 0) + energy);
}

export const paints = [['Azure Blue', '#3b6d9a'], ['Crimson Red', '#8e2f2a'], ['Midnight Black', '#15181c'], ['Tangerine Orange', '#c7702e'], ['Emerald Green', '#2f7a55'], ['Razzle Dazzle Pattern', 'repeating-linear-gradient(135deg, #e7e2d4 0 4px, #1c2024 4px 8px)']];

// Stats: maneuverability, speed (combat speed for shuttles), hull, armor, Blight protection (rovers),
// travel speed in AD per day and range in AD (shuttles), passengers, cargo in supply, and upgrade slots.
export const vehicles = {
  rover: {
    label: 'Rover',
    models: {
      Rhino: { note: 'Wheeled all-terrain workhorse', stats: { maneuverability: 3, speed: 2, hull: 9, armor: 6, blight: 4, passengers: 5, cargoCapacity: 1500, slots: 7 }, starts: ['Comfortable Bunk Beds', 'Airlock', 'Tow Line'] },
      Crocodile: { note: 'Tracked, for rubble, ice and cliffs', stats: { maneuverability: 2, speed: 2, hull: 11, armor: 7, blight: 3, passengers: 8, cargoCapacity: 2000, slots: 6 }, starts: ['Airlock'] },
      Sphinx: { note: 'Hovers on gravity projectors', stats: { maneuverability: 4, speed: 3, hull: 7, armor: 5, blight: 2, passengers: 6, cargoCapacity: 1000, slots: 5 }, starts: [], hover: true }
    },
    // [name, slots, cost per level]
    upgrades: [['Airlock', 1, [1]], ['Amphibious', 1, [2]], ['Armor Plating', 0, [2, 5, 10]], ['Comfortable Bunk Beds', 1, [2]], ['Enhanced Scopes', 0, [3, 5, 10]], ['Entertainment Module', 0, [3]],
      ['Excavator Arm', 1, [3]], ['Field Library', 1, [1, 3]], ['Gun Turret', 0, [1]], ['Hab Module', 0, [2]], ['Hazard Protection', 0, [2, 5, 10]], ['Hydroponic Garden Cube', 1, [5]],
      ['Improved Suspension', 0, [2, 5, 10]], ['Jump Jets', 0, [6], 'hover'], ['Laboratory', 1, [5]], ['Med Lab', 1, [5]], ['Med Station', 1, [3]], ['New Coat of Paint', 0, [1]],
      ['Orbital Distress Beacon', 0, [1]], ['Remote Control System', 0, [3]], ['Robust Hull', 0, [3, 5, 10]], ['Salvage Crane', 1, [5]], ['Small Galley', 1, [1, 2, 3]], ['Storm Bolts', 0, [1]],
      ['Storm Lanterns', 0, [1]], ['Tow Line', 0, [1]], ['Turbo Charger', 0, [5]], ['Workshop', 1, [5]]]
  },
  shuttle: {
    label: 'Shuttle',
    models: {
      Grasshopper: { note: 'The Guild workhorse, +1 die to repairs', stats: { maneuverability: 3, speed: 4, hull: 14, armor: 6, travel: 1, range: 15, passengers: 6, cargoCapacity: 3000, slots: 7 }, starts: ['Galley', 'Comfortable Bunks'] },
      Owl: { note: 'Tough, with powerful sensors', stats: { maneuverability: 2, speed: 3, hull: 16, armor: 7, travel: 1, range: 20, passengers: 8, cargoCapacity: 4000, slots: 5 }, starts: ['Enhanced Sensors'] },
      Manta: { note: 'Fast, sleek and rare', stats: { maneuverability: 4, speed: 4, hull: 12, armor: 5, travel: 2, range: 20, passengers: 5, cargoCapacity: 2000, slots: 3 }, starts: ['Enhanced Avionics'] }
    },
    upgrades: [['Composite Plating', 0, [2, 5, 10]], ['Comfortable Bunks', 1, [2]], ['Enhanced Avionics', 0, [2, 5, 10]], ['Enhanced Sensors', 0, [2, 5, 10]], ['Entertainment Module', 0, [3]], ['Escape Pod', 1, [2]],
      ['External Cargo Racks', 0, [5]], ['Galley', 1, [1, 2, 3]], ['Garden Wall', 1, [1]], ['Hull Art', 0, [1]], ['Infirmary', 1, [3]], ['Laboratory', 1, [5]], ['Library', 1, [1, 3, 5]],
      ['Med Lab', 1, [5]], ['Optimized Projector', 0, [5]], ['Reinforced Hull', 0, [3, 5, 10]], ['Remote Control System', 0, [3]], ['Salvage Hook', 1, [5]], ['Shrine', 1, [1]],
      ['Storm Lanterns', 0, [1]], ['Turret', 1, [1]], ['Workshop', 1, [5]]]
  }
};
export const vehicleStatKeys = ['maneuverability', 'speed', 'hull', 'armor', 'blight', 'travel', 'range', 'passengers', 'cargoCapacity', 'slots'];
export function findUpgrade(kind, name) {
  const row = vehicles[kind].upgrades.find(([title]) => title === name);
  return row ? { name: row[0], slots: row[1], costs: row[2], hoverOnly: row[3] === 'hover' } : null;
}
export const levelName = (level, levels) => levels > 1 ? ['I', 'II', 'III'][level - 1] : '';
// Slots used by installed upgrades; custom upgrades that aren't in the book take no slot.
export const slotsUsed = (kind, installed = []) => installed.reduce((sum, item) => sum + (findUpgrade(kind, item.name)?.slots || 0), 0);
// The next level of an upgrade and its cost, or null when it is fully installed.
export function nextLevel(kind, installed = [], name) {
  const upgrade = findUpgrade(kind, name); if (!upgrade) return null;
  const level = (installed.find(item => item.name === name)?.level || 0) + 1;
  return level > upgrade.costs.length ? null : { level, cost: upgrade.costs[level - 1] };
}
export function vehicleFromModel(kind, model) {
  const book = vehicles[kind].models[model]; if (!book) return null;
  return { ...book.stats, installed: book.starts.map(name => ({ name, level: 1 })) };
}

// The session debrief: one crew point for each yes (the book's wording is paraphrased).
export const debriefQuestions = ['Took on a challenge together', 'Undertook a delve, a trek or a Greatship voyage', 'Found a new Builder Glyph or artifact', 'Gave or was promised a favor by a faction', 'Turned in an artifact to a faction', 'Got help from the Bird in desperate circumstances'];
