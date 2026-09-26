import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';
import { retireLocations } from './migrate-011.js';

// Retires the Dockside Exchange, a Vista inside Ship City that was only used for testing.
export const retireDocksidePrototype = (sql = db()) => retireLocations(sql, ['dockside'], '013');

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await retireDocksidePrototype();
  console.log(`Dockside Exchange retired: ${result.removed} location removed, ${result.returned} characters returned to Ship City.`);
}
