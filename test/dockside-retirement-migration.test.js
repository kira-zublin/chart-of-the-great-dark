import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyLocationAccess } from '../scripts/migrate-008.js';
import { applyLocationCards } from '../scripts/migrate-009.js';
import { retireDocksidePrototype } from '../scripts/migrate-013.js';

test('the Dockside Exchange is retired and its visitors return to Ship City', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  try {
    await applyInitialSchema(sql); await applyWorldSchema(sql); await applyLocationAccess(sql); await applyLocationCards(sql);
    await sql.query("INSERT INTO profiles (id, name, password_salt, password_hash, role) VALUES ('p1', 'Player', 's', 'h', 'player')");
    await sql.query("INSERT INTO characters (id, owner_id, kind, name) VALUES ('c1', 'p1', 'pc', 'Trader')");
    await sql.query("INSERT INTO character_positions (character_id, location_id, x, y) VALUES ('c1', 'dockside', 400, 800)");

    assert.deepEqual(await retireDocksidePrototype(sql), { removed: 1, returned: 1 });
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM locations WHERE id = 'dockside'"))[0].count, 0);
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM location_links WHERE to_id = 'dockside' OR from_id = 'dockside'"))[0].count, 0);
    assert.deepEqual(await sql.query("SELECT location_id, x, y FROM character_positions WHERE character_id = 'c1'"), [{ location_id: 'ship-city', x: null, y: null }]);
    assert.ok((await sql.query("SELECT id FROM locations WHERE id = 'ship-city'")).length, 'Ship City is untouched');

    assert.deepEqual(await retireDocksidePrototype(sql), { removed: 0, returned: 0 });
  } finally { sql.close?.(); }
});
