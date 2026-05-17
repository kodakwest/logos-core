# LogOS Ecosystem — Scope & Level of Effort

## Overview
Rebrand "Bible AI Search" → **LogOS Core**, unify with **LogOS Shepherd** (kids ministry) and **LogOS Roundtable** (sermon study) under a common ecosystem. Deploy an **MCP Gateway** for AI agent access.

---

## Workstream 1: LogOS Core Rebrand

**Current state:** Workers project at bible-ai-api.kodakwest.workers.dev, repo kodakwest/bible-ai-search, Vite React frontend with 3 views (search, parse, upload).

### Tasks
1.1 Rename GitHub repo to `logos-core` (or create new + migrate)
1.2 Update wrangler.toml `name` from `bible-ai-api` to `logos-core`
1.3 Re-deploy to Cloudflare Workers under new name
1.4 Update frontend: title, favicon, meta tags, app name
1.5 Apply brand colors (gold #d4af37 accent, teal/blue secondary, dark #0b0d0e bg)
1.6 Update README.md with new brand description
1.7 Update AGENTS.md with LogOS brand context

**Files affected:** wrangler.toml, src/frontend/app.tsx, src/frontend/index.html, package.json (name field), README.md, AGENTS.md

---

## Workstream 2: Auth Layer

**Current state:** Zero auth on all endpoints. CORS is wildcard. Anybody can call any endpoint including /api/ask (costs AI credits) and /api/upload/* (data mutation).

### Tasks
2.1 Design auth strategy (recommend: public read on verse/status endpoints, auth required on /api/ask, /api/explain, /api/upload/*, /api/parse/greek)
2.2 Implement auth middleware in src/index.ts
2.3 Rate limiting on public endpoints
2.4 CORS hardening (restrict from * to specific origins)
2.5 Auth integration testing

**Files affected:** src/index.ts, wrangler.toml (maybe secrets), new auth helper module

---

## Workstream 3: Hub Portal Frontend

**Current state:** Minimal React SPA with 3 hash-routed views (search, parse, upload). No landing page, no navigation between sections, no Q&A or Explain UIs.

### Tasks
3.1 Redesign layout as portal with section navigation (Bible Study, Kids Ministry → Shepherd, Sermon Study → Roundtable)
3.2 Add Q&A interface (POST /api/ask) — query input, streaming answer display, cited sources
3.3 Add verse deep-dive interface (POST /api/explain) — verse display with context, morphology, AI analysis
3.4 Add Kids Ministry section with description + external link to shepherdparentcompanion.pages.dev
5.5 Add Sermon Study Coming Soon section with vision/roadmap content
3.6 Add loading animation (already built: 3-variant LogOS fade cycle)
3.7 Responsive mobile navigation

**Files affected:** src/frontend/app.tsx, src/frontend/search.tsx, new files for Q&A, Explain, portal sections, style.css

---

## Workstream 4: LogOS Shepherd Integration

**Current state:** Shepherd is a fully static SPA at shepherdparentcompanion.pages.dev. 13 topics with 98 verses baked into JSON files at build time from BTB data.

### Tasks
4.1 Add batch verse lookup endpoint to LogOS Core: POST /api/verses/by-ref (accept array of {book, chapter, verse}, return verse text)
4.2 Update Shepherd build script (scripts/populate-scripture-text.ts) to fetch from Core API instead of parsing BTB files
4.3 Update Shepherd's Scripture Explorer component to query Core's /api/verses/search at runtime
4.4 Apply LogOS brand footer/link to Shepherd ("Part of LogOS ecosystem")

**Files affected (Shepherd):** scripts/populate-scripture-text.ts, src/views/ScriptureExplorer.tsx, src/App.tsx (footer)
**Files affected (Core):** src/index.ts (new endpoint), src/types.ts

---

## Workstream 5: LogOS Roundtable Backend

**Current state:** Static React SPA with 4 sample guides. Not deployed. No backend. No data.

### Tasks
5.1 **Database design** — D1 tables:
    - `series` (id, name, description, start_date, end_date, keywords)
    - `sermons` (id, series_id, title, date, youtube_id, spotify_id, duration_minutes, outline_text, transcript_text, embedding_id)
    - `sermon_verses` (id, sermon_id, book, chapter, verse, context_note)
    - `guides` (id, sermon_id, title, sections_json, published)
    - `guide_responses` (id, guide_id, user_session, question_id, response_text, created_at)
    - `progress` (id, user_session, series_id, sermon_id, guide_id, completed, last_updated)
5.2 **Workers API** — routes:
    - GET/POST /api/series — list/create series
    - GET /api/series/:id — series detail with sermon list
    - GET /api/sermons — list with filters (series, book, date range, search)
    - GET /api/sermons/:id — sermon detail with outline, verses, media links
    - POST /api/sermons/semantic — vector search across sermon content
    - GET /api/guides/:id — guide with sections and questions
    - POST /api/guides/generate — AI generate guide from sermon (Workers AI)
    - POST /api/guides/:id/response — save user/group responses
    - GET /api/progress/:session — get user/group progress
    - POST /api/import/sermon-map — import existing Harvest Ridge sermon map data
5.3 **Data import** — script to parse existing Harvest Ridge Sermon Map HTML (28 series, 124 sermons, 525 videos) and populate D1
5.4 **Vectorize index** — "sermon-embeddings" for semantic search across sermon content
5.5 **Workers AI integration** — guide generation from sermon transcript/outline using Llama 4 Scout
5.6 **Media integration** — YouTube embed player, Spotify episode player (API keys/config)

**New project:** /mnt/s/Projects/logos-roundtable/ (new Workers project)

---

## Workstream 6: Roundtable Frontend

**Current state:** Scaffold React SPA with 4 sample guides (from existing roundtable repo). Not deployed.

### Tasks
6.1 Port existing roundtable frontend into new project, rebrand as LogOS Roundtable
6.2 Series browser — grid of series cards with sermon count, date range
6.3 Sermon browser — list with filters (series, date, book, search), semantic search
6.4 Sermon detail page — YouTube embed, Spotify player, outline, cross-referenced verses, link to guide
6.5 Guide page — interactive form with section-by-section questions, progress check-off
6.6 Gamification — series completion badges, progress rings, session tracking
6.7 Print-friendly layout, export options
6.8 Deploy to Cloudflare Pages

**Files:** Full new frontend in logos-roundtable repo

---

## Workstream 7: MCP Gateway

**Current state:** Hermes Agent has native MCP client support (pharm-mcp, etc.). No LogOS MCP server exists.

### Tasks
7.1 Create MCP server as Cloudflare Worker
7.2 Expose tools:
    - `get_verse(ref)` — verse text by reference
    - `search_verses(query)` — semantic search
    - `ask_bible(query, deep)` — AI Q&A
    - `explain_verse(ref)` — verse deep-dive
    - `get_shepherd_topic(id)` — parenting topic
    - `get_sermon(id)` — sermon with media
    - `search_sermons(query)` — semantic sermon search
    - `get_guide(id)` — discussion guide
7.3 Expose resources (URI schema: logos://verses/ref, logos://shepherd/topics/id, logos://roundtable/sermons/id, logos://roundtable/guides/id)
7.4 Wire into Hermes Agent config (hermes-mcp-servers in config.yaml)
7.5 Test with TARS: "get me John 3:16" via MCP tool call

**Files:** New Cloudflare Workers project for MCP server, config.yaml update

---

## Workstream 8: Content Pipeline (Future)

8.1 OT Hebrew ingestion into LogOS Core D1
8.2 BibleFlow → Roundtable guide generation workflow (sermon transcript → AI guide)
8.3 OpenText NA28 Greek morphology enhancement
8.4 Analytics across ecosystem
8.5 Custom domain setup

---

## LOE Guidelines
For each workstream, estimate:
- **Files changed** — count of source files
- **Lines of code** — approximate new/modified
- **Complexity** — Low / Medium / High / Very High
- **Risks** — what could go wrong
- **Dependencies** — what must be done first
- **Suggested order** — if workstreams overlap
