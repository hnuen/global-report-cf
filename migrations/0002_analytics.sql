-- Visitor analytics tables (Phase 1). Mirrors the bounded/TTL'd design used on
-- the Upstash path: daily counters + per-day uniques + live presence + geo
-- tallies, all pruned opportunistically so the tables can't grow without limit.

CREATE TABLE IF NOT EXISTS analytics_visit (
  day    TEXT PRIMARY KEY,            -- 'all' (all-time) or 'YYYY-MM-DD'
  visits INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS analytics_unique (
  day TEXT NOT NULL,                  -- 'YYYY-MM-DD'
  vid TEXT NOT NULL,
  PRIMARY KEY (day, vid)
) STRICT;

CREATE TABLE IF NOT EXISTS analytics_presence (
  vid     TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL            -- epoch milliseconds
) STRICT;
CREATE INDEX IF NOT EXISTS analytics_presence_seen_idx ON analytics_presence (seen_at);

CREATE TABLE IF NOT EXISTS analytics_session (
  vid        TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL         -- epoch seconds
) STRICT;
CREATE INDEX IF NOT EXISTS analytics_session_exp_idx ON analytics_session (expires_at);

CREATE TABLE IF NOT EXISTS analytics_geo (
  scope  TEXT NOT NULL,               -- 'country' or 'city:YYYY-MM-DD'
  name   TEXT NOT NULL,               -- 'US' or 'US|New York'
  visits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, name)
) STRICT;
