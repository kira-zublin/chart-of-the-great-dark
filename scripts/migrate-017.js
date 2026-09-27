import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Adds creature palette templates, their images, and placed creatures; chat messages gain an optional
// reference to the creature the GM spoke as. Additive and safe to rerun.
export async function applyCreatureSchema(sql = db()) {
  if (!(await sql.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'locations'")).length) throw new Error('Apply world migration 006 before migration 017.');
  const chat = await sql.query('PRAGMA table_info(chat_messages)');
  if (!chat.length) throw new Error('Apply chat migration 004 before migration 017.');
  const source = await readFile(new URL('../db/017_creatures.sql', import.meta.url), 'utf8');
  for (const statement of source.replace(/^--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean)) await sql.query(statement);
  if (!chat.some(column => column.name === 'creature_id')) {
    await sql.query('ALTER TABLE chat_messages ADD COLUMN creature_id TEXT REFERENCES creatures(id) ON DELETE SET NULL');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyCreatureSchema();
  console.log('Creature schema applied.');
}
