# LogOS Core — Build Spec

> **Goal:** Deployable Cloudflare Workers + Pages app that ingests Bible chapters from local BTB data, enables semantic search, and performs Greek parsing via Workers AI.
>
> **Project root:** `S:\Projects\bible-ai-search\` (mounts at `/mnt/s/Projects/bible-ai-search/` in WSL)
> **Workers subdomain:** `logos-core` (deploys to `logos-core.kodakwest.workers.dev`)
> **Deploy target:** Cloudflare Workers (not Pages for the API; static frontend served by Worker or Pages)

---

## Architecture

```
┌──────────────────────────────┐
│  Frontend (Vite React SPA)  │  ← served by Pages or Worker static asset
│  - Search bar               │
│  - Verse results cards       │
│  - Chapter upload tool       │
│  - Greek parser input        │
└──────────┬───────────────────┘
           │ fetch()
┌──────────▼───────────────────┐
│  Worker (logos-core)        │  ← wrangler deploy
│  POST /api/upload/chapter   │  ← reads BTB interlinear files
│  GET  /api/verses/search    │  ← keyword + semantic search
│  POST /api/parse/greek      │  ← Workers AI Greek parsing
│  GET  /api/status           │  ← stats
│  POST /api/verses/semantic  │  ← Vectorize search
└──────────┬───────────────────┘
           │
     ┌─────┴──────┬──────────┐
     ▼            ▼          ▼
┌─────────┐ ┌──────────┐ ┌──────────┐
│  D1 DB  │ │Vectorize │ │Workers AI│
│ (verses)│ │(embeds)  │ │(Llama 4) │
└─────────┘ └──────────┘ └──────────┘
```

## Files to Create

```
bible-ai-search/
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
├── src/
│   ├── index.ts            ← Worker entry: router + all endpoints
│   ├── db.ts               ← D1 queries
│   ├── btbutils.ts         ← BTB file format parser
│   ├── ai.ts               ← Workers AI helpers
│   ├── types.ts            ← Shared types
│   └── frontend/
│       ├── index.html       ← SPA entry
│       ├── app.tsx          ← React app
│       ├── search.tsx       ← Search view
│       ├── upload.tsx       ← Chapter upload view
│       ├── parser.tsx       ← Greek parser view
│       └── style.css        ← Dark theme styles
├── schemas/
│   ├── 001_create_verses.sql    ← D1 migration
│   └── 002_create_vectorize.sql ← Vectorize index setup
└── docs/
    └── API.md
```

## D1 Schema

### Migration 001: verses table

```sql
CREATE TABLE verses (
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

CREATE INDEX idx_verses_book_chapter ON verses(book, chapter);
CREATE INDEX idx_verses_book ON verses(book);
```

### Migration 002: greek_cache table

```sql
CREATE TABLE greek_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  greek_text TEXT UNIQUE NOT NULL,
  parsing TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Vectorize Index

```toml
# In wrangler.toml:
[[vectorize]]
binding = "VECTORIZE"
index_name = "bible-verse-embeddings"
dimensions = 768  # bge-base-en-v1.5
```

## Workers AI Models

| Task | Model | Notes |
|------|-------|-------|
| Embeddings | `@cf/baai/bge-base-en-v1.5` | 768-dim, fast |
| Greek parsing | `@cf/meta/llama-4-scout-hf` | 17B, instruct-following |

## Worker Endpoints

### POST /api/upload/chapter

Request:
```json
{
  "book": "Luke",
  "bookNumber": 42,
  "chapter": 1
}
```

Logic:
1. Look up BTB interlinear path: `/home/tsrwest/BTB/interlinear/{bookNumber} - {book}/{chapter}/`
2. Read all `.md` files sorted by verse number
3. Parse YAML frontmatter for each (kjv, bsb, greek, topics, pericope)
4. Batch insert into D1 (up to 100 verses per chapter)
5. For each verse, generate embedding via Workers AI (bge-base-en-v1.5) and upsert to Vectorize
6. Return: `{ versesInserted: number, errors: string[] }`

Error handling:
- If BTB directory doesn't exist for that book/chapter, return `{ error: "Chapter data not found in BTB export" }`
- Gracefully handle verses without Greek text (OT books)
- Skip duplicate verses (idempotent — verse-level upsert)

### GET /api/verses/search?q=...&book=...&chapter=...&limit=20

Logic:
1. If `q` provided: keyword search on bsb + kjv fields using LIKE
2. Optional `book` and `chapter` filters
3. Return verse results with book, chapter, verse, bsb, kjv, greek

Response:
```json
{
  "results": [
    { "id": 1, "book": "Luke", "chapter": 1, "verse": 5,
      "bsb": "In the time of Herod...", "kjv": "...",
      "greek": "Ἐγένετο ἐν ταῖς...",
      "score": 0.95 }
  ],
  "total": 1
}
```

### POST /api/verses/semantic

Request:
```json
{
  "query": "shepherds watching their flocks",
  "limit": 5
}
```

Logic:
1. Generate embedding for query via Workers AI
2. Query Vectorize for nearest neighbors
3. Fetch verse texts from D1 by embedding_id
4. Return ranked results

### POST /api/parse/greek

Request:
```json
{
  "greek": "Ἐγένετο ἐν ταῖς ἡμέραις Ἡρῴδου"
}
```

Logic:
1. Check greek_cache table for cached result
2. If miss: call Workers AI (Llama 4) with prompt:
   ```
   Parse this Greek NT text word-by-word. For each word provide:
   - Lemma (dictionary form)
   - Part of speech
   - Parsing (tense, voice, mood for verbs; case, number, gender for nouns)
   - A brief gloss
   
   Text: {greek}
   ```
3. Cache result in greek_cache
4. Return structured parsing

Response:
```json
{
  "words": [
    { "word": "Ἐγένετο", "lemma": "γίνομαι", "pos": "verb",
      "parsing": "aorist, middle, indicative, 3rd singular",
      "gloss": "became, happened" },
    ...
  ],
  "cached": true
}
```

## Frontend (React SPA)

### Views

1. **Search** — Default view. Search bar with book/chapter filters. Results as cards showing BSB + Greek toggle.

2. **Upload** — Form: select book (dropdown), enter chapter number, click "Upload". Shows progress + count of verses inserted. Preview of uploaded verses.

3. **Greek Parser** — Textarea for Greek text input, "Parse" button, word-by-word breakdown table: Word | Lemma | POS | Parsing | Gloss.

### Styling
- Dark theme (matching TARS aesthetic)
- Mobile-responsive
- Card-based verse display with expandable Greek text
- Loading states for all async actions

### Tech choices
- React 19 + Vite + TypeScript
- Single-page, client-side routing via hash (#search, #upload, #parse)
- fetch() direct to Worker API
- No Zustand needed — simple state per view

## Wrangler Config

```toml
name = "logos-core"
compatibility_date = "2026-05-13"
main = "src/index.ts"

[observability]
enabled = true

[[d1_databases]]
binding = "DB"
database_name = "bible-ai-db"
database_id = "create-on-first-deploy"

[[vectorize]]
binding = "VECTORIZE"
index_name = "bible-verse-embeddings"

[ai]
binding = "AI"

[env.production]
vars = { BTB_PATH = "/home/tsrwest/BTB" }
```

## Deployment Steps

1. `npm create vite@latest bible-ai-search -- --template react-ts`
2. `cd bible-ai-search && npm install`
3. `wrangler d1 create bible-ai-db` → get database_id, insert into wrangler.toml
4. `wrangler vectorize create bible-verse-embeddings --dimensions 768 --metric cosine`
5. Apply D1 migrations
6. `npm run build` (frontend)
7. `wrangler deploy` (worker)
8. Test: `curl https://logos-core.kodakwest.workers.dev/api/status`
9. Upload a chapter via the upload UI
10. Search + parse test

## Gotchas / Edge Cases

- **BTB files are local to WSL** — the Worker reads them at upload time via a local path. For production, the upload endpoint reads the mount at `/home/tsrwest/BTB/...`. On WSL, the S: drive is at `/mnt/s/`.
- **YAML frontmatter** — each verse file has YAML between `---` markers. Use a simple key-value parser (not gray-matter — avoid npm dependency). Just regex for `key: value` lines.
- **Old Testament** — no Greek text in interlinear. Handle gracefully.
- **Vectorize free tier** — 50k vectors. 31k verses in NT, ~23k in OT. Under limit.
- **Workers AI free tier** — 10k requests/day. The Greek parser will be the heavy user. Cache aggressively.
- **Duplicate uploads** — verse-level upsert on (book, chapter, verse) combo. Use INSERT OR REPLACE.
- **No server-side rendering** — SPA fetches from Worker API.
- **Cold start** — Workers AI has ~1-2s cold start on embedding calls. Acceptable for MVP.

## Files to Create (Build Order)

| # | File | Purpose |
|---|------|---------|
| 1 | `wrangler.toml` | Worker config with D1 + Vectorize + AI bindings |
| 2 | `src/types.ts` | Shared types for Verse, ParseResult, etc. |
| 3 | `src/db.ts` | D1 query helpers (insert verse, search, get status) |
| 4 | `src/btbutils.ts` | BTB file system reader + YAML frontmatter parser |
| 5 | `src/ai.ts` | Workers AI wrapper (embeddings + Greek parsing) |
| 6 | `src/index.ts` | Main Worker router with all endpoints |
| 7 | `package.json` | Dependencies (wrangler, typescript) |
| 8 | `tsconfig.json` | TypeScript config for Workers |
| 9 | `.gitignore` | node_modules, dist, wrangler state |
| 10 | `src/frontend/index.html` | SPA entry |
| 11 | `src/frontend/app.tsx` | Main React app with routing |
| 12 | `src/frontend/search.tsx` | Search view |
| 13 | `src/frontend/upload.tsx` | Chapter upload view |
| 14 | `src/frontend/parser.tsx` | Greek parser view |
| 15 | `src/frontend/style.css` | Dark theme styles |
| 16 | `vite.config.ts` | Vite config for Pages build |
| 17 | `README.md` | Setup instructions |

## Out of Scope (MVP Skip)

- User auth / API keys
- Multi-version comparison (KJV vs BSB vs ESV side-by-side)
- Full-text search engine (LIKE is fine for MVP)
- Batch upload all 66 books at once
- Real-time sync with BTB changes
- Strong's number integration
- Morphology charts / visualizations
