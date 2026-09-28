import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';

// Adds the chat window marker that hides old messages from the chat window; safe to rerun.
export async function applyChatWindowSchema(sql = db()) {
  const source = await readFile(new URL('../db/020_chat_window.sql', import.meta.url), 'utf8');
  for (const statement of source.replace(/^--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean)) await sql.query(statement);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await applyChatWindowSchema();
  console.log('Chat window schema applied.');
}
