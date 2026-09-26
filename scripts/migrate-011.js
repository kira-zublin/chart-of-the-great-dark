import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Retires the Choir Below and its lower level, prototype delves that were only used for testing.
// Characters standing in them return to Ship City; anything created beneath them moves up to Ship City.
const RETIRED = ['choir', 'choir-depths'];
const RETURN_TO = 'ship-city';

export async function retireChoirPrototype(sql = db()) {
  const tables = new Set((await sql.query("SELECT name FROM sqlite_master WHERE type = 'table'")).map(row => row.name));
  if (!tables.has('locations')) throw new Error('Apply world migration 006 before migration 011.');
  const marks = RETIRED.map(() => '?').join(', ');
  const found = await sql.query(`SELECT id FROM locations WHERE id IN (${marks})`, RETIRED);
  if (!found.length) return { removed: 0, returned: 0 };
  const destination = (await sql.query('SELECT id FROM locations WHERE id = ?', [RETURN_TO])).length ? RETURN_TO : 'star-map';
  const returned = (await sql.query(`SELECT COUNT(*) AS count FROM character_positions WHERE location_id IN (${marks})`, RETIRED))[0].count;
  await sql.query(`UPDATE character_positions SET location_id = ?, x = NULL, y = NULL WHERE location_id IN (${marks})`, [destination, ...RETIRED]);
  await sql.query(`UPDATE locations SET parent_id = ? WHERE parent_id IN (${marks}) AND id NOT IN (${marks})`, [destination, ...RETIRED, ...RETIRED]);
  await sql.query(`DELETE FROM location_links WHERE from_id IN (${marks}) OR to_id IN (${marks})`, [...RETIRED, ...RETIRED]);
  for (const table of ['room_overrides', 'location_images', 'location_card_images']) {
    if (tables.has(table)) await sql.query(`DELETE FROM ${table} WHERE location_id IN (${marks})`, RETIRED);
  }
  await sql.query(`DELETE FROM locations WHERE id IN (${marks})`, RETIRED);
  return { removed: found.length, returned: Number(returned) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await retireChoirPrototype();
  console.log(`Choir prototype retired: ${result.removed} locations removed, ${result.returned} characters returned to Ship City.`);
}
