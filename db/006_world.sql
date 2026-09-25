-- Additive world prototype schema. Keep existing characters and campaign data.
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('star', 'settlement', 'delve', 'diorama', 'poi')),
  parent_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  access_level TEXT NOT NULL DEFAULT 'accessible' CHECK (access_level IN ('invisible', 'inaccessible', 'accessible')),
  grid TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(grid)),
  fog_enabled INTEGER NOT NULL DEFAULT 0 CHECK (fog_enabled IN (0, 1)),
  image_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS locations_parent_idx ON locations(parent_id);

CREATE TABLE IF NOT EXISTS location_links (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('marker', 'door')),
  label TEXT NOT NULL DEFAULT '',
  x REAL NOT NULL,
  y REAL NOT NULL,
  arrival_x INTEGER,
  arrival_y INTEGER
);
CREATE INDEX IF NOT EXISTS location_links_from_idx ON location_links(from_id);

CREATE TABLE IF NOT EXISTS location_images (
  location_id TEXT PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS character_positions (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id),
  x INTEGER,
  y INTEGER,
  changed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK ((x IS NULL AND y IS NULL) OR (x IS NOT NULL AND y IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS character_positions_square_idx ON character_positions(location_id, x, y) WHERE x IS NOT NULL AND y IS NOT NULL;
CREATE INDEX IF NOT EXISTS character_positions_location_idx ON character_positions(location_id);

CREATE TABLE IF NOT EXISTS room_overrides (
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('show', 'hide')),
  PRIMARY KEY(location_id, room_id)
);
