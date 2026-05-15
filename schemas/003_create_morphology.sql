CREATE TABLE IF NOT EXISTS word_morphology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verse_id INTEGER NOT NULL,
  word_position INTEGER NOT NULL,
  lemma TEXT,
  pos TEXT,
  gender TEXT,
  case_field TEXT,
  number_field TEXT,
  domains TEXT,
  subdomains TEXT,
  clause_function TEXT,
  FOREIGN KEY (verse_id) REFERENCES verses(id)
);

CREATE INDEX IF NOT EXISTS idx_morph_verse ON word_morphology(verse_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_morph_verse_position ON word_morphology(verse_id, word_position);
