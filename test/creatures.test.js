import test from 'node:test';
import assert from 'node:assert/strict';
import { db, digest } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyChatSchema } from '../scripts/migrate-004.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyCreatureSchema } from '../scripts/migrate-017.js';
import { importCreatureLibrary } from '../scripts/import-creatures.js';
import { DELETE, GET, POST, PUT, cleanTemplate, copyName } from '../api/creatures.js';
import * as images from '../api/creature-image.js';
import { attackSummary, blankStats, cleanStats } from '../creature-stats.js';
import { searchText, templateMeta } from '../creature-ui.js';

const base = 'http://localhost:3000/api/creatures';
const request = (path, method = 'GET', data, token, url = base) => new Request(url + path, {
  method, headers: { ...(token ? { cookie: `chart_session=${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
  body: data ? JSON.stringify(data) : undefined
});
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(16)]);

// Invented entries only: the rulebook's text stays out of the repository.
const hound = {
  type: 'creature', rarity: 1, ferocity: 2, health: 7, armor: 1, attributes: { agility: 4, perception: 5 }, size: 'normal', footprint: 1,
  description: 'A test hound.', containment: 'Keep a respectful distance.',
  abilities: [{ name: 'Pack Hunter', text: 'Hunts in pairs.' }],
  behavior: [{ from: 4, to: 6, text: 'Circling' }, { from: 1, to: 3, text: 'Sleeping' }],
  attacks: [{ roll: 2, name: 'Howl', despair: 2, text: 'Everyone nearby hears it.' }, { roll: 1, name: 'Bite', dice: 7, damage: 2, text: 'Snaps at one Explorer.' }]
};
const library = { entries: [
  { key: 'test-hound', name: 'Test Hound', category: 'beast', stats: hound },
  { key: 'test-guard', name: 'Test Guard', category: 'adversary', stats: { type: 'adversary', health: 7, attributes: { strength: 4, agility: 3, logic: 2, perception: 3, insight: 3, empathy: 2 }, talents: [{ name: 'Polearms', level: 2 }], equipment: 'Spear' } }
] };

test('creature stat blocks are validated and normalized', () => {
  const clean = cleanStats(hound);
  assert.deepEqual(clean.behavior.map(row => row.from), [1, 4], 'behavior sorted by roll');
  assert.deepEqual(clean.attacks.map(row => row.name), ['Bite', 'Howl'], 'attacks sorted by roll');
  assert.equal(clean.attacks[0].crit, null, 'no crit');
  assert.equal(clean.attacks[1].dice, null);
  assert.deepEqual(Object.keys(clean.attributes), ['agility', 'perception']);
  assert.deepEqual(cleanStats(blankStats('adversary')).attributes, { strength: 3, agility: 3, logic: 3, perception: 3, insight: 3, empathy: 3 });
  assert.equal(attackSummary(clean.attacks[0]), '7 base dice · damage 2 · no crit');
  assert.equal(attackSummary({ blightDice: 5, blight: 2, despair: 1 }), 'Blight attack 5 dice, base Blight 2 · 1 despair');

  for (const broken of [
    { ...hound, type: 'monster' }, { ...hound, health: 0 }, { ...hound, ferocity: 11 }, { ...hound, footprint: 4 }, { ...hound, size: 'huge' },
    { ...hound, attributes: { charm: 3 } }, { ...hound, attributes: { agility: 21 } }, { ...hound, description: 'x'.repeat(4001) },
    { ...hound, behavior: [{ from: 5, to: 2, text: 'Backwards' }] }, { ...hound, attacks: [{ roll: 7, name: 'Too high' }] },
    { ...hound, attacks: [{ roll: 1, name: '' }] }, { ...hound, attacks: [{ roll: 1, name: 'Huge', dice: 41 }] },
    { ...hound, abilities: Array.from({ length: 13 }, () => ({ name: 'Many', text: '' })) }, [], null
  ]) assert.equal(cleanStats(broken), null, JSON.stringify(broken)?.slice(0, 60));

  assert.equal(cleanTemplate({ name: 'Hound', category: 'dragon', stats: hound }), null);
  assert.equal(cleanTemplate({ name: '  ', category: 'beast', stats: hound }), null);
  assert.equal(copyName('x'.repeat(80)).length, 80);
});

test('palette helpers search abilities, attacks and talents', () => {
  const template = { name: 'Test Hound', category: 'beast', stats: cleanStats(hound) };
  assert.ok(searchText(template).includes('pack hunter'));
  assert.ok(searchText(template).includes('beasts'));
  assert.equal(templateMeta(template), 'Ferocity 2 · Health 7 · Armor 1');
  assert.equal(templateMeta({ stats: cleanStats(library.entries[1].stats) }), 'Health 7 · Polearms 2');
});

test('creature palette: GM-only CRUD, duplicates, images, and the book import', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  await applyInitialSchema(sql); await applySheetAndCrewSchema(sql); await applyChatSchema(sql); await applyWorldSchema(sql);
  await applyCreatureSchema(sql); await applyCreatureSchema(sql);
  assert.ok((await sql.query('PRAGMA table_info(chat_messages)')).some(column => column.name === 'creature_id'));
  const gm = 'c'.repeat(64), player = 'd'.repeat(64);
  await sql`INSERT INTO profiles (id, name, role, password_salt, password_hash) VALUES ('g1', 'Keeper', 'gm', 'x', 'x'), ('p1', 'Explorer', 'player', 'x', 'x')`;
  await sql`INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (${digest(gm)}, 'g1', unixepoch() + 3600), (${digest(player)}, 'p1', unixepoch() + 3600)`;

  // Only the GM can use the palette
  assert.equal((await GET(request(''))).status, 401);
  assert.equal((await GET(request('', 'GET', null, player))).status, 403);
  assert.equal((await POST(request('', 'POST', { action: 'create', name: 'X', category: 'beast', stats: hound }, player))).status, 403);
  assert.deepEqual((await (await GET(request('', 'GET', null, gm))).json()).templates, []);

  // Book import adds, keeps GM edits on rerun, and restores them only on overwrite
  assert.deepEqual(await importCreatureLibrary(sql, library), { added: 2, updated: 0, kept: 0 });
  await assert.rejects(importCreatureLibrary(sql, { entries: [{ key: 'Bad Key', name: 'X', category: 'beast', stats: hound }] }), /entry 1/);
  await assert.rejects(importCreatureLibrary(sql, { entries: [library.entries[0], library.entries[0]] }), /unique/);
  let list = (await (await GET(request('', 'GET', null, gm))).json()).templates;
  assert.deepEqual(list.map(item => [item.name, item.source]), [['Test Guard', 'book'], ['Test Hound', 'book']]);
  const bookHound = list.find(item => item.book_key === 'test-hound');
  assert.equal(bookHound.stats.attacks[0].name, 'Bite');

  const edited = { id: bookHound.id, name: 'Hungry Hound', category: 'beast', stats: { ...hound, health: 12 } };
  assert.equal((await PUT(request('', 'PUT', { ...edited, stats: { ...hound, health: 100 } }, gm))).status, 400);
  assert.equal((await PUT(request('', 'PUT', { ...edited, id: '00000000-0000-0000-0000-000000000000' }, gm))).status, 404);
  assert.equal((await PUT(request('', 'PUT', edited, gm))).status, 200);
  assert.deepEqual(await importCreatureLibrary(sql, library), { added: 0, updated: 0, kept: 2 });
  assert.equal((await sql`SELECT name FROM creature_templates WHERE id = ${bookHound.id}`)[0].name, 'Hungry Hound');
  assert.deepEqual(await importCreatureLibrary(sql, library, { overwrite: true }), { added: 0, updated: 2, kept: 0 });
  assert.equal((await sql`SELECT name FROM creature_templates WHERE id = ${bookHound.id}`)[0].name, 'Test Hound');

  // GM-created entries are custom and never touched by the import
  const created = await (await POST(request('', 'POST', { action: 'create', name: ' Ash Moth ', category: 'blight', stats: blankStats('creature') }, gm))).json();
  const moth = created.templates.find(item => item.id === created.id);
  assert.equal(moth.name, 'Ash Moth'); assert.equal(moth.source, 'custom'); assert.equal(moth.book_key, null);
  assert.equal((await POST(request('', 'POST', { action: 'create', name: 'Bad', category: 'blight', stats: { type: 'creature' } }, gm))).status, 400);

  // Images: GM uploads; players see art only for a template placed on the map and not hidden
  const imageUrl = 'http://localhost:3000/api/creature-image';
  const put = (id, token, bytes = png, type = 'image/png') => images.PUT(new Request(`${imageUrl}?id=${id}&slot=portrait`, { method: 'PUT', headers: { cookie: `chart_session=${token}`, 'Content-Type': type }, body: bytes }));
  assert.equal((await put(bookHound.id, player)).status, 403);
  assert.equal((await put(bookHound.id, gm, Buffer.from('not an image'))).status, 400);
  assert.equal((await put(bookHound.id, gm, png, 'image/gif')).status, 400);
  assert.equal((await put(bookHound.id, gm)).status, 200);
  const getImage = token => images.GET(request(`?id=${bookHound.id}&slot=portrait`, 'GET', null, token, imageUrl));
  assert.equal((await getImage(gm)).status, 200);
  assert.equal((await getImage(player)).status, 404);
  const placedId = '11111111-1111-1111-1111-111111111111';
  await sql`INSERT INTO creatures (id, template_id, name, category, stats, location_id, health, hidden) VALUES (${placedId}, ${bookHound.id}, 'Hound 1', 'beast', ${JSON.stringify(hound)}, 'star-map', 7, 1)`;
  assert.equal((await getImage(player)).status, 404, 'hidden creature');
  await sql`UPDATE creatures SET hidden = 0 WHERE id = ${placedId}`;
  assert.equal((await getImage(player)).status, 200);
  list = (await (await GET(request('', 'GET', null, gm))).json()).templates;
  assert.equal(list.find(item => item.id === bookHound.id).has_portrait, true);

  // Duplicates are custom copies with their own images
  const copy = await (await POST(request('', 'POST', { action: 'duplicate', id: bookHound.id }, gm))).json();
  const duplicate = copy.templates.find(item => item.id === copy.id);
  assert.equal(duplicate.name, 'Test Hound (copy)'); assert.equal(duplicate.source, 'custom'); assert.equal(duplicate.has_portrait, true);
  assert.deepEqual(duplicate.stats, bookHound.stats);
  assert.equal((await POST(request('', 'POST', { action: 'duplicate', id: '00000000-0000-0000-0000-000000000000' }, gm))).status, 404);

  // Deleting a template keeps placed creatures, which fall back to their own snapshot and category icon
  assert.equal((await DELETE(request(`?id=${bookHound.id}`, 'DELETE', null, player))).status, 403);
  const afterDelete = await (await DELETE(request(`?id=${bookHound.id}`, 'DELETE', null, gm))).json();
  assert.ok(!afterDelete.templates.some(item => item.id === bookHound.id));
  const placed = (await sql`SELECT template_id, name FROM creatures WHERE id = ${placedId}`)[0];
  assert.equal(placed.template_id, null); assert.equal(placed.name, 'Hound 1');
  assert.equal((await sql`SELECT COUNT(*) AS count FROM creature_template_images WHERE template_id = ${bookHound.id}`)[0].count, 0);
  assert.equal((await DELETE(request(`?id=${bookHound.id}`, 'DELETE', null, gm))).status, 404);
});
