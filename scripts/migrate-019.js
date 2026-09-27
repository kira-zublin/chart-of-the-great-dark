import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';
import { applyRulesLibrarySchema } from './migrate-018.js';

// Adds the crew's engagement tracker and crew-point history, and rebuilds the rules reference table so it
// accepts the crew kinds. The reference is copied across, so no reimport is needed. Safe to rerun.
export async function applyCrewSheetSchema(sql = db()) {
  const crew = await sql.query('PRAGMA table_info(crew)');
  if (!crew.length) throw new Error('Apply sheet and crew migration 002 before migration 019.');
  if (!crew.some(column => column.name === 'engagement')) await sql.query("ALTER TABLE crew ADD COLUMN engagement TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(engagement))");
  if (!crew.some(column => column.name === 'points_log')) await sql.query("ALTER TABLE crew ADD COLUMN points_log TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(points_log))");

  await applyRulesLibrarySchema(sql);
  const table = (await sql.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'rules_entries'"))[0]?.sql || '';
  if (table.includes("'maneuver'")) return;
  const source = await readFile(new URL('../db/019_crew_sheet.sql', import.meta.url), 'utf8');
  const create = source.replace(/^--.*$/gm, '').trim().replace(/;$/, '');
  await sql.client.batch([
    'DROP TABLE IF EXISTS rules_entries_019',
    create,
    'INSERT INTO rules_entries_019 (kind, key, name, data, position) SELECT kind, key, name, data, position FROM rules_entries',
    'DROP TABLE rules_entries',
    'ALTER TABLE rules_entries_019 RENAME TO rules_entries'
  ], 'write');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyCrewSheetSchema();
  console.log('Crew sheet schema applied.');
}
