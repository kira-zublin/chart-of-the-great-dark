import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

export async function applySheetAndCrewSchema(sql = db()) {
  const columns = await sql.query('PRAGMA table_info(characters)');
  if (!columns.length) throw new Error('Apply 001_initial.sql before migration 002.');
  const source = await readFile(new URL('../db/002_sheets_and_crew.sql', import.meta.url), 'utf8');
  const statements = source.replace(/^--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean);
  for (const statement of statements) {
    if (statement.startsWith('ALTER TABLE characters') && columns.some(column => column.name === 'sheet')) continue;
    await sql.query(statement);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applySheetAndCrewSchema();
  console.log('Character and crew schema applied.');
}
