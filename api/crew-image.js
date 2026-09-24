import { currentProfile, db, error, guarded, json } from '../lib/server.js';

const maxBytes = 2 * 1024 * 1024;
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
function slotOf(req) { const slot = new URL(req.url).searchParams.get('slot'); return ['crew', 'bird'].includes(slot) ? slot : null; }
async function authorized(req) { const sql = db(); return { sql, profile: await currentProfile(req, sql) }; }

export async function GET(req) {
  return guarded(async () => {
    const slot = slotOf(req); if (!slot) return error('Invalid image');
    const { sql, profile } = await authorized(req); if (!profile) return error('Sign in to see the image', 401);
    const rows = await sql`SELECT mime_type, bytes FROM crew_images WHERE slot = ${slot}`;
    if (!rows.length) return error('Image not found', 404);
    return new Response(Buffer.from(rows[0].bytes), { headers: { 'Content-Type': rows[0].mime_type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}

export async function PUT(req) {
  return guarded(async () => {
    const slot = slotOf(req); if (!slot) return error('Invalid image');
    const { sql, profile } = await authorized(req); if (!profile) return error('Sign in to edit the image', 401);
    const mime = req.headers.get('content-type')?.split(';')[0];
    if (!allowed.has(mime)) return error('Use a JPEG, PNG, or WebP image');
    if (Number(req.headers.get('content-length') || 0) > maxBytes) return error('Image must be under 2 MB', 413);
    const bytes = Buffer.from(await req.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) return error('Image must be under 2 MB', 413);
    const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : bytes.subarray(0, 12).toString('ascii').startsWith('RIFF') && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!valid) return error('Image content does not match its file type');
    await sql`INSERT INTO crew_images (slot, mime_type, bytes) VALUES (${slot}, ${mime}, ${bytes}) ON CONFLICT (slot) DO UPDATE SET mime_type = EXCLUDED.mime_type, bytes = EXCLUDED.bytes`;
    return json({ ok: true });
  });
}

export async function DELETE(req) {
  return guarded(async () => {
    const slot = slotOf(req); if (!slot) return error('Invalid image');
    const { sql, profile } = await authorized(req); if (!profile) return error('Sign in to edit the image', 401);
    await sql`DELETE FROM crew_images WHERE slot = ${slot}`;
    return json({ ok: true });
  });
}
