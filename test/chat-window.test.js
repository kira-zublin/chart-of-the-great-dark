import test from 'node:test';
import assert from 'node:assert/strict';
import { db, digest } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applySheetAndCrewSchema } from '../scripts/migrate-002.js';
import { applyChatSchema } from '../scripts/migrate-004.js';
import { applyPushSchema } from '../scripts/migrate-005.js';
import { applyWorldSchema } from '../scripts/migrate-006.js';
import { applyCreatureSchema } from '../scripts/migrate-017.js';
import { applyChatWindowSchema } from '../scripts/migrate-020.js';
import { GET, POST } from '../api/chat.js';

const base = 'http://localhost:3000/api/chat';
const request = (path, method = 'GET', data, token) => new Request(base + path, {
  method, headers: { ...(token ? { cookie: `chart_session=${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
  body: data ? JSON.stringify(data) : undefined
});

test('the chat window starts fresh after four quiet hours or a GM clear, and Download Log keeps everything', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  try {
    await applyInitialSchema(sql); await applySheetAndCrewSchema(sql); await applyChatSchema(sql); await applyPushSchema(sql); await applyWorldSchema(sql); await applyCreatureSchema(sql);
    const player = 'd'.repeat(64); const gm = 'e'.repeat(64);
    await sql`INSERT INTO profiles (id, name, role, password_salt, password_hash) VALUES ('p1', 'Explorer', 'player', 'x', 'x'), ('g1', 'Keeper', 'gm', 'x', 'x')`;
    await sql`INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (${digest(player)}, 'p1', unixepoch() + 3600), (${digest(gm)}, 'g1', unixepoch() + 3600)`;
    const say = async text => (await (await POST(request('', 'POST', { type: 'text', text }, player))).json()).message;
    const read = async (query = '') => (await GET(request(query, 'GET', undefined, player))).json();
    const quiet = hours => sql`UPDATE chat_window SET active_at = unixepoch() - ${hours * 3600}`;

    const old = await say('Last session');
    assert.deepEqual((await read()).messages.map(item => item.body), ['Last session'], 'before migration 020 the whole history shows');
    await applyChatWindowSchema(sql); await applyChatWindowSchema(sql);
    assert.equal((await read()).clearedAfter, 0);
    assert.equal((await read()).messages.length, 1, 'the migration keeps existing history in the window');

    await quiet(3);
    assert.equal((await read()).messages.length, 1, 'a shorter break keeps the window');
    await quiet(5);
    const fresh = await read();
    assert.deepEqual(fresh.messages, [], 'the first read after four quiet hours starts the window fresh');
    assert.equal(fresh.clearedAfter, old.id);
    assert.equal((await read('?after=0')).messages.length, 0, 'an old cursor cannot reach hidden messages');
    assert.equal((await read()).clearedAfter, old.id, 'the fresh window holds while people are around');
    const next = await say('New session');
    assert.deepEqual((await read()).messages.map(item => item.body), ['New session']);

    assert.equal((await POST(request('', 'POST', { action: 'clearWindow' }, player))).status, 403);
    const cleared = await POST(request('', 'POST', { action: 'clearWindow' }, gm));
    assert.equal(cleared.status, 200); assert.equal((await cleared.json()).clearedAfter, next.id);
    assert.deepEqual((await read()).messages, []);

    const today = new Date().toISOString().slice(0, 10);
    const log = await (await GET(request(`?export=text&from=${today}&through=${today}`, 'GET', undefined, player))).text();
    assert.match(log, /Last session/); assert.match(log, /New session/);
  } finally { sql.client.close(); }
});
