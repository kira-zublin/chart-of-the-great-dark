// Shape of one rules reference entry, shared by the import script and its tests.
// Every text is bounded; unknown fields are dropped.
export const RULE_KINDS = ['talent', 'injury', 'trauma', 'blight', 'feature', 'maneuver', 'power', 'control', 'upgrade'];
const text = (value, max) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null;
const fields = {
  talent: { group: 40, text: 1500 },
  injury: { roll: 10, effect: 500, heal: 60 },
  trauma: { roll: 10, effect: 500, heal: 60 },
  blight: { roll: 10, description: 500, effect: 500, heal: 60 },
  feature: { applies: 10, text: 1000 },
  maneuver: { role: 20, text: 1000 },
  power: { type: 20, text: 1000, expression: 1000 },
  control: { roll: 10, text: 500 },
  upgrade: { vehicle: 10, text: 500 }
};

export function cleanRulesEntry(entry) {
  if (!entry || typeof entry !== 'object' || !RULE_KINDS.includes(entry.kind)) return null;
  if (typeof entry.key !== 'string' || !/^[a-z0-9-]{1,60}$/.test(entry.key)) return null;
  const name = text(entry.name, 80); if (!name) return null;
  const raw = entry.data && typeof entry.data === 'object' ? entry.data : {};
  const data = {};
  for (const [key, max] of Object.entries(fields[entry.kind])) {
    const value = text(raw[key] ?? '', max); if (value === null) return null; data[key] = value;
  }
  if (entry.kind === 'talent') {
    if (![1, 3].includes(raw.max)) return null;
    data.max = raw.max;
  }
  if (entry.kind === 'injury') {
    if (typeof raw.lethal !== 'boolean') return null;
    data.lethal = raw.lethal;
  }
  if (entry.kind === 'feature' && !['weapon', 'suit'].includes(data.applies)) return null;
  if (entry.kind === 'upgrade' && !['rover', 'shuttle'].includes(data.vehicle)) return null;
  return { kind: entry.kind, key: entry.key, name, data };
}
