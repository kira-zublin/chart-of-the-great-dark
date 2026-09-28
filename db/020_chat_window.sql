-- The chat window shows only messages after cleared_after_id; every message stays stored for Download Log.
-- active_at is when anyone last had chat open. After a long quiet spell the window starts fresh.
CREATE TABLE IF NOT EXISTS chat_window (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_at INTEGER NOT NULL DEFAULT (unixepoch()),
  cleared_after_id INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO chat_window (id) VALUES (1);
