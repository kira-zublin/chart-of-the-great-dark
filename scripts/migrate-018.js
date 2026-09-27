import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Adds the read-only rules reference table (talent descriptions and the injury, trauma, Blight and
// feature tables). Additive and safe to rerun.
export async function applyRulesLibrarySchema(sql = db()) {
  const source = await readFile(new URL('../db/018_rules_library.sql', import.meta.url), 'utf8');
  for (const statement of source.replace(/^--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean)) await sql.query(statement);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyRulesLibrarySchema();
  console.log('Rules library schema applied.');
}
