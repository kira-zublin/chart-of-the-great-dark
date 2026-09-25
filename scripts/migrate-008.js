import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

export async function applyLocationAccess(sql = db()) {
  const columns = await sql.query('PRAGMA table_info(locations)');
  if (!columns.length) throw new Error('Apply world migration 006 before migration 008.');
  if (!columns.some(column => column.name === 'access_level')) {
    await sql.query("ALTER TABLE locations ADD COLUMN access_level TEXT NOT NULL DEFAULT 'accessible' CHECK (access_level IN ('invisible', 'inaccessible', 'accessible'))");
    await sql.query("UPDATE locations SET access_level = 'invisible' WHERE visible = 0");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyLocationAccess();
  console.log('Location access migration applied.');
}
