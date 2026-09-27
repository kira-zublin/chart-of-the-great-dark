-- Additive creature palette. Templates are the GM's palette entries (book entries are loaded by
-- scripts/import-creatures.js from a local, uncommitted library file); creatures are placed instances
-- that copy a template's stats when placed and then change independently.
CREATE TABLE IF NOT EXISTS creature_templates (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('book', 'custom')),
  book_key TEXT UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (category IN ('blight', 'construct', 'beast', 'echo', 'adversary', 'other')),
  stats TEXT NOT NULL CHECK (json_valid(stats)),
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS creature_templates_name_idx ON creature_templates (lower(name));

CREATE TABLE IF NOT EXISTS creature_template_images (
  template_id TEXT NOT NULL REFERENCES creature_templates(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('portrait', 'standup')),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes BLOB NOT NULL,
  PRIMARY KEY (template_id, slot)
);

-- A placed creature keeps its category so it can fall back to the category icon if its template is deleted.
CREATE TABLE IF NOT EXISTS creatures (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES creature_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (category IN ('blight', 'construct', 'beast', 'echo', 'adversary', 'other')),
  stats TEXT NOT NULL CHECK (json_valid(stats)),
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  x INTEGER,
  y INTEGER,
  standup_scale REAL NOT NULL DEFAULT 1 CHECK (standup_scale BETWEEN 0.25 AND 3),
  standup_flipped INTEGER NOT NULL DEFAULT 0 CHECK (standup_flipped IN (0, 1)),
  health INTEGER NOT NULL CHECK (health >= 0),
  conditions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(conditions)),
  show_health INTEGER NOT NULL DEFAULT 0 CHECK (show_health IN (0, 1)),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK ((x IS NULL AND y IS NULL) OR (x IS NOT NULL AND y IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS creatures_location_idx ON creatures (location_id);
