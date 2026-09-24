-- Additive migration for shared Crew and Bird portraits.
CREATE TABLE IF NOT EXISTS crew_images (
  slot TEXT PRIMARY KEY CHECK (slot IN ('crew', 'bird')),
  mime_type TEXT NOT NULL,
  bytes BLOB NOT NULL
);
