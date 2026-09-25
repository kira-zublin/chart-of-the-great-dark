import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyChatSchema } from '../scripts/migrate-004.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyChoirParent } from '../scripts/migrate-007.js';
import { applyLocationAccess } from '../scripts/migrate-008.js';
import { GET as authGet, POST as authPost } from '../api/auth.js';
import { POST as characterPost } from '../api/characters.js';
import { GET as worldGet, POST as worldPost } from '../api/world.js';
import { GET as imageGet, PUT as imagePut } from '../api/location-image.js';
import { GET as characterImageGet, PUT as characterImagePut } from '../api/image.js';

const base = 'http://localhost:3000';
const req = (path, method = 'GET', value, cookie = '') => new Request(base + path, {
  method, headers: { ...(cookie ? { cookie } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
  body: value === undefined ? undefined : JSON.stringify(value)
});
const data = async response => ({ status: response.status, body: await response.json() });
const character = name => ({ kind: 'pc', name, attributes: { strength: 4, agility: 4, logic: 4, insight: 4, perception: 4, empathy: 4 } });

test('world positions, fog, GM permissions, pulls, and uploaded art', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.REGISTRATION_INVITE_CODE = 'private invitation';
  const sql = db();
  try {
    await applyInitialSchema(sql); await applySheetAndCrewSchema(sql); await applyChatSchema(sql); await applyWorldSchema(sql); await applyWorldSchema(sql); await applyLocationAccess(sql); await applyLocationAccess(sql);
    assert.equal((await sql`SELECT parent_id FROM locations WHERE id = 'choir'`)[0].parent_id, 'ship-city');
    await sql`UPDATE locations SET parent_id = 'star-map' WHERE id = 'choir'`;
    await applyChoirParent(sql); await applyChoirParent(sql);
    assert.equal((await sql`SELECT parent_id FROM locations WHERE id = 'choir'`)[0].parent_id, 'ship-city');
    const signup = async (name, role) => {
      const response = await authPost(req('/api/auth', 'POST', { action: 'register', name, password: 'long-password-123', role, inviteCode: process.env.REGISTRATION_INVITE_CODE }));
      assert.equal(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    };
    const alice = await signup('Alice', 'player'), bob = await signup('Bob', 'player'), gm = await signup('Keeper', 'gm');
    const a = (await data(await characterPost(req('/api/characters', 'POST', character('Saira'), alice)))).body.id;
    const b = (await data(await characterPost(req('/api/characters', 'POST', character('Nadir'), bob)))).body.id;
    assert.equal((await worldGet(req('/api/world'))).status, 401);
    const initial = (await data(await worldGet(req('/api/world', 'GET', undefined, alice)))).body;
    assert.equal(initial.positions.find(pos => pos.character_id === a).location_id, 'star-map');
    assert.equal(initial.locations.filter(loc => loc.id === 'choir').length, 1);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'fog', locationId: 'choir', enabled: false }, alice))).status, 403);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'move', characterId: b, locationId: 'choir' }, alice))).status, 403);
    const first = await data(await worldPost(req('/api/world', 'POST', { action: 'move', characterId: a, locationId: 'choir' }, alice)));
    assert.equal(first.status, 200); assert.deepEqual([first.body.moved[0].x, first.body.moved[0].y], [1, 3]);
    const second = await data(await worldPost(req('/api/world', 'POST', { action: 'move', characterId: b, locationId: 'choir' }, bob)));
    assert.equal(second.status, 200);
    assert.notDeepEqual([second.body.moved[0].x, second.body.moved[0].y], [1, 3]);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'position', characterId: b, x: 1, y: 3 }, bob))).status, 409);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'position', characterId: b, x: 5, y: 3 }, bob))).status, 200);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'room', locationId: 'choir', roomId: 'entry', visibility: 'hide' }, gm))).status, 200);
    const hidden = (await data(await worldGet(req('/api/world', 'GET', undefined, alice)))).body;
    assert.equal(hidden.visibleRooms.choir.entry, false);
    assert.equal(hidden.positions.find(pos => pos.character_id === a).x, null);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'room', locationId: 'choir', roomId: 'entry', visibility: 'show' }, gm))).status, 200);
    assert.equal((await data(await worldGet(req('/api/world', 'GET', undefined, alice)))).body.visibleRooms.choir.entry, true);
    const pulled = await data(await worldPost(req('/api/world', 'POST', { action: 'pull', characterIds: [a, b], locationId: 'choir-depths' }, gm)));
    assert.equal(pulled.status, 200); assert.notDeepEqual([pulled.body.moved[0].x, pulled.body.moved[0].y], [pulled.body.moved[1].x, pulled.body.moved[1].y]);
    const throughDoor = await data(await worldPost(req('/api/world', 'POST', { action: 'move', characterId: a, locationId: 'choir', linkId: 'depths-choir-door' }, alice)));
    assert.equal(throughDoor.status, 200); assert.deepEqual([throughDoor.body.moved[0].x, throughDoor.body.moved[0].y], [9, 3]);
    const created = await data(await worldPost(req('/api/world', 'POST', { action: 'create', parentId: 'ship-city', title: 'Test Hall', kind: 'diorama', description: 'A test.', x: 45, y: 60 }, gm)));
    assert.equal(created.status, 201);
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');
    assert.equal((await characterImagePut(new Request(base + `/api/image?id=${a}&slot=portrait`, { method: 'PUT', headers: { cookie: alice, 'Content-Type': 'image/png' }, body: bytes }))).status, 200);
    assert.equal((await characterImageGet(req(`/api/image?id=${a}&slot=portrait`, 'GET', undefined, bob))).status, 200);
    const uploadReq = new Request(base + `/api/location-image?id=${created.body.id}`, { method: 'PUT', headers: { cookie: gm, 'Content-Type': 'image/png' }, body: bytes });
    assert.equal((await imagePut(uploadReq)).status, 200);
    assert.equal((await imageGet(req(`/api/location-image?id=${created.body.id}`, 'GET', undefined, alice))).status, 200);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'edit', locationId: created.body.id, title: 'Test Hall', description: 'A test.', accessLevel: 'inaccessible', linkId: created.body.linkId, x: 60, y: 65 }, gm))).status, 200);
    const inaccessible = (await data(await worldGet(req('/api/world', 'GET', undefined, alice)))).body;
    assert.equal(inaccessible.locations.find(loc => loc.id === created.body.id).access_level, 'inaccessible');
    assert.equal(inaccessible.locations.find(loc => loc.id === created.body.id).has_image, false);
    assert.equal(inaccessible.links.find(link => link.id === created.body.linkId).x, 60);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'move', characterId: a, locationId: created.body.id }, alice))).status, 404);
    assert.equal((await imageGet(req(`/api/location-image?id=${created.body.id}`, 'GET', undefined, alice))).status, 404);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'marker', linkId: created.body.linkId, x: 70, y: 75 }, alice))).status, 403);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'marker', linkId: created.body.linkId, x: 70, y: 75 }, gm))).status, 200);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'marker', linkId: created.body.linkId, x: 101, y: 75 }, gm))).status, 400);
    assert.equal((await worldPost(req('/api/world', 'POST', { action: 'edit', locationId: created.body.id, title: 'Test Hall', description: 'A test.', accessLevel: 'invisible' }, gm))).status, 200);
    assert.equal((await data(await worldGet(req('/api/world', 'GET', undefined, alice)))).body.locations.some(loc => loc.id === created.body.id), false);
    assert.equal((await authGet(req('/api/auth', 'GET', undefined, alice))).status, 200);
  } finally {
    sql.client.close(); delete process.env.TURSO_DATABASE_URL; delete process.env.REGISTRATION_INVITE_CODE;
  }
});
