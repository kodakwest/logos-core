CREATE TABLE IF NOT EXISTS verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book TEXT NOT NULL,
  book_number INTEGER,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  kjv TEXT,
  bsb TEXT,
  greek TEXT,
  topics TEXT,
  pericope TEXT,
  embedding_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verses_unique_reference ON verses(book, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_verses_book_chapter ON verses(book, chapter);
CREATE INDEX IF NOT EXISTS idx_verses_book ON verses(book);
