// Ephemeral local preview for UI checks when Vercel CLI is not installed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';
import { applyInitialSchema } from './migrate.js';
import { applySheetAndCrewSchema } from './migrate-002.js';
import { applyCrewImageSchema } from './migrate-003.js';
import { applyChatSchema } from './migrate-004.js';
import { applyPushSchema } from './migrate-005.js';
import { applyWorldSchema } from './migrate-006.js';
import { applyChoirParent } from './migrate-007.js';
import { applyLocationAccess } from './migrate-008.js';
import { applyLocationCards } from './migrate-009.js';
import { applyJukeboxSchema } from './migrate-010.js';
import { seedShipCitySlice } from './seed-ship-city-slice.js';

// Only the Blob token is taken from .env.local; the database stays in memory.
try {
  const token = (await readFile(new URL('../.env.local', import.meta.url), 'utf8')).match(/^BLOB_READ_WRITE_TOKEN="?([^"\r\n]+)"?/m)?.[1];
  if (token) process.env.BLOB_READ_WRITE_TOKEN = token;
} catch { /* no .env.local */ }
console.log(process.env.BLOB_READ_WRITE_TOKEN ? 'Jukebox uploads use the Blob store from .env.local.' : 'BLOB_READ_WRITE_TOKEN not found; jukebox uploads are disabled.');
process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.REGISTRATION_INVITE_CODE = 'local-preview-only';
const sql = db();
await applyInitialSchema(sql);
await applySheetAndCrewSchema(sql);
await applyCrewImageSchema(sql);
await applyChatSchema(sql);
await applyPushSchema(sql);
await applyWorldSchema(sql);
await applyChoirParent(sql);
await applyLocationAccess(sql);
await applyLocationCards(sql);
await applyJukeboxSchema(sql);
await seedShipCitySlice(sql);

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.LOCAL_PREVIEW_PORT || 3000);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const publicFiles = new Set(['index.html', 'world-ui.css', 'ui-theme.css', 'star-chart.css', 'scene-effects.js', 'star-chart.js', 'app.js', 'world-ui.js', 'chat-ui.js', 'sheet-ui.js', 'crew-ui.js', 'side-panel.js', 'jukebox-ui.js', 'vendor/blob-client.js']);
const api = { auth: '../api/auth.js', characters: '../api/characters.js', image: '../api/image.js', crew: '../api/crew.js', 'crew-image': '../api/crew-image.js', chat: '../api/chat.js', world: '../api/world.js', 'location-image': '../api/location-image.js', jukebox: '../api/jukebox.js' };
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://127.0.0.1:${port}`);
    let response;
    if (url.pathname.startsWith('/api/')) {
      const modulePath = api[url.pathname.slice(5)];
      if (!modulePath) { outgoing.writeHead(404); outgoing.end(); return; }
      const route = await import(modulePath);
      const method = route[incoming.method];
      if (!method) { outgoing.writeHead(405); outgoing.end(); return; }
      const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      response = await method(request);
    } else {
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      if (!publicFiles.has(pathname.slice(1)) && !/^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp|woff2|svg)$/.test(pathname)) { outgoing.writeHead(404); outgoing.end(); return; }
      const filename = resolve(root, '.' + pathname);
      if (filename !== root && !filename.startsWith(root + sep)) { outgoing.writeHead(403); outgoing.end(); return; }
      try { response = new Response(await readFile(filename), { headers: { 'Content-Type': mime[extname(filename)] || 'application/octet-stream' } }); }
      catch { response = new Response('Not found', { status: 404 }); }
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (cause) { console.error(cause); outgoing.writeHead(500); outgoing.end('Local preview error'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port} (invite: local-preview-only; in-memory data)`));
