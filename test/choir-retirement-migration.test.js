import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyLocationAccess } from '../scripts/migrate-008.js';
import { applyLocationCards } from '../scripts/migrate-009.js';
import { retireChoirPrototype } from '../scripts/migrate-011.js';

test('the Choir prototype is retired without stranding characters or other locations', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  try {
    await applyInitialSchema(sql); await applyWorldSchema(sql); await applyLocationAccess(sql); await applyLocationCards(sql);
    await sql.query("INSERT INTO profiles (id, name, password_salt, password_hash, role) VALUES ('p1', 'Player', 's', 'h', 'player')");
    await sql.query("INSERT INTO characters (id, owner_id, kind, name) VALUES ('c1', 'p1', 'pc', 'Delver'), ('c2', 'p1', 'pc', 'Porter')");
    await sql.query("INSERT INTO character_positions (character_id, location_id, x, y) VALUES ('c1', 'choir-depths', 2, 3), ('c2', 'dockside', NULL, NULL)");
    await sql.query("INSERT INTO locations (id, kind, parent_id, title, description) VALUES ('gm-annex', 'diorama', 'choir', 'Annex', '')");
    await sql.query("INSERT INTO room_overrides (location_id, room_id, visibility) VALUES ('choir', 'entry', 'hide')");

    assert.deepEqual(await retireChoirPrototype(sql), { removed: 2, returned: 1 });
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM locations WHERE id IN ('choir', 'choir-depths')"))[0].count, 0);
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM location_links WHERE from_id IN ('choir', 'choir-depths') OR to_id IN ('choir', 'choir-depths')"))[0].count, 0);
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM room_overrides WHERE location_id = 'choir'"))[0].count, 0);
    assert.deepEqual(await sql.query("SELECT character_id, location_id, x, y FROM character_positions ORDER BY character_id"), [
      { character_id: 'c1', location_id: 'ship-city', x: null, y: null },
      { character_id: 'c2', location_id: 'dockside', x: null, y: null }
    ]);
    assert.equal((await sql.query("SELECT parent_id FROM locations WHERE id = 'gm-annex'"))[0].parent_id, 'ship-city');
    assert.ok((await sql.query("SELECT id FROM location_links WHERE id = 'star-ship-city'")).length, 'Ship City keeps its star-map link');

    assert.deepEqual(await retireChoirPrototype(sql), { removed: 0, returned: 0 });
  } finally { sql.close?.(); }
});
