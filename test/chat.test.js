import test from 'node:test';
import assert from 'node:assert/strict';
import { db, digest } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyChatSchema } from '../scripts/migrate-004.js';
import { applyPushSchema } from '../scripts/migrate-005.js';
import { GET, POST } from '../api/chat.js';

const base = 'http://localhost:3000/api/chat';
const cookie = token => `chart_session=${token}`;
const request = (path, method = 'GET', data, token) => new Request(base + path, {
  method, headers: { ...(token ? { cookie: cookie(token) } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
  body: data ? JSON.stringify(data) : undefined
});

test('chat persists ordered text and server dice, checks ownership, and exports a date range', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  try {
    await applyInitialSchema(sql); await applySheetAndCrewSchema(sql); await applyChatSchema(sql); await applyPushSchema(sql); await applyPushSchema(sql);
    const one = 'a'.repeat(64); const two = 'b'.repeat(64);
    await sql`INSERT INTO profiles (id, name, role, password_salt, password_hash) VALUES ('p1', 'Explorer', 'player', 'x', 'x'), ('p2', 'Other', 'player', 'x', 'x')`;
    await sql`INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (${digest(one)}, 'p1', unixepoch() + 3600), (${digest(two)}, 'p2', unixepoch() + 3600)`;
    await sql`INSERT INTO characters (id, owner_id, kind, name, attributes, sheet) VALUES ('12345678-1234-1234-1234-123456789012', 'p1', 'pc', 'Saira', '{"strength":2,"agility":3,"logic":4,"insight":4,"perception":5,"empathy":3}', '{"talents":[{"name":"Lookout","level":2},{"name":"Renowned","level":1}]}')`;
    const characterId = '12345678-1234-1234-1234-123456789012';
    assert.equal((await POST(request('', 'POST', { type: 'text', text: 'No', characterId }, two))).status, 403);
    assert.equal((await GET(request(''))).status, 401);
    const text = await POST(request('', 'POST', { type: 'text', text: 'Meet at https://example.com', characterId }, one));
    assert.equal(text.status, 201); const first = (await text.json()).message;
    assert.equal(first.character_name, 'Saira'); assert.equal(first.player_name, 'Explorer');
    assert.equal((await POST(request('', 'POST', { type: 'text', text: '<script>alert(1)</script>' }, two))).status, 201);
    const simple = (await (await POST(request('', 'POST', { type: 'simple' }, two))).json()).message;
    assert.ok(simple.roll.dice[0] >= 1 && simple.roll.dice[0] <= 6);
    const rollMessage = (await (await POST(request('', 'POST', { type: 'skill', characterId, attribute: 'perception', talent: 'Lookout', modifier: -2, gear: 1 }, one))).json()).message;
    const roll = rollMessage.roll;
    assert.equal(roll.baseDice.length, 5); assert.equal(roll.gearDice.length, 1);
    assert.equal(roll.successes, [...roll.baseDice, ...roll.gearDice].filter(d => d === 6).length);
    assert.equal((await POST(request('', 'POST', { type: 'skill', characterId, attribute: 'perception', modifier: 11 }, one))).status, 400);
    const poolMessage = (await (await POST(request('', 'POST', { type: 'pool', base: 4, modifier: -1, gear: 2 }, two))).json()).message;
    assert.equal(poolMessage.roll.baseDice.length, 3); assert.equal(poolMessage.roll.gearDice.length, 2);
    assert.equal((await POST(request('', 'POST', { type: 'push', messageId: rollMessage.id }, two))).status, 403);
    const pushed = (await (await POST(request('', 'POST', { type: 'push', messageId: rollMessage.id }, one))).json()).message;
    assert.equal(pushed.push_of, rollMessage.id); assert.equal(pushed.roll.pushCount, 1);
    for (const [before, after] of [[roll.baseDice, pushed.roll.baseDice], [roll.gearDice, pushed.roll.gearDice]]) {
      assert.equal(before.length, after.length);
      before.forEach((die, index) => { if (die === 1 || die === 6) assert.equal(after[index], die); else assert.ok(after[index] >= 1 && after[index] <= 6); });
    }
    assert.equal(pushed.roll.successes, [...pushed.roll.baseDice, ...pushed.roll.gearDice].filter(d => d === 6).length);
    assert.equal(pushed.roll.hopeLoss, pushed.roll.baseDice.filter(d => d === 1).length);
    assert.equal(pushed.roll.gearWear, pushed.roll.gearDice.filter(d => d === 1).length);
    assert.equal((await POST(request('', 'POST', { type: 'push', messageId: rollMessage.id }, one))).status, 409);
    assert.equal((await POST(request('', 'POST', { type: 'push', messageId: pushed.id }, one))).status, 400);
    const empathy = (await (await POST(request('', 'POST', { type: 'skill', characterId, attribute: 'empathy', gear: 0 }, one))).json()).message;
    const empathyPush = (await (await POST(request('', 'POST', { type: 'push', messageId: empathy.id }, one))).json()).message;
    const empathySecond = (await (await POST(request('', 'POST', { type: 'push', messageId: empathyPush.id }, one))).json()).message;
    assert.equal(empathySecond.roll.pushCount, 2);
    assert.equal((await POST(request('', 'POST', { type: 'push', messageId: empathySecond.id }, one))).status, 400);
    const all = (await (await GET(request('', 'GET', undefined, two))).json()).messages;
    assert.equal(all.length, 9);
    assert.equal((await (await GET(request(`?after=${first.id}`, 'GET', undefined, one))).json()).messages.length, 8);
    const today = new Date().toISOString().slice(0, 10);
    const exportResponse = await GET(request(`?export=text&from=${today}&through=${today}`, 'GET', undefined, one));
    const exportText = await exportResponse.text();
    assert.match(exportText, /Saira <Explorer>: Meet at https:\/\/example.com/);
    assert.match(exportText, /rolled perception/);
    assert.match(exportText, /pushed perception/);
    assert.equal((await GET(request('?export=text&from=2026-02-30&through=2026-03-01', 'GET', undefined, one))).status, 400);
  } finally { sql.client.close(); }
});
