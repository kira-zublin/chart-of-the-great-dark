import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, randomUUID } from '../lib/server.js';
import { cleanTemplate } from '../api/creatures.js';

// The rulebook's creatures and adversaries are copyrighted text, so the extracted library is a local file in
// the uncommitted gamerules/ folder rather than part of the repository.
export const DEFAULT_LIBRARY = new URL('../gamerules/creature-library.json', import.meta.url);

// Loads book entries into the palette, matched by their stable key. Entries the GM already has are left alone,
// since the GM may have customized them; overwrite restores their name, category and stats from the file.
// Every entry is validated before anything is written.
export async function importCreatureLibrary(sql, library, { overwrite = false } = {}) {
  if (!library || !Array.isArray(library.entries)) throw new Error('The library file needs an "entries" array.');
  const entries = library.entries.map((entry, index) => {
    const clean = cleanTemplate(entry);
    if (!clean || typeof entry.key !== 'string' || !/^[a-z0-9-]{1,60}$/.test(entry.key)) throw new Error(`Library entry ${index + 1} (${entry?.name || entry?.key || 'unnamed'}) is invalid.`);
    return { key: entry.key, ...clean };
  });
  const keys = entries.map(entry => entry.key);
  if (new Set(keys).size !== keys.length) throw new Error('Library keys must be unique.');
  const existing = new Set((await sql.query('SELECT book_key FROM creature_templates WHERE book_key IS NOT NULL')).map(row => row.book_key));
  const statements = [], counts = { added: 0, updated: 0, kept: 0 };
  for (const entry of entries) {
    const stats = JSON.stringify(entry.stats);
    if (!existing.has(entry.key)) {
      statements.push({ sql: "INSERT INTO creature_templates (id, source, book_key, name, category, stats) VALUES (?, 'book', ?, ?, ?, ?)", args: [randomUUID(), entry.key, entry.name, entry.category, stats] });
      counts.added++;
    } else if (overwrite) {
      statements.push({ sql: 'UPDATE creature_templates SET name = ?, category = ?, stats = ?, updated_at = unixepoch() WHERE book_key = ?', args: [entry.name, entry.category, stats, entry.key] });
      counts.updated++;
    } else counts.kept++;
  }
  if (statements.length) await sql.client.batch(statements, 'write');
  return counts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const file = args.find(arg => !arg.startsWith('--'));
  const library = JSON.parse(await readFile(file ? resolve(file) : DEFAULT_LIBRARY, 'utf8'));
  const counts = await importCreatureLibrary(db(), library, { overwrite: args.includes('--overwrite') });
  console.log(`Creature library: ${counts.added} added, ${counts.updated} restored from the book, ${counts.kept} already present and left unchanged.`);
}
