import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

export const PORTRAIT_DIR = fileURLToPath(new URL('../assets/creatures/', import.meta.url));
const maxBytes = 2 * 1024 * 1024;

// Portrait filenames are the stable book keys. Importing only missing images preserves GM uploads.
export async function importCreaturePortraits(sql, { directory = PORTRAIT_DIR, dryRun = false, overwrite = false } = {}) {
  const filenames = (await readdir(directory)).filter(name => /^[a-z0-9-]+\.jpg$/.test(name)).sort();
  if (!filenames.length) throw new Error('No creature portraits found.');
  const keys = filenames.map(name => basename(name, '.jpg'));
  const templates = await sql.query("SELECT id, book_key FROM creature_templates WHERE source = 'book' AND book_key IS NOT NULL");
  const byKey = new Map(templates.map(row => [row.book_key, row.id]));
  const missing = keys.filter(key => !byKey.has(key));
  if (missing.length) throw new Error(`Book templates missing for portraits: ${missing.join(', ')}`);
  const existing = new Set((await sql.query("SELECT template_id FROM creature_template_images WHERE slot = 'portrait'")).map(row => row.template_id));
  const statements = [];
  let kept = 0, bytes = 0;
  for (const filename of filenames) {
    const key = basename(filename, '.jpg');
    const id = byKey.get(key);
    const data = await readFile(join(directory, filename));
    if (data.length < 4 || data.length > maxBytes || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) throw new Error(`Invalid JPEG portrait: ${filename}`);
    bytes += data.length;
    if (existing.has(id) && !overwrite) { kept++; continue; }
    statements.push({
      sql: "INSERT INTO creature_template_images (template_id, slot, mime_type, bytes) VALUES (?, 'portrait', 'image/jpeg', ?) ON CONFLICT (template_id, slot) DO UPDATE SET mime_type = excluded.mime_type, bytes = excluded.bytes",
      args: [id, data]
    });
    statements.push({ sql: 'UPDATE creature_templates SET updated_at = unixepoch() WHERE id = ?', args: [id] });
  }
  if (!dryRun && statements.length) await sql.client.batch(statements, 'write');
  return { images: filenames.length, imported: statements.length / 2, kept, bytes, dryRun };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await importCreaturePortraits(db(), {
    dryRun: process.argv.includes('--dry-run'),
    overwrite: process.argv.includes('--overwrite')
  });
  console.log(`Creature portraits: ${result.imported} ${result.dryRun ? 'ready to import' : 'imported'}, ${result.kept} existing kept; ${result.images} files, ${result.bytes} bytes total.`);
}
