const conditions = ['exhausted', 'dazed', 'confused', 'distracted', 'shaken', 'disheartened'];
const text = (value, max = 500) => typeof value === 'string' && value.length <= max ? value.trim() : null;
const number = (value, max = 999999) => Number.isInteger(value) && value >= 0 && value <= max ? value : null;
function entries(value, fields, limit = 30) {
  if (!Array.isArray(value) || value.length > limit) return null;
  const rows = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const row = {};
    for (const [key, kind] of Object.entries(fields)) {
      const raw = entry[key] ?? (kind === 'number' ? 0 : '');
      const clean = kind === 'number' ? number(raw, 99) : text(raw, 200);
      if (clean === null) return null;
      row[key] = clean;
    }
    rows.push(row);
  }
  return rows;
}

export function cleanSheet(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const result = {};
  for (const key of ['specialty', 'quirk', 'contacts', 'keepsake']) {
    const value = text(input[key] ?? '', 1000); if (value === null) return null; result[key] = value;
  }
  for (const key of ['experience', 'supply', 'rukh']) {
    const value = number(input[key] ?? 0); if (value === null) return null; result[key] = value;
  }
  const vitality = input.vitality ?? {};
  if (!vitality || typeof vitality !== 'object') return null;
  result.vitality = {};
  for (const key of ['health', 'hope', 'heart']) {
    const value = number(vitality[key] ?? 0, 99); if (value === null) return null; result.vitality[key] = value;
  }
  if (!Array.isArray(input.conditions ?? []) || (input.conditions ?? []).some(item => !conditions.includes(item))) return null;
  result.conditions = [...new Set(input.conditions ?? [])];
  for (const key of ['injuries', 'trauma', 'blight']) {
    const value = text(input[key] ?? '', 2000); if (value === null) return null; result[key] = value;
  }
  result.talents = entries(input.talents ?? [], { name: 'text', level: 'number' }, 60);
  result.weapons = entries(input.weapons ?? [], { name: 'text', bonus: 'number', damage: 'number', crit: 'number', range: 'text', features: 'text' });
  result.armor = entries(input.armor ?? [], { name: 'text', rating: 'number', blight: 'number', features: 'text' });
  result.equipment = entries(input.equipment ?? [], { name: 'text', weight: 'text', bonus: 'number', features: 'text' }, 100);
  result.tinyItems = entries(input.tinyItems ?? [], { name: 'text' }, 100);
  if ([result.talents, result.weapons, result.armor, result.equipment, result.tinyItems].some(x => x === null)) return null;
  return result;
}
