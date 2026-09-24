import { currentProfile, db, error, guarded, json } from '../lib/server.js';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 2 * 1024 * 1024;
function params(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id'); const slot = url.searchParams.get('slot');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !['portrait', 'standup'].includes(slot)) return null;
  return { id, slot };
}
async function canSee(sql, profile, id) {
  const rows = await sql`SELECT owner_id FROM characters WHERE id = ${id} LIMIT 1`;
  return rows.length && (profile.role === 'gm' || rows[0].owner_id === profile.id);
}

export async function GET(req) {
  return guarded(async () => {
    const p = params(req); if (!p) return error('Invalid image');
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile || !await canSee(sql, profile, p.id)) return error('Image unavailable', 404);
    const rows = await sql`SELECT mime_type, bytes FROM character_images WHERE character_id = ${p.id} AND slot = ${p.slot} LIMIT 1`;
    if (!rows.length) return error('Image not found', 404);
    return new Response(Buffer.from(rows[0].bytes), { headers: { 'Content-Type': rows[0].mime_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}

export async function PUT(req) {
  return guarded(async () => {
    const p = params(req); if (!p) return error('Invalid image');
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile || !await canSee(sql, profile, p.id)) return error('Character unavailable', 404);
    const mime = req.headers.get('content-type')?.split(';')[0];
    if (!allowed.has(mime)) return error('Use a JPEG, PNG, or WebP image');
    if (Number(req.headers.get('content-length') || 0) > maxBytes) return error('Image must be under 2 MB', 413);
    const bytes = Buffer.from(await req.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) return error('Image must be under 2 MB', 413);
    const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : bytes.subarray(0, 12).toString('ascii').startsWith('RIFF') && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!valid) return error('Image content does not match its file type');
    await sql`INSERT INTO character_images (character_id, slot, mime_type, bytes) VALUES (${p.id}, ${p.slot}, ${mime}, ${bytes}) ON CONFLICT (character_id, slot) DO UPDATE SET mime_type = EXCLUDED.mime_type, bytes = EXCLUDED.bytes`;
    return json({ ok: true });
  });
}

export async function DELETE(req) {
  return guarded(async () => {
    const p = params(req); if (!p) return error('Invalid image');
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile || !await canSee(sql, profile, p.id)) return error('Character unavailable', 404);
    await sql`DELETE FROM character_images WHERE character_id = ${p.id} AND slot = ${p.slot}`;
    return json({ ok: true });
  });
}
