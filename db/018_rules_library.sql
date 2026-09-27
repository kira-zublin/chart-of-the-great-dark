-- Additive rules reference: talent descriptions and the critical injury, mental trauma, Blight manifestation
-- and gear feature tables. The rulebook text is loaded by scripts/import-rules.js from a local, uncommitted
-- library file; the app only reads it, and each import replaces the whole set.
CREATE TABLE IF NOT EXISTS rules_entries (
  kind TEXT NOT NULL CHECK (kind IN ('talent', 'injury', 'trauma', 'blight', 'feature')),
  key TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 60),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  data TEXT NOT NULL CHECK (json_valid(data)),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, key)
);
