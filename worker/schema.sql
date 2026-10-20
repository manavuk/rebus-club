-- Rebus Club results database (Cloudflare D1).
-- Apply with: npx wrangler d1 execute rebus-club --remote --file=schema.sql

-- One row per player per puzzle: their first go only.
CREATE TABLE IF NOT EXISTS results (
  puzzle  TEXT    NOT NULL,  -- built-in puzzle id, e.g. b_mindovermatter
  client  TEXT    NOT NULL,  -- random id kept in the player's browser
  outcome INTEGER NOT NULL,  -- 1 solved, 0 gave up, -1 skipped
  hints   INTEGER NOT NULL,
  wrongs  INTEGER NOT NULL,
  secs    INTEGER NOT NULL,  -- time spent with the puzzle on screen
  mode    TEXT    NOT NULL,
  at      INTEGER NOT NULL,  -- ms since 1970
  PRIMARY KEY (puzzle, client)
);

-- Daily result counts per network, for rate limiting. key is a salted hash that changes daily.
CREATE TABLE IF NOT EXISTS limits (
  key TEXT PRIMARY KEY,
  day TEXT    NOT NULL,
  n   INTEGER NOT NULL
);
