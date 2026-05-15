CREATE TABLE IF NOT EXISTS greek_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greek_text TEXT UNIQUE NOT NULL,
  parsing TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
