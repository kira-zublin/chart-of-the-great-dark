import { currentProfile, db, error, guarded, json } from '../lib/server.js';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 2 * 1024 * 1024;
function params(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id'); const slot = url.searchParams.get('slot');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !['portrait', 'standup'].includes(slot)) return null;
  return { id, slot };
}
const validBytes = (mime, bytes) => mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  : mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : bytes.subarray(0, 12).toString('ascii').startsWith('RIFF') && bytes.subarray(8, 12).toString('ascii') === 'WEBP';

// The GM sees every palette image. Players see a template's art only while a creature placed from it is on the
// map and not hidden, so tokens and stand-ups render for them.
export async function GET(req) {
  return guarded(async () => {
    const p = params(req); if (!p) return error('Invalid image');
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Image unavailable', 404);
    if (profile.role !== 'gm' && !(await sql`SELECT 1 FROM creatures WHERE template_id = ${p.id} AND hidden = 0 LIMIT 1`).length) return error('Image unavailable', 404);
    const rows = await sql`SELECT mime_type, bytes FROM creature_template_images WHERE template_id = ${p.id} AND slot = ${p.slot} LIMIT 1`;
    if (!rows.length) return error('Image not found', 404);
    return new Response(Buffer.from(rows[0].bytes), { headers: { 'Content-Type': rows[0].mime_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}

async function gmTemplate(req, sql, p) {
  const profile = await currentProfile(req, sql);
  if (!profile || profile.role !== 'gm') return error('Only the GM can change creature images', 403);
  if (!(await sql`SELECT 1 FROM creature_templates WHERE id = ${p.id}`).length) return error('Creature not found', 404);
  return null;
}

export async function PUT(req) {
  return guarded(async () => {
    const p = params(req); if (!p) return error('Invalid image');
    const sql = db(); const denied = await gmTemplate(req, sql, p);
    if (denied) return denied;
    const mime = req.headers.get('content-type')?.split(';')[0];
    if (!allowed.has(mime)) return error('Use a JPEG, PNG, or WebP image');
    if (Number(req.headers.get('content-length') || 0) > maxBytes) return error('Image must be under 2 MB', 413);
    const bytes = Buffer.from(await req.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) return error('Image must be under 2 MB', 413);
    if (!validBytes(mime, bytes)) return error('Image content does not match its file type');
    // updated_at doubles as the image version the palette uses to refresh cached art.
    await sql.client.batch([
      { sql: 'INSERT INTO creature_template_images (template_id, slot, mime_type, bytes) VALUES (?, ?, ?, ?) ON CONFLICT (template_id, slot) DO UPDATE SET mime_type = excluded.mime_type, bytes = excluded.bytes', args: [p.id, p.slot, mime, bytes] },
      { sql: 'UPDATE creature_templates SET updated_at = unixepoch() WHERE id = ?', args: [p.id] }
    ], 'write');
    return json({ ok: true });
  });
}

export async function DELETE(req) {
  return guarded(async () => {
    const p = params(req); if (!p) return error('Invalid image');
    const sql = db(); const denied = await gmTemplate(req, sql, p);
    if (denied) return denied;
    await sql.client.batch([
      { sql: 'DELETE FROM creature_template_images WHERE template_id = ? AND slot = ?', args: [p.id, p.slot] },
      { sql: 'UPDATE creature_templates SET updated_at = unixepoch() WHERE id = ?', args: [p.id] }
    ], 'write');
    return json({ ok: true });
  });
}
