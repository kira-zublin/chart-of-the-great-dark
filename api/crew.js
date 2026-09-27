import { body, currentProfile, db, error, guarded, json } from '../lib/server.js';
import { birdTypes } from '../crew-rules.js';

export const roles = ['delver', 'burrower', 'scout', 'guard', 'archaeologist'];
const uuid = /^[0-9a-f-]{36}$/i;
const text = (value, max) => typeof value === 'string' && value.length <= max ? value.trim() : null;
const whole = (value, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : null;
// Older sheets stored some numbers as free text ("2 zones"); keep their leading number.
const legacyNumber = (value, max) => typeof value === 'string' ? Math.min(max, Number.parseInt(value, 10) || 0) : value;
function fields(value, spec) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const [key, [kind, max]] of Object.entries(spec)) {
    const raw = value[key] ?? (kind === 'number' ? 0 : '');
    const clean = kind === 'number' ? whole(legacyNumber(raw, max), max) : text(raw, max);
    if (clean === null) return null;
    result[key] = clean;
  }
  return result;
}
const names = (value, limit, max = 60) => Array.isArray(value) && value.length <= limit && value.every(item => typeof item === 'string' && item.trim() && item.length <= max) ? [...new Set(value.map(item => item.trim()))] : null;
const characterRef = value => value === '' || value === null || value === undefined ? '' : typeof value === 'string' && uuid.test(value) ? value : null;

function cleanBird(value) {
  const result = fields(value, { name: ['text', 500], type: ['text', 20], appearance: ['text', 2000], description: ['text', 2000], powerNotes: ['text', 2000], health: ['number', 99], energy: ['number', 99], maxHealth: ['number', 99], maxEnergy: ['number', 99] });
  if (!result || (result.type && !birdTypes[result.type])) return null;
  // Powers used to be one block of text; that text is kept as notes.
  if (typeof value.powers === 'string') { if (value.powers.length > 2000) return null; result.powerNotes ||= value.powers.trim(); result.powers = []; }
  else { result.powers = names(value.powers ?? [], 40); if (!result.powers) return null; }
  for (const key of ['companion', 'device']) { result[key] = characterRef(value[key]); if (result[key] === null) return null; }
  return result;
}
function cleanVehicle(value) {
  const result = fields(value, {
    name: ['text', 500], model: ['text', 500], paint: ['text', 60], upgrades: ['text', 500], cargo: ['text', 2000],
    hull: ['number', 999], hullNow: ['number', 999], armor: ['number', 999], blight: ['number', 999], maneuverability: ['number', 99], speed: ['number', 99],
    travel: ['number', 99], range: ['number', 999], passengers: ['number', 99], cargoCapacity: ['number', 99999], supply: ['number', 99999], slots: ['number', 20]
  });
  if (!result) return null;
  const installed = value.installed ?? [];
  if (!Array.isArray(installed) || installed.length > 40 || !installed.every(item => item && typeof item === 'object' && text(item.name, 60) && whole(item.level, 3) >= 1)) return null;
  result.installed = installed.map(item => ({ name: item.name.trim(), level: item.level }));
  return result;
}
function cleanEngagement(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 10 || !entries.every(([id, maneuver]) => uuid.test(id) && text(maneuver, 120))) return null;
  return Object.fromEntries(entries.map(([id, maneuver]) => [id, maneuver.trim()]));
}
export function cleanCrewField(field, value) {
  if (field === 'name') return text(value, 100);
  if (field === 'crew_points') return whole(value, 999);
  if (field === 'bird') return cleanBird(value);
  if (field === 'rover' || field === 'shuttle') return cleanVehicle(value);
  if (field === 'engagement') return cleanEngagement(value);
  if (field === 'maneuvers' && Array.isArray(value) && value.length <= 40 && value.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.name === 'string' && item.name.length <= 120 && typeof (item.description ?? '') === 'string' && (item.description ?? '').length <= 2000)) {
    return value.map(item => ({ name: item.name.trim(), description: (item.description ?? '').trim() })).filter(item => item.name || item.description);
  }
  return null;
}
// A change to crew points: a whole-number change and the reason shown in the crew's history.
export function cleanPoints(value) {
  if (!value || typeof value !== 'object' || !Number.isInteger(value.change) || value.change < -999 || value.change > 999 || value.change === 0) return null;
  const reason = text(value.reason, 120);
  return reason ? { change: value.change, reason } : null;
}
async function readCrew(sql) {
  const crew = (await sql`SELECT * FROM crew WHERE id = 1`)[0];
  const members = await sql.query('SELECT r.role, r.character_id, c.name AS character_name, c.owner_id FROM crew_roles r LEFT JOIN characters c ON c.id = r.character_id ORDER BY r.rowid');
  const images = await sql`SELECT slot FROM crew_images`;
  // Every player character, so the sheet can show role fit, portraits and the Bird's companion.
  const people = await sql.query("SELECT c.id, c.name, c.owner_id, c.attributes, c.sheet, EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'portrait') AS has_portrait FROM characters c WHERE c.kind = 'pc' ORDER BY c.name");
  const explorers = people.map(row => {
    const sheet = JSON.parse(row.sheet || '{}');
    return { id: row.id, name: row.name, owner_id: row.owner_id, attributes: JSON.parse(row.attributes), conditions: sheet.conditions || [], birdHandler: (sheet.talents || []).find(item => item.name === 'Bird Handler')?.level || 0, has_portrait: Boolean(row.has_portrait) };
  });
  const maneuvers = JSON.parse(crew.maneuvers).map(item => typeof item === 'string' ? { name: item, description: '' } : item);
  return {
    ...crew, bird: JSON.parse(crew.bird), rover: JSON.parse(crew.rover), shuttle: JSON.parse(crew.shuttle), maneuvers,
    engagement: JSON.parse(crew.engagement ?? '{}'), points_log: JSON.parse(crew.points_log ?? '[]'),
    roles: members, explorers, images: Object.fromEntries(images.map(item => [item.slot, true]))
  };
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
    // A field change, a crew-point change, or both at once (learning a maneuver sets the list and spends 5 CP).
    // Both apply together only if nobody else changed the crew meanwhile.
    const hasField = data.field !== undefined;
    const value = hasField ? cleanCrewField(data.field, data.value) : undefined;
    const points = data.points === undefined ? null : cleanPoints(data.points);
    if ((hasField && value === null) || (!hasField && !points) || (data.points !== undefined && !points) || !Number.isInteger(data.revision)) return error('Invalid crew change');
    const current = (await sql`SELECT * FROM crew WHERE id = 1`)[0];
    // Before migration 019 there is no history column; changes still save, just without a history entry.
    const hasLog = current.points_log !== undefined;
    if (current.revision !== data.revision) return error('The crew changed while you were editing. Refresh and try again.', 409);
    const columns = { name: 'name', crew_points: 'crew_points', bird: 'bird', rover: 'rover', shuttle: 'shuttle', maneuvers: 'maneuvers', engagement: 'engagement' };
    const sets = [], args = [];
    let log = JSON.parse(current.points_log || '[]'), total = current.crew_points;
    if (hasField) {
      sets.push(`${columns[data.field]} = ?`); args.push(typeof value === 'object' ? JSON.stringify(value) : value);
      // Setting crew points by hand is logged too, so the history always adds up.
      if (data.field === 'crew_points' && value !== current.crew_points) { log.push({ at: Math.floor(Date.now() / 1000), by: profile.name, change: value - current.crew_points, reason: 'Adjusted by hand' }); total = value; }
    }
    if (points) {
      total = current.crew_points + points.change;
      if (total < 0) return error(`The crew has only ${current.crew_points} CP.`, 409);
      if (total > 999) return error('Crew points top out at 999.');
      sets.push('crew_points = ?'); args.push(total);
      log.push({ at: Math.floor(Date.now() / 1000), by: profile.name, change: points.change, reason: points.reason });
    }
    log = log.slice(-40);
    if (hasLog) { sets.push('points_log = ?'); args.push(JSON.stringify(log)); }
    const changed = await sql.query(`UPDATE crew SET ${sets.join(', ')}, revision = revision + 1 WHERE id = 1 AND revision = ? RETURNING revision`, [...args, data.revision]);
    if (!changed.length) return error('The crew changed while you were editing. Refresh and try again.', 409);
    return json({ crew: await readCrew(sql) });
  });
}
