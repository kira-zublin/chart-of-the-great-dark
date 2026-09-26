import { body, currentProfile, db, error, guarded, json, randomUUID } from '../lib/server.js';
import { blobStore, maxTrackBytes } from '../lib/jukebox-blob.js';

const pathnamePattern = /^jukebox\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$/;
const maxDurationMs = 6 * 60 * 60 * 1000;

async function snapshot(sql, profile) {
  const state = (await sql`SELECT s.track_id, s.status, s.started_at_ms, s.position_ms, s.loop, s.revision, t.blob_url, t.duration_ms
    FROM jukebox_state s LEFT JOIN jukebox_tracks t ON t.id = s.track_id WHERE s.id = 1`)[0];
  // Players receive only what playback needs: no track titles or ids.
  const shared = {
    status: state.track_id ? state.status : 'stopped',
    url: state.track_id ? state.blob_url : null,
    started_at_ms: state.started_at_ms, position_ms: state.position_ms,
    duration_ms: state.duration_ms, loop: Boolean(state.loop), revision: state.revision
  };
  const result = { now: Date.now(), state: shared };
  if (profile.role === 'gm') {
    result.state.track_id = state.track_id;
    result.tracks = await sql`SELECT id, title, size_bytes, duration_ms, created_at FROM jukebox_tracks ORDER BY created_at DESC, title`;
    result.usageBytes = result.tracks.reduce((sum, track) => sum + Number(track.size_bytes), 0);
    result.storageConfigured = blobStore.configured();
    result.maxTrackBytes = maxTrackBytes;
  }
  return result;
}

export async function GET(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Sign in to hear the jukebox', 401);
    return json(await snapshot(sql, profile));
  });
}

export async function POST(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile || profile.role !== 'gm') return error('Only the GM can control the jukebox', 403);
    const input = await body(req);
    const now = Date.now();
    const state = (await sql`SELECT s.*, t.duration_ms FROM jukebox_state s LEFT JOIN jukebox_tracks t ON t.id = s.track_id WHERE s.id = 1`)[0];
    const setState = async ({ track_id = state.track_id, status, started_at_ms = null, position_ms = 0, loop = state.loop }) => {
      await sql`UPDATE jukebox_state SET track_id = ${track_id}, status = ${status}, started_at_ms = ${started_at_ms}, position_ms = ${position_ms}, loop = ${loop}, revision = revision + 1 WHERE id = 1`;
    };

    switch (input.action) {
      case 'upload-token': {
        if (!blobStore.configured()) return error('Music storage is not configured for this environment.', 503);
        const size = Number(input.size);
        if (!Number.isInteger(size) || size < 1) return error('Choose an MP3 file to upload.');
        if (size > maxTrackBytes) return error('Tracks must be 15 MB or smaller.', 413);
        const pathname = `jukebox/${randomUUID()}.mp3`;
        const clientToken = await blobStore.clientToken({ pathname, allowedContentTypes: ['audio/mpeg'], maximumSizeInBytes: maxTrackBytes, validUntil: now + 15 * 60 * 1000, addRandomSuffix: false, allowOverwrite: false });
        return json({ pathname, clientToken });
      }
      case 'add': {
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (!title || title.length > 120) return error('Track titles must be 1–120 characters.');
        if (typeof input.pathname !== 'string' || !pathnamePattern.test(input.pathname)) return error('Invalid upload reference.');
        const durationMs = Number.isInteger(input.durationMs) && input.durationMs > 0 && input.durationMs <= maxDurationMs ? input.durationMs : null;
        // Trust the store, not the browser: confirm the uploaded object exists and is an MP3 within the limit.
        let stored;
        try { stored = await blobStore.head(input.pathname); }
        catch { return error('The upload could not be found. Please try again.'); }
        if (stored.pathname !== input.pathname || stored.contentType !== 'audio/mpeg' || !(stored.size > 0) || stored.size > maxTrackBytes) return error('The uploaded file is not an accepted MP3.');
        const id = randomUUID();
        try {
          await sql`INSERT INTO jukebox_tracks (id, title, blob_url, blob_pathname, size_bytes, duration_ms, uploaded_by) VALUES (${id}, ${title}, ${stored.url}, ${stored.pathname}, ${stored.size}, ${durationMs}, ${profile.id})`;
        } catch (cause) {
          if (/UNIQUE/i.test(cause.message)) return error('That upload has already been added.', 409);
          throw cause;
        }
        return json({ id, ...(await snapshot(sql, profile)) }, 201);
      }
      case 'play': {
        const track = (await sql`SELECT id FROM jukebox_tracks WHERE id = ${String(input.trackId || '')}`)[0];
        if (!track) return error('Track not found', 404);
        await setState({ track_id: track.id, status: 'playing', started_at_ms: now });
        break;
      }
      case 'pause': {
        if (state.status !== 'playing' || !state.track_id) return error('Nothing is playing.', 409);
        let position = Math.max(0, now - state.started_at_ms);
        if (state.loop && state.duration_ms) position %= state.duration_ms;
        await setState({ status: 'paused', position_ms: position });
        break;
      }
      case 'resume': {
        if (state.status !== 'paused' || !state.track_id) return error('Nothing is paused.', 409);
        await setState({ status: 'playing', started_at_ms: now - state.position_ms });
        break;
      }
      case 'stop':
        await setState({ status: 'stopped' });
        break;
      case 'loop': {
        if (typeof input.loop !== 'boolean') return error('Loop must be on or off.');
        await sql`UPDATE jukebox_state SET loop = ${input.loop ? 1 : 0}, revision = revision + 1 WHERE id = 1`;
        break;
      }
      default:
        return error('Unknown jukebox action');
    }
    return json(await snapshot(sql, profile));
  });
}

export async function DELETE(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile || profile.role !== 'gm') return error('Only the GM can delete tracks', 403);
    const id = new URL(req.url).searchParams.get('id') || '';
    const track = (await sql`SELECT id, blob_url FROM jukebox_tracks WHERE id = ${id}`)[0];
    if (!track) return error('Track not found', 404);
    // Remove the stored file first so a failure leaves the row for a retry instead of an orphaned file.
    await blobStore.del(track.blob_url);
    await sql`UPDATE jukebox_state SET track_id = NULL, status = 'stopped', started_at_ms = NULL, position_ms = 0, revision = revision + 1 WHERE id = 1 AND track_id = ${id}`;
    await sql`DELETE FROM jukebox_tracks WHERE id = ${id}`;
    return json(await snapshot(sql, profile));
  });
}
