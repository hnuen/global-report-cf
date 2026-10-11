CREATE TABLE IF NOT EXISTS alert_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS alert_state_expires_at_idx
  ON alert_state (expires_at);

CREATE TABLE IF NOT EXISTS alert_set_members (
  set_key TEXT NOT NULL,
  member TEXT NOT NULL,
  PRIMARY KEY (set_key, member)
) STRICT;
