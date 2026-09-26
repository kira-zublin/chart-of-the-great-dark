import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Retires the Choir Below and its lower level, prototype delves that were only used for testing.
const RETIRED = ['choir', 'choir-depths'];

// Removes test locations with their links, art and room settings. Characters standing in them return to
// Ship City, and anything created beneath them moves up to Ship City. Safe to rerun.
export async function retireLocations(sql, retired, migration) {
  const tables = new Set((await sql.query("SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name));
  if (!tables.has('locations')) throw new Error(`Apply world migration 006 before migration ${migration}.`);
  const marks = retired.map(() => '?').join(', ');
  const found = await sql.query(`SELECT id FROM locations WHERE id IN (${marks})`, retired);
  if (!found.length) return { removed: 0, returned: 0 };
  const destination = (await sql.query("SELECT id FROM locations WHERE id = 'ship-city'")).length ? 'ship-city' : 'star-map';
  const returned = (await sql.query(`SELECT COUNT(*) AS count FROM character_positions WHERE location_id IN (${marks})`, retired))[0].count;
  await sql.query(`UPDATE character_positions SET location_id = ?, x = NULL, y = NULL WHERE location_id IN (${marks})`, [destination, ...retired]);
  await sql.query(`UPDATE locations SET parent_id = ? WHERE parent_id IN (${marks}) AND id NOT IN (${marks})`, [destination, ...retired, ...retired]);
  await sql.query(`DELETE FROM location_links WHERE from_id IN (${marks}) OR to_id IN (${marks})`, [...retired, ...retired]);
  for (const table of ['room_overrides', 'location_images', 'location_card_images']) {
    if (tables.has(table)) await sql.query(`DELETE FROM ${table} WHERE location_id IN (${marks})`, retired);
  }
  await sql.query(`DELETE FROM locations WHERE id IN (${marks})`, retired);
  return { removed: found.length, returned: Number(returned) };
}

export const retireChoirPrototype = (sql = db()) => retireLocations(sql, RETIRED, '011');

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await retireChoirPrototype();
  console.log(`Choir prototype retired: ${result.removed} locations removed, ${result.returned} characters returned to Ship City.`);
}
