import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

export async function applyPushSchema(sql = db()) {
  const source = await readFile(new URL('../db/005_chat_push.sql', import.meta.url), 'utf8');
  const columns = await sql.query('PRAGMA table_info(chat_messages)');
  if (!columns.some(column => column.name === 'push_of')) await sql.query(source.split(';')[0].replace(/^--.*$/gm, '').trim());
  await sql.query(source.split(';')[1].trim());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyPushSchema();
  console.log('Chat push schema applied.');
}
