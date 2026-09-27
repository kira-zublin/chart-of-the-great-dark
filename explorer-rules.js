// Explorer sheet rules and book choices from Core Rules chapter 2. Only names and
// numbers live here; the book's rule text stays out of this public repository.
// Pure data and helpers, shared by the sheet, the chat roll and the tests.

// Clockwise round the attribute wheel, so each pair that makes a pool shares an edge.
export const attributes = [
  { key: 'strength', abbr: 'STR', name: 'Strength', condition: 'exhausted' },
  { key: 'agility', abbr: 'AGL', name: 'Agility', condition: 'dazed' },
  { key: 'logic', abbr: 'LOG', name: 'Logic', condition: 'confused' },
  { key: 'empathy', abbr: 'EMP', name: 'Empathy', condition: 'disheartened' },
  { key: 'perception', abbr: 'PER', name: 'Perception', condition: 'distracted' },
  { key: 'insight', abbr: 'INS', name: 'Insight', condition: 'shaken' }
];
export const pools = [
  { key: 'health', name: 'Health', from: ['strength', 'agility'] },
  { key: 'hope', name: 'Hope', from: ['logic', 'empathy'] },
  { key: 'heart', name: 'Heart', from: ['insight', 'perception'] }
];
export const conditionName = key => key[0].toUpperCase() + key.slice(1);

export const factions = ['The Machinists Guild', 'The Gardeners Guild', 'The Navigators Guild', 'The Black Toad', 'The Coriolites', 'Mining Combine', 'Wreckers'];

// faction is null where the book lets the Explorer roll or choose.
export const origins = [
  { name: 'The Decrepit Halls of an Orphanage', place: 'The Orphanage', talent: 'Stealthy', faction: 'The Navigators Guild', rukh: 'D6 × 100' },
  { name: 'In the Depths of a Mining Colony', place: 'A Mining Colony', talent: 'Miner', faction: 'Mining Combine', rukh: 'D6 × 100' },
  { name: 'Under the Sunless Sky of the Far Colonies', place: 'The Far Colonies', talent: 'Endurance', faction: 'Mining Combine', rukh: 'D6 × 100' },
  { name: 'Among the Alleys and Shanties of Aluminum Bay', place: 'Aluminum Bay', talent: 'Actor', faction: null, rukh: 'D6 × 100' },
  { name: 'Under the Iron Sky of the Dome', place: 'The Dome', talent: 'Acrobat', faction: null, rukh: '3D6 × 100' },
  { name: 'Somewhere in the Eternal Fog of the Haze', place: 'The Haze', talent: 'Sleight of Hand', faction: 'The Black Toad', rukh: '3D6 × 100' },
  { name: 'Among the Hulks and Wrecks of Hull Town', place: 'Hull Town', talent: 'Exo-Specialist', faction: null, rukh: '3D6 × 100' },
  { name: 'Deep Inside the Factory City of the Turbine Halls', place: 'The Turbine Halls', talent: 'Mechanic', faction: 'The Machinists Guild', rukh: '3D6 × 100' },
  { name: 'In the Purple Meadows of the Cave Gardens', place: 'The Cave Gardens', talent: 'Botanist', faction: 'The Gardeners Guild', rukh: 'D6 × 1,000' },
  { name: 'In the Eternal Dusk of the Inner Sanctum', place: 'The Inner Sanctum', talent: 'Cultural Savant', faction: 'The Coriolites', rukh: 'D6 × 1,000' },
  { name: 'In the Lighthouse on the Edge of the Dark', place: 'The Lighthouse', talent: 'Lookout', faction: 'The Navigators Guild', rukh: 'D6 × 100' },
  { name: 'Among the Hulks of a Scavenger Herd', place: 'A Scavenger Herd', talent: 'Zero-G Training', faction: 'Wreckers', rukh: 'D6 × 100' },
  { name: 'In the Depths of a Greatship', place: 'A Greatship', talent: 'Shuttle Pilot', faction: 'The Navigators Guild', rukh: '3D6 × 100' }
];

const weaponTalents = ['Blade Fighter', 'Bowman', 'Demolitions Expert', 'Heavy Weapons', 'Pistoleer', 'Polearms', 'Pugilist', 'Sharpshooter'];
// Each specialty is [name, free talent], in the book's D6 order.
export const professions = [
  { name: 'Artist', key: 'empathy', talents: ['Acrobat', 'Charmer', 'Cultural Savant', 'Renowned'], specialties: [['Hull Painter', 'Zero-G Training'], ['Staircase Poet', 'Charmer'], ['Maidy Row Balladeer', 'Musician'], ['Alley Theater Actor', 'Disguise'], ['Occasional Publisher', 'Librarian'], ['Machine Artisan', 'Jury-Rig']] },
  { name: 'Enforcer', key: 'agility', talents: [...weaponTalents, 'Commander', 'Evasive', 'Medic'], specialties: [['Zapti Constable', 'Interrogator'], ['Guild Militia', 'Lookout'], ['Fusillard Protector', 'Bodyguard'], ['Guild Investigator', 'Investigator'], ['Coriolite Guard', 'Polearms'], ['Bounty Hunter', 'Streetwise']] },
  { name: 'Esoteric', key: 'insight', talents: ['Actor', 'Botanist', 'Cultural Savant', 'Librarian'], specialties: [['Spice Engineer', 'Laboratorist'], ['Bird Warden', 'Bird Handler'], ['Coriolite Seer', 'Intuition'], ['Revolutionary Prophet', 'Agitator'], ['Toad Dreamer', 'Hardened'], ['Rim Zealot', 'Mentalist']] },
  { name: 'Odd Jobber', key: 'empathy', talents: ['Actor', 'Charmer', 'Cultural Savant', 'Streetwise'], specialties: [['Guild Clerk', 'Librarian'], ['Stair Peddler', 'Mentalist'], ['Ice Trader', 'Barter'], ['Alley Cook', 'Cook'], ['Coriolite Servant', 'Cultural Savant'], ['Artifact Dealer', 'Artifact Specialist']] },
  { name: 'Roughneck', key: 'strength', talents: ['Endurance', 'Force', 'Jury-Rig', 'Scan Operator'], specialties: [['Hull Guard', 'Lookout'], ['Wreck Diver', 'Exo-Specialist'], ['Vacuum Welder', 'Zero-G Training'], ['Deep Miner', 'Miner'], ['Crane Rat', 'Acrobat'], ['Machine Tender', 'Mechanic']] },
  { name: 'Scholar', key: 'logic', talents: ['Investigator', 'Librarian', 'Smart', 'Teratology'], specialties: [['Guild Archivist', 'Librarian'], ['Algebraist Apprentice', 'Astrometry'], ['Slipstream Cartographer', 'Cartographer'], ['Diaspora Historian', 'Historian'], ['Cave Botanist', 'Botanist'], ['Builder Archaeologist', 'Archaeology']] },
  { name: 'Scoundrel', key: 'perception', talents: ['Acrobat', 'Charmer', 'Lookout', 'Stealthy'], specialties: [['Dust Runner', 'Streetwise'], ['Tech Smuggler', 'Electro-Specialist'], ['Guild Spy', 'Stealthy'], ['Alley Thug', 'Thug'], ['Hull Cutter', 'Mechanic'], ['Con Artist', 'Actor']] },
  { name: 'Traveler', key: 'perception', talents: ['Driver', 'Mechanic', 'Exo-Specialist', 'Zero-G Training'], specialties: [['Tugship Pilot', 'Shuttle Pilot'], ['Hull Warden', 'Investigator'], ['Guild Surveyor', 'Scan Operator'], ['Kite Handler', 'Kite Operator'], ['Lighthouse Keeper', 'Endurance'], ['Asteroid Hauler', 'Exo-Specialist']] }
];

// Talents by group. A trailing "|1" marks a talent with a single level.
const talentGroups = {
  Combat: ['Blade Fighter', 'Bodyguard|1', 'Bowman', 'Defender', 'Demolitions Expert', 'Dirty Fighter|1', 'Evasive', 'Executioner|1', 'Fast Reflexes|1', 'Heavy Weapons', 'Pistoleer', 'Polearms', 'Pugilist', 'Sharpshooter'],
  Social: ['Actor', 'Agitator', 'Barter', 'Charmer', 'Cook', 'Interrogator', 'Malicious|1', 'Mentalist', 'Musician', 'Renowned|1', 'Thug'],
  Exo: ['Driver', 'Exo-Specialist', 'Greatship Pilot', 'Kite Operator', 'Shuttle Pilot'],
  Knowledge: ['Archaeology', 'Artifact Specialist', 'Astrometry', 'Botanist', 'Cartographer', 'Cultural Savant', 'Data Djinn', 'Glyph Scholar', 'Historian', 'Investigator', 'Laboratorist', 'Librarian', 'Quartermastery', 'Ruin Delver', 'Teratology'],
  Insight: ['Bird Handler', 'Intuition|1'],
  Equipment: ['Electro-Specialist', 'Jury-Rig', 'Mechanic', 'Miner', 'Permit|1', 'Scan Operator'],
  Recovery: ['Commander', 'Field Surgeon', 'Lone Wolf|1', 'Medic', 'Nine Lives|1', 'Nurse|1', 'Survivor|1'],
  Mobility: ['Acrobat', 'Assassin', 'Burglar', 'Disguise', 'Hunter', 'Lookout', 'Sixth Sense|1', 'Sleight of Hand', 'Stealthy', 'Streetwise', 'Tracker', 'Zero-G Training|1'],
  Resilience: ['Blight Resistant', 'Endurance', 'Force', 'Hardened', 'Hopeful', 'Pack Mule', 'Reckless|1', 'Resilient', 'Smart|1', 'Stamina', 'Tough']
};
export const talents = Object.entries(talentGroups).flatMap(([group, names]) => names.map(entry => {
  const [name, levels] = entry.split('|');
  return { name, group, max: Number(levels || 3) };
}));

export const ranges = ['Engaged', 'Short', 'Medium', 'Long', 'Extreme'];
export const weaponFeatures = ['1H', '2H', 'Autofire', 'Bulky', 'Concealable', 'Explosive', 'Fire', 'Flexible', 'Grape', 'High capacity', 'Long', 'Low capacity', 'Powered', 'Single shot', 'Stun'];
export const suitFeatures = ['Bulky', 'Cargo carrier', 'Comlink', 'Ejector', 'Electric lantern', 'Filter pack', 'Magnetic boots', 'Maneuvering thrusters', 'Reinforced exo servos', 'Vacuum resistant'];
// Rows each weight takes on the sheet; worn suits and tiny items take none.
export const weights = { Tiny: 0, Light: 0.5, Regular: 1, Heavy: 2 };

export const findOrigin = name => origins.find(item => item.name === name) || null;
export const findProfession = name => professions.find(item => item.name === name) || null;
export const findTalent = name => talents.find(item => item.name.toLowerCase() === String(name).trim().toLowerCase()) || null;
export const talentMax = name => findTalent(name)?.max ?? 3;
// Learning a talent costs 5 XP; each later level costs five times the new level.
export const raiseCost = level => 5 * (level + 1);

export function maxima(stats = {}) {
  return Object.fromEntries(pools.map(pool => [pool.key, pool.from.reduce((sum, key) => sum + (Number(stats[key]) || 0), 0)]));
}
export function penalty(conditions = [], attribute) {
  const condition = attributes.find(item => item.key === attribute)?.condition;
  return condition && conditions.includes(condition) ? 2 : 0;
}
// 24 points at creation; each attribute 2–5, the profession's key attribute up to 6.
export function attributeIssues(stats = {}, key = null) {
  const total = attributes.reduce((sum, item) => sum + (Number(stats[item.key]) || 0), 0);
  const outside = attributes.filter(item => { const value = Number(stats[item.key]) || 0; return value < 2 || value > (item.key === key ? 6 : 5); });
  return { total, ok: total === 24 && !outside.length, outside: outside.map(item => item.key) };
}
export const carryLimit = stats => (Number(stats?.strength) || 0) + 4;
export function carried(equipment = []) {
  return equipment.reduce((sum, item) => sum + (weights[item.weight] ?? weights.Regular), 0);
}
// Where a talent came from, for the label beside it.
export function talentSource(name, { origin, profession, specialty } = {}) {
  const job = findProfession(profession);
  const free = job?.specialties.find(([title]) => title === specialty)?.[1];
  const tags = [];
  if (findOrigin(origin)?.talent === name) tags.push('Origin');
  if (free === name) tags.push('Specialty');
  if (job?.talents.includes(name)) tags.push('Key');
  return tags.join(' · ');
}
export const splitFeatures = text => String(text || '').split(',').map(item => item.trim()).filter(Boolean);
export const joinFeatures = list => list.join(', ');
// The keepsake restores Hope once per session; a session is one evening, so the date is enough.
export const today = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
