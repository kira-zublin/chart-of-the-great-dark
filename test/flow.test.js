import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as authGet, POST as authPost, DELETE as authDelete } from '../api/auth.js';
import { GET as charactersGet, POST as charactersPost, PUT as charactersPut, DELETE as charactersDelete } from '../api/characters.js';
import { GET as imageGet, PUT as imagePut } from '../api/image.js';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';

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
    assert.equal((await result(await charactersGet(req('/api/characters', 'GET', undefined, playerCookie)))).body.characters.length, 1);
    assert.equal((await charactersDelete(req(`/api/characters?id=${id}`, 'DELETE', undefined, playerCookie))).status, 200);
    assert.equal((await imageGet(req(imagePath, 'GET', undefined, playerCookie))).status, 404);
    assert.equal((await sql`SELECT count(*) AS count FROM character_images WHERE character_id = ${id}`)[0].count, 0);

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
