import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Adds a shared stand-up size to each character's position so every viewer sees the same Vista scene.
export async function applyStandupScale(sql = db()) {
  const columns = await sql.query('PRAGMA table_info(character_positions)');
  if (!columns.length) throw new Error('Apply world migration 006 before migration 012.');
  if (!columns.some(column => column.name === 'standup_scale')) {
    await sql.query('ALTER TABLE character_positions ADD COLUMN standup_scale REAL NOT NULL DEFAULT 1 CHECK (standup_scale BETWEEN 0.5 AND 1.5)');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyStandupScale();
  console.log('Stand-up scale migration applied.');
}
