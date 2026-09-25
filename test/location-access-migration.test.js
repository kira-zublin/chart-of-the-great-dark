import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { applyLocationAccess } from '../scripts/migrate-008.js';

test('legacy hidden locations become Invisible without resetting later access choices', async () => {
  const client = createClient({ url: 'file::memory:' });
  const sql = { query: async statement => Array.from((await client.execute(statement)).rows) };
  try {
    await client.execute('CREATE TABLE locations (id TEXT PRIMARY KEY, visible INTEGER NOT NULL)');
    await client.execute("INSERT INTO locations (id, visible) VALUES ('hidden', 0), ('shown', 1)");
    await applyLocationAccess(sql);
    let rows = await client.execute('SELECT id, access_level FROM locations ORDER BY id');
    assert.deepEqual(rows.rows.map(row => [row.id, row.access_level]), [['hidden', 'invisible'], ['shown', 'accessible']]);
    await client.execute("UPDATE locations SET access_level = 'inaccessible' WHERE id = 'shown'");
    await applyLocationAccess(sql);
    rows = await client.execute("SELECT access_level FROM locations WHERE id = 'shown'");
    assert.equal(rows.rows[0].access_level, 'inaccessible');
  } finally { client.close(); }
});
