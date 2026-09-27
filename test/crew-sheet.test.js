import test from 'node:test';
import assert from 'node:assert/strict';
import { db, digest } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyCrewImageSchema } from '../scripts/migrate-003.js';
import { applyChatSchema } from '../scripts/migrate-004.js';
import { applyPushSchema } from '../scripts/migrate-005.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyCreatureSchema } from '../scripts/migrate-017.js';
import { applyRulesLibrarySchema } from '../scripts/migrate-018.js';
import { applyCrewSheetSchema } from '../scripts/migrate-019.js';
import { importRulesLibrary } from '../scripts/import-rules.js';
import { GET, PATCH, cleanCrewField, cleanPoints } from '../api/crew.js';
import { POST as chatPost } from '../api/chat.js';
import { rollCard } from '../chat-ui.js';
import { advancedPowers, bookManeuvers, commandDice, controlOutcome, findUpgrade, nextLevel, powerCost, roleFit, roles, slotsUsed, vehicleFromModel, vehicles } from '../crew-rules.js';

const request = (url, method = 'GET', data, token) => new Request(url, {
  method, headers: { ...(token ? { cookie: `chart_session=${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
  body: data ? JSON.stringify(data) : undefined
});
const crewUrl = 'http://localhost:3000/api/crew';

test('crew rules: role fit, Bird costs, losing control and commanding dice', () => {
  const delver = roles.find(role => role.key === 'delver');
  assert.equal(roleFit({ agility: 4, insight: 6 }, delver), 10);
  assert.equal(bookManeuvers.length, 20);
  assert.equal(new Set(bookManeuvers).size, 20);
  assert.equal(powerCost('Farsight', 'Guide'), 5);
  assert.equal(powerCost('Fetch', 'Ward'), 5);
  assert.equal(powerCost('Enshroud', 'Guide'), 10);
  assert.equal(advancedPowers.length, 12);
  assert.deepEqual([1, 2, 3, 6, 7, 8, 9, 14].map(controlOutcome), ['mind-link-break', 'mind-link-break', 'self-preservation-mode', 'lightstorm-display', 'temporal-drift', 'energy-drain', 'energy-surge', 'energy-surge']);
  assert.equal(commandDice({ insight: 6, handler: 1, companion: true, energy: 2 }), 10);
  assert.equal(commandDice({ insight: 3, weakened: true }), 1);
});

test('vehicle models start with upgrades from their own list, and levels cost more each step', () => {
  for (const [kind, vehicle] of Object.entries(vehicles)) {
    for (const [model, info] of Object.entries(vehicle.models)) {
      for (const name of info.starts) assert.ok(findUpgrade(kind, name), `${model}: ${name}`);
      assert.ok(slotsUsed(kind, vehicleFromModel(kind, model).installed) <= info.stats.slots, model);
    }
  }
  assert.deepEqual(nextLevel('rover', [], 'Armor Plating'), { level: 1, cost: 2 });
  assert.deepEqual(nextLevel('rover', [{ name: 'Armor Plating', level: 2 }], 'Armor Plating'), { level: 3, cost: 10 });
  assert.equal(nextLevel('rover', [{ name: 'Armor Plating', level: 3 }], 'Armor Plating'), null);
  assert.equal(slotsUsed('shuttle', [{ name: 'Galley', level: 2 }, { name: 'Hull Art', level: 1 }, { name: 'Our own gadget', level: 1 }]), 1);
  assert.equal(findUpgrade('rover', 'Jump Jets').hoverOnly, true);
});

test('crew fields validate the new shapes and keep older free text', () => {
  const id = '12345678-1234-1234-1234-123456789012';
  assert.equal(cleanCrewField('bird', { type: 'Dragon' }), null);
  assert.deepEqual(cleanCrewField('bird', { type: 'Guide', powers: ['Farsight', 'Farsight'], companion: id }).powers, ['Farsight']);
  assert.equal(cleanCrewField('bird', { companion: 'not-an-id' }), null);
  const rover = cleanCrewField('rover', { model: 'Rhino', speed: '2 zones', range: 'Long', installed: [{ name: 'Airlock', level: 1 }] });
  assert.equal(rover.speed, 2); assert.equal(rover.range, 0); assert.equal(rover.installed[0].name, 'Airlock');
  assert.equal(cleanCrewField('rover', { installed: [{ name: 'Airlock', level: 4 }] }), null);
  assert.deepEqual(cleanCrewField('engagement', { [id]: 'Flank' }), { [id]: 'Flank' });
  assert.equal(cleanCrewField('engagement', { someone: 'Flank' }), null);
  assert.equal(cleanPoints({ change: 0, reason: 'Nothing' }), null);
  assert.equal(cleanPoints({ change: -5 }), null);
  assert.deepEqual(cleanPoints({ change: -5, reason: 'Learned Flank' }), { change: -5, reason: 'Learned Flank' });
});

test('crew points: spending saves together with the change, is logged, and cannot overdraw', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  for (const apply of [applyInitialSchema, applySheetAndCrewSchema, applyCrewImageSchema, applyChatSchema, applyPushSchema, applyWorldSchema, applyCreatureSchema, applyRulesLibrarySchema]) await apply(sql);
  // The rules reference imported before 019 survives the table rebuild.
  await importRulesLibrary(sql, { entries: [{ kind: 'talent', key: 'test-lore', name: 'Test Lore', data: { group: 'Knowledge', max: 3, text: 'Knows things.' } }] });
  await applyCrewSheetSchema(sql); await applyCrewSheetSchema(sql);
  assert.equal((await sql`SELECT count(*) AS n FROM rules_entries`)[0].n, 1);
  await importRulesLibrary(sql, { entries: [{ kind: 'maneuver', key: 'test-step', name: 'Test Step', data: { role: 'scout', text: 'A step.' } }] });

  const player = 'f'.repeat(64);
  await sql`INSERT INTO profiles (id, name, role, password_salt, password_hash) VALUES ('p1', 'Explorer', 'player', 'x', 'x')`;
  await sql`INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (${digest(player)}, 'p1', unixepoch() + 3600)`;
  await sql`INSERT INTO characters (id, owner_id, kind, name, attributes, sheet) VALUES ('12345678-1234-1234-1234-123456789012', 'p1', 'pc', 'Tobe', '{"strength":3,"agility":4,"logic":4,"insight":6,"perception":4,"empathy":3}', '{"talents":[{"name":"Bird Handler","level":1}]}')`;
  const patch = async data => { const response = await PATCH(request(crewUrl, 'PATCH', data, player)); return { status: response.status, body: await response.json() }; };

  let crew = (await (await GET(request(crewUrl, 'GET', null, player))).json()).crew;
  assert.deepEqual(crew.engagement, {}); assert.deepEqual(crew.points_log, []);
  assert.equal(crew.explorers[0].birdHandler, 1);
  assert.equal(crew.explorers[0].attributes.insight, 6);

  // Awarding points, then learning a maneuver with them.
  crew = (await patch({ revision: crew.revision, points: { change: 6, reason: 'Session debrief (6 of 6)' } })).body.crew;
  assert.equal(crew.crew_points, 6);
  crew = (await patch({ revision: crew.revision, field: 'maneuvers', value: [{ name: 'Rope Master', description: '' }], points: { change: -5, reason: 'Learned Rope Master' } })).body.crew;
  assert.equal(crew.crew_points, 1); assert.equal(crew.maneuvers[0].name, 'Rope Master');
  assert.deepEqual(crew.points_log.map(entry => [entry.change, entry.by]), [[6, 'Explorer'], [-5, 'Explorer']]);

  // Too few points: nothing changes.
  const broke = await patch({ revision: crew.revision, field: 'maneuvers', value: [{ name: 'Flank', description: '' }], points: { change: -5, reason: 'Learned Flank' } });
  assert.equal(broke.status, 409);
  // A stale revision: nothing changes either.
  assert.equal((await patch({ revision: crew.revision - 1, points: { change: 1, reason: 'Late' } })).status, 409);
  crew = (await (await GET(request(crewUrl, 'GET', null, player))).json()).crew;
  assert.equal(crew.crew_points, 1); assert.equal(crew.maneuvers.length, 1);

  // Setting points by hand is logged as an adjustment.
  crew = (await patch({ revision: crew.revision, field: 'crew_points', value: 4 })).body.crew;
  assert.equal(crew.points_log.at(-1).reason, 'Adjusted by hand'); assert.equal(crew.points_log.at(-1).change, 3);
  assert.equal((await patch({ revision: crew.revision })).status, 400);

  // The engagement tracker, keyed by character.
  crew = (await patch({ revision: crew.revision, field: 'engagement', value: { '12345678-1234-1234-1234-123456789012': 'Rope Master' } })).body.crew;
  assert.equal(crew.engagement['12345678-1234-1234-1234-123456789012'], 'Rope Master');

  // Commanding the Bird: a labelled Insight roll whose push keeps the label.
  const chat = (data, token = player) => chatPost(request('http://localhost:3000/api/chat', 'POST', { characterId: '12345678-1234-1234-1234-123456789012', ...data }, token));
  const command = (await (await chat({ type: 'skill', attribute: 'insight', talent: 'Bird Handler', base: 10, gear: 0, purpose: 'Command the Bird · Farsight' })).json()).message;
  assert.equal(command.roll.purpose, 'Command the Bird · Farsight'); assert.equal(command.roll.baseDice.length, 10);
  assert.match(rollCard(command.roll).title, /^Command the Bird · Farsight · Insight \+ Bird Handler/);
  const push = (await (await chat({ type: 'push', messageId: command.id })).json()).message;
  assert.equal(push.roll.purpose, 'Command the Bird · Farsight');
  assert.equal((await chat({ type: 'pool', base: 1, purpose: 'x'.repeat(81) })).status, 400);
});
