-- Additive campaign chat history. Apply after 003 in each environment.
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  player_name TEXT NOT NULL,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  character_name TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'roll')),
  body TEXT NOT NULL DEFAULT '',
  roll TEXT CHECK (roll IS NULL OR json_valid(roll)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS chat_messages_created_id_idx ON chat_messages(created_at, id);
