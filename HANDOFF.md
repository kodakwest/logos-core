---
title: "LogOS Core — Project State & Handoff"
artifact_type: Handoff
domain: "Cloudflare Workers; D1; TypeScript; Edge API"
systems: ["logos-core", "cloudflare-workers", "d1", "ai-search", "word_morphology"]
primary_entities: ["parse/greek endpoint", "word_morphology table", "verses table", "greek_cache", "src/greek.ts"]
last_updated: "2026-05-15"
status: active
---

# LogOS Core — Project Handoff

## Project Location
`/mnt/s/Projects/bible-ai-search/` — git repo on `main`, 2 commits, no remote

## Live URL
https://logos-core.kodakwest.workers.dev

## What This Is
A Cloudflare Workers app (Workers + D1 + Vectorize + Workers AI) serving a Bible study API with semantic search, verse text, Greek morphology, and an AI-powered assistant. Frontend SPA at the root URL.

## Current State (May 15, 2026)

### What's Working
- **7,959 NT verses** loaded in D1 with BSB, KJV, Greek text, and embeddings
- **139,476 morphology entries** loaded (per-word: Strong's lemma, POS)
- **Semantic search** via Vectorize index
- **Ask/Explain** endpoints via Workers AI (llama-4-scout)
- **Greek parse** `/api/parse/greek` — data-driven first, LLM fallback
- **Search, upload, status** endpoints all operational

### Parse Tool — Recent Changes (2 commits)
The parse handler now has a **data-first pipeline**:
1. Normalize input (strip diacritics, punctuation, lowercase)
2. Search `verses.greek` via LIKE with consonant-pattern fallback
3. If match found → return stored morphology (Strong's lemma, POS, case/number/gender)
4. If no match → fall through to LLM (cached in greek_cache)
5. Entire handler wrapped in triple-layer error handling — never returns HTML

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Worker routes + all endpoint handlers |
| `src/db.ts` | D1 queries: verse CRUD, morphology, search, greek cache |
| `src/greek.ts` | Greek text normalization + word↔morphology alignment |
| `src/ai.ts` | Workers AI: embeddings, Greek parsing, chat, ask/explain |
| `src/types.ts` | All TypeScript interfaces |
| `src/frontend/parser.tsx` | Parser UI (calls /api/parse/greek) |
| `wrangler.toml` | CF config: D1, Vectorize, AI, Assets bindings |

### Python Data Scripts
| Script | Purpose |
|--------|---------|
| `parse_btb_morph.py` | Parses BTB interlinear markdown → uploads morphology to API |
| `parse_opentext.py` | Parses OpenText NA28 XML → uploads morphology (richer data) |
| `upload_nt.py` | Batch uploads NT verse text (YAML from BTB files) |
| `fill_gaps.py` | Detects missing verses and uploads them |
| `retry_failed.py` | Retries chapters that failed with 503 |

### Known Issues

1. **Parsing fields sparse** — case/gender/number mostly null. The BTB morph_code parser (`parse_btb_morph.py:parse_morph_code()`) splits codes on `-` and expects 3+ segments, but NT codes like `N-NSF` (Noun-NominativeSingularFeminine) only produce 2 segments. Fix: rewrite `parse_morph_code` to handle 2-segment codes by extracting case/number/gender from the second segment's characters.

2. **Gloss empty for morphology path** — stored morphology has Strong's numbers but no English gloss. Sources available: OpenText NA28 XML has semantic domains; Strong's definitions are freely available.

3. **No OT Hebrew** — only NT Greek in the DB. All OT input falls through to LLM.

4. **OpenText NA28 data not uploaded** — `parse_opentext.py` exists and parses richer morphology (proper lemma, case, gender, number, semantic domains) but hasn't been run to upload yet. Would provide better data than BTB.

5. **No word-level reverse index** — currently only matches full verses. Can't handle arbitrary Greek word combinations that don't correspond to a stored verse.

### Next Steps (Priority Order)
1. Fix BTB morph_code parser → re-upload → better parsing fields
2. Run OpenText NA28 upload for richer morphology data
3. Add gloss data from Strong's lexicon
4. Build word-level reverse index for arbitrary Greek input

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/status` | Verse count, cache size |
| POST | `/api/upload/chapter` | Upload verse text + generate embedding |
| POST | `/api/upload/morphology` | Upload per-verse morphology |
| GET | `/api/verses/search?q=&book=&chapter=` | Keyword search |
| POST | `/api/verses/morphology` | Get morphology for a verse reference |
| POST | `/api/verses/semantic` | Vector similarity search |
| POST | `/api/parse/greek` | **Parse Greek text** (data-first, LLM fallback) |
| POST | `/api/ask` | Ask a question with RAG context |
| POST | `/api/explain` | Verse analysis with context |

## Infrastructure
- **Account:** Cloudflare enterprise (kodakwest)
- **Worker:** `logos-core` — deployed via `wrangler deploy` from S: drive
- **D1:** `bible-ai-db` — 7,959 verses, 139K morphology rows, greek_cache
- **Vectorize:** `bible-verse-embeddings` — 768-dim (bge-base-en-v1.5)
- **AI:** Workers AI with `@cf/meta/llama-4-scout-17b-16e-instruct`
- **Frontend:** Vite/React SPA, served via `env.ASSETS.fetch()`
- **Secrets:** None set directly — AI binding is automatic
