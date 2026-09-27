import test from 'node:test';
import assert from 'node:assert/strict';
import { db, digest } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applyRulesLibrarySchema } from '../scripts/migrate-018.js';
import { importRulesLibrary } from '../scripts/import-rules.js';
import { cleanRulesEntry } from '../lib/rules-library.js';
import { GET } from '../api/rules.js';

// Invented entries only: the rulebook's text stays out of the repository.
const library = { entries: [
  { kind: 'talent', key: 'test-lore', name: 'Test Lore', data: { group: 'Knowledge', max: 3, text: 'Knows test things.' } },
  { kind: 'injury', key: 'test-bruise', name: 'Test bruise', data: { roll: '11–12', lethal: false, effect: 'You become Dazed.', heal: '1 shift' } },
  { kind: 'trauma', key: 'test-jitters', name: 'Test jitters', data: { roll: '13', effect: 'You become Shaken.', heal: '1 shift' } },
  { kind: 'blight', key: 'test-glimmer', name: 'Test glimmer', data: { roll: '14', description: 'Faint light.', effect: 'None.', heal: 'D6 days' } },
  { kind: 'feature', key: 'weapon-test-edge', name: 'Test edge', data: { applies: 'weapon', text: 'Sharp.' } }
] };
const request = token => new Request('http://localhost:3000/api/rules', { headers: token ? { cookie: `chart_session=${token}` } : {} });

test('rules entries are validated by kind', () => {
  assert.deepEqual(cleanRulesEntry(library.entries[0]), library.entries[0]);
  assert.equal(cleanRulesEntry({ ...library.entries[0], kind: 'spell' }), null);
  assert.equal(cleanRulesEntry({ ...library.entries[0], key: 'Bad Key' }), null);
  assert.equal(cleanRulesEntry({ ...library.entries[0], data: { ...library.entries[0].data, max: 2 } }), null);
  assert.equal(cleanRulesEntry({ ...library.entries[1], data: { ...library.entries[1].data, lethal: 'no' } }), null);
  assert.equal(cleanRulesEntry({ ...library.entries[4], data: { applies: 'boat', text: 'x' } }), null);
  assert.equal(cleanRulesEntry({ ...library.entries[3], data: { ...library.entries[3].data, description: 'x'.repeat(501) } }), null);
});

test('the rules reference imports as a whole and is readable by any signed-in profile', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  await applyInitialSchema(sql);
  const player = 'e'.repeat(64);
  await sql`INSERT INTO profiles (id, name, role, password_salt, password_hash) VALUES ('p1', 'Explorer', 'player', 'x', 'x')`;
  await sql`INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (${digest(player)}, 'p1', unixepoch() + 3600)`;

  // Before migration 018 the sheet still works, with no descriptions.
  assert.deepEqual((await (await GET(request(player))).json()).entries, []);
  await applyRulesLibrarySchema(sql); await applyRulesLibrarySchema(sql);
  assert.equal((await GET(request())).status, 401);

  assert.deepEqual(await importRulesLibrary(sql, library), { talent: 1, injury: 1, trauma: 1, blight: 1, feature: 1 });
  await assert.rejects(importRulesLibrary(sql, { entries: [{ ...library.entries[0], name: '' }] }), /entry 1/);
  await assert.rejects(importRulesLibrary(sql, { entries: [library.entries[0], library.entries[0]] }), /unique/);
  // A rerun replaces the set rather than adding to it.
  assert.deepEqual(await importRulesLibrary(sql, { entries: library.entries.slice(0, 2) }), { talent: 1, injury: 1, trauma: 0, blight: 0, feature: 0 });
  const entries = (await (await GET(request(player))).json()).entries;
  assert.deepEqual(entries.map(entry => entry.name), ['Test bruise', 'Test Lore']);
  assert.equal(entries.find(entry => entry.kind === 'injury').data.lethal, false);
});
