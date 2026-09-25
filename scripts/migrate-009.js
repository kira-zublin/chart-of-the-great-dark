import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Additive fields for short place cards; existing descriptions remain intact.
export async function applyLocationCards(sql = db()) {
  const columns = new Set((await sql.query('PRAGMA table_info(locations)')).map(row => row.name));
  if (!columns.size) throw new Error('Apply world migration 006 before migration 009.');
  for (const [name, definition] of [
    ['teaser', "TEXT NOT NULL DEFAULT ''"],
    ['quote', "TEXT NOT NULL DEFAULT ''"],
    ['quote_speaker', "TEXT NOT NULL DEFAULT ''"],
    ['card_image_version', 'INTEGER NOT NULL DEFAULT 0']
  ]) if (!columns.has(name)) await sql.query(`ALTER TABLE locations ADD COLUMN ${name} ${definition}`);
  await sql.query(`CREATE TABLE IF NOT EXISTS location_card_images (
    location_id TEXT PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    bytes BLOB NOT NULL
  )`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyLocationCards();
  console.log('Location card migration applied.');
}
