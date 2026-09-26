// Creature stat blocks, shared by the creature API (validation) and the palette (defaults and labels).
// Two shapes follow Core Rules chapter 13: creatures (Ferocity, behavior table, signature attacks) and
// adversaries (six attributes, talents and equipment). Both live in one validated object.

export const CREATURE_CATEGORIES = ['blight', 'construct', 'beast', 'echo', 'adversary', 'other'];
export const CATEGORY_LABELS = { blight: 'Blight Being', construct: 'Construct', beast: 'Beast', echo: 'Echo', adversary: 'Adversary', other: 'Other' };
export const CREATURE_TYPES = ['creature', 'adversary'];
export const CREATURE_ATTRIBUTES = ['strength', 'agility', 'logic', 'perception', 'insight', 'empathy'];
// Small creatures give attackers -2 base dice and large ones +2 (Core Rules p. 223).
export const CREATURE_SIZES = ['small', 'normal', 'large'];
// Squares per side a placed creature covers in an Explorable.
export const CREATURE_FOOTPRINTS = [1, 2, 3];
// Placed creature stand-ups scale further than PCs'; kept in step with the database CHECK in migration 017.
export const CREATURE_SCALE = { min: 0.25, max: 3 };
// Numbers a signature attack may carry. A damaging attack with no crit threshold has crit null ("no crit").
export const ATTACK_NUMBERS = ['dice', 'damage', 'crit', 'blightDice', 'blight', 'despair'];

export const creatureIcon = category => `assets/icons/creatures/${CREATURE_CATEGORIES.includes(category) ? category : 'other'}.svg`;

export function blankStats(type = 'creature') {
  return {
    type, rarity: 0, ferocity: 1, health: type === 'adversary' ? 6 : 8, armor: 0,
    attributes: type === 'adversary' ? Object.fromEntries(CREATURE_ATTRIBUTES.map(name => [name, 3])) : { agility: 3, perception: 3 },
    size: 'normal', footprint: 1, description: '', containment: '',
    abilities: [], behavior: [], attacks: [], talents: [], equipment: ''
  };
}

const text = (value, max, required = false) => {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > max) return null;
  const clean = value.trim();
  return required && !clean ? null : clean;
};
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : null;
const optionalWhole = (value, min, max) => value === undefined || value === null || value === '' ? { ok: true, value: null } : { ok: whole(value, min, max) !== null, value };

function rows(value, limit, clean) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) return null;
  const result = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const row = clean(entry);
    if (!row) return null;
    result.push(row);
  }
  return result;
}

const cleanAbility = entry => {
  const name = text(entry.name, 80, true), body = text(entry.text, 1500);
  return name === null || body === null ? null : { name, text: body };
};
const cleanBehavior = entry => {
  const from = whole(entry.from, 1, 6), to = whole(entry.to ?? entry.from, 1, 6), body = text(entry.text, 500, true);
  return from === null || to === null || from > to || body === null ? null : { from, to, text: body };
};
const cleanAttack = entry => {
  const roll = whole(entry.roll, 1, 6), name = text(entry.name, 80, true), body = text(entry.text, 1500);
  if (roll === null || name === null || body === null) return null;
  const attack = { roll, name, text: body };
  for (const key of ATTACK_NUMBERS) {
    const { ok, value } = optionalWhole(entry[key], 0, 40);
    if (!ok) return null;
    attack[key] = value;
  }
  return attack;
};
const cleanTalent = entry => {
  const name = text(entry.name, 80, true), level = whole(entry.level ?? 1, 0, 9);
  return name === null || level === null ? null : { name, level };
};

// Returns a normalized stat block, or null when anything is out of range.
export function cleanStats(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !CREATURE_TYPES.includes(input.type)) return null;
  const stats = { type: input.type };
  const numbers = { rarity: [-3, 3, 0], ferocity: [1, 10, 1], health: [1, 99, null], armor: [0, 20, 0] };
  for (const [key, [min, max, fallback]] of Object.entries(numbers)) {
    const value = whole(input[key] ?? fallback, min, max);
    if (value === null) return null;
    stats[key] = value;
  }
  const attributes = input.attributes ?? {};
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes) || Object.keys(attributes).some(key => !CREATURE_ATTRIBUTES.includes(key))) return null;
  stats.attributes = {};
  // Listed in rulebook order; a creature usually has only Agility and Perception.
  for (const key of CREATURE_ATTRIBUTES) {
    if (attributes[key] === undefined || attributes[key] === null || attributes[key] === '') continue;
    const value = whole(attributes[key], 0, 20);
    if (value === null) return null;
    stats.attributes[key] = value;
  }
  stats.size = input.size ?? 'normal';
  stats.footprint = input.footprint ?? 1;
  if (!CREATURE_SIZES.includes(stats.size) || !CREATURE_FOOTPRINTS.includes(stats.footprint)) return null;
  stats.description = text(input.description, 4000);
  stats.containment = text(input.containment, 1000);
  stats.equipment = text(input.equipment, 1000);
  stats.abilities = rows(input.abilities, 12, cleanAbility);
  stats.behavior = rows(input.behavior, 12, cleanBehavior);
  stats.attacks = rows(input.attacks, 12, cleanAttack);
  stats.talents = rows(input.talents, 20, cleanTalent);
  if (Object.values(stats).some(value => value === null)) return null;
  stats.behavior.sort((a, b) => a.from - b.from);
  stats.attacks.sort((a, b) => a.roll - b.roll);
  return stats;
}

// The size modifier attackers apply, as the book states it.
export const sizeModifier = size => size === 'small' ? -2 : size === 'large' ? 2 : 0;

// "8 base dice, damage 2, crit 4" style summary of an attack's numbers, for lists and chat.
export function attackSummary(attack) {
  const parts = [];
  if (attack.dice !== null && attack.dice !== undefined) parts.push(`${attack.dice} base dice`);
  if (attack.damage !== null && attack.damage !== undefined) parts.push(`damage ${attack.damage}`, attack.crit === null || attack.crit === undefined ? 'no crit' : `crit ${attack.crit}`);
  if (attack.blightDice !== null && attack.blightDice !== undefined) parts.push(`Blight attack ${attack.blightDice} dice${attack.blight !== null && attack.blight !== undefined ? `, base Blight ${attack.blight}` : ''}`);
  else if (attack.blight !== null && attack.blight !== undefined) parts.push(`${attack.blight} Blight`);
  if (attack.despair !== null && attack.despair !== undefined) parts.push(`${attack.despair} despair`);
  return parts.join(' · ');
}
