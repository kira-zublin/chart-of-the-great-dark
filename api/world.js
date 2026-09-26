import { body, currentProfile, db, error, guarded, json, randomUUID } from '../lib/server.js';
import { coord, gridOf, inside, key, nearestOpen, roomAt, roomVisible, standupScale, uuid, validGrid } from '../lib/world.js';

const safeText = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit ? value.trim() : null;
const optionalText = (value, limit) => value === undefined ? '' : typeof value === 'string' && value.length <= limit ? value.trim() : null;
const simpleGrid = () => ({ width: 10, height: 8, entry: [1, 1], blocked: [], rooms: [{ id: 'main', name: 'Main area', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 10 }, (_, x) => [x, y])).flat() }] });
const locate = async (sql, id) => (await sql`SELECT * FROM locations WHERE id = ${id} LIMIT 1`)[0];
const conflict = cause => String(cause?.code || '').startsWith('SQLITE_CONSTRAINT');

async function moveCharacter(sql, character, location, preferred, exact = false) {
  const grid = gridOf(location);
  if (grid && !validGrid(grid)) return error('This Explorable has an invalid grid', 409);
  if (grid && (!preferred || !inside(grid, ...preferred))) return error('Choose a square within this Explorable');
  if (!grid) preferred = location.kind === 'diorama' ? (preferred || [500, 800]) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const occupied = new Set((await sql`SELECT x, y FROM character_positions WHERE location_id = ${location.id} AND x IS NOT NULL AND character_id != ${character.id}`).map(row => key(row.x, row.y)));
    let square = null;
    if (location.kind === 'diorama') {
      const taken = new Set((await sql`SELECT x, y FROM character_positions WHERE location_id = ${location.id} AND x IS NOT NULL AND character_id != ${character.id}`).map(row => key(row.x, row.y)));
      const candidates = [preferred, ...Array.from({ length: 8 }, (_, i) => [Math.min(1000, preferred[0] + (i % 4 + 1) * 80), Math.max(0, preferred[1] - Math.floor(i / 4) * 100)])];
      square = exact ? preferred : candidates.find(([x, y]) => !taken.has(key(x, y))) || null;
      if (!square || (exact && taken.has(key(...square)))) return error('That scene position is occupied', 409);
    }
    if (grid) {
      if (exact) {
        const [x, y] = preferred;
        if (new Set(grid.blocked.map(pair => key(...pair))).has(key(x, y)) || occupied.has(key(x, y))) return error('That square is blocked or occupied', 409);
        square = preferred;
      } else square = nearestOpen(grid, preferred, occupied);
      if (!square) return error('No open square is available in this Explorable', 409);
    }
    try {
      await sql`INSERT INTO character_positions (character_id, location_id, x, y, changed_at) VALUES (${character.id}, ${location.id}, ${square?.[0] ?? null}, ${square?.[1] ?? null}, unixepoch()) ON CONFLICT(character_id) DO UPDATE SET location_id = excluded.location_id, x = excluded.x, y = excluded.y, changed_at = unixepoch()`;
      return { characterId: character.id, locationId: location.id, x: square?.[0] ?? null, y: square?.[1] ?? null };
    } catch (cause) { if (!conflict(cause)) throw cause; }
  }
  return error('Position changed. Try again.', 409);
}

export async function GET(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Sign in to view the world', 401);
    const gm = profile.role === 'gm';
    const locations = gm ? await sql.query('SELECT * FROM locations ORDER BY created_at, title') : await sql.query("SELECT * FROM locations WHERE access_level != 'invisible' ORDER BY created_at, title");
    const allowed = new Set(locations.map(item => item.id));
    const links = (await sql.query('SELECT * FROM location_links')).filter(link => allowed.has(link.from_id) && allowed.has(link.to_id) && (gm || locations.find(item => item.id === link.from_id)?.access_level === 'accessible'));
    const rows = await sql.query(`SELECT c.id AS character_id, c.name, c.kind, c.owner_id, c.id AS image_id, COALESCE(p.location_id, 'star-map') AS location_id, p.x, p.y, p.changed_at, COALESCE(p.standup_scale, 1) AS standup_scale,
      EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'portrait') AS has_portrait,
      EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'standup') AS has_standup
      FROM characters c LEFT JOIN character_positions p ON p.character_id = c.id WHERE c.kind = 'pc'`);
    const overrides = await sql.query('SELECT * FROM room_overrides');
    const visibleRoom = (location, roomId) => {
      const grid = gridOf(location);
      const occupants = rows.filter(row => row.location_id === location.id && row.x !== null).map(row => ({ room_id: roomAt(grid, row.x, row.y) }));
      return roomVisible(location, roomId, occupants, overrides.filter(row => row.location_id === location.id));
    };
    const positions = rows.filter(row => allowed.has(row.location_id)).map(row => {
      const location = locations.find(item => item.id === row.location_id);
      const hidden = !gm && location.kind === 'delve' && row.x !== null && !visibleRoom(location, roomAt(gridOf(location), row.x, row.y));
      return hidden ? { ...row, x: null, y: null, hidden: true } : row;
    });
    return json({ locations: locations.map(item => ({ ...item, grid: gm || item.access_level === 'accessible' ? gridOf(item) : null, has_image: (gm || item.access_level === 'accessible') && item.image_version > 0, has_card_image: item.card_image_version > 0 })), links, positions, overrides: gm ? overrides : [], visibleRooms: Object.fromEntries(locations.filter(item => item.kind === 'delve' && (gm || item.access_level === 'accessible')).map(item => [item.id, Object.fromEntries([...gridOf(item).rooms.map(room => room.id), '_unassigned'].map(id => [id, visibleRoom(item, id)]))])) });
  });
}

export async function POST(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Sign in to use the map', 401);
    const data = await body(req);
    if (data.action === 'move' || data.action === 'pull') {
      if (data.action === 'pull' && profile.role !== 'gm') return error('Only the GM can pull characters', 403);
      const location = await locate(sql, data.locationId);
      if (!location || location.access_level !== 'accessible' || location.kind === 'poi') return error('Location unavailable', 404);
      const ids = data.action === 'pull' ? data.characterIds : [data.characterId];
      if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length) return error('Choose valid characters');
      const characters = await sql.query(`SELECT id, owner_id, kind FROM characters WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      if (characters.length !== ids.length || characters.some(item => item.kind !== 'pc' || (data.action === 'move' && profile.role !== 'gm' && item.owner_id !== profile.id))) return error('Character unavailable', 403);
      let preferred = null;
      const grid = gridOf(location);
      if (grid) {
        if (data.linkId) {
          const link = (await sql`SELECT * FROM location_links WHERE id = ${data.linkId} AND to_id = ${location.id}`)[0];
          if (!link) return error('Entrance unavailable');
          preferred = link.arrival_x === null || link.arrival_y === null ? grid.entry : [link.arrival_x, link.arrival_y];
        } else preferred = grid.entry;
      }
      const moved = [], failed = [];
      for (const id of ids) {
        const result = await moveCharacter(sql, characters.find(item => item.id === id), location, preferred);
        if (result instanceof Response) failed.push({ characterId: id, error: (await result.json()).error }); else moved.push(result);
      }
      return json({ moved, failed, ...(failed.length ? { error: `${failed.length} character(s) could not be placed; ${moved.length} moved. Refresh the map.` } : {}) }, failed.length ? 409 : 200);
    }
    if (data.action === 'position') {
      if (!uuid(data.characterId) || !coord(data.x) || !coord(data.y)) return error('Invalid token position');
      const character = (await sql`SELECT id, owner_id, kind FROM characters WHERE id = ${data.characterId}`)[0];
      const position = (await sql`SELECT location_id FROM character_positions WHERE character_id = ${data.characterId}`)[0];
      if (!character || character.kind !== 'pc' || (!position && profile.role !== 'gm') || (profile.role !== 'gm' && character.owner_id !== profile.id)) return error('Character unavailable', 403);
      const location = await locate(sql, position?.location_id || 'star-map');
      if (!location || !['delve', 'diorama'].includes(location.kind)) return error('Character is not in a positional scene');
      if (location.kind === 'diorama' && (data.x > 1000 || data.y > 1000)) return error('Position outside the scene');
      const moved = await moveCharacter(sql, character, location, [data.x, data.y], true);
      return moved instanceof Response ? moved : json({ moved });
    }
    if (data.action === 'scale') {
      if (!uuid(data.characterId) || !standupScale(data.scale)) return error('Choose a size between half and one and a half times');
      const character = (await sql`SELECT id, owner_id, kind FROM characters WHERE id = ${data.characterId}`)[0];
      const position = (await sql`SELECT location_id FROM character_positions WHERE character_id = ${data.characterId}`)[0];
      if (!character || character.kind !== 'pc' || !position || (profile.role !== 'gm' && character.owner_id !== profile.id)) return error('Character unavailable', 403);
      const scale = Math.round(data.scale * 100) / 100;
      await sql`UPDATE character_positions SET standup_scale = ${scale} WHERE character_id = ${character.id}`;
      return json({ scale });
    }
    if (profile.role !== 'gm') return error('Only the GM can edit the world', 403);
    if (data.action === 'create') {
      const title = safeText(data.title, 80), description = typeof data.description === 'string' && data.description.length <= 4000 ? data.description.trim() : null;
      const teaser = optionalText(data.teaser, 220), quote = optionalText(data.quote, 280), speaker = optionalText(data.quoteSpeaker, 100);
      if (!title || description === null || teaser === null || quote === null || speaker === null || !['settlement', 'delve', 'diorama', 'poi'].includes(data.kind)) return error('Check location details');
      const parent = await locate(sql, data.parentId);
      if (!parent || !['star', 'settlement'].includes(parent.kind) || !coord(data.x) || !coord(data.y) || (parent.kind === 'star' ? data.x > 900 || data.y > 600 : data.x > 100 || data.y > 100)) return error('Choose a valid parent and marker position');
      const grid = data.kind === 'delve' ? simpleGrid() : null;
      const id = randomUUID(), linkId = randomUUID();
      await sql`INSERT INTO locations (id, kind, parent_id, title, description, teaser, quote, quote_speaker, grid) VALUES (${id}, ${data.kind}, ${parent.id}, ${title}, ${description}, ${teaser}, ${quote}, ${speaker}, ${JSON.stringify(grid || {})})`;
      await sql`INSERT INTO location_links (id, from_id, to_id, kind, label, x, y) VALUES (${linkId}, ${parent.id}, ${id}, 'marker', ${title}, ${data.x}, ${data.y})`;
      return json({ id, linkId }, 201);
    }
    if (data.action === 'edit') {
      const location = await locate(sql, data.locationId);
      if (!location || location.kind === 'star') return error('Location unavailable');
      const title = safeText(data.title, 80), description = typeof data.description === 'string' && data.description.length <= 4000 ? data.description.trim() : null;
      const teaser = optionalText(data.teaser === undefined ? location.teaser : data.teaser, 220);
      const quote = optionalText(data.quote === undefined ? location.quote : data.quote, 280);
      const speaker = optionalText(data.quoteSpeaker === undefined ? location.quote_speaker : data.quoteSpeaker, 100);
      if (!title || description === null || teaser === null || quote === null || speaker === null || !['invisible', 'inaccessible', 'accessible'].includes(data.accessLevel)) return error('Check location details');
      let link = null;
      if (data.linkId !== undefined) {
        link = (await sql`SELECT l.*, source.kind AS source_kind FROM location_links l JOIN locations source ON source.id = l.from_id WHERE l.id = ${data.linkId} AND l.to_id = ${location.id} AND l.kind = 'marker' LIMIT 1`)[0];
        if (!link || !Number.isFinite(data.x) || !Number.isFinite(data.y) || data.x < 0 || data.y < 0 || (link.source_kind === 'star' ? data.x > 900 || data.y > 600 : link.source_kind !== 'settlement' || data.x > 100 || data.y > 100)) return error('Choose a valid marker position');
      }
      await sql`UPDATE locations SET title = ${title}, description = ${description}, teaser = ${teaser}, quote = ${quote}, quote_speaker = ${speaker}, access_level = ${data.accessLevel}, visible = ${Number(data.accessLevel !== 'invisible')} WHERE id = ${location.id}`;
      if (link) await sql`UPDATE location_links SET label = ${title}, x = ${data.x}, y = ${data.y} WHERE id = ${link.id}`;
      return json({ ok: true });
    }
    if (data.action === 'marker') {
      const link = (await sql`SELECT l.id, source.kind AS source_kind FROM location_links l JOIN locations source ON source.id = l.from_id WHERE l.id = ${data.linkId} AND l.kind = 'marker' LIMIT 1`)[0];
      if (!link || link.source_kind !== 'settlement' || !Number.isFinite(data.x) || !Number.isFinite(data.y) || data.x < 0 || data.x > 100 || data.y < 0 || data.y > 100) return error('Choose a valid Hub marker position');
      await sql`UPDATE location_links SET x = ${data.x}, y = ${data.y} WHERE id = ${link.id}`;
      return json({ ok: true });
    }
    if (data.action === 'fog') {
      const location = await locate(sql, data.locationId);
      if (!location || location.kind !== 'delve' || typeof data.enabled !== 'boolean') return error('Invalid fog setting');
      await sql`UPDATE locations SET fog_enabled = ${Number(data.enabled)} WHERE id = ${location.id}`;
      return json({ ok: true });
    }
    if (data.action === 'room') {
      const location = await locate(sql, data.locationId);
      if (!location || location.kind !== 'delve' || !['automatic', 'show', 'hide'].includes(data.visibility)) return error('Invalid room setting');
      const grid = gridOf(location);
      if (!grid.rooms.some(room => room.id === data.roomId) && data.roomId !== '_unassigned') return error('Room unavailable');
      if (data.visibility === 'automatic') await sql`DELETE FROM room_overrides WHERE location_id = ${location.id} AND room_id = ${data.roomId}`;
      else await sql`INSERT INTO room_overrides (location_id, room_id, visibility) VALUES (${location.id}, ${data.roomId}, ${data.visibility}) ON CONFLICT(location_id, room_id) DO UPDATE SET visibility = excluded.visibility`;
      return json({ ok: true });
    }
    return error('Unknown map action');
  });
}
