import { body, currentProfile, db, error, guarded, json, randomUUID } from '../lib/server.js';
import { INSTANCE_IDLE_SECONDS, coord, footprintFits, footprintSquares, gridOf, inside, key, nearestFootprint, nearestOpen, roomAt, roomVisible, standupScale, uuid, validGrid } from '../lib/world.js';
import { CREATURE_SCALE, baseCreatureName, nextCreatureName } from '../creature-stats.js';

const safeText = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit ? value.trim() : null;
const optionalText = (value, limit) => value === undefined ? '' : typeof value === 'string' && value.length <= limit ? value.trim() : null;
const simpleGrid = () => ({ width: 10, height: 8, entry: [1, 1], blocked: [], rooms: [{ id: 'main', name: 'Main area', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 10 }, (_, x) => [x, y])).flat() }] });
const locate = async (sql, id) => (await sql`SELECT * FROM locations WHERE id = ${id} LIMIT 1`)[0];
const conflict = cause => String(cause?.code || '').startsWith('SQLITE_CONSTRAINT');

// Removes instanced areas with their links, art and room settings; locations created inside one move up to its
// parent. Unless forced, an instance survives while a character stands in it or it was active within the idle
// window. Forced removal first returns its characters to the Star Map. Every statement re-selects the same
// instances inside one write batch, so a character arriving mid-cleanup keeps the whole instance intact.
async function removeInstances(sql, ids, force = false) {
  if (!ids.length) return;
  const doomed = `SELECT d.id FROM locations d WHERE d.id IN (${ids.map(() => '?').join(', ')}) AND d.is_instance = 1${force ? '' : ` AND d.instance_active_at < unixepoch() - ${INSTANCE_IDLE_SECONDS} AND NOT EXISTS (SELECT 1 FROM character_positions p WHERE p.location_id = d.id)`}`;
  const statement = (text, uses) => ({ sql: text, args: Array.from({ length: uses }, () => ids).flat() });
  await sql.client.batch([
    ...(force ? [statement(`UPDATE character_positions SET location_id = 'star-map', x = NULL, y = NULL WHERE location_id IN (${doomed})`, 1)] : []),
    statement(`UPDATE locations SET parent_id = (SELECT e.parent_id FROM locations e WHERE e.id = locations.parent_id) WHERE parent_id IN (${doomed}) AND id NOT IN (${doomed})`, 2),
    statement(`DELETE FROM location_links WHERE from_id IN (${doomed}) OR to_id IN (${doomed})`, 2),
    ...['room_overrides', 'location_images', 'location_card_images'].map(table => statement(`DELETE FROM ${table} WHERE location_id IN (${doomed})`, 1)),
    statement(`DELETE FROM locations WHERE id IN (${doomed})`, 1)
  ], 'write');
}

// Keeps instances that someone is standing in or viewing marked active (at most once a minute), and removes
// the ones left idle. Cleanup problems are logged rather than breaking the map.
async function tidyInstances(sql, viewing) {
  try {
    const instances = await sql`SELECT l.id, l.instance_active_at, EXISTS (SELECT 1 FROM character_positions p WHERE p.location_id = l.id) AS occupied FROM locations l WHERE l.is_instance = 1`;
    if (!instances.length) return;
    const now = Math.floor(Date.now() / 1000), inUse = row => row.occupied || row.id === viewing;
    const touched = instances.filter(row => inUse(row) && !(row.instance_active_at > now - 60)).map(row => row.id);
    if (touched.length) await sql.query(`UPDATE locations SET instance_active_at = unixepoch() WHERE id IN (${touched.map(() => '?').join(', ')})`, touched);
    await removeInstances(sql, instances.filter(row => !inUse(row) && !(row.instance_active_at > now - INSTANCE_IDLE_SECONDS)).map(row => row.id));
  } catch (cause) { console.error('Instance cleanup failed', cause); }
}

// A placed player character whose stand-up this profile may change: its owner, or the GM.
async function standupOwner(sql, profile, characterId) {
  const character = (await sql`SELECT id, owner_id, kind FROM characters WHERE id = ${characterId}`)[0];
  const position = (await sql`SELECT location_id FROM character_positions WHERE character_id = ${characterId}`)[0];
  return character && character.kind === 'pc' && position && (profile.role === 'gm' || character.owner_id === profile.id) ? character : null;
}

// Squares covered by placed creatures in an Explorable. Hidden creatures do not block characters, so an unseen
// ambush does not give itself away; they still block other creatures.
async function creatureSquares(sql, locationId, { exceptId = '', includeHidden = true } = {}) {
  const rows = await sql`SELECT x, y, json_extract(stats, '$.footprint') AS size FROM creatures WHERE location_id = ${locationId} AND x IS NOT NULL AND id != ${exceptId} AND (${Number(includeHidden)} = 1 OR hidden = 0)`;
  return new Set(rows.flatMap(row => footprintSquares(row.x, row.y, row.size || 1).map(pair => key(...pair))));
}

// SQL that is true when a size × size footprint at (x, y) is free of characters and other creatures. Checking in
// the same statement as the write means a character or creature arriving at the same time cannot overlap it.
const footprintFree = (locationId, x, y, size, exceptId = '') => ({
  sql: `NOT EXISTS (SELECT 1 FROM character_positions p WHERE p.location_id = ? AND p.x BETWEEN ? AND ? AND p.y BETWEEN ? AND ?)
    AND NOT EXISTS (SELECT 1 FROM creatures o WHERE o.location_id = ? AND o.id != ? AND o.x IS NOT NULL AND o.x < ? AND ? < o.x + json_extract(o.stats, '$.footprint') AND o.y < ? AND ? < o.y + json_extract(o.stats, '$.footprint'))`,
  args: [locationId, x, x + size - 1, y, y + size - 1, locationId, exceptId, x + size, x, y + size, y]
});

// Chooses a creature's square (Explorable) or scene point (Vista) and runs write(x, y, guard), which returns the
// written rows. In an Explorable an exact drop must fit where it lands; otherwise the nearest open space is used.
async function positionCreature(sql, location, size, preferred, exact, write, exceptId = '') {
  const grid = gridOf(location);
  if (!grid) {
    const [x, y] = preferred;
    if (!coord(x) || !coord(y) || x > 1000 || y > 1000) return error('Position outside the scene');
    return (await write(x, y, { sql: '1', args: [] })).length ? [x, y] : error('Creature unavailable', 404);
  }
  if (!validGrid(grid)) return error('This Explorable has an invalid grid', 409);
  if (!Array.isArray(preferred) || !inside(grid, ...preferred)) return error('Choose a square within this Explorable');
  for (let attempt = 0; attempt < 5; attempt++) {
    const occupied = await creatureSquares(sql, location.id, { exceptId });
    for (const row of await sql`SELECT x, y FROM character_positions WHERE location_id = ${location.id} AND x IS NOT NULL`) occupied.add(key(row.x, row.y));
    const square = exact ? (footprintFits(grid, ...preferred, size, occupied) ? preferred : null) : nearestFootprint(grid, preferred, size, occupied);
    if (!square) return error(exact ? 'That spot is blocked or occupied' : 'There is no open space for this creature here', 409);
    if ((await write(...square, footprintFree(location.id, ...square, size, exceptId))).length) return square;
  }
  return error('Position changed. Try again.', 409);
}

// A placed creature with its location, for the GM's creature actions.
async function placedCreature(sql, id) {
  if (!uuid(id)) return null;
  const creature = (await sql`SELECT c.*, json_extract(c.stats, '$.footprint') AS size FROM creatures c WHERE c.id = ${id}`)[0];
  return creature ? { ...creature, location: await locate(sql, creature.location_id) } : null;
}

// A default spot when the GM places a creature without dropping it somewhere: the Explorable's entry, or a
// point along a Vista's floor that moves along with each creature already there.
function defaultSpot(location, count) {
  const grid = gridOf(location);
  return grid ? grid.entry : [Math.min(1000, 260 + (count % 6) * 95), 820];
}

async function moveCharacter(sql, character, location, preferred, exact = false) {
  const grid = gridOf(location);
  if (grid && !validGrid(grid)) return error('This Explorable has an invalid grid', 409);
  if (grid && (!preferred || !inside(grid, ...preferred))) return error('Choose a square within this Explorable');
  if (!grid) preferred = location.kind === 'diorama' ? (preferred || [500, 800]) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const occupied = new Set((await sql`SELECT x, y FROM character_positions WHERE location_id = ${location.id} AND x IS NOT NULL AND character_id != ${character.id}`).map(row => key(row.x, row.y)));
    if (grid) for (const square of await creatureSquares(sql, location.id, { includeHidden: false })) occupied.add(square);
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
      // In an Explorable the square must also be free of visible creatures at the moment of writing.
      const [gx, gy] = grid ? square : [null, null];
      const written = await sql`INSERT INTO character_positions (character_id, location_id, x, y, changed_at)
        SELECT ${character.id}, ${location.id}, ${square?.[0] ?? null}, ${square?.[1] ?? null}, unixepoch()
        WHERE NOT EXISTS (SELECT 1 FROM creatures c WHERE c.location_id = ${location.id} AND c.hidden = 0 AND c.x IS NOT NULL AND ${gx} BETWEEN c.x AND c.x + json_extract(c.stats, '$.footprint') - 1 AND ${gy} BETWEEN c.y AND c.y + json_extract(c.stats, '$.footprint') - 1)
        ON CONFLICT(character_id) DO UPDATE SET location_id = excluded.location_id, x = excluded.x, y = excluded.y, changed_at = unixepoch() RETURNING character_id`;
      if (written.length) return { characterId: character.id, locationId: location.id, x: square?.[0] ?? null, y: square?.[1] ?? null };
      if (exact) return error('That square is blocked or occupied', 409);
    } catch (cause) { if (!conflict(cause)) throw cause; }
  }
  return error('Position changed. Try again.', 409);
}

export async function GET(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Sign in to view the world', 401);
    await tidyInstances(sql, new URL(req.url).searchParams.get('viewing'));
    const gm = profile.role === 'gm';
    const locations = gm ? await sql.query('SELECT * FROM locations ORDER BY created_at, title') : await sql.query("SELECT * FROM locations WHERE access_level != 'invisible' ORDER BY created_at, title");
    const allowed = new Set(locations.map(item => item.id));
    const links = (await sql.query('SELECT * FROM location_links')).filter(link => allowed.has(link.from_id) && allowed.has(link.to_id) && (gm || locations.find(item => item.id === link.from_id)?.access_level === 'accessible'));
    const rows = await sql.query(`SELECT c.id AS character_id, c.name, c.kind, c.owner_id, c.id AS image_id, COALESCE(p.location_id, 'star-map') AS location_id, p.x, p.y, p.changed_at, COALESCE(p.standup_scale, 1) AS standup_scale, COALESCE(p.standup_flipped, 0) AS standup_flipped, COALESCE(p.delve_suit, 0) AS delve_suit,
      EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'portrait') AS has_portrait,
      EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'standup') AS has_standup,
      EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = c.id AND i.slot = 'delve_suit') AS has_delve_suit
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
    const creatures = (await sql.query(`SELECT c.id, c.template_id, c.name, c.category, c.location_id, c.x, c.y, c.standup_scale, c.standup_flipped, c.hidden, c.health, c.show_health,
      json_extract(c.stats, '$.health') AS max_health, json_extract(c.stats, '$.footprint') AS footprint, COALESCE(t.updated_at, 0) AS image_version,
      EXISTS (SELECT 1 FROM creature_template_images i WHERE i.template_id = c.template_id AND i.slot = 'portrait') AS has_portrait,
      EXISTS (SELECT 1 FROM creature_template_images i WHERE i.template_id = c.template_id AND i.slot = 'standup') AS has_standup
      FROM creatures c LEFT JOIN creature_templates t ON t.id = c.template_id ORDER BY c.created_at, c.id`)).filter(row => {
      const location = locations.find(item => item.id === row.location_id);
      if (!location) return false;
      if (gm) return true;
      if (row.hidden || location.access_level !== 'accessible') return false;
      // In fog, players see a creature while any square it covers is in a visible room.
      return location.kind !== 'delve' || row.x === null || footprintSquares(row.x, row.y, row.footprint || 1).some(([x, y]) => visibleRoom(location, roomAt(gridOf(location), x, y)));
    }).map(row => {
      const shared = { id: row.id, template_id: row.template_id, name: row.name, category: row.category, location_id: row.location_id, x: row.x, y: row.y, footprint: row.footprint || 1, standup_scale: row.standup_scale, standup_flipped: Boolean(row.standup_flipped), has_portrait: Boolean(row.has_portrait), has_standup: Boolean(row.has_standup), image_version: row.image_version };
      // Players see Health only when the GM shows it for that creature.
      if (gm) return { ...shared, hidden: Boolean(row.hidden), show_health: Boolean(row.show_health), health: row.health, max_health: row.max_health };
      return row.show_health ? { ...shared, health: row.health, max_health: row.max_health } : shared;
    });
    return json({ locations: locations.map(item => ({ ...item, grid: gm || item.access_level === 'accessible' ? gridOf(item) : null, has_image: (gm || item.access_level === 'accessible') && item.image_version > 0, has_card_image: item.card_image_version > 0 })), links, positions, creatures, overrides: gm ? overrides : [], visibleRooms: Object.fromEntries(locations.filter(item => item.kind === 'delve' && (gm || item.access_level === 'accessible')).map(item => [item.id, Object.fromEntries([...gridOf(item).rooms.map(room => room.id), '_unassigned'].map(id => [id, visibleRoom(item, id)]))])) });
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
      const character = await standupOwner(sql, profile, data.characterId);
      if (!character) return error('Character unavailable', 403);
      const scale = Math.round(data.scale * 100) / 100;
      await sql`UPDATE character_positions SET standup_scale = ${scale} WHERE character_id = ${character.id}`;
      return json({ scale });
    }
    if (data.action === 'standup') {
      const flipped = data.flipped, delveSuit = data.delveSuit;
      if (!uuid(data.characterId) || (flipped === undefined && delveSuit === undefined) || ![flipped, delveSuit].every(value => value === undefined || typeof value === 'boolean')) return error('Invalid stand-up setting');
      const character = await standupOwner(sql, profile, data.characterId);
      if (!character) return error('Character unavailable', 403);
      if (delveSuit && !(await sql`SELECT 1 FROM character_images WHERE character_id = ${character.id} AND slot = 'delve_suit'`).length) return error('Upload a delve-suit stand-up for this character first');
      if (flipped !== undefined) await sql`UPDATE character_positions SET standup_flipped = ${Number(flipped)} WHERE character_id = ${character.id}`;
      if (delveSuit !== undefined) await sql`UPDATE character_positions SET delve_suit = ${Number(delveSuit)} WHERE character_id = ${character.id}`;
      return json({ ok: true });
    }
    if (profile.role !== 'gm') return error('Only the GM can edit the world', 403);
    if (data.action === 'placeCreature') {
      if (!uuid(data.templateId)) return error('Choose a creature from the palette');
      const template = (await sql`SELECT id, name, category, stats FROM creature_templates WHERE id = ${data.templateId}`)[0];
      if (!template) return error('Creature not found', 404);
      const location = await locate(sql, data.locationId);
      if (!location || !['delve', 'diorama'].includes(location.kind)) return error('Creatures can be placed only in Vistas and Explorables');
      const names = (await sql`SELECT name FROM creatures WHERE location_id = ${location.id}`).map(row => row.name);
      const stats = JSON.parse(template.stats), id = randomUUID(), name = nextCreatureName(template.name, names);
      const dropped = data.x !== undefined || data.y !== undefined;
      // A placed creature takes a copy of the entry's stats and starts at full Health.
      const placed = await positionCreature(sql, location, stats.footprint || 1, dropped ? [data.x, data.y] : defaultSpot(location, names.length), false, (x, y, guard) => sql.query(
        `INSERT INTO creatures (id, template_id, name, category, stats, location_id, x, y, health) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard.sql} RETURNING id`,
        [id, template.id, name, template.category, template.stats, location.id, x, y, stats.health, ...guard.args]));
      return placed instanceof Response ? placed : json({ id, name, x: placed[0], y: placed[1] }, 201);
    }
    if (data.action === 'moveCreature') {
      const creature = await placedCreature(sql, data.creatureId);
      if (!creature) return error('Creature not found', 404);
      const moved = await positionCreature(sql, creature.location, creature.size || 1, [data.x, data.y], true, (x, y, guard) => sql.query(
        `UPDATE creatures SET x = ?, y = ?, updated_at = unixepoch() WHERE id = ? AND ${guard.sql} RETURNING id`, [x, y, creature.id, ...guard.args]), creature.id);
      return moved instanceof Response ? moved : json({ x: moved[0], y: moved[1] });
    }
    if (data.action === 'duplicateCreature') {
      const creature = await placedCreature(sql, data.creatureId);
      if (!creature) return error('Creature not found', 404);
      const names = (await sql`SELECT name FROM creatures WHERE location_id = ${creature.location_id}`).map(row => row.name);
      const id = randomUUID(), name = nextCreatureName(baseCreatureName(creature.name), names);
      // The copy has the same stats, look and visibility, at full Health, beside the original.
      const near = gridOf(creature.location) ? [creature.x ?? 0, creature.y ?? 0] : [Math.min(1000, (creature.x ?? 500) + 90), creature.y ?? 820];
      const placed = await positionCreature(sql, creature.location, creature.size || 1, near, false, (x, y, guard) => sql.query(
        `INSERT INTO creatures (id, template_id, name, category, stats, location_id, x, y, health, standup_scale, standup_flipped, hidden)
          SELECT ?, template_id, ?, category, stats, location_id, ?, ?, json_extract(stats, '$.health'), standup_scale, standup_flipped, hidden FROM creatures WHERE id = ? AND ${guard.sql} RETURNING id`,
        [id, name, x, y, creature.id, ...guard.args]));
      return placed instanceof Response ? placed : json({ id, name, x: placed[0], y: placed[1] }, 201);
    }
    if (data.action === 'creature') {
      const creature = await placedCreature(sql, data.creatureId);
      if (!creature) return error('Creature not found', 404);
      const { hidden, flipped, scale } = data;
      if ([hidden, flipped].some(value => value !== undefined && typeof value !== 'boolean') || (scale !== undefined && !(Number.isFinite(scale) && scale >= CREATURE_SCALE.min && scale <= CREATURE_SCALE.max))) return error('Invalid creature setting');
      const size = scale === undefined ? creature.standup_scale : Math.round(scale * 100) / 100;
      await sql`UPDATE creatures SET hidden = ${hidden === undefined ? creature.hidden : Number(hidden)}, standup_flipped = ${flipped === undefined ? creature.standup_flipped : Number(flipped)}, standup_scale = ${size}, updated_at = unixepoch() WHERE id = ${creature.id}`;
      return json({ ok: true });
    }
    if (data.action === 'removeCreature') {
      if (!uuid(data.creatureId)) return error('Creature not found', 404);
      const rows = await sql`DELETE FROM creatures WHERE id = ${data.creatureId} RETURNING id`;
      return rows.length ? json({ ok: true }) : error('Creature not found', 404);
    }
    if (data.action === 'create') {
      const title = safeText(data.title, 80), description = typeof data.description === 'string' && data.description.length <= 4000 ? data.description.trim() : null;
      const teaser = optionalText(data.teaser, 220), quote = optionalText(data.quote, 280), speaker = optionalText(data.quoteSpeaker, 100);
      if (!title || description === null || teaser === null || quote === null || speaker === null || !['settlement', 'delve', 'diorama', 'poi'].includes(data.kind)) return error('Check location details');
      const parent = await locate(sql, data.parentId);
      if (!parent || !['star', 'settlement'].includes(parent.kind) || !coord(data.x) || !coord(data.y) || (parent.kind === 'star' ? data.x > 900 || data.y > 600 : data.x > 100 || data.y > 100)) return error('Choose a valid parent and marker position');
      const grid = data.kind === 'delve' ? simpleGrid() : null;
      const id = randomUUID(), linkId = randomUUID();
      // A location created inside an instance is temporary too, and is cleaned up the same way.
      await sql`INSERT INTO locations (id, kind, parent_id, title, description, teaser, quote, quote_speaker, grid, is_instance, instance_active_at) VALUES (${id}, ${data.kind}, ${parent.id}, ${title}, ${description}, ${teaser}, ${quote}, ${speaker}, ${JSON.stringify(grid || {})}, ${parent.is_instance ? 1 : 0}, ${parent.is_instance ? Math.floor(Date.now() / 1000) : null})`;
      await sql`INSERT INTO location_links (id, from_id, to_id, kind, label, x, y) VALUES (${linkId}, ${parent.id}, ${id}, 'marker', ${title}, ${data.x}, ${data.y})`;
      return json({ id, linkId }, 201);
    }
    if (data.action === 'instance') {
      const source = await locate(sql, data.locationId);
      if (!source || !['settlement', 'delve', 'diorama'].includes(source.kind)) return error('Only Hubs, Explorables, and Vistas can be instanced');
      // A disconnected copy: same parent, art and room settings, but no markers, doors or characters. It stays
      // Accessible so the GM can pull players in; with no markers pointing to it, players cannot find it themselves.
      const id = randomUUID();
      await sql.client.batch([
        { sql: `INSERT INTO locations (id, kind, parent_id, title, description, teaser, quote, quote_speaker, grid, fog_enabled, image_version, card_image_version, access_level, visible, is_instance, instance_of, instance_active_at)
          SELECT ?, kind, parent_id, title, description, teaser, quote, quote_speaker, grid, fog_enabled, image_version, card_image_version, 'accessible', 1, 1, ?, unixepoch() FROM locations WHERE id = ?`, args: [id, source.instance_of || source.id, source.id] },
        ...['location_images', 'location_card_images'].map(table => ({ sql: `INSERT INTO ${table} (location_id, mime_type, bytes) SELECT ?, mime_type, bytes FROM ${table} WHERE location_id = ?`, args: [id, source.id] })),
        { sql: 'INSERT INTO room_overrides (location_id, room_id, visibility) SELECT ?, room_id, visibility FROM room_overrides WHERE location_id = ?', args: [id, source.id] }
      ], 'write');
      return json({ id }, 201);
    }
    if (data.action === 'deleteInstance') {
      const location = await locate(sql, data.locationId);
      if (!location?.is_instance) return error('Only instanced areas can be deleted');
      await removeInstances(sql, [location.id], true);
      return json({ ok: true });
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
