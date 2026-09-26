export const uuid = value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
export const coord = value => Number.isInteger(value) && value >= 0;
// Stand-ups can shrink or grow within this range; kept in step with the database CHECK in migration 012.
export const STANDUP_SCALE = { min: 0.5, max: 1.5 };
export const standupScale = value => typeof value === 'number' && Number.isFinite(value) && value >= STANDUP_SCALE.min && value <= STANDUP_SCALE.max;
export const key = (x, y) => `${x},${y}`;

export function gridOf(location) {
  if (location.kind !== 'delve') return null;
  const grid = JSON.parse(location.grid);
  return grid;
}

export function validGrid(grid) {
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 2 || grid.height < 2 || grid.width > 80 || grid.height > 80) return false;
  if (!Array.isArray(grid.entry) || !inside(grid, ...grid.entry)) return false;
  if (!Array.isArray(grid.blocked) || !Array.isArray(grid.rooms) || grid.rooms.length > 100) return false;
  const seen = new Set();
  for (const pair of grid.blocked) { if (!Array.isArray(pair) || !inside(grid, ...pair)) return false; seen.add(key(...pair)); }
  const roomIds = new Set();
  for (const room of grid.rooms) {
    if (!room || typeof room.id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(room.id) || roomIds.has(room.id) || typeof room.name !== 'string' || room.name.length > 80 || !Array.isArray(room.squares)) return false;
    roomIds.add(room.id);
    for (const pair of room.squares) if (!Array.isArray(pair) || !inside(grid, ...pair) || seen.has(`room:${key(...pair)}`)) return false;
    else seen.add(`room:${key(...pair)}`);
  }
  return !seen.has(key(...grid.entry));
}

export function inside(grid, x, y) { return coord(x) && coord(y) && x < grid.width && y < grid.height; }
export function roomAt(grid, x, y) { return grid.rooms.find(room => room.squares.some(pair => pair[0] === x && pair[1] === y))?.id || '_unassigned'; }

export function roomVisible(location, roomId, occupants, overrides) {
  const override = overrides.find(row => row.room_id === roomId)?.visibility;
  if (override) return override === 'show';
  return !location.fog_enabled || occupants.some(row => row.room_id === roomId);
}

export function nearestOpen(grid, preferred, occupied) {
  const blocked = new Set(grid.blocked.map(pair => key(...pair)));
  const [sx, sy] = preferred;
  if (!inside(grid, sx, sy)) return null;
  const candidates = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    if (blocked.has(key(x, y)) || occupied.has(key(x, y))) continue;
    candidates.push([x, y]);
  }
  candidates.sort((a, b) => Math.abs(a[0] - sx) + Math.abs(a[1] - sy) - Math.abs(b[0] - sx) - Math.abs(b[1] - sy) || a[1] - b[1] || a[0] - b[0]);
  return candidates[0] || null;
}
