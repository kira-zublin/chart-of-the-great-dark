import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Correct only the original sample route. A GM-chosen parent is left intact.
export async function applyChoirParent(sql = db()) {
  await sql.query(`UPDATE locations SET parent_id = 'ship-city'
    WHERE id = 'choir' AND parent_id = 'star-map'
    AND EXISTS (SELECT 1 FROM location_links
      WHERE id = 'city-choir' AND from_id = 'ship-city' AND to_id = 'choir')`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyChoirParent();
  console.log('Sample Choir parent migration applied.');
}
