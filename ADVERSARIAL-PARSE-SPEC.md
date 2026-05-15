---
title: "Bible AI Search — Parse Tool Upgrade: Data-Driven Greek Parsing"
artifact_type: Implementation_Plan
domain: "Cloudflare Workers; D1; TypeScript; Edge API"
systems: ["bible-ai-api", "cloudflare-workers", "d1", "word_morphology"]
primary_entities: ["parse/greek endpoint", "word_morphology table", "verses table", "greek_cache"]
last_updated: "2026-05-15"
status: ready
---

# Parse Tool Upgrade: Data-Driven Greek Parsing

## Goal

Replace the 100% LLM-dependent `/api/parse/greek` handler with a **data-first pipeline**: search stored morphology for verse-matching Greek text, return structured data instantly, and only fall back to Workers AI when no data match exists.

## Current State

- `POST /api/parse/greek` takes Greek text → calls Workers AI (llama-4-scout) → returns `{ words: [{ word, lemma, pos, parsing, gloss }] }`
- Result is cached in `greek_cache` table (2nd call for same text = instant)
- `word_morphology` table has 139K+ rows: per-word morphology for all 7,959 NT verses
- Each morphology row has: `word_position`, `lemma` (Strong's number, e.g. G1722), `pos`, `gender`, `case_field`, `number_field`
- `verses` table has `greek` column with the full Greek text per verse
- **Gap**: morphology table stores Strong's and structural fields but NOT the Greek surface form or gloss

## Target Flow

```
User enters Greek text
  → Normalize input (strip diacritics, normalize Unicode)
  → D1: SELECT id, greek FROM verses WHERE normalized_greek LIKE ?
    → Match found?
      YES → fetch word_morphology for that verse_id
           → split verse Greek text by word → align with morphology by word_position
           → format as GreekWordParsing[] (word, lemma, pos, parsing, gloss)
           → return immediately (cached = true, source = "morphology")
    → No match → existing LLM path (check greek_cache → miss → AI → cache → return)
```

## Edge Cases & Failure Modes

### Greek Text Matching

| Edge Case | Strategy |
|-----------|----------|
| User types Greek with different accentuation (polytonic vs monotonic) | Strip diacritics on both sides before comparing — normalize to base Greek characters |
| User types partial verse (first few words) | LIKE `%` prefix/suffix matching after normalization |
| User types with punctuation differences (commas, periods, semicolons) | Strip all punctuation before comparison |
| Unicode normalization differences (NFC vs NFD) | Normalize both sides to NFC before comparing |
| User types non-NT Greek (LXX, church fathers, random input) | Falls through to LLM — not a failure |
| Multiple verses match the same Greek text (unlikely but possible for short input) | Return first match or most popular verse (by id) |

### Morphology-to-Response Mapping

| Issue | Strategy |
|-------|----------|
| `word` (Greek surface form) not in morphology table | Split verse Greek text by whitespace → align with morphology by word_position. Strip punctuation from word tokens. |
| `lemma` field is Strong's number (G3056) not Greek lemma | Return Strong's as lemma — it's more useful for scholarly cross-reference than Greek dictionary form. Frontend shows this. |
| `parsing` field needs to be a human-readable string | Build from stored fields: combine `pos`, `case_field`, `number_field`, `gender` → e.g. "accusative, singular, masculine" |
| `gloss` not available in stored data | Return empty string. Frontend shows blank gloss cell. LLM path still produces glosses. |
| Morphology row count doesn't match word count from split Greek | Truncate to shorter length. Log discrepancy but don't fail. |
| Null fields in morphology (prepositions have no case/gender/number) | Skip nulls when building parsing string. "preposition" is descriptive enough. |
| verse_id has no morphology rows | Fall through to LLM path |

### LLM Fallback

| Issue | Strategy |
|-------|----------|
| LLM returns malformed JSON | Existing `parseGreekJson` handles this. Falls through to fallback words. |
| Workers AI rate limited | Error propagates to caller. No retry — user sees "temporarily unavailable". |
| LLM returns empty response | Same as malformed — fallback word splitting |
| LLM slow (>10s) | Not a new problem — this is the existing behavior. Data path should be <200ms. |

### Missing Greek Surface Form — The GAP

The morphology table stores Strong's numbers and POS but NOT the Greek word form itself. To fill the `word` field in the response, we need the Greek word from the verse text, aligned by position.

**Approach**: When a verse match is found, grab the verse's `greek` text, split on whitespace, strip punctuation from each token, then zip with the morphology rows ordered by `word_position`.

**Pitfall**: Some Greek words contain spaces in Unicode (e.g., combining forms). Standard whitespace split should work for 99%+ of NT Greek. If alignment fails, truncate.

## Implementation Phases

### Phase 1: Greek Text Matching + Morphology Response (Handler Change)

**Files to modify:**
- `src/index.ts` — rewrite `handleGreekParse` to check morphology before AI
- `src/db.ts` — add `searchVerseByGreekText()` function with normalized matching
- `src/types.ts` — add `MorphologyMatchResult` type (or reuse existing)

**Don't touch:**
- `src/ai.ts` — the LLM fallback logic stays exactly as-is
- `src/frontend/parser.tsx` — frontend compatible with response format
- `wrangler.toml`, schemas, config — no infra changes

**New logic in `src/db.ts`:**

```typescript
export async function searchVerseByGreekText(
  db: D1Database,
  greekText: string
): Promise<{ verse: VerseRecord; morphology: MorphologyWordRecord[] } | null> {
  // Normalize input: strip diacritics, strip punctuation, NFC normalize
  // D1 doesn't have native Greek collation, so we do LIKE with normalized comparison
  // Query verses table where greek contains the normalized input
  // Return first match with its morphology
}
```

**Pitfall — D1 LIKE on Greek Unicode**: D1 (SQLite) LIKE is byte-wise, not Unicode-aware. A search for "Ἐν ἀρχῇ" won't match "Εν αρχη" (different diacritics). **Solution**: Store a normalized copy of the Greek text in a new column `greek_normalized` on the verses table. Populate it with a one-time migration. Search against the normalized column.

Without this, the LIKE query will miss most user input because most users won't type exact polytonic Greek.

### Phase 1a: Add `greek_normalized` column

**SQL:**
```sql
ALTER TABLE verses ADD COLUMN greek_normalized TEXT;
```

**Migration:** Populate by reading each verse's `greek` column, running Python-side normalization (unicodedata.normalize, strip diacritics), and UPDATE-ing the new column.

But wait — we can do the normalization in the Worker itself during the one-time population. Or we can use a local Python script.

**Better approach for Phase 1a**: Write a Python script that:
1. Fetches all verses from the API (or uses the local BTB data)  
2. For each verse with Greek text, normalizes it
3. Updates the D1 database via wrangler SQL or the API

Actually, the simplest approach: since we're already in the Worker, we can:
1. When the parse handler gets a request, normalize the input Greek
2. D1: `SELECT * FROM verses WHERE greek LIKE '%' || ? || '%'` with the normalized input
3. Then filter client-side for the best match

This avoids needing a new column. For short Greek input (2-5 words), LIKE will return a small candidate set, and we can score by similarity.

**Decision**: Start with the simpler approach (LIKE on existing greek column, normalize input). If matching quality is poor, add the normalized column later.

### Phase 2: Seed greek_cache Pre-Population (Script)

Once Phase 1 works, write a Python script (`seed_greek_parse_cache.py`) that:
1. Queries `/api/status` to get verse count
2. For each verse in the DB, fetches Greek text + morphology via `/api/verses/morphology`
3. Formats morphology as GreekWordParsing[]
4. POSTs to a new endpoint or directly to D1 to pre-populate greek_cache

This makes the "hot path" instant — second query for the same text returns from cache.

**Phase 2 is optional** — Phase 1 alone eliminates LLM dependency. Phase 2 adds cache warmth for speed.

## File-by-File Changes

### `src/index.ts`

Replace `handleGreekParse` function:

```typescript
async function handleGreekParse(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ greek?: string }>(request);
  const greek = body.greek?.trim();
  if (!greek) return json({ error: "greek is required" }, 400);

  // Phase 1: Try to match from stored morphology
  // Normalize input: strip diacritics, strip punctuation, NFC normalize
  const normalized = normalizeGreekForComparison(greek);
  
  // Search verses by Greek text (normalized LIKE)
  const match = await searchVerseByGreekText(env.DB, normalized);
  if (match) {
    // Split verse Greek text into words, align with morphology by position
    const words = alignGreekWordsWithMorphology(match.verse.greek!, match.morphology);
    return json({ words, cached: true, source: "morphology" });
  }

  // Phase 2: Fall back to existing LLM path (with cache check)
  const cached = await getGreekCache(env.DB, greek);
  if (cached) return json(cached);

  const parsing = await parseGreekWithAi(env.AI, greek);
  await setGreekCache(env.DB, greek, parsing);
  return json({ ...parsing, cached: false });
}
```

**New helper function** `normalizeGreekForComparison(text: string): string`:
- NFC normalize
- Strip all combining diacritics (accents, breathing marks, iota subscript, diaeresis)
- Strip punctuation (.,;:¶"'«» etc.)
- Collapse whitespace
- Lowercase

**New helper function** `alignGreekWordsWithMorphology(greekText: string, morphology: MorphologyWordRecord[]): GreekWordParsing[]`:
- Split greekText on whitespace into tokens
- Strip trailing punctuation from each token
- Zip with morphology ordered by word_position
- For each pair: word=greekToken, lemma=morph.lemma, pos=morph.pos, parsing=buildParsingString(morph), gloss=""
- If counts mismatch, truncate to shorter length

### `src/db.ts`

Add:

```typescript
export interface GreekTextMatch {
  verse: VerseRecord;
  morphology: MorphologyWordRecord[];
}

export async function searchVerseByGreekText(
  db: D1Database,
  normalized: string
): Promise<GreekTextMatch | null> {
  // Escape LIKE special chars in normalized input
  const escaped = normalized.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  
  // Search verses where greek contains (approximately) the input
  const verse = await db
    .prepare("SELECT * FROM verses WHERE greek LIKE ? AND greek IS NOT NULL AND greek != '' LIMIT 1")
    .bind(pattern)
    .first<VerseRow>();
  
  if (!verse) return null;
  
  const mappedVerse = mapVerse(verse);
  const morphology = await getMorphology(db, mappedVerse.id);
  
  // Post-filter: verify the match quality
  // Check that most normalized words from input appear in normalized verse text
  const normalizedVerse = normalizeGreekForComparison(mappedVerse.greek || "");
  const inputWords = normalized.split(/\s+/).filter(Boolean);
  const verseWords = normalizedVerse.split(/\s+/).filter(Boolean);
  const matchCount = inputWords.filter(w => verseWords.includes(w)).length;
  
  // Require at least 60% of input words to match
  if (inputWords.length > 0 && matchCount / inputWords.length < 0.6) {
    return null; // Poor match — fall through to LLM
  }
  
  return { verse: mappedVerse, morphology };
}
```

### `src/types.ts`

No new types needed — `MorphologyWordRecord` and `GreekWordParsing` already exist.

### New helper: `greek.ts`

Create `src/greek.ts` with normalization and word-alignment utilities:

```typescript
// Greek text normalization utilities
export function normalizeGreekForComparison(text: string): string {
  // NFC normalize first
  let normalized = text.normalize('NFC');
  
  // Strip combining diacritics (accents, breathing marks, iota subscript, diaeresis)
  normalized = normalized.replace(/[\u0300-\u036F\u0370-\u03FF\u1F00-\u1FFF]/g, '');  // approximation
  
  // Strip punctuation
  normalized = normalized.replace(/[.,;:·'ʼ"«»‿\(\)\[\]{}]/g, '');
  
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Lowercase
  return normalized.toLowerCase();
}

export function alignGreekWordsWithMorphology(
  greekText: string,
  morphology: MorphologyWordRecord[]
): GreekWordParsing[] {
  const words = greekText
    .split(/\s+/)
    .map(w => w.replace(/[.,;:·'ʼ"«»‿\(\)\[\]{}]+$/, '').replace(/^[.,;:·'ʼ"«»‿\(\)\[\]{}]+/, ''))
    .filter(Boolean);
  
  const result: GreekWordParsing[] = [];
  const limit = Math.min(words.length, morphology.length);
  
  for (let i = 0; i < limit; i++) {
    const morph = morphology[i];
    result.push({
      word: words[i] || '',
      lemma: morph.lemma || '',
      pos: morph.pos || '',
      parsing: buildParsingString(morph),
      gloss: ''
    });
  }
  
  return result;
}

function buildParsingString(morph: MorphologyWordRecord): string {
  const parts: string[] = [];
  if (morph.case) parts.push(morph.case);
  if (morph.number) parts.push(morph.number);
  if (morph.gender) parts.push(morph.gender);
  return parts.join(', ');
}
```

## Verification

After implementation, test with:

### Basic test (exact verse Greek)
```bash
curl -s -X POST https://bible-ai-api.kodakwest.workers.dev/api/parse/greek \
  -H "Content-Type: application/json" \
  -d '{"greek":"Ἐν ἀρχῇ ἦν ὁ λόγος"}' | jq '{ cached, source, wordCount: (.words | length) }'
```
Expected: `{ "cached": true, "source": "morphology", "wordCount": N }` — response in <200ms

### Partial verse test  
```bash
curl -s -X POST https://bible-ai-api.kodakwest.workers.dev/api/parse/greek \
  -H "Content-Type: application/json" \
  -d '{"greek":"Ἐν ἀρχῇ"}' | jq '{ cached, source, wordCount: (.words | length) }'
```
Expected: Matches John 1:1, returns morphology for that verse

### Normalized matching test (no diacritics)
```bash
curl -s -X POST https://bible-ai-api.kodakwest.workers.dev/api/parse/greek \
  -H "Content-Type: application/json" \
  -d '{"greek":"Εν αρχη ην ο λογος"}' | jq '{ cached, source, wordCount: (.words | length) }'
```
Expected: Still matches John 1:1 (normalized input matches normalized verse)

### Non-NT Greek (should fall through to LLM)
```bash
curl -s -X POST https://bible-ai-api.kodakwest.workers.dev/api/parse/greek \
  -H "Content-Type: application/json" \
  -d '{"greek":"Κύριε ἐλέησον"}' | jq '{ cached, source }'
```
Expected: `{ "cached": false }` — falls through to LLM (or may match a verse containing these words)

### Word field population
```bash
curl -s -X POST https://bible-ai-api.kodakwest.workers.dev/api/parse/greek \
  -H "Content-Type: application/json" \
  -d '{"greek":"Ἐν ἀρχῇ ἦν ὁ λόγος"}' | jq '.words[0]'
```
Expected: `{ "word": "Ἐν", "lemma": "G1722", "pos": "preposition", "parsing": "", "gloss": "" }`

### Frontend check
Open https://bible-ai-api.kodakwest.workers.dev/#parse, enter Greek text, click Parse.
Expected: Response appears instantly. Word column shows Greek surface forms. Lemma shows Strong's numbers. Parsing shows case/number/gender. Gloss is empty (UI handles gracefully).

### Regression: LLM fallback still works
```bash
curl -s -X POST https://bible-ai-api.kodakwest.workers.dev/api/parse/greek \
  -H "Content-Type: application/json" \
  -d '{"greek":"τῇ τρίτῃ ἡμέρᾳ"}' | jq '.words[0]'
```
Expected: Returns LLM-parsed result with glosses populated.

## Out of Scope (Future)

- **Gloss data**: Adding English glosses from a lexicon. The morphology path returns empty gloss. LLM path still provides glosses.
- **OT Hebrew**: No morphology data exists for OT. All OT input falls through to LLM.
- **Word-level reverse index**: Building a lookup table from Greek word form → known analyses. Not needed until users submit non-verse text regularly.
- **Frontend changes**: The existing parser UI is compatible with the response format. No changes needed.
- **greek_normalized column**: Not implementing this unless LIKE matching proves insufficient. Start with simple LIKE on greek column.

## Implementation Order

1. Create `src/greek.ts` with normalization and word-alignment utilities
2. Add `searchVerseByGreekText` to `src/db.ts`
3. Rewrite `handleGreekParse` in `src/index.ts`
4. Build and verify: `npm run build` + `npx tsc --noEmit`
5. Deploy: `wrangler deploy`
6. Run verification tests (curl commands above)
7. Report results
