import { body, currentProfile, db, error, guarded, json } from '../lib/server.js';

export const roles = ['delver', 'burrower', 'scout', 'guard', 'archaeologist'];
const uuid = /^[0-9a-f-]{36}$/i;
function objectFields(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const [key, type] of Object.entries(keys)) {
    const item = value[key] ?? (type === 'number' ? 0 : '');
    if (type === 'number' ? !Number.isInteger(item) || item < 0 || item > 999 : typeof item !== 'string' || item.length > (type === 'long' ? 2000 : 500)) return null;
    result[key] = type === 'number' ? item : item.trim();
  }
  return result;
}
export function cleanCrewField(field, value) {
  if (field === 'name') return typeof value === 'string' && value.length <= 100 ? value.trim() : null;
  if (field === 'crew_points') return Number.isInteger(value) && value >= 0 && value <= 999 ? value : null;
  if (field === 'bird') return objectFields(value, { name: 'text', type: 'text', appearance: 'long', description: 'long', health: 'number', energy: 'number', powers: 'long' });
  if (field === 'rover' || field === 'shuttle') return objectFields(value, { name: 'text', model: 'text', hull: 'number', armor: 'number', blight: 'number', speed: 'text', range: 'text', upgrades: 'text', cargo: 'long' });
  if (field === 'maneuvers' && Array.isArray(value) && value.length <= 30 && value.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.name === 'string' && item.name.length <= 120 && typeof item.description === 'string' && item.description.length <= 2000)) {
    return value.map(item => ({ name: item.name.trim(), description: item.description.trim() })).filter(item => item.name || item.description);
  }
  return null;
}
async function readCrew(sql) {
  const crew = (await sql`SELECT * FROM crew WHERE id = 1`)[0];
  const members = await sql.query('SELECT r.role, r.character_id, c.name AS character_name, c.owner_id FROM crew_roles r LEFT JOIN characters c ON c.id = r.character_id ORDER BY r.rowid');
  const images = await sql`SELECT slot FROM crew_images`;
  const maneuvers = JSON.parse(crew.maneuvers).map(item => typeof item === 'string' ? { name: item, description: '' } : item);
  return { ...crew, bird: JSON.parse(crew.bird), rover: JSON.parse(crew.rover), shuttle: JSON.parse(crew.shuttle), maneuvers, roles: members, images: Object.fromEntries(images.map(item => [item.slot, true])) };
}
export async function GET(req) {
  return guarded(async () => {
    const sql = db(); if (!await currentProfile(req, sql)) return error('Sign in to see the crew', 401);
    return json({ crew: await readCrew(sql) });
  });
}
export async function PATCH(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Sign in to edit the crew', 401);
    const data = await body(req);
    if (data.action === 'assign') {
      if (!roles.includes(data.role) || (data.characterId !== null && (typeof data.characterId !== 'string' || !uuid.test(data.characterId))) || (data.expectedId !== null && (typeof data.expectedId !== 'string' || !uuid.test(data.expectedId)))) return error('Invalid role assignment');
      const current = (await sql`SELECT character_id FROM crew_roles WHERE role = ${data.role}`)[0];
      if ((current?.character_id ?? null) !== data.expectedId) return error('This role changed. Refresh the crew sheet.', 409);
      if (current?.character_id && profile.role !== 'gm') {
        const assigned = (await sql`SELECT owner_id FROM characters WHERE id = ${current.character_id}`)[0];
        if (assigned?.owner_id !== profile.id) return error('Only the owner or GM can change this role', 403);
      }
      if (data.characterId) {
        const character = (await sql`SELECT owner_id, kind FROM characters WHERE id = ${data.characterId}`)[0];
        if (!character || character.kind !== 'pc') return error('Choose a player character', 400);
        if (profile.role !== 'gm' && character.owner_id !== profile.id) return error('Choose one of your characters', 403);
      }
      try {
        const changed = await sql.query('UPDATE crew_roles SET character_id = ? WHERE role = ? AND character_id IS ? RETURNING role', [data.characterId, data.role, data.expectedId]);
        if (!changed.length) return error('This role changed. Refresh the crew sheet.', 409);
      } catch (cause) {
        if (String(cause.code).startsWith('SQLITE_CONSTRAINT')) return error('That character already has a role', 409);
        throw cause;
      }
      await sql`UPDATE crew SET revision = revision + 1 WHERE id = 1`;
      return json({ crew: await readCrew(sql) });
    }
    const value = cleanCrewField(data.field, data.value);
    if (value === null || !Number.isInteger(data.revision)) return error('Invalid crew change');
    const stored = typeof value === 'object' ? JSON.stringify(value) : value;
    const columns = { name: 'name', crew_points: 'crew_points', bird: 'bird', rover: 'rover', shuttle: 'shuttle', maneuvers: 'maneuvers' };
    const changed = await sql.query(`UPDATE crew SET ${columns[data.field]} = ?, revision = revision + 1 WHERE id = 1 AND revision = ? RETURNING revision`, [stored, data.revision]);
    if (!changed.length) return error('The crew changed while you were editing. Refresh and try again.', 409);
    return json({ crew: await readCrew(sql) });
  });
}
