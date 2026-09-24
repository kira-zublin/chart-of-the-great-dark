import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

export async function applyInitialSchema(sql = db()) {
  const file = new URL('../db/001_initial.sql', import.meta.url);
  const source = await readFile(file, 'utf8');
  const statements = source.replace(/^--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyInitialSchema();
  console.log('Initial schema applied.');
}
