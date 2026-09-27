import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';
import { cleanRulesEntry } from '../lib/rules-library.js';

// The rulebook's talent descriptions and injury, trauma, Blight and feature tables are copyrighted text, so
// the extracted library is a local file in the uncommitted gamerules/ folder rather than part of the repository.
export const DEFAULT_RULES_LIBRARY = new URL('../gamerules/rules-library.json', import.meta.url);

// Replaces the whole rules reference with the file's entries, in the file's order. Nobody edits these in the
// app, so there is nothing to keep. Every entry is validated before anything is written.
export async function importRulesLibrary(sql, library) {
  if (!library || !Array.isArray(library.entries)) throw new Error('The rules library needs an "entries" array.');
  const entries = library.entries.map((entry, index) => {
    const clean = cleanRulesEntry(entry);
    if (!clean) throw new Error(`Rules entry ${index + 1} (${entry?.name || entry?.key || 'unnamed'}) is invalid.`);
    return clean;
  });
  const ids = entries.map(entry => `${entry.kind}:${entry.key}`);
  if (new Set(ids).size !== ids.length) throw new Error('Rules keys must be unique within each kind.');
  await sql.client.batch([
    'DELETE FROM rules_entries',
    ...entries.map((entry, position) => ({ sql: 'INSERT INTO rules_entries (kind, key, name, data, position) VALUES (?, ?, ?, ?, ?)', args: [entry.kind, entry.key, entry.name, JSON.stringify(entry.data), position] }))
  ], 'write');
  return Object.fromEntries(['talent', 'injury', 'trauma', 'blight', 'feature'].map(kind => [kind, entries.filter(entry => entry.kind === kind).length]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const file = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  const library = JSON.parse(await readFile(file ? resolve(file) : DEFAULT_RULES_LIBRARY, 'utf8'));
  const counts = await importRulesLibrary(db(), library);
  console.log(`Rules library: ${counts.talent} talents, ${counts.injury} critical injuries, ${counts.trauma} mental traumas, ${counts.blight} Blight manifestations, ${counts.feature} gear features.`);
}
