import type { GreekParsingResponse, MorphologyWordInput, MorphologyWordRecord, VerseInput, VerseRecord } from "./types";
import { normalizeGreekForComparison } from "./greek";

let greekVerseCache: VerseRecord[] | null = null;

export async function upsertVerse(db: D1Database, verse: VerseInput): Promise<VerseRecord> {
  await db
    .prepare(
      `INSERT INTO verses (book, book_number, chapter, verse, kjv, bsb, greek, topics, pericope)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(book, chapter, verse) DO UPDATE SET
         book_number = excluded.book_number,
         kjv = excluded.kjv,
         bsb = excluded.bsb,
         greek = excluded.greek,
         topics = excluded.topics,
         pericope = excluded.pericope`
    )
    .bind(
      verse.book,
      verse.bookNumber,
      verse.chapter,
      verse.verse,
      verse.kjv,
      verse.bsb,
      verse.greek,
      JSON.stringify(verse.topics),
      verse.pericope
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM verses WHERE book = ? AND chapter = ? AND verse = ?")
    .bind(verse.book, verse.chapter, verse.verse)
    .first<VerseRow>();

  if (!row) throw new Error(`Unable to read inserted verse ${verse.book} ${verse.chapter}:${verse.verse}`);
  greekVerseCache = null;
  return mapVerse(row);
}

export async function setVerseEmbeddingId(db: D1Database, id: number, embeddingId: number): Promise<void> {
  await db.prepare("UPDATE verses SET embedding_id = ? WHERE id = ?").bind(embeddingId, id).run();
}

export async function searchVerses(
  db: D1Database,
  filters: { q?: string; book?: string; chapter?: number; limit: number }
): Promise<VerseRecord[]> {
  const where: string[] = [];
  const binds: unknown[] = [];

  if (filters.q) {
    where.push("(bsb LIKE ? OR kjv LIKE ? OR greek LIKE ?)");
    const like = `%${filters.q}%`;
    binds.push(like, like, like);
  }
  if (filters.book) {
    where.push("book = ?");
    binds.push(filters.book);
  }
  if (filters.chapter) {
    where.push("chapter = ?");
    binds.push(filters.chapter);
  }

  binds.push(filters.limit);
  const sql = `SELECT * FROM verses ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY book_number, chapter, verse LIMIT ?`;
  const result = await db.prepare(sql).bind(...binds).all<VerseRow>();
  return result.results.map(mapVerse);
}

export async function getVersesByIds(db: D1Database, ids: number[]): Promise<VerseRecord[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.prepare(`SELECT * FROM verses WHERE id IN (${placeholders})`).bind(...ids).all<VerseRow>();
  const byId = new Map(result.results.map((row) => [row.id, mapVerse(row)]));
  return ids.map((id) => byId.get(id)).filter((verse): verse is VerseRecord => Boolean(verse));
}

export async function getVerseByReference(
  db: D1Database,
  reference: { book: string; chapter: number; verse: number }
): Promise<VerseRecord | null> {
  const row = await db
    .prepare("SELECT * FROM verses WHERE book = ? AND chapter = ? AND verse = ?")
    .bind(reference.book, reference.chapter, reference.verse)
    .first<VerseRow>();
  return row ? mapVerse(row) : null;
}

export async function upsertMorphology(db: D1Database, verseId: number, words: MorphologyWordInput[]): Promise<number> {
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM word_morphology WHERE verse_id = ?").bind(verseId)
  ];

  for (const word of words) {
    statements.push(
      db
        .prepare(
          `INSERT INTO word_morphology
             (verse_id, word_position, lemma, pos, gender, case_field, number_field, domains, subdomains, clause_function)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          verseId,
          word.position,
          word.lemma,
          word.pos,
          word.gender,
          word.case,
          word.number,
          word.domains,
          word.subdomains,
          word.clauseFunction
        )
    );
  }

  await db.batch(statements);
  return words.length;
}

export async function getMorphology(db: D1Database, verseId: number): Promise<MorphologyWordRecord[]> {
  const result = await db
    .prepare("SELECT * FROM word_morphology WHERE verse_id = ? ORDER BY word_position")
    .bind(verseId)
    .all<MorphologyRow>();
  return result.results.map(mapMorphology);
}

export async function searchVerseByGreekText(
  db: D1Database,
  normalized: string
): Promise<{ verse: VerseRecord; morphology: MorphologyWordRecord[] } | null> {
  const escaped = escapeLike(normalized);
  const pattern = `%${escaped}%`;
  const row = await db
    .prepare("SELECT * FROM verses WHERE greek LIKE ? ESCAPE '\\' AND greek IS NOT NULL AND greek != '' LIMIT 1")
    .bind(pattern)
    .first<VerseRow>();

  const likeMatch = row ? await buildGreekTextMatch(db, mapVerse(row), normalized, "overlap") : null;
  if (likeMatch) return likeMatch;

  const candidates = await getGreekVerseCandidates(db);

  for (const candidate of candidates) {
    const match = await buildGreekTextMatch(db, candidate, normalized, "phrase");
    if (match) return match;
  }

  for (const candidate of candidates) {
    const match = await buildGreekTextMatch(db, candidate, normalized, "overlap");
    if (match) return match;
  }

  return null;
}

export async function getGreekCache(db: D1Database, greek: string): Promise<GreekParsingResponse | null> {
  const row = await db.prepare("SELECT parsing FROM greek_cache WHERE greek_text = ?").bind(greek).first<{ parsing: string }>();
  if (!row) return null;
  return { ...JSON.parse(row.parsing), cached: true };
}

export async function setGreekCache(db: D1Database, greek: string, parsing: Omit<GreekParsingResponse, "cached">): Promise<void> {
  await db
    .prepare(
      `INSERT INTO greek_cache (greek_text, parsing)
       VALUES (?, ?)
       ON CONFLICT(greek_text) DO UPDATE SET parsing = excluded.parsing`
    )
    .bind(greek, JSON.stringify(parsing))
    .run();
}

export async function getStatus(db: D1Database): Promise<{ verses: number; greekCacheEntries: number }> {
  const verses = await db.prepare("SELECT COUNT(*) AS count FROM verses").first<{ count: number }>();
  const cache = await db.prepare("SELECT COUNT(*) AS count FROM greek_cache").first<{ count: number }>();
  return { verses: verses?.count ?? 0, greekCacheEntries: cache?.count ?? 0 };
}

interface VerseRow {
  id: number;
  book: string;
  book_number: number | null;
  chapter: number;
  verse: number;
  kjv: string | null;
  bsb: string | null;
  greek: string | null;
  topics: string | null;
  pericope: string | null;
  embedding_id: number | null;
}

interface MorphologyRow {
  id: number;
  verse_id: number;
  word_position: number;
  lemma: string | null;
  pos: string | null;
  gender: string | null;
  case_field: string | null;
  number_field: string | null;
  domains: string | null;
  subdomains: string | null;
  clause_function: string | null;
}

function mapVerse(row: VerseRow): VerseRecord {
  return {
    id: row.id,
    book: row.book,
    bookNumber: row.book_number ?? 0,
    chapter: row.chapter,
    verse: row.verse,
    kjv: row.kjv,
    bsb: row.bsb,
    greek: row.greek,
    topics: parseTopics(row.topics),
    pericope: row.pericope,
    embeddingId: row.embedding_id
  };
}

function mapMorphology(row: MorphologyRow): MorphologyWordRecord {
  return {
    id: row.id,
    verseId: row.verse_id,
    position: row.word_position,
    lemma: row.lemma,
    pos: row.pos,
    gender: row.gender,
    case: row.case_field,
    number: row.number_field,
    domains: row.domains,
    subdomains: row.subdomains,
    clauseFunction: row.clause_function
  };
}

function parseTopics(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function buildGreekTextMatch(
  db: D1Database,
  verse: VerseRecord,
  normalized: string,
  mode: "phrase" | "overlap"
): Promise<{ verse: VerseRecord; morphology: MorphologyWordRecord[] } | null> {
  const normalizedVerse = normalizeGreekForComparison(verse.greek ?? "");
  const inputWords = normalized.split(/\s+/).filter(Boolean);
  const verseWords = normalizedVerse.split(/\s+/).filter(Boolean);

  if (inputWords.length === 0) return null;
  if (normalizedVerse.includes(normalized) && (inputWords.length >= 3 || normalizedVerse.startsWith(normalized))) {
    return buildMorphologyMatch(db, verse);
  }
  if (mode === "phrase" || inputWords.length < 3) return null;

  const matchCount = inputWords.filter((word) => verseWords.includes(word)).length;
  if (matchCount / inputWords.length < 0.6) return null;

  return buildMorphologyMatch(db, verse);
}

async function buildMorphologyMatch(
  db: D1Database,
  verse: VerseRecord
): Promise<{ verse: VerseRecord; morphology: MorphologyWordRecord[] } | null> {
  const morphology = await getMorphology(db, verse.id);
  if (morphology.length === 0) return null;
  return { verse, morphology };
}

async function getGreekVerseCandidates(db: D1Database): Promise<VerseRecord[]> {
  if (greekVerseCache) return greekVerseCache;

  const candidates = await db
    .prepare("SELECT * FROM verses WHERE greek IS NOT NULL AND greek != '' ORDER BY book_number, chapter, verse")
    .all<VerseRow>();
  greekVerseCache = candidates.results.map(mapVerse);
  return greekVerseCache;
}
