import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyStandupScale } from '../scripts/migrate-012.js';
import { applyStandupVariants } from '../scripts/migrate-014.js';

test('the delve-suit slot is added without losing existing character images', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  try {
    await applyInitialSchema(sql); await applyWorldSchema(sql); await applyStandupScale(sql);
    await sql.query("INSERT INTO profiles (id, name, password_salt, password_hash, role) VALUES ('p1', 'Player', 's', 'h', 'player')");
    await sql.query("INSERT INTO characters (id, owner_id, kind, name) VALUES ('c1', 'p1', 'pc', 'Delver')");
    await sql.query("INSERT INTO character_positions (character_id, location_id, x, y, standup_scale) VALUES ('c1', 'ship-city', NULL, NULL, 1.2)");
    await sql.query("INSERT INTO character_images (character_id, slot, mime_type, bytes) VALUES ('c1', 'portrait', 'image/png', ?), ('c1', 'standup', 'image/webp', ?)", [Buffer.from('face'), Buffer.from('body')]);
    await assert.rejects(sql.query("INSERT INTO character_images (character_id, slot, mime_type, bytes) VALUES ('c1', 'delve_suit', 'image/png', x'00')"));

    await applyStandupVariants(sql); await applyStandupVariants(sql);
    const images = await sql.query('SELECT slot, mime_type, bytes FROM character_images ORDER BY slot');
    assert.deepEqual(images.map(row => [row.slot, row.mime_type, Buffer.from(row.bytes).toString()]), [['portrait', 'image/png', 'face'], ['standup', 'image/webp', 'body']]);
    await sql.query("INSERT INTO character_images (character_id, slot, mime_type, bytes) VALUES ('c1', 'delve_suit', 'image/png', x'00')");
    await assert.rejects(sql.query("INSERT INTO character_images (character_id, slot, mime_type, bytes) VALUES ('c1', 'hat', 'image/png', x'00')"));
    assert.deepEqual(await sql.query('SELECT standup_scale, standup_flipped, delve_suit FROM character_positions'), [{ standup_scale: 1.2, standup_flipped: 0, delve_suit: 0 }]);
    await assert.rejects(sql.query('UPDATE character_positions SET standup_flipped = 2'));
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'character_images_014'"))[0].count, 0);

    await sql.query("DELETE FROM characters WHERE id = 'c1'");
    assert.equal((await sql.query('SELECT COUNT(*) AS count FROM character_images'))[0].count, 0, 'images still cascade with their character');
  } finally {
    sql.client.close(); delete process.env.TURSO_DATABASE_URL;
  }
});
