-- Additive GM jukebox. Audio bytes live in Vercel Blob; these rows hold track metadata and the shared playback state.
CREATE TABLE IF NOT EXISTS jukebox_tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  blob_url TEXT NOT NULL UNIQUE,
  blob_pathname TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms > 0),
  uploaded_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- One row. While playing, started_at_ms is the server time at which position 0 played; while paused, position_ms holds the offset.
CREATE TABLE IF NOT EXISTS jukebox_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  track_id TEXT REFERENCES jukebox_tracks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('playing', 'paused', 'stopped')),
  started_at_ms INTEGER,
  position_ms INTEGER NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
  loop INTEGER NOT NULL DEFAULT 1 CHECK (loop IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO jukebox_state (id) VALUES (1);
