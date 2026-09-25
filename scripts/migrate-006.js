import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

const grid = (width, height, blocked, rooms, entry) => JSON.stringify({ width, height, blocked, rooms, entry });
const sample = [
  ['star-map', 'star', null, 'Chart of the Great Dark', 'The chart of the known horizon.', '{}', 0],
  ['ship-city', 'settlement', 'star-map', 'Ship City', 'The expedition begins among the docks and guild halls.', '{}', 0],
  ['dockside', 'diorama', 'ship-city', 'Dockside Exchange', 'A place to meet before setting out.', '{}', 0],
  ['choir', 'delve', 'ship-city', 'The Choir Below', 'A resonant ruin beneath the surface.', grid(12, 8, [[5, 0], [5, 1], [5, 2], [5, 5], [5, 6], [5, 7]], [
    { id: 'entry', name: 'Entry Hall', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 5 }, (_, x) => [x, y])).flat() },
    { id: 'choir', name: 'Resonance Hall', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 6 }, (_, x) => [x + 6, y])).flat() }
  ], [1, 3]), 1],
  ['choir-depths', 'delve', 'choir', 'Choir Depths', 'The lower chamber of the ruin.', grid(10, 7, [], [
    { id: 'depths', name: 'Lower Chamber', squares: Array.from({ length: 7 }, (_, y) => Array.from({ length: 10 }, (_, x) => [x, y])).flat() }
  ], [1, 3]), 1]
];
const links = [
  ['star-ship-city', 'star-map', 'ship-city', 'marker', 'Ship City', 315, 286, null, null],
  ['star-choir', 'star-map', 'choir', 'marker', 'The Choir Below', 514, 238, null, null],
  ['city-dock', 'ship-city', 'dockside', 'marker', 'Dockside Exchange', 38, 55, null, null],
  ['city-choir', 'ship-city', 'choir', 'marker', 'The Choir Below', 75, 52, 1, 3],
  ['choir-depths-door', 'choir', 'choir-depths', 'door', 'Stair to Choir Depths', 10, 3, 1, 3],
  ['depths-choir-door', 'choir-depths', 'choir', 'door', 'Stair to Entry Hall', 0, 3, 9, 3]
];

export async function applyWorldSchema(sql = db()) {
  const source = await readFile(new URL('../db/006_world.sql', import.meta.url), 'utf8');
  for (const statement of source.split(';').map(part => part.replace(/^--.*$/gm, '').trim()).filter(Boolean)) await sql.query(statement);
  for (const row of sample) await sql.query('INSERT OR IGNORE INTO locations (id, kind, parent_id, title, description, grid, fog_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)', row);
  for (const row of links) await sql.query('INSERT OR IGNORE INTO location_links (id, from_id, to_id, kind, label, x, y, arrival_x, arrival_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', row);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyWorldSchema();
  console.log('World prototype schema applied.');
}
