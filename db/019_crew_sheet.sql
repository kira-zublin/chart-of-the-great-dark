-- The crew sheet redesign keeps the book's crew rules in the existing crew JSON columns. This migration adds
-- the per-engagement maneuver tracker and the crew-point history, and widens the rules reference to the
-- crew's book text (maneuvers, Bird powers, Losing Control and vehicle upgrades).
CREATE TABLE IF NOT EXISTS rules_entries_019 (
  kind TEXT NOT NULL CHECK (kind IN ('talent', 'injury', 'trauma', 'blight', 'feature', 'maneuver', 'power', 'control', 'upgrade')),
  key TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 60),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  data TEXT NOT NULL CHECK (json_valid(data)),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, key)
);
