import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

export async function applyCrewImageSchema(sql = db()) {
  const source = await readFile(new URL('../db/003_crew_images.sql', import.meta.url), 'utf8');
  for (const statement of source.replace(/^--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean)) await sql.query(statement);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyCrewImageSchema();
  console.log('Crew image schema applied.');
}
