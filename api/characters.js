import { body, currentProfile, db, error, guarded, json, randomUUID } from '../lib/server.js';

const fields = ['name', 'profession', 'origin', 'faction', 'appearance', 'motivation', 'description'];
const statNames = ['strength', 'agility', 'logic', 'insight', 'perception', 'empathy'];
const select = `SELECT c.id, c.owner_id, c.kind, c.name, c.profession, c.origin, c.faction, c.appearance, c.motivation, c.description, c.attributes, c.created_at, c.updated_at, p.name AS owner_name, EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'portrait') AS has_portrait, EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'standup') AS has_standup FROM characters c JOIN profiles p ON p.id = c.owner_id`;
function present(row) { return { ...row, attributes: JSON.parse(row.attributes), has_portrait: Boolean(row.has_portrait), has_standup: Boolean(row.has_standup) }; }

export function clean(input) {
  if (!input || typeof input !== 'object') return null;
  if (!['pc', 'npc'].includes(input.kind)) return null;
  const result = { kind: input.kind };
  for (const key of fields) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > (key === 'description' ? 4000 : 500)) return null;
    result[key] = value.trim();
  }
  if (!result.name || result.name.length > 80) return null;
  if (!input.attributes || typeof input.attributes !== 'object') return null;
  const attributes = {};
  for (const stat of statNames) {
    const value = Number(input.attributes[stat]);
    if (!Number.isInteger(value) || value < 0 || value > 99) return null;
    attributes[stat] = value;
  }
  result.attributes = attributes;
  return result;
}

export function canCreate(profile, kind) { return kind === 'pc' || profile.role === 'gm'; }
export function canEdit(profile, character, kind) {
  return profile.role === 'gm' || (character.owner_id === profile.id && character.kind === 'pc' && kind === 'pc');
}

async function authorize(req, sql) {
  const profile = await currentProfile(req, sql);
  return profile || null;
}

export async function GET(req) {
  return guarded(async () => {
    const sql = db(); const profile = await authorize(req, sql);
    if (!profile) return error('Sign in to see characters', 401);
    const kind = new URL(req.url).searchParams.get('kind');
    if (kind && !['pc', 'npc'].includes(kind)) return error('Invalid character filter');
    let rows;
    if (profile.role === 'gm') {
      rows = kind ? await sql.query(`${select} WHERE c.kind = ? ORDER BY c.updated_at DESC`, [kind]) : await sql.query(`${select} ORDER BY c.updated_at DESC`);
    } else {
      rows = await sql.query(`${select} WHERE c.owner_id = ? ORDER BY c.updated_at DESC`, [profile.id]);
    }
    return json({ characters: rows.map(present) });
  });
}

export async function POST(req) {
  return guarded(async () => {
    const sql = db(); const profile = await authorize(req, sql);
    if (!profile) return error('Sign in to create a character', 401);
    const input = clean(await body(req));
    if (!input) return error('Check the character fields');
    if (!canCreate(profile, input.kind)) return error('Only a GM can create NPCs', 403);
    const id = randomUUID();
    await sql`INSERT INTO characters (id, owner_id, kind, name, profession, origin, faction, appearance, motivation, description, attributes) VALUES (${id}, ${profile.id}, ${input.kind}, ${input.name}, ${input.profession}, ${input.origin}, ${input.faction}, ${input.appearance}, ${input.motivation}, ${input.description}, ${JSON.stringify(input.attributes)})`;
    return json({ id }, 201);
  });
}

export async function PUT(req) {
  return guarded(async () => {
    const sql = db(); const profile = await authorize(req, sql);
    if (!profile) return error('Sign in to edit a character', 401);
    const raw = await body(req); const id = raw.id;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return error('Invalid character');
    const input = clean(raw);
    if (!input) return error('Check the character fields');
    const found = await sql`SELECT owner_id, kind FROM characters WHERE id = ${id} LIMIT 1`;
    if (!found.length) return error('Character not found', 404);
    if (!canEdit(profile, found[0], input.kind)) return error('You cannot edit this character', 403);
    await sql`UPDATE characters SET kind = ${input.kind}, name = ${input.name}, profession = ${input.profession}, origin = ${input.origin}, faction = ${input.faction}, appearance = ${input.appearance}, motivation = ${input.motivation}, description = ${input.description}, attributes = ${JSON.stringify(input.attributes)}, updated_at = unixepoch() WHERE id = ${id}`;
    return json({ ok: true });
  });
}

export async function DELETE(req) {
  return guarded(async () => {
    const sql = db(); const profile = await authorize(req, sql);
    if (!profile) return error('Sign in to delete a character', 401);
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return error('Invalid character');
    const rows = profile.role === 'gm' ? await sql`DELETE FROM characters WHERE id = ${id} RETURNING id` : await sql`DELETE FROM characters WHERE id = ${id} AND owner_id = ${profile.id} RETURNING id`;
    if (!rows.length) return error('Character not found or unavailable', 404);
    return json({ ok: true });
  });
}
