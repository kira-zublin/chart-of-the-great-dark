import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyChatSchema } from '../scripts/migrate-004.js';
import { applyPushSchema } from '../scripts/migrate-005.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyLocationAccess } from '../scripts/migrate-008.js';
import { applyLocationCards } from '../scripts/migrate-009.js';
import { applyStandupScale } from '../scripts/migrate-012.js';
import { applyStandupVariants } from '../scripts/migrate-014.js';
import { applyInstances } from '../scripts/migrate-015.js';
import { applyCreatureSchema } from '../scripts/migrate-017.js';
import { POST as authPost } from '../api/auth.js';
import { GET as worldGet, POST as worldPost } from '../api/world.js';
import { GET as chatGet, POST as chatPost, describeRoll } from '../api/chat.js';
import { cleanCreatureConditions } from '../creature-stats.js';
import { messageAvatar, rollCard } from '../chat-ui.js';
import { dialogLine } from '../vista-dialog.js';
import { placedMeta } from '../creature-ui.js';
import { healthBar } from '../world-ui.js';

const base = 'http://localhost:3000';
const req = (path, method = 'GET', value, cookie = '') => new Request(base + path, {
  method, headers: { ...(cookie ? { cookie } : {}), ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
  body: value === undefined ? undefined : JSON.stringify(value)
});
const data = async response => ({ status: response.status, body: await response.json() });
// An invented creature; the rulebook's text stays out of the repository.
const stats = { type: 'creature', rarity: 0, ferocity: 1, health: 8, armor: 1, attributes: { agility: 4 }, size: 'normal', footprint: 1, description: '', containment: '', abilities: [], behavior: [], talents: [], equipment: '',
  attacks: [{ roll: 1, name: 'Rake', text: 'Claws one Explorer.', dice: 6, damage: 1, crit: 3, blightDice: null, blight: null, despair: null }, { roll: 2, name: 'Wail', text: 'Everyone nearby shudders.', dice: null, damage: null, crit: null, blightDice: 4, blight: 1, despair: 2 }] };

test('conditions, health bars and placed summaries', () => {
  assert.deepEqual(cleanCreatureConditions([' Stunned ', 'dazed', 'stunned']), ['Stunned', 'dazed']);
  assert.equal(cleanCreatureConditions(['x'.repeat(41)]), null);
  assert.equal(cleanCreatureConditions(Array.from({ length: 13 }, (_, i) => `c${i}`)), null);
  assert.equal(cleanCreatureConditions('dazed'), null);
  assert.deepEqual(healthBar({ health: 3, max_health: 12, show_health: false }), { share: 0.25, text: 'Health 3/12', shared: false });
  assert.equal(healthBar({ name: 'no health for players' }), null);
  assert.equal(placedMeta({ health: 0, max_health: 8, hidden: true, conditions: ['dazed', 'Stunned'] }), 'Health 0/8 · Broken · Hidden · Dazed · Stunned');
});

test('attack cards, creature avatars and creature dialog lines', () => {
  const attack = { type: 'attack', roll: 2, name: 'Wail', summary: 'Blight attack 4 dice, base Blight 1 · 2 despair', text: 'Everyone nearby shudders.', baseDice: [], blightDice: [6, 2, 6, 1], gearDice: [], successes: 0, blightSuccesses: 2 };
  const card = rollCard(attack);
  assert.equal(card.title, 'Signature attack 2 · Wail');
  assert.equal(card.result, '2 Blight');
  assert.deepEqual(card.dice.map(die => die.blight), [true, true, true, true]);
  assert.equal(card.note, 'Everyone nearby shudders.');
  assert.match(describeRoll(attack), /^used 2\. Wail \(Blight attack 4 dice.*\): Blight \[6, 2, 6, 1\] — 2 successes$/);
  assert.equal(rollCard({ ...attack, blightDice: [], blightSuccesses: 0, summary: '' }).result, null);

  const art = { creature_id: 'c1', creature_image: 't1', creature_image_version: 5, creature_category: 'beast' };
  assert.equal(messageAvatar(art), '/api/creature-image?id=t1&slot=portrait&v=5');
  assert.equal(messageAvatar({ ...art, creature_image: null }), 'assets/icons/creatures/beast.svg');
  assert.equal(messageAvatar({ character_id: 'p1', has_portrait: false }), 'assets/characters/anonymous-explorer.png');
  const line = dialogLine({ id: 4, kind: 'text', body: 'You should not have come.', from_gm: true, character_id: null, character_name: 'Rake Hound', creature_id: 'c1', creature_category: 'beast', player_name: 'Keeper' });
  assert.equal(line.narrator, false); assert.equal(line.speaker, 'Rake Hound'); assert.equal(line.portrait, 'assets/icons/creatures/beast.svg');
  assert.equal(dialogLine({ id: 5, kind: 'text', body: 'Dust falls.', from_gm: true, character_id: null, creature_id: null, player_name: 'Keeper' }).narrator, true);
});

test('GM tracks a placed creature, edits its snapshot, and speaks and attacks as it', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.REGISTRATION_INVITE_CODE = 'private invitation';
  const sql = db();
  for (const apply of [applyInitialSchema, applySheetAndCrewSchema, applyChatSchema, applyPushSchema, applyWorldSchema, applyLocationAccess, applyLocationCards, applyStandupScale, applyStandupVariants, applyInstances, applyCreatureSchema]) await apply(sql);
  const signup = async (name, role) => (await authPost(req('/api/auth', 'POST', { action: 'register', name, password: 'long-password-123', role, inviteCode: process.env.REGISTRATION_INVITE_CODE }))).headers.get('set-cookie').split(';')[0];
  const alice = await signup('Alice', 'player'), gm = await signup('Keeper', 'gm');
  const template = '44444444-4444-4444-4444-444444444444';
  await sql`INSERT INTO creature_templates (id, source, name, category, stats) VALUES (${template}, 'custom', 'Rake Hound', 'beast', ${JSON.stringify(stats)})`;
  const act = (value, cookie = gm) => worldPost(req('/api/world', 'POST', value, cookie));
  const say = (value, cookie = gm) => chatPost(req('/api/chat', 'POST', value, cookie));
  const mine = async (cookie, id) => (await data(await worldGet(req('/api/world', 'GET', undefined, cookie)))).body.creatures.find(row => row.id === id);
  const hound = (await data(await act({ action: 'placeCreature', templateId: template, locationId: 'dockside' }))).body.id;
  const other = (await data(await act({ action: 'placeCreature', templateId: template, locationId: 'dockside' }))).body.id;

  // Health, conditions, name and Show Health
  assert.equal((await act({ action: 'creature', creatureId: hound, health: 3 }, alice)).status, 403);
  for (const bad of [{ health: -1 }, { health: 1.5 }, { health: 100 }, { name: ' ' }, { name: 'x'.repeat(81) }, { conditions: 'dazed' }, { showHealth: 'yes' }]) {
    assert.equal((await act({ action: 'creature', creatureId: hound, ...bad })).status, 400, JSON.stringify(bad));
  }
  assert.equal((await act({ action: 'creature', creatureId: hound, health: 3, conditions: ['dazed', 'Stunned'], name: 'Old Rake' })).status, 200);
  let seen = await mine(gm, hound);
  assert.deepEqual([seen.name, seen.health, seen.max_health, seen.conditions, seen.stats.attacks.length, seen.last_attack], ['Old Rake', 3, 8, ['dazed', 'Stunned'], 2, null]);
  seen = await mine(alice, hound);
  assert.deepEqual([seen.name, seen.health, seen.conditions, seen.stats], ['Old Rake', undefined, undefined, undefined]);
  await act({ action: 'creature', creatureId: hound, showHealth: true });
  seen = await mine(alice, hound);
  assert.deepEqual([seen.health, seen.max_health], [3, 8]);

  // Editing one creature's stats leaves the palette and other creatures alone, and caps Health at the new maximum
  const edited = { ...stats, health: 2, attacks: [stats.attacks[0]] };
  assert.equal((await act({ action: 'creatureStats', creatureId: hound, name: 'Old Rake', category: 'beast', stats: { ...stats, health: 0 } })).status, 400);
  assert.equal((await act({ action: 'creatureStats', creatureId: hound, name: 'Old Rake', category: 'echo', stats: edited })).status, 200);
  seen = await mine(gm, hound);
  assert.deepEqual([seen.health, seen.max_health, seen.category, seen.stats.attacks.length], [2, 2, 'echo', 1]);
  assert.equal(JSON.parse((await sql`SELECT stats FROM creature_templates WHERE id = ${template}`)[0].stats).health, 8);
  assert.equal((await mine(gm, other)).max_health, 8);

  // Speaking as a creature
  assert.equal((await say({ type: 'text', text: 'Grr', creatureId: hound }, alice)).status, 403, 'players cannot speak as creatures');
  assert.equal((await say({ type: 'text', text: 'Grr', creatureId: '00000000-0000-0000-0000-000000000000' })).status, 403);
  const spoken = await data(await say({ type: 'text', text: 'You should not have come.', creatureId: hound }));
  assert.equal(spoken.status, 201);
  assert.deepEqual([spoken.body.message.character_name, spoken.body.message.creature_id, spoken.body.message.creature_category, spoken.body.message.character_id], ['Old Rake', hound, 'echo', null]);

  // Signature attacks: the GM chooses one, and the server rolls its base and Blight dice
  assert.equal((await say({ type: 'attack', attack: 1 })).status, 400, 'needs a creature');
  assert.equal((await say({ type: 'attack', attack: 2, creatureId: hound })).status, 404, 'removed from this creature');
  const rake = await data(await say({ type: 'attack', attack: 1, creatureId: hound }));
  assert.equal(rake.status, 201);
  const roll = rake.body.message.roll;
  assert.deepEqual([roll.type, roll.name, roll.baseDice.length, roll.blightDice.length, roll.damage, roll.crit], ['attack', 'Rake', 6, 0, 1, 3]);
  assert.equal(roll.successes, roll.baseDice.filter(die => die === 6).length);
  const wail = await data(await say({ type: 'attack', attack: 2, creatureId: other }));
  assert.deepEqual([wail.body.message.roll.baseDice.length, wail.body.message.roll.blightDice.length, wail.body.message.roll.despair], [0, 4, 2]);
  assert.equal((await mine(gm, hound)).last_attack, 1);
  assert.equal((await mine(gm, other)).last_attack, 2);
  assert.equal((await say({ type: 'push', messageId: rake.body.message.id })).status, 400, 'creatures do not push');
  const history = (await data(await chatGet(req('/api/chat', 'GET', undefined, alice)))).body.messages;
  assert.ok(history.some(item => item.roll?.type === 'attack' && item.character_name === 'Old Rake'));

  // Removing the creature keeps its lines under its name
  await act({ action: 'removeCreature', creatureId: hound });
  const kept = (await data(await chatGet(req('/api/chat', 'GET', undefined, alice)))).body.messages.find(item => item.id === spoken.body.message.id);
  assert.deepEqual([kept.character_name, kept.creature_id, kept.creature_category], ['Old Rake', null, null]);
  assert.equal((await say({ type: 'text', text: 'Still here?', creatureId: hound })).status, 403);
});
