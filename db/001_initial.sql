-- Run once against each environment's persistent Postgres database.
-- Additive initial migration; never run a reset against campaign data.
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('player', 'gm')),
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_name_lower_idx ON profiles (lower(name));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_profile_id_idx ON sessions (profile_id);

CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pc', 'npc')),
  name text NOT NULL,
  profession text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT '',
  faction text NOT NULL DEFAULT '',
  appearance text NOT NULL DEFAULT '',
  motivation text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS characters_owner_id_idx ON characters (owner_id);
CREATE INDEX IF NOT EXISTS characters_kind_idx ON characters (kind);

CREATE TABLE IF NOT EXISTS character_images (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('portrait', 'standup')),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes bytea NOT NULL,
  PRIMARY KEY (character_id, slot)
);
