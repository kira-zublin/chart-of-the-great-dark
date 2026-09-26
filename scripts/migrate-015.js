import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Adds instanced areas: temporary GM copies of a location that are removed once they sit empty and unviewed.
// is_instance marks a temporary location, instance_of names the original it was copied from, and
// instance_active_at records when it was last viewed or occupied. Safe to rerun.
export async function applyInstances(sql = db()) {
  const columns = new Set((await sql.query('PRAGMA table_info(locations)')).map(row => row.name));
  if (!columns.size) throw new Error('Apply world migration 006 before migration 015.');
  for (const [name, definition] of [
    ['is_instance', 'INTEGER NOT NULL DEFAULT 0 CHECK (is_instance IN (0, 1))'],
    ['instance_of', 'TEXT'],
    ['instance_active_at', 'INTEGER']
  ]) if (!columns.has(name)) await sql.query(`ALTER TABLE locations ADD COLUMN ${name} ${definition}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyInstances();
  console.log('Instanced area migration applied.');
}
