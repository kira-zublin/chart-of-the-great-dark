import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Adds the GM's jukebox volume, shared with every listener and multiplied by each browser's own volume. Safe to rerun.
export async function applyJukeboxVolume(sql = db()) {
  const columns = await sql.query('PRAGMA table_info(jukebox_state)');
  if (!columns.length) throw new Error('Apply jukebox migration 010 before migration 016.');
  if (!columns.some(column => column.name === 'volume')) {
    await sql.query('ALTER TABLE jukebox_state ADD COLUMN volume REAL NOT NULL DEFAULT 1 CHECK (volume BETWEEN 0 AND 1)');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyJukeboxVolume();
  console.log('Jukebox volume migration applied.');
}
