import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyLocationAccess } from '../scripts/migrate-008.js';
import { applyLocationCards } from '../scripts/migrate-009.js';
import { applyStandupScale } from '../scripts/migrate-012.js';
import { applyStandupVariants } from '../scripts/migrate-014.js';
import { applyInstances } from '../scripts/migrate-015.js';
import { POST as authPost } from '../api/auth.js';
import { POST as characterPost } from '../api/characters.js';
import { GET as worldGet, POST as worldPost } from '../api/world.js';
import { PUT as imagePut } from '../api/location-image.js';

const base = 'http://localhost:3000';
const req = (path, method = 'GET', value, cookie = '') => new Request(base + path, {
  method, headers: { ...(cookie ? { cookie } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
  body: value === undefined ? undefined : JSON.stringify(value)
});
const data = async response => ({ status: response.status, body: await response.json() });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');

test('instanced areas copy a location without its connections and are cleaned up once idle', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.REGISTRATION_INVITE_CODE = 'private invitation';
  const sql = db();
  try {
    await applyInitialSchema(sql); await applySheetAndCrewSchema(sql); await applyWorldSchema(sql); await applyLocationAccess(sql); await applyLocationCards(sql);
    await applyStandupScale(sql); await applyStandupVariants(sql); await applyInstances(sql); await applyInstances(sql);
    const signup = async (name, role) => (await authPost(req('/api/auth', 'POST', { action: 'register', name, password: 'long-password-123', role, inviteCode: process.env.REGISTRATION_INVITE_CODE }))).headers.get('set-cookie').split(';')[0];
    const alice = await signup('Alice', 'player'), gm = await signup('Keeper', 'gm');
    const a = (await data(await characterPost(req('/api/characters', 'POST', { kind: 'pc', name: 'Saira', attributes: { strength: 4, agility: 4, logic: 4, insight: 4, perception: 4, empathy: 4 } }, alice)))).body.id;
    const act = (value, cookie = gm) => worldPost(req('/api/world', 'POST', value, cookie));
    const world = async (cookie = gm, viewing) => (await data(await worldGet(req(`/api/world${viewing ? `?viewing=${viewing}` : ''}`, 'GET', undefined, cookie)))).body;
    const count = async (table, id) => (await sql.query(`SELECT COUNT(*) AS count FROM ${table} WHERE location_id = ?`, [id]))[0].count;
    const idle = id => sql.query('UPDATE locations SET instance_active_at = unixepoch() - 3 * 60 * 60 WHERE id = ?', [id]);

    // The original keeps its art, card, fog and room settings; only the GM may instance, and only enterable places.
    assert.equal((await imagePut(new Request(base + '/api/location-image?id=choir', { method: 'PUT', headers: { cookie: gm, 'Content-Type': 'image/png' }, body: png }))).status, 200);
    assert.equal((await imagePut(new Request(base + '/api/location-image?id=choir&slot=card', { method: 'PUT', headers: { cookie: gm, 'Content-Type': 'image/png' }, body: png }))).status, 200);
    assert.equal((await act({ action: 'room', locationId: 'choir', roomId: 'entry', visibility: 'hide' })).status, 200);
    assert.equal((await act({ action: 'instance', locationId: 'choir' }, alice)).status, 403);
    assert.equal((await act({ action: 'instance', locationId: 'star-map' })).status, 400);
    const created = await data(await act({ action: 'instance', locationId: 'choir' }));
    assert.equal(created.status, 201);
    const id = created.body.id;
    const original = (await world()).locations.find(row => row.id === 'choir'), copy = (await world()).locations.find(row => row.id === id);
    for (const field of ['kind', 'parent_id', 'title', 'description', 'fog_enabled', 'has_image', 'has_card_image']) assert.deepEqual(copy[field], original[field], field);
    assert.deepEqual(copy.grid, original.grid);
    assert.deepEqual([copy.is_instance, copy.instance_of, copy.access_level], [1, 'choir', 'accessible']);
    assert.equal(await count('room_overrides', id), 1);
    assert.equal((await world()).links.filter(link => link.from_id === id || link.to_id === id).length, 0, 'no markers or doors');
    const nested = (await data(await act({ action: 'instance', locationId: id }))).body.id;
    assert.equal((await world()).locations.find(row => row.id === nested).instance_of, 'choir', 'an instance of an instance names the original');

    // Renaming the instance leaves the original alone.
    assert.equal((await act({ action: 'edit', locationId: id, title: 'Flooded Choir', description: 'Knee-deep.', accessLevel: 'accessible' })).status, 200);
    assert.equal((await world()).locations.find(row => row.id === 'choir').title, 'The Choir Below');

    // An occupied or viewed instance survives; an empty, unviewed one is removed with its art and settings.
    assert.equal((await act({ action: 'pull', characterIds: [a], locationId: id })).status, 200);
    await idle(id);
    assert.ok((await world(alice)).locations.some(row => row.id === id), 'occupied');
    assert.equal((await act({ action: 'move', characterId: a, locationId: 'ship-city' }, alice)).status, 200);
    await idle(id);
    assert.ok((await world(gm, id)).locations.some(row => row.id === id), 'viewed');
    assert.ok((await world()).locations.some(row => row.id === id), 'viewing marked it active');
    await idle(id);
    assert.ok(!(await world()).locations.some(row => row.id === id), 'idle instance removed');
    for (const table of ['location_images', 'location_card_images', 'room_overrides']) assert.equal(await count(table, id), 0, table);
    assert.ok((await world()).locations.some(row => row.id === 'choir'), 'the original remains');
    assert.equal(await count('location_images', 'choir'), 1);

    // Locations made inside a Hub instance are temporary too. Deleting the instance returns characters to the
    // Star Map and moves anything inside it up to the instance's parent.
    const hub = (await data(await act({ action: 'instance', locationId: 'ship-city' }))).body.id;
    const inner = (await data(await act({ action: 'create', parentId: hub, title: 'Pop-up Market', kind: 'diorama', description: '', x: 40, y: 40 }))).body.id;
    assert.equal((await world()).locations.find(row => row.id === inner).is_instance, 1);
    assert.equal((await act({ action: 'pull', characterIds: [a], locationId: hub })).status, 200);
    assert.equal((await act({ action: 'deleteInstance', locationId: hub }, alice)).status, 403);
    assert.equal((await act({ action: 'deleteInstance', locationId: 'ship-city' })).status, 400);
    assert.equal((await act({ action: 'deleteInstance', locationId: hub })).status, 200);
    const after = await world();
    assert.ok(!after.locations.some(row => row.id === hub));
    assert.equal(after.positions.find(pos => pos.character_id === a).location_id, 'star-map');
    assert.equal(after.locations.find(row => row.id === inner).parent_id, 'star-map');
    assert.ok(after.locations.some(row => row.id === 'ship-city'));
  } finally {
    sql.client.close(); delete process.env.TURSO_DATABASE_URL; delete process.env.REGISTRATION_INVITE_CODE;
  }
});
