-- devlog local database schema

CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',   -- public | private | client
  project_tag TEXT,
  voice_profile TEXT DEFAULT 'default',
  platforms TEXT DEFAULT '["x"]',              -- JSON array
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER REFERENCES repos(id),
  source_commit TEXT,
  platform TEXT NOT NULL,                      -- x | linkedin | facebook | instagram
  content TEXT NOT NULL,
  thread_parts TEXT,                           -- JSON array if it's a thread
  media_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | approved | rejected | posted | failed
  edited_content TEXT,                         -- filled in if user edits before approving
  created_at TEXT DEFAULT (datetime('now')),
  posted_at TEXT
);

CREATE TABLE IF NOT EXISTS voice_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id),
  original_content TEXT NOT NULL,
  edited_content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engagement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id),
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  pulled_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  status TEXT DEFAULT 'connected',              -- connected | expired | error
  token_ref TEXT NOT NULL,                      -- key name in OS keychain, never the token itself
  refresh_token_ref TEXT,
  expiry_at TEXT,
  last_posted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform, handle)
);

CREATE TABLE IF NOT EXISTS repo_name_map (
  repo_path TEXT PRIMARY KEY,
  resolved_name TEXT NOT NULL,
  source TEXT NOT NULL                          -- config | package_json | readme | git_remote | folder
);
