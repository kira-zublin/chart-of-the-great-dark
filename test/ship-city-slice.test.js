import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyLocationCards } from '../scripts/migrate-009.js';
import { seedShipCitySlice } from '../scripts/seed-ship-city-slice.js';

test('local Ship City slice links districts and preserves repeatable seed data', async () => {
  const client = createClient({ url: 'file::memory:' });
  const sql = { query: async (statement, args = []) => Array.from((await client.execute({ sql: statement, args })).rows) };
  try {
    await applyInitialSchema(sql);
    await applyWorldSchema(sql);
    await applyLocationCards(sql);
    await applyLocationCards(sql);
    await seedShipCitySlice(sql);
    await seedShipCitySlice(sql);
    const cityLinks = await sql.query("SELECT to_id FROM location_links WHERE from_id = 'ship-city'");
    assert.equal(cityLinks.length, 8);
    assert.ok(cityLinks.some(link => link.to_id === 'aluminum-bay'));
    assert.ok(cityLinks.some(link => link.to_id === 'hull-town'));
    const bazaar = (await sql.query("SELECT kind, teaser, quote, quote_speaker FROM locations WHERE id = 'bazaar-bizarre'"))[0];
    assert.equal(bazaar.kind, 'diorama');
    assert.ok(bazaar.teaser && bazaar.quote && bazaar.quote_speaker);
    const tower = (await sql.query("SELECT access_level FROM locations WHERE id = 'astrolaab-tower'"))[0];
    assert.equal(tower.access_level, 'inaccessible');
    const murk = (await sql.query("SELECT grid FROM locations WHERE id = 'warehouse-murk'"))[0];
    const grid = JSON.parse(murk.grid);
    assert.equal(grid.rooms.length, 3);
    assert.deepEqual(grid.entry, [1, 3]);
  } finally { client.close(); }
});
