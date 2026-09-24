import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as authGet, POST as authPost, DELETE as authDelete } from '../api/auth.js';
import { GET as charactersGet, POST as charactersPost, PUT as charactersPut, DELETE as charactersDelete } from '../api/characters.js';
import { GET as imageGet, PUT as imagePut } from '../api/image.js';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyCrewImageSchema } from '../scripts/migrate-003.js';
import { GET as crewGet, PATCH as crewPatch } from '../api/crew.js';
import { GET as crewImageGet, PUT as crewImagePut, DELETE as crewImageDelete } from '../api/crew-image.js';

const base = 'http://localhost:3000';
function req(path, method = 'GET', value, cookie = '') {
  return new Request(base + path, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: value === undefined ? undefined : JSON.stringify(value)
  });
}
async function result(response) { return { status: response.status, body: await response.json() }; }
const sheet = {
  kind: 'pc', name: 'Saira', profession: 'Explorer', origin: 'Ship City', faction: 'Guild',
  appearance: 'Blue coat', motivation: 'Find the lost chart', description: 'Quiet cartographer',
  attributes: { strength: 1, agility: 2, logic: 3, insight: 4, perception: 5, empathy: 6 }
};

test('registration, sessions, role boundaries, characters, and image persistence', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.REGISTRATION_INVITE_CODE = 'a long private invitation';
  let client;
  try {
    const sql = db(); client = sql.client;
    await applyInitialSchema(sql);
    await applySheetAndCrewSchema(sql);
    await applyCrewImageSchema(sql);
    await applyCrewImageSchema(sql);
    const invalidInvite = await result(await authPost(req('/api/auth', 'POST', { action: 'register', name: 'Player One', password: 'long-password-123', role: 'player', inviteCode: 'wrong' })));
    assert.equal(invalidInvite.status, 403);
    const playerRes = await authPost(req('/api/auth', 'POST', { action: 'register', name: 'Player One', password: 'long-password-123', role: 'player', inviteCode: process.env.REGISTRATION_INVITE_CODE }));
    assert.equal(playerRes.status, 200);
    const player = (await playerRes.json()).profile;
    const playerCookie = playerRes.headers.get('set-cookie').split(';')[0];
    assert.equal((await result(await authGet(req('/api/auth', 'GET', undefined, playerCookie)))).body.profile.id, player.id);
    const duplicate = await authPost(req('/api/auth', 'POST', { action: 'register', name: 'player one', password: 'long-password-123', role: 'player', inviteCode: process.env.REGISTRATION_INVITE_CODE }));
    assert.equal(duplicate.status, 409);

    const created = await result(await charactersPost(req('/api/characters', 'POST', sheet, playerCookie)));
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal((await result(await charactersGet(req('/api/characters', 'GET', undefined, playerCookie)))).body.characters[0].attributes.perception, 5);
    const extended = { ...sheet, sheet: { specialty: 'Cartographer', quirk: 'Collects old charts', talents: [{ name: 'Lookout', level: 1 }], vitality: { health: 3, hope: 4, heart: 5 }, conditions: ['dazed'], weapons: [{ name: 'Pistol', bonus: 2, damage: 2, crit: 3, range: 'Short', features: '' }] } };
    assert.equal((await charactersPut(req('/api/characters', 'PUT', { ...extended, id }, playerCookie))).status, 200);
    assert.equal((await result(await charactersGet(req('/api/characters', 'GET', undefined, playerCookie)))).body.characters[0].sheet.specialty, 'Cartographer');
    assert.equal((await charactersPost(req('/api/characters', 'POST', { ...sheet, kind: 'npc' }, playerCookie))).status, 403);

    const gmRes = await authPost(req('/api/auth', 'POST', { action: 'register', name: 'Keeper', password: 'long-password-456', role: 'gm', inviteCode: process.env.REGISTRATION_INVITE_CODE }));
    assert.equal(gmRes.status, 200);
    const gmCookie = gmRes.headers.get('set-cookie').split(';')[0];
    assert.equal((await result(await charactersGet(req('/api/characters', 'GET', undefined, gmCookie)))).body.characters.length, 1);
    const npc = await result(await charactersPost(req('/api/characters', 'POST', { ...sheet, kind: 'npc', name: 'The Guide' }, gmCookie)));
    assert.equal(npc.status, 201);
    assert.equal((await result(await charactersGet(req('/api/characters?kind=npc', 'GET', undefined, gmCookie)))).body.characters.length, 1);
    assert.equal((await result(await charactersGet(req('/api/characters', 'GET', undefined, playerCookie)))).body.characters.length, 1);
    assert.equal((await charactersPut(req('/api/characters', 'PUT', { ...sheet, id: npc.body.id }, playerCookie))).status, 403);
    assert.equal((await charactersPut(req('/api/characters', 'PUT', { ...sheet, id, name: 'Saira the Cartographer' }, gmCookie))).status, 200);
    assert.equal((await result(await charactersGet(req('/api/characters', 'GET', undefined, playerCookie)))).body.characters[0].sheet.specialty, 'Cartographer');

    const crewBefore = (await result(await crewGet(req('/api/crew', 'GET', undefined, playerCookie)))).body.crew;
    assert.deepEqual(crewBefore.images, {});
    const crewImageBytes = Buffer.from('89504e470d0a1a0a00000000', 'hex');
    const imageRequest = (slot, method, cookie, bytes = crewImageBytes) => new Request(base + `/api/crew-image?slot=${slot}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(method === 'PUT' ? { 'Content-Type': 'image/png' } : {}) }, body: method === 'PUT' ? bytes : undefined });
    assert.equal((await crewImagePut(imageRequest('crew', 'PUT', '', crewImageBytes))).status, 401);
    assert.equal((await crewImagePut(imageRequest('crew', 'PUT', playerCookie, Buffer.from('not an image')))).status, 400);
    assert.equal((await crewImagePut(imageRequest('crew', 'PUT', playerCookie))).status, 200);
    assert.equal((await crewImagePut(imageRequest('bird', 'PUT', playerCookie))).status, 200);
    assert.equal((await crewImageGet(imageRequest('bird', 'GET', gmCookie))).status, 200);
    assert.equal((await crewImageGet(imageRequest('crew', 'GET', gmCookie))).status, 200);
    assert.equal((await crewImageGet(imageRequest('crew', 'GET', ''))).status, 401);
    assert.deepEqual((await result(await crewGet(req('/api/crew', 'GET', undefined, gmCookie)))).body.crew.images, { crew: true, bird: true });
    assert.equal((await crewImageDelete(imageRequest('bird', 'DELETE', gmCookie))).status, 200);
    assert.equal((await crewImageGet(imageRequest('bird', 'GET', playerCookie))).status, 404);
    assert.equal(crewBefore.roles.length, 5);
    const assign = await crewPatch(req('/api/crew', 'PATCH', { action: 'assign', role: 'scout', expectedId: null, characterId: id }, playerCookie));
    assert.equal(assign.status, 200);
    assert.equal((await crewPatch(req('/api/crew', 'PATCH', { action: 'assign', role: 'guard', expectedId: null, characterId: id }, playerCookie))).status, 409);
    assert.equal((await crewPatch(req('/api/crew', 'PATCH', { action: 'assign', role: 'scout', expectedId: null, characterId: npc.body.id }, playerCookie))).status, 409);
    const currentCrew = (await result(await crewGet(req('/api/crew', 'GET', undefined, gmCookie)))).body.crew;
    assert.equal(currentCrew.roles.find(item => item.role === 'scout').character_id, id);
    const secondRes = await authPost(req('/api/auth', 'POST', { action: 'register', name: 'Player Two', password: 'another-password-123', role: 'player', inviteCode: process.env.REGISTRATION_INVITE_CODE }));
    const secondCookie = secondRes.headers.get('set-cookie').split(';')[0];
    assert.equal((await crewPatch(req('/api/crew', 'PATCH', { action: 'assign', role: 'guard', expectedId: null, characterId: id }, secondCookie))).status, 403);
    assert.equal((await crewPatch(req('/api/crew', 'PATCH', { action: 'assign', role: 'scout', expectedId: id, characterId: null }, secondCookie))).status, 403);
    assert.equal((await crewGet(req('/api/crew'))).status, 401);
    assert.equal((await crewPatch(req('/api/crew', 'PATCH', { field: 'name', value: 'Wayfinders', revision: currentCrew.revision }, playerCookie))).status, 200);
    assert.equal((await crewPatch(req('/api/crew', 'PATCH', { field: 'crew_points', value: 2, revision: currentCrew.revision }, gmCookie))).status, 409);
    assert.equal((await result(await crewGet(req('/api/crew', 'GET', undefined, gmCookie)))).body.crew.name, 'Wayfinders');

    const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');
    const imagePath = `/api/image?id=${id}&slot=portrait`;
    const upload = await imagePut(new Request(base + imagePath, { method: 'PUT', headers: { cookie: playerCookie, 'Content-Type': 'image/png' }, body: imageBytes }));
    assert.equal(upload.status, 200);
    const image = await imageGet(req(imagePath, 'GET', undefined, playerCookie));
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), imageBytes);
    const savedAgain = await result(await charactersGet(req('/api/characters', 'GET', undefined, playerCookie)));
    assert.equal(savedAgain.body.characters[0].name, 'Saira the Cartographer');
    await applyInitialSchema(sql);
    await applySheetAndCrewSchema(sql);
    assert.equal((await result(await charactersGet(req('/api/characters', 'GET', undefined, playerCookie)))).body.characters.length, 1);
    assert.equal((await charactersDelete(req(`/api/characters?id=${id}`, 'DELETE', undefined, playerCookie))).status, 200);
    assert.equal((await imageGet(req(imagePath, 'GET', undefined, playerCookie))).status, 404);
    assert.equal((await sql`SELECT count(*) AS count FROM character_images WHERE character_id = ${id}`)[0].count, 0);
    assert.equal((await result(await crewGet(req('/api/crew', 'GET', undefined, gmCookie)))).body.crew.roles.find(item => item.role === 'scout').character_id, null);

    assert.equal((await authDelete(req('/api/auth', 'DELETE', undefined, playerCookie))).status, 200);
    assert.equal((await result(await authGet(req('/api/auth', 'GET', undefined, playerCookie)))).body.profile, null);
    const login = await authPost(req('/api/auth', 'POST', { action: 'login', name: 'Player One', password: 'long-password-123' }));
    assert.equal(login.status, 200);
  } finally {
    client?.close();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.REGISTRATION_INVITE_CODE;
  }
});
