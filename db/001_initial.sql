-- Run once against each environment's persistent Turso database.
-- Initial additive schema. Do not reset an existing campaign database.
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('player', 'gm')),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_name_lower_idx ON profiles (lower(name));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_profile_id_idx ON sessions (profile_id);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pc', 'npc')),
  name TEXT NOT NULL,
  profession TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '',
  faction TEXT NOT NULL DEFAULT '',
  appearance TEXT NOT NULL DEFAULT '',
  motivation TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  attributes TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS characters_owner_id_idx ON characters (owner_id);
CREATE INDEX IF NOT EXISTS characters_kind_idx ON characters (kind);

CREATE TABLE IF NOT EXISTS character_images (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('portrait', 'standup')),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes BLOB NOT NULL,
  PRIMARY KEY (character_id, slot)
);
