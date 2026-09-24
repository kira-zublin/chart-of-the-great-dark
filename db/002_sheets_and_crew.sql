-- Additive migration. Apply after 001_initial.sql to each environment.
ALTER TABLE characters ADD COLUMN sheet TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(sheet));

CREATE TABLE IF NOT EXISTS crew (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  crew_points INTEGER NOT NULL DEFAULT 0 CHECK (crew_points >= 0),
  bird TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(bird)),
  rover TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rover)),
  shuttle TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(shuttle)),
  maneuvers TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(maneuvers)),
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO crew (id) VALUES (1);

CREATE TABLE IF NOT EXISTS crew_roles (
  role TEXT PRIMARY KEY CHECK (role IN ('delver', 'burrower', 'scout', 'guard', 'archaeologist')),
  character_id TEXT UNIQUE REFERENCES characters(id) ON DELETE SET NULL
);
INSERT OR IGNORE INTO crew_roles (role) VALUES ('delver'), ('burrower'), ('scout'), ('guard'), ('archaeologist');
