import { currentProfile, db, error, guarded, json } from '../lib/server.js';
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const idOf = req => new URL(req.url).searchParams.get('id');
const isCard = req => new URL(req.url).searchParams.get('slot') === 'card';
export async function GET(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql); if (!profile) return error('Sign in to view map art', 401);
    const id = idOf(req), card = isCard(req); const location = (await sql`SELECT access_level FROM locations WHERE id = ${id}`)[0];
    if (!location || (location.access_level === 'invisible' && profile.role !== 'gm') || (!card && location.access_level !== 'accessible' && profile.role !== 'gm')) return error('Location unavailable', 404);
    const image = card ? (await sql`SELECT mime_type, bytes FROM location_card_images WHERE location_id = ${id}`)[0] : (await sql`SELECT mime_type, bytes FROM location_images WHERE location_id = ${id}`)[0];
    if (!image) return error('No map art', 404);
    return new Response(image.bytes, { headers: { 'Content-Type': image.mime_type, 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff' } });
  });
}
export async function PUT(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql); if (!profile || profile.role !== 'gm') return error('Only the GM can upload map art', 403);
    const id = idOf(req), card = isCard(req), location = (await sql`SELECT id, kind FROM locations WHERE id = ${id}`)[0];
    if (!location || location.kind === 'star') return error('Location unavailable', 404);
    const mime = req.headers.get('content-type')?.split(';')[0];
    if (!allowed.has(mime)) return error('Use a JPEG, PNG, or WebP image');
    if (Number(req.headers.get('content-length') || 0) > 6 * 1024 * 1024) return error('Image must be under 6 MB', 413);
    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length > 6 * 1024 * 1024 || bytes.length < 12) return error('Image must be under 6 MB');
    const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : mime === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : bytes.subarray(0, 12).toString('ascii').startsWith('RIFF') && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!valid) return error('Invalid image');
    if (card) {
      await sql`INSERT INTO location_card_images (location_id, mime_type, bytes) VALUES (${id}, ${mime}, ${bytes}) ON CONFLICT(location_id) DO UPDATE SET mime_type = excluded.mime_type, bytes = excluded.bytes`;
      await sql`UPDATE locations SET card_image_version = card_image_version + 1 WHERE id = ${id}`;
    } else {
      await sql`INSERT INTO location_images (location_id, mime_type, bytes) VALUES (${id}, ${mime}, ${bytes}) ON CONFLICT(location_id) DO UPDATE SET mime_type = excluded.mime_type, bytes = excluded.bytes`;
      await sql`UPDATE locations SET image_version = image_version + 1 WHERE id = ${id}`;
    }
    return json({ ok: true });
  });
}
