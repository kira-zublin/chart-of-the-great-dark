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
import { retireChoirPrototype } from './migrate-011.js';
import { applyStandupScale } from './migrate-012.js';
import { retireDocksidePrototype } from './migrate-013.js';
import { applyStandupVariants } from './migrate-014.js';
import { applyInstances } from './migrate-015.js';
import { applyJukeboxVolume } from './migrate-016.js';
import { applyCreatureSchema } from './migrate-017.js';
import { applyRulesLibrarySchema } from './migrate-018.js';
import { seedShipCitySlice } from './seed-ship-city-slice.js';
import { DEFAULT_LIBRARY, importCreatureLibrary } from './import-creatures.js';
import { importCreaturePortraits } from './import-creature-portraits.js';
import { DEFAULT_RULES_LIBRARY, importRulesLibrary } from './import-rules.js';

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
await retireChoirPrototype(sql);
await applyStandupScale(sql);
await retireDocksidePrototype(sql);
await applyStandupVariants(sql);
await applyInstances(sql);
await applyJukeboxVolume(sql);
await applyCreatureSchema(sql);
await applyRulesLibrarySchema(sql);
await seedShipCitySlice(sql);
// The rulebook creatures load only when the local, uncommitted library file is present.
try {
  const counts = await importCreatureLibrary(sql, JSON.parse(await readFile(DEFAULT_LIBRARY, 'utf8')));
  console.log(`Creature palette: ${counts.added} rulebook entries loaded.`);
  const portraits = await importCreaturePortraits(sql);
  console.log(`Creature portraits: ${portraits.imported} loaded.`);
} catch (cause) {
  if (cause.code !== 'ENOENT') throw cause;
  console.log('gamerules/creature-library.json not found; the creature palette starts empty.');
}

// Talent descriptions and the injury, trauma and Blight tables load the same way.
try {
  const counts = await importRulesLibrary(sql, JSON.parse(await readFile(DEFAULT_RULES_LIBRARY, 'utf8')));
  console.log(`Rules reference: ${counts.talent} talents and ${counts.injury + counts.trauma + counts.blight} table rows loaded.`);
} catch (cause) {
  if (cause.code !== 'ENOENT') throw cause;
  console.log('gamerules/rules-library.json not found; the sheet runs without rule descriptions.');
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.LOCAL_PREVIEW_PORT || 3000);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const publicFiles = new Set(['index.html', 'world-ui.css', 'ui-theme.css', 'star-chart.css', 'scene-effects.js', 'star-chart.js', 'app.js', 'world-ui.js', 'chat-ui.js', 'sheet-ui.js', 'crew-ui.js', 'side-panel.js', 'jukebox-ui.js', 'vista-dialog.js', 'creature-ui.js', 'creature-stats.js', 'explorer-rules.js', 'sheet.css', 'vendor/blob-client.js']);
const api = { auth: '../api/auth.js', characters: '../api/characters.js', image: '../api/image.js', crew: '../api/crew.js', 'crew-image': '../api/crew-image.js', chat: '../api/chat.js', world: '../api/world.js', 'location-image': '../api/location-image.js', jukebox: '../api/jukebox.js', creatures: '../api/creatures.js', rules: '../api/rules.js', 'creature-image': '../api/creature-image.js' };
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
