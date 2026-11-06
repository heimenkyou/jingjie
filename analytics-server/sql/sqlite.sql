CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY,
  event_name TEXT NOT NULL,
  install_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  client_timestamp INTEGER NOT NULL,
  properties TEXT NOT NULL,
  page_path TEXT GENERATED ALWAYS AS (json_extract(properties, '$.page')) STORED,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_events_created_event ON analytics_events (created_at, event_name);
CREATE INDEX IF NOT EXISTS idx_events_created_install ON analytics_events (created_at, install_id);
CREATE INDEX IF NOT EXISTS idx_events_created_page ON analytics_events (created_at, page_path);

CREATE TABLE IF NOT EXISTS feedback_items (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_items (created_at);

CREATE TABLE IF NOT EXISTS download_statistics (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_downloads INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime'))
);
