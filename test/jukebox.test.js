import test from 'node:test';
import assert from 'node:assert/strict';
import { db, digest } from '../lib/server.js';
import { applyInitialSchema } from '../scripts/migrate.js';
import { applyJukeboxSchema } from '../scripts/migrate-010.js';
import { blobStore, maxTrackBytes } from '../lib/jukebox-blob.js';
import { DELETE, GET, POST } from '../api/jukebox.js';

const base = 'http://localhost:3000/api/jukebox';
const request = (path, method = 'GET', data, token) => new Request(base + path, {
  method, headers: { ...(token ? { cookie: `chart_session=${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
  body: data ? JSON.stringify(data) : undefined
});

test('jukebox: GM-only control, verified uploads, shared playback state, and cleanup', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  const sql = db();
  await applyInitialSchema(sql); await applyJukeboxSchema(sql); await applyJukeboxSchema(sql);
  const gm = 'a'.repeat(64), player = 'b'.repeat(64);
  await sql`INSERT INTO profiles (id, name, role, password_salt, password_hash) VALUES ('g1', 'Keeper', 'gm', 'x', 'x'), ('p1', 'Explorer', 'player', 'x', 'x')`;
  await sql`INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (${digest(gm)}, 'g1', unixepoch() + 3600), (${digest(player)}, 'p1', unixepoch() + 3600)`;

  const stored = new Map(); const deleted = []; const tokenRequests = [];
  let configured = false;
  Object.assign(blobStore, {
    configured: () => configured,
    clientToken: async options => { tokenRequests.push(options); return 'vercel_blob_client_test'; },
    head: async pathname => { if (!stored.has(pathname)) throw new Error('BlobNotFoundError'); return stored.get(pathname); },
    del: async url => { deleted.push(url); }
  });

  // Authorization
  assert.equal((await GET(request(''))).status, 401);
  assert.equal((await POST(request('', 'POST', { action: 'stop' }, player))).status, 403);
  assert.equal((await DELETE(request('?id=x', 'DELETE', null, player))).status, 403);
  const empty = await (await GET(request('', 'GET', null, player))).json();
  assert.equal(empty.state.status, 'stopped'); assert.equal(empty.state.url, null);
  assert.equal(empty.tracks, undefined);

  // Upload tokens need storage and respect the size limit
  assert.equal((await POST(request('', 'POST', { action: 'upload-token', size: 1000 }, gm))).status, 503);
  configured = true;
  assert.equal((await POST(request('', 'POST', { action: 'upload-token', size: maxTrackBytes + 1 }, gm))).status, 413);
  const token = await (await POST(request('', 'POST', { action: 'upload-token', size: 1000 }, gm))).json();
  assert.match(token.pathname, /^jukebox\/[0-9a-f-]{36}\.mp3$/);
  assert.equal(token.clientToken, 'vercel_blob_client_test');
  assert.deepEqual(tokenRequests[0].allowedContentTypes, ['audio/mpeg']);
  assert.equal(tokenRequests[0].maximumSizeInBytes, maxTrackBytes);
  assert.equal(tokenRequests[0].pathname, token.pathname);

  // Adding a track is verified against the store
  assert.equal((await POST(request('', 'POST', { action: 'add', pathname: '../secret.mp3', title: 'X' }, gm))).status, 400);
  assert.equal((await POST(request('', 'POST', { action: 'add', pathname: token.pathname, title: 'Dust Choir' }, gm))).status, 400, 'missing upload');
  stored.set(token.pathname, { pathname: token.pathname, url: `https://store.public.blob.vercel-storage.com/${token.pathname}`, contentType: 'text/html', size: 1000 });
  assert.equal((await POST(request('', 'POST', { action: 'add', pathname: token.pathname, title: 'Dust Choir' }, gm))).status, 400, 'wrong type');
  stored.get(token.pathname).contentType = 'audio/mpeg';
  assert.equal((await POST(request('', 'POST', { action: 'add', pathname: token.pathname, title: '   ' }, gm))).status, 400, 'blank title');
  const added = await POST(request('', 'POST', { action: 'add', pathname: token.pathname, title: ' Dust Choir ', durationMs: 180000 }, gm));
  assert.equal(added.status, 201);
  const addedBody = await added.json();
  assert.equal(addedBody.tracks.length, 1); assert.equal(addedBody.tracks[0].title, 'Dust Choir');
  assert.equal(addedBody.usageBytes, 1000);
  assert.equal((await POST(request('', 'POST', { action: 'add', pathname: token.pathname, title: 'Again' }, gm))).status, 409);
  const trackId = addedBody.id;

  // Playback state is shared; players never see titles or ids
  assert.equal((await POST(request('', 'POST', { action: 'pause' }, gm))).status, 409);
  assert.equal((await POST(request('', 'POST', { action: 'play', trackId: 'missing' }, gm))).status, 404);
  const before = Date.now();
  await POST(request('', 'POST', { action: 'play', trackId }, gm));
  const heard = await (await GET(request('', 'GET', null, player))).json();
  assert.equal(heard.state.status, 'playing');
  assert.equal(heard.state.url, stored.get(token.pathname).url);
  assert.ok(heard.state.started_at_ms >= before && heard.state.started_at_ms <= heard.now);
  assert.equal(heard.state.loop, true);
  assert.equal(heard.state.track_id, undefined);
  assert.ok(!JSON.stringify(heard).includes('Dust Choir'));

  await sql`UPDATE jukebox_state SET started_at_ms = ${Date.now() - 190000} WHERE id = 1`;
  const paused = await (await POST(request('', 'POST', { action: 'pause' }, gm))).json();
  assert.equal(paused.state.status, 'paused');
  assert.ok(paused.state.position_ms >= 10000 && paused.state.position_ms < 11000, 'looping pause wraps by duration');
  const resumed = await (await POST(request('', 'POST', { action: 'resume' }, gm))).json();
  assert.equal(resumed.state.status, 'playing');
  assert.ok(Math.abs(resumed.now - resumed.state.started_at_ms - paused.state.position_ms) < 1000);
  const unlooped = await (await POST(request('', 'POST', { action: 'loop', loop: false }, gm))).json();
  assert.equal(unlooped.state.loop, false); assert.ok(unlooped.state.revision > resumed.state.revision);
  assert.equal((await POST(request('', 'POST', { action: 'loop', loop: 'yes' }, gm))).status, 400);
  const stopped = await (await POST(request('', 'POST', { action: 'stop' }, gm))).json();
  assert.equal(stopped.state.status, 'stopped');

  // Deleting the playing track removes its file and stops playback
  await POST(request('', 'POST', { action: 'play', trackId }, gm));
  const afterDelete = await (await DELETE(request(`?id=${trackId}`, 'DELETE', null, gm))).json();
  assert.deepEqual(deleted, [stored.get(token.pathname).url]);
  assert.equal(afterDelete.tracks.length, 0);
  assert.equal(afterDelete.state.status, 'stopped'); assert.equal(afterDelete.state.url, null);
  assert.equal((await DELETE(request(`?id=${trackId}`, 'DELETE', null, gm))).status, 404);
});
