import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, stat, unlink } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { db } from '../lib/server.js';

// Copy a remote campaign to a new local SQLite file before a production migration.
export async function backupTurso(destination, source = db()) {
  const target = resolve(destination);
  try { await access(target); throw new Error(`Backup already exists: ${target}`); }
  catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
  const local = createClient({ url: `file:${target}` });
  const snapshot = source.client ? await source.client.transaction('read') : null;
  const read = snapshot ? async statement => Array.from((await snapshot.execute(statement)).rows) : statement => source.query(statement);
  try {
    const objects = await read("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name");
    await local.execute('PRAGMA foreign_keys = OFF');
    for (const object of objects.filter(item => item.type === 'table')) {
      await local.execute(object.sql);
      const name = `"${object.name.replaceAll('"', '""')}"`;
      const rows = await read(`SELECT * FROM ${name}`);
      for (const row of rows) {
        const columns = Object.keys(row);
        const names = columns.map(column => `"${column.replaceAll('"', '""')}"`).join(', ');
        await local.execute({ sql: `INSERT INTO ${name} (${names}) VALUES (${columns.map(() => '?').join(', ')})`, args: columns.map(column => row[column]) });
      }
      const copied = (await local.execute(`SELECT COUNT(*) AS total FROM ${name}`)).rows[0].total;
      if (Number(copied) !== rows.length) throw new Error(`Backup row count mismatch in ${object.name}`);
    }
    for (const object of objects.filter(item => item.type !== 'table')) await local.execute(object.sql);
    const integrity = (await local.execute('PRAGMA integrity_check')).rows[0].integrity_check;
    if (integrity !== 'ok') throw new Error(`Backup integrity check failed: ${integrity}`);
    if (snapshot) await snapshot.commit();
    await local.close();
    return { path: target, bytes: (await stat(target)).size, tables: objects.filter(item => item.type === 'table').length };
  } catch (cause) {
    if (snapshot) await snapshot.rollback().catch(() => {});
    await local.close();
    await unlink(target).catch(() => {});
    throw cause;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!process.argv[2]) throw new Error('Usage: node --env-file=<verified-env> scripts/backup-turso.js <new-backup.sqlite>');
  const result = await backupTurso(process.argv[2]);
  console.log(`Verified backup: ${result.path} (${result.tables} tables, ${result.bytes} bytes)`);
}
