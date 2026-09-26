import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

const IMAGE_TABLE = `CREATE TABLE character_images_014 (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('portrait', 'standup', 'delve_suit')),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes BLOB NOT NULL,
  PRIMARY KEY (character_id, slot)
)`;

// Lets a stand-up face the other way and adds an optional delve-suit stand-up. Each position gains shared
// standup_flipped and delve_suit flags, and character images gain a 'delve_suit' slot. SQLite cannot relax
// a CHECK in place, so character_images is rebuilt in one write batch that keeps every image. Safe to rerun.
export async function applyStandupVariants(sql = db()) {
  const columns = await sql.query('PRAGMA table_info(character_positions)');
  if (!columns.length) throw new Error('Apply world migration 006 before migration 014.');
  for (const name of ['standup_flipped', 'delve_suit']) {
    if (!columns.some(column => column.name === name)) await sql.query(`ALTER TABLE character_positions ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0 CHECK (${name} IN (0, 1))`);
  }
  const images = (await sql.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'character_images'"))[0];
  if (!images) throw new Error('Apply the initial migration before migration 014.');
  if (images.sql.includes("'delve_suit'")) return;
  await sql.client.batch([
    'DROP TABLE IF EXISTS character_images_014',
    IMAGE_TABLE,
    'INSERT INTO character_images_014 (character_id, slot, mime_type, bytes) SELECT character_id, slot, mime_type, bytes FROM character_images',
    'DROP TABLE character_images',
    'ALTER TABLE character_images_014 RENAME TO character_images'
  ], 'write');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyStandupVariants();
  console.log('Stand-up flip and delve-suit migration applied.');
}
