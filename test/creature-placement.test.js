import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyChatSchema } from '../scripts/migrate-004.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyLocationAccess } from '../scripts/migrate-008.js';
import { applyLocationCards } from '../scripts/migrate-009.js';
import { applyStandupScale } from '../scripts/migrate-012.js';
import { applyStandupVariants } from '../scripts/migrate-014.js';
import { applyInstances } from '../scripts/migrate-015.js';
import { applyCreatureSchema } from '../scripts/migrate-017.js';
import { POST as authPost } from '../api/auth.js';
import { POST as characterPost } from '../api/characters.js';
import { GET as worldGet, POST as worldPost } from '../api/world.js';
import { footprintFits, nearestFootprint, nearestOpen } from '../lib/world.js';
import { baseCreatureName, nextCreatureName } from '../creature-stats.js';

const base = 'http://localhost:3000';
const req = (path, method = 'GET', value, cookie = '') => new Request(base + path, {
  method, headers: { ...(cookie ? { cookie } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
  body: value === undefined ? undefined : JSON.stringify(value)
});
const data = async response => ({ status: response.status, body: await response.json() });
const stats = footprint => JSON.stringify({ type: 'creature', rarity: 0, ferocity: 1, health: 9, armor: 0, attributes: {}, size: 'normal', footprint, description: '', containment: '', abilities: [], behavior: [], attacks: [], talents: [], equipment: '' });

test('creature names are numbered per location', () => {
  assert.equal(nextCreatureName('Hound', []), 'Hound');
  assert.equal(nextCreatureName('Hound', ['Hound']), 'Hound 2');
  assert.equal(nextCreatureName('Hound', ['Hound', 'Hound 2', 'Hound 7', 'Hounds', 'Hound x']), 'Hound 8');
  assert.equal(nextCreatureName('Hound', ['Hound 3']), 'Hound 4');
  assert.equal(baseCreatureName('Sentry Hound 12'), 'Sentry Hound');
  assert.equal(baseCreatureName('42'), '42');
  assert.ok(nextCreatureName('x'.repeat(80), ['x'.repeat(80)]).length <= 80);
});

test('footprints fit inside the grid around blocked and occupied squares', () => {
  const grid = { width: 4, height: 3, blocked: [[2, 0]], rooms: [], entry: [0, 0] };
  assert.ok(footprintFits(grid, 0, 0, 2, new Set()));
  assert.ok(!footprintFits(grid, 1, 0, 2, new Set()), 'blocked square');
  assert.ok(!footprintFits(grid, 3, 1, 2, new Set()), 'off the grid');
  assert.ok(!footprintFits(grid, 0, 0, 2, new Set(['1,1'])), 'occupied square');
  assert.deepEqual(nearestFootprint(grid, [1, 0], 2, new Set()), [0, 0]);
  assert.deepEqual(nearestFootprint(grid, [0, 0], 3, new Set()), null);
  assert.deepEqual(nearestOpen(grid, [2, 0], new Set()), [1, 0]);
});

test('GM places, moves, duplicates, hides, and removes creatures; players see only what they should', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.REGISTRATION_INVITE_CODE = 'private invitation';
  const sql = db();
  for (const apply of [applyInitialSchema, applySheetAndCrewSchema, applyChatSchema, applyWorldSchema, applyLocationAccess, applyLocationCards, applyStandupScale, applyStandupVariants, applyInstances, applyCreatureSchema]) await apply(sql);
  const signup = async (name, role) => (await authPost(req('/api/auth', 'POST', { action: 'register', name, password: 'long-password-123', role, inviteCode: process.env.REGISTRATION_INVITE_CODE }))).headers.get('set-cookie').split(';')[0];
  const alice = await signup('Alice', 'player'), gm = await signup('Keeper', 'gm');
  const saira = (await data(await characterPost(req('/api/characters', 'POST', { kind: 'pc', name: 'Saira', attributes: { strength: 4, agility: 4, logic: 4, insight: 4, perception: 4, empathy: 4 } }, alice)))).body.id;
  const brute = '22222222-2222-2222-2222-222222222222', imp = '33333333-3333-3333-3333-333333333333';
  await sql`INSERT INTO creature_templates (id, source, name, category, stats) VALUES (${brute}, 'custom', 'Brute', 'construct', ${stats(2)}), (${imp}, 'custom', 'Imp', 'echo', ${stats(1)})`;
  const act = (value, cookie = gm) => worldPost(req('/api/world', 'POST', value, cookie));
  const view = async cookie => (await data(await worldGet(req('/api/world', 'GET', undefined, cookie)))).body.creatures;

  // Placement is GM-only and limited to Vistas and Explorables
  assert.equal((await act({ action: 'placeCreature', templateId: brute, locationId: 'choir', x: 6, y: 0 }, alice)).status, 403);
  assert.equal((await act({ action: 'placeCreature', templateId: brute, locationId: 'ship-city' })).status, 400);
  assert.equal((await act({ action: 'placeCreature', templateId: '00000000-0000-0000-0000-000000000000', locationId: 'choir' })).status, 404);
  const first = await data(await act({ action: 'placeCreature', templateId: brute, locationId: 'choir', x: 6, y: 0 }));
  assert.equal(first.status, 201); assert.equal(first.body.name, 'Brute'); assert.deepEqual([first.body.x, first.body.y], [6, 0]);
  // A second drop on the same spot moves to the nearest place where the whole 2 × 2 footprint fits
  const second = await data(await act({ action: 'placeCreature', templateId: brute, locationId: 'choir', x: 6, y: 0 }));
  assert.equal(second.body.name, 'Brute 2');
  assert.ok(Math.abs(second.body.x - 6) >= 2 || Math.abs(second.body.y) >= 2, 'no overlap');
  const snapshot = (await sql`SELECT stats, health, template_id FROM creatures WHERE id = ${first.body.id}`)[0];
  assert.equal(snapshot.health, 9); assert.equal(snapshot.template_id, brute); assert.equal(JSON.parse(snapshot.stats).footprint, 2);

  // Creatures block characters, and characters block creatures
  await act({ action: 'move', characterId: saira, locationId: 'choir' }, alice);
  assert.equal((await act({ action: 'position', characterId: saira, x: 7, y: 1 }, alice)).status, 409, 'square covered by the 2 × 2 Brute');
  assert.equal((await act({ action: 'position', characterId: saira, x: 8, y: 3 }, alice)).status, 200);
  assert.equal((await act({ action: 'moveCreature', creatureId: first.body.id, x: 7, y: 2 })).status, 409, 'Saira stands in that footprint');
  assert.equal((await act({ action: 'moveCreature', creatureId: first.body.id, x: 4, y: 0 })).status, 409, 'blocked wall square');
  assert.equal((await act({ action: 'moveCreature', creatureId: first.body.id, x: 11, y: 7 })).status, 409, 'off the grid');
  assert.equal((await act({ action: 'moveCreature', creatureId: first.body.id, x: 6, y: 1 })).status, 200, 'may overlap its own old squares');
  assert.equal((await act({ action: 'moveCreature', creatureId: first.body.id, x: 6, y: 1 }, alice)).status, 403);

  // Players: fog hides creatures in unseen rooms; health only when shown; hidden creatures never appear
  await sql`UPDATE locations SET fog_enabled = 1 WHERE id = 'choir'`;
  await act({ action: 'position', characterId: saira, x: 1, y: 3 }, alice);
  assert.equal((await view(alice)).filter(row => row.location_id === 'choir').length, 0, 'Resonance Hall is fogged');
  await act({ action: 'room', locationId: 'choir', roomId: 'choir', visibility: 'show' });
  let seen = (await view(alice)).find(row => row.id === first.body.id);
  assert.equal(seen.name, 'Brute'); assert.equal(seen.footprint, 2); assert.equal(seen.health, undefined); assert.equal(seen.hidden, undefined);
  await sql`UPDATE creatures SET show_health = 1, health = 4 WHERE id = ${first.body.id}`;
  seen = (await view(alice)).find(row => row.id === first.body.id);
  assert.deepEqual([seen.health, seen.max_health], [4, 9]);
  assert.equal((await act({ action: 'creature', creatureId: first.body.id, hidden: true })).status, 200);
  assert.ok(!(await view(alice)).some(row => row.id === first.body.id));
  assert.equal((await view(gm)).find(row => row.id === first.body.id).hidden, true);
  // A hidden creature does not block characters, so it cannot give itself away
  assert.equal((await act({ action: 'position', characterId: saira, x: 7, y: 2 }, alice)).status, 200);
  assert.equal((await act({ action: 'moveCreature', creatureId: second.body.id, x: 7, y: 0 })).status, 409, 'creatures still avoid hidden creatures');

  // Vistas use free scene coordinates; stand-up size and flip are shared settings
  const vista = await data(await act({ action: 'placeCreature', templateId: imp, locationId: 'dockside' }));
  assert.deepEqual([vista.body.x, vista.body.y], [260, 820]);
  assert.equal((await act({ action: 'moveCreature', creatureId: vista.body.id, x: 1001, y: 500 })).status, 400);
  assert.equal((await act({ action: 'moveCreature', creatureId: vista.body.id, x: 700, y: 640 })).status, 200);
  assert.equal((await act({ action: 'creature', creatureId: vista.body.id, scale: 3.5 })).status, 400);
  assert.equal((await act({ action: 'creature', creatureId: vista.body.id, hidden: 'yes' })).status, 400);
  assert.equal((await act({ action: 'creature', creatureId: vista.body.id, scale: 2.4, flipped: true })).status, 200);
  const imp1 = (await view(alice)).find(row => row.id === vista.body.id);
  assert.deepEqual([imp1.x, imp1.y, imp1.standup_scale, imp1.standup_flipped], [700, 640, 2.4, true]);

  // Duplicates sit beside the original with full Health and the next number
  await sql`UPDATE creatures SET health = 1 WHERE id = ${vista.body.id}`;
  const copy = await data(await act({ action: 'duplicateCreature', creatureId: vista.body.id }));
  assert.equal(copy.status, 201); assert.equal(copy.body.name, 'Imp 2'); assert.deepEqual([copy.body.x, copy.body.y], [790, 640]);
  const copied = (await sql`SELECT health, standup_scale, standup_flipped FROM creatures WHERE id = ${copy.body.id}`)[0];
  assert.deepEqual([copied.health, copied.standup_scale, copied.standup_flipped], [9, 2.4, 1]);
  const gridCopy = await data(await act({ action: 'duplicateCreature', creatureId: second.body.id }));
  assert.equal(gridCopy.body.name, 'Brute 3');

  // Removal, and cleanup with an instanced area
  assert.equal((await act({ action: 'removeCreature', creatureId: copy.body.id }, alice)).status, 403);
  assert.equal((await act({ action: 'removeCreature', creatureId: copy.body.id })).status, 200);
  assert.equal((await act({ action: 'removeCreature', creatureId: copy.body.id })).status, 404);
  const instance = (await data(await act({ action: 'instance', locationId: 'choir' }))).body.id;
  const inside = await data(await act({ action: 'placeCreature', templateId: imp, locationId: instance }));
  assert.equal(inside.body.name, 'Imp', 'numbering is per location');
  await act({ action: 'deleteInstance', locationId: instance });
  assert.equal((await sql`SELECT COUNT(*) AS count FROM creatures WHERE id = ${inside.body.id}`)[0].count, 0);
});
