import { body, currentProfile, db, error, guarded, json, randomUUID } from '../lib/server.js';
import { CREATURE_CATEGORIES, cleanStats } from '../creature-stats.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const select = `SELECT t.id, t.source, t.book_key, t.name, t.category, t.stats, t.updated_at,
  EXISTS (SELECT 1 FROM creature_template_images i WHERE i.template_id = t.id AND i.slot = 'portrait') AS has_portrait,
  EXISTS (SELECT 1 FROM creature_template_images i WHERE i.template_id = t.id AND i.slot = 'standup') AS has_standup
  FROM creature_templates t`;
const present = row => ({ ...row, stats: JSON.parse(row.stats), has_portrait: Boolean(row.has_portrait), has_standup: Boolean(row.has_standup) });
const list = async sql => (await sql.query(`${select} ORDER BY lower(t.name), t.id`)).map(present);

// A palette entry's editable fields: name, category and a validated stat block.
export function cleanTemplate(input) {
  if (!input || typeof input !== 'object') return null;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 80 || !CREATURE_CATEGORIES.includes(input.category)) return null;
  const stats = cleanStats(input.stats);
  return stats ? { name, category: input.category, stats } : null;
}

// Copies get "(copy)" appended, trimmed so the name stays within 80 characters.
export const copyName = name => `${name.slice(0, 73)} (copy)`;

async function gm(req, sql) {
  const profile = await currentProfile(req, sql);
  if (!profile) return error('Sign in to use the creature palette', 401);
  return profile.role === 'gm' ? profile : error('Only the GM can use the creature palette', 403);
}

export async function GET(req) {
  return guarded(async () => {
    const sql = db(); const profile = await gm(req, sql);
    if (profile instanceof Response) return profile;
    return json({ templates: await list(sql) });
  });
}

export async function POST(req) {
  return guarded(async () => {
    const sql = db(); const profile = await gm(req, sql);
    if (profile instanceof Response) return profile;
    const data = await body(req);
    if (data.action === 'create') {
      const input = cleanTemplate(data);
      if (!input) return error('Check the creature fields');
      const id = randomUUID();
      await sql`INSERT INTO creature_templates (id, source, name, category, stats, created_by) VALUES (${id}, 'custom', ${input.name}, ${input.category}, ${JSON.stringify(input.stats)}, ${profile.id})`;
      return json({ id, templates: await list(sql) }, 201);
    }
    if (data.action === 'duplicate') {
      if (!uuid(data.id)) return error('Invalid creature');
      const source = (await sql`SELECT name FROM creature_templates WHERE id = ${data.id}`)[0];
      if (!source) return error('Creature not found', 404);
      const id = randomUUID();
      // The copy is a custom entry with the same stats and images; the book import never touches it.
      await sql.client.batch([
        { sql: `INSERT INTO creature_templates (id, source, name, category, stats, created_by) SELECT ?, 'custom', ?, category, stats, ? FROM creature_templates WHERE id = ?`, args: [id, copyName(source.name), profile.id, data.id] },
        { sql: 'INSERT INTO creature_template_images (template_id, slot, mime_type, bytes) SELECT ?, slot, mime_type, bytes FROM creature_template_images WHERE template_id = ?', args: [id, data.id] }
      ], 'write');
      return json({ id, templates: await list(sql) }, 201);
    }
    return error('Unknown creature action');
  });
}

export async function PUT(req) {
  return guarded(async () => {
    const sql = db(); const profile = await gm(req, sql);
    if (profile instanceof Response) return profile;
    const data = await body(req);
    if (!uuid(data.id)) return error('Invalid creature');
    const input = cleanTemplate(data);
    if (!input) return error('Check the creature fields');
    // Placed creatures keep the stats they were placed with; only new placements see the edit.
    const rows = await sql`UPDATE creature_templates SET name = ${input.name}, category = ${input.category}, stats = ${JSON.stringify(input.stats)}, updated_at = unixepoch() WHERE id = ${data.id} RETURNING id`;
    if (!rows.length) return error('Creature not found', 404);
    return json({ id: data.id, templates: await list(sql) });
  });
}

export async function DELETE(req) {
  return guarded(async () => {
    const sql = db(); const profile = await gm(req, sql);
    if (profile instanceof Response) return profile;
    const id = new URL(req.url).searchParams.get('id');
    if (!uuid(id)) return error('Invalid creature');
    const rows = await sql`DELETE FROM creature_templates WHERE id = ${id} RETURNING id`;
    if (!rows.length) return error('Creature not found', 404);
    return json({ templates: await list(sql) });
  });
}
