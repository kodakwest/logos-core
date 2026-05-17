---
title: "LogOS — Roadmap & Features"
artifact_type: Architecture_Plan
source_context: Consolidated from 5 planning artifacts + 2 rebranding sessions (May 15-17, 2026) covering brand identity, phased execution, auth strategy, and ecosystem architecture
domain: Bible technology; Cloudflare; brand identity; product strategy
systems: LogOS Core; LogOS Shepherd; LogOS Roundtable; Cloudflare Workers; D1; Vectorize; Workers AI; Cloudflare Pages; MCP Gateway; Hermes Agent
primary_entities: LogOS; LogOS Core; LogOS Shepherd; LogOS Roundtable; The Open Path; Auth Layer; Hub Portal; MCP Gateway; Harvest Ridge Sermon Map
last_updated: 2026-05-17
status: active
---

# LogOS — Roadmap & Features

> **LogOS** — "The Operating System for Truth"  
> Rebrand of "Bible AI Search" into a unified ecosystem of Bible tools.
> Primary mark: **The Open Path** — an open Bible forming a road.

---

## 1. Brand Identity

### Name & Tagline

| Element | Value |
|---------|-------|
| Name | **LogOS** (Logos + OS) |
| Tagline | "The Operating System for Truth" |
| Logo | The Open Path (Bible pages shaping a winding road) |

### Logo Lockup

Three variants cycle via slow fade (7.5s loop, 2.5s each):

| Variant | Characters | Tagline | Meaning |
|---------|-----------|---------|---------|
| L**ó**gOS | L, ó, g, O, S | The Illuminated Word | Spark of discovery, divine inspiration |
| **Λ**ogOS | Λ, o, g, O, S | The Upward Path | Mountain peak, journey forward |
| LogO**Σ** | L, o, g, O, Σ | The Foundational System | Structure, completeness |

### Color System

| Role | Hex | Usage |
|------|-----|-------|
| Divine Gold | `#d4af37` | Primary brand, headings, logos |
| Tech Blue | `#4da8da` | Secondary, interactive elements |
| Dark BG | `#0b0d0e` | Page background |
| Card BG | `#131618` | Panel/surface backgrounds |
| Ink | `#f4f4f5` | Primary text |
| Muted | `#82828b` | Secondary text, metadata |

### Typography

| Role | Font | Weight |
|------|------|--------|
| Logotype | Playfair Display | 700 |
| Headings | Playfair Display | 600 |
| Body | Inter | 400 |
| Code | JetBrains Mono | 400 |

### Ecosystem Products

| Product | Role | Primary Users | Backend |
|---------|------|--------------|---------|
| **LogOS Core** | Central hub — search, Q&A, Bible tools | All church members | Workers + D1 + Vectorize + AI |
| **LogOS Shepherd** | Kids ministry — parenting lessons | Parents, kids | None (static SPA, consumes Core API) |
| **LogOS Roundtable** | Sermon discussion groups | Small groups | Workers + D1 + Vectorize + AI (Phase 2) |

### Brand Assets (Created)

| Asset | Location |
|-------|----------|
| Brand Media Kit (v3) | `/mnt/s/Projects/logos-core/rebrand-moodboard.html` |
| Loading Animation (final) | `/mnt/s/Projects/logos-core/logos-loading-animation.html` |
| Ecosystem Landscape | `/mnt/s/Projects/logos-core/logos-rebrand-and-ecosystem-landscape.html` |
| Product Blueprints | `/mnt/s/Projects/logos-core/logos-product-blueprints.html` |
| Shared Backend Analysis | `/mnt/s/Projects/logos-core/logos-shared-backend-analysis.html` |
| UI Concepts (Jules) | `/mnt/s/Projects/logos-core/logos-ui-concept.html` |
| API Landscape Diagram | `/mnt/s/Projects/logos-core/logos-api-landscape.html` |
| Bible API Research KB | `/mnt/s/Projects/logos-core/bible-api-research-kb/` |

---

## 2. Current State Assessment

| Aspect | LogOS Core (Hub) | Shepherd (Kids) | Roundtable (Sermons) |
|--------|-----------------|-----------------|---------------------|
| **Backend** | ✅ Workers + D1 + Vectorize + AI — 9 API endpoints | ❌ None (fully static) | ❌ None (static scaffold) |
| **Frontend** | ⚠️ Minimal — 3 views (search, parse, upload) | ✅ Gold MVP deployed | ⚠️ Scaffold — 4 sample guides |
| **Data** | ✅ 7,959 NT verses, 139K morphology, 15.9K vectors | ✅ 13 topics, 98 verses, 7 age tiers | ❌ No data (needs sermon map import) |
| **Auth** | ❌ **None** — critical blocker | ⚠️ N/A (static site) | ⚠️ N/A (not deployed) |
| **CORS** | ❌ Wildcard `*` on all endpoints | ✅ N/A | ✅ N/A |
| **Deployment** | ✅ `logos-core.kodakwest.workers.dev` | ✅ `shepherdparentcompanion.pages.dev` | ❌ Not deployed |
| **Cross-linking** | ❌ None | ❌ None | ❌ None |

### Current Architecture

```
User → logos-core.workers.dev
         │
         ├─ /api/ask              POST   RAG Q&A          ⚠ No auth
         ├─ /api/explain          POST   Verse deep-dive   ⚠ No auth
         ├─ /api/status           GET    DB stats          Public
         ├─ /api/verses/search    GET    Keyword search    Public
         ├─ /api/verses/semantic  POST   Vector search     ⚠ No auth
         ├─ /api/verse/morphology POST   Word morphology   Public
         ├─ /api/parse/greek      POST   Greek analysis    ⚠ No auth
         ├─ /api/upload/chapter   POST   Ingest chapter    ⚠ PUBLIC — admin endpoint
         └─ /api/upload/morphology POST  Ingest morphology ⚠ PUBLIC — admin endpoint
```

### Critical Issues (Codex Architecture Review — May 15)

| Severity | Issue | Details |
|----------|-------|---------|
| 🔴 Critical | No auth on AI-cost/admin endpoints | Anyone can mutate D1, burn AI credits |
| 🔴 Critical | Blanket CORS `*` on POST endpoints | Any website can trigger browser-originated abuse |
| 🟡 High | Serial upload (D1→AI→Vectorize per verse) | No rollback on partial failure — state drifts |
| 🟡 High | Greek search uses `LIKE '%...%'` | Can't use prefix index — slow at scale |
| 🟡 High | No timeout/retry around provider calls | Workers AI failures cascade silently |
| 🟡 High | Embedding state can go inconsistent | Verse stored without embedding_id on AI failure |
| 🟡 High | Error messages leak internals | D1/Vectorize/AI errors returned to caller |
| 🟡 High | Request body sizes unbounded | No max verses/words/query length enforcement |
| 🟡 High | No pagination on search | No offset/cursor — clients can't page results |
| 🟡 High | Upload leaves orphaned vectors | Vectorize upsert succeeds but D1 update may fail |

---

## 3. Gap Analysis

### 🔴 Critical (blocks public launch)

1. **No auth on any endpoint** — Zero auth, wildcard CORS, unbounded inputs. Anyone can burn AI credits or mutate data.
2. **No auth strategy decided** — Cloudflare Access vs lightweight JWT? Public read vs full auth?
3. **OpenRouter/Workers AI cost exposure** — Without auth, `/api/ask` is publicly callable.

### 🟡 High (blocks unification)

4. **No hub frontend** — LogOS Core has no landing page, no nav to Shepherd/Roundtable
5. **Shepherd has no API** — Can't query or surface Shepherd content programmatically
6. **Roundtable not deployed** — Can't link to something that doesn't exist at a URL
7. **No shared content layer** — Search across products isn't possible
8. **Kids ministry section undefined** — How does Shepherd surface in the hub? Link? Embed? Search?

### 🟢 Medium (important but not blocking)

9. **OT Hebrew not ingested** — NT Greek only
10. **No content pipeline** — All content manually curated
11. **No analytics** — No visibility into usage
12. **Roundtable incomplete** — Missing 2 guides, markdown export, deeperDive rendering

---

## 4. Phased Execution Roadmap

### Phase 1: Foundation (Now)

**Goal:** Secure the API, rebrand to LogOS, launch the hub portal.

| # | Task | Details | Effort | Priority |
|---|------|---------|--------|----------|
| 1.1 | **Auth Layer** | Cloudflare Access (admin UI) + API key (service-to-service). Restrict CORS to specific origins. Rate limiting (AI: 10/min, search: 30/min). | **High** (450-850 LOC) | **P0** |
| 1.2 | **Rename GitHub repo** | `bible-ai-search` → `logos-core` | Low (config) | P1 |
| 1.3 | **Rename Workers project** | Update `wrangler.toml` name, redeploy to `logos-core.kodakwest.workers.dev` | Low (config) | P1 |
| 1.4 | **Hub Portal frontend** | Redesign as portal with nav sections. Add Q&A UI (POST /api/ask), verse deep-dive UI (POST /api/explain), Kids Ministry section (→ Shepherd link), Sermon Study Coming Soon. Apply LogOS brand. Add loading animation. | **Med-High** (1,200-2,000 LOC) | P1 |
| 1.5 | **API improvements** | New endpoints: GET /api/verses/:ref, GET /api/verses/chapter. Pagination (offset/cursor). Batch verse lookup for Shepherd. | Medium (300-600 LOC) | P1 |
| 1.6 | **Shepherd integration** | Batch verse endpoint on Core. Shepherd build script fetches from Core API. Add "Part of LogOS" footer. | Medium (550-1,000 LOC) | P2 |
| 1.7 | **MCP Gateway (prototype)** | Cloudflare Worker wrapping Core endpoints as MCP tools. Wire into Hermes Agent. | **High** (1,400-2,500 LOC) | P2 |
| 1.8 | **Ingestion improvements** | Batch D1 writes. Embedding status tracking. Content hashes. Retry/timeout budgets. | Medium (300-500 LOC) | P2 |

#### Architecture Diagram — Phase 1 Target State

```
User (browser / phone / agent)
        │
        ▼
┌───────────────────────────────────────────────┐
│           Auth Gateway                        │
│  Cloudflare Access (admin UI endpoints)       │
│  API Key header (service-to-service)          │
│  Rate limiting (per-endpoint budgets)         │
│  CORS restricted to allowed origins           │
└──────────────────┬────────────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────────────┐
│          LogOS Core Worker                     │
│  logos-core.kodakwest.workers.dev              │
│                                               │
│  /api/status          GET   Public            │
│  /api/verses/search   GET   Public            │
│  /api/verses/:ref     GET   Public            │  ← NEW
│  /api/verses/chapter  GET   Public            │  ← NEW
│  /api/verse/morphology POST Public            │
│  /api/ai/ask          POST  Auth required     │  ← MOVED
│  /api/ai/explain      POST  Auth required     │  ← MOVED
│  /api/ai/parse/greek  POST  Auth required     │  ← MOVED
│  /api/admin/upload/*  POST  Admin key         │  ← MOVED
│  /api/admin/reindex   POST  Admin key         │  ← NEW
│                                               │
│  ┌────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  D1    │  │Vectorize │  │  Workers AI   │  │
│  │ verses │  │  768-dim │  │ Llama 4 Scout │  │
│  │ morph  │  │ 16K vecs │  │ BGE embeddings│  │
│  │ content│  │ versioned│  │ retry budgets │  │
│  │ hashes │  │          │  │              │  │
│  └────────┘  └──────────┘  └──────────────┘  │
└──────────────────┬────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│ LogOS Shepherd   │   │ LogOS Roundtable │
│ (current)        │   │ (Phase 2)       │
│ Static SPA       │   │ Not deployed    │
│ Consumes Core    │   │ Coming Soon     │
│ API via build    │   │                 │
└─────────────────┘   └─────────────────┘

┌───────────────────────────────────────────────┐
│    MCP Gateway (Worker — prototype)           │
│  Tools: get_verse, search_verses, ask_bible,  │
│  explain_verse, get_shepherd_topic            │
│  URI: logos://verses/ref, logos://shepherd/..│
│  Wired into Hermes Agent config               │
└───────────────────────────────────────────────┘
```

---

### Phase 2: Roundtable Launch

**Goal:** Full sermon knowledge system with backend, frontend, and Harvest Ridge data.

| # | Task | Details | Effort | Priority |
|---|------|---------|--------|----------|
| 2.1 | **D1 schema design** | Tables: `series`, `sermons`, `sermon_verses`, `guides`, `guide_responses`, `progress` | Low (schema) | P0 |
| 2.2 | **Workers API** | 10+ endpoints: CRUD series/sermons, semantic search, guide CRUD, AI generation, progress tracking | **Very High** (2,800-5,000 LOC) | P0 |
| 2.3 | **Vectorize index** | `sermon-embeddings` for semantic search across sermon content | Low (config) | P0 |
| 2.4 | **Data import** | Harvest Ridge Sermon Map: 28 series, 124 sermons, 525 YouTube videos | Medium (script) | P0 |
| 2.5 | **Frontend — Series browser** | Grid of series cards with sermon count, date range | Medium | P1 |
| 2.6 | **Frontend — Sermon browser** | List with filters (series, date, book, search), semantic search | Medium | P1 |
| 2.7 | **Frontend — Sermon detail** | YouTube embed, Spotify player, outline, cross-referenced verses, guide link | Medium | P1 |
| 2.8 | **Frontend — Guide form** | Interactive form with section-by-section questions, progress check-off | **High** | P1 |
| 2.9 | **Frontend — Gamification** | Series completion badges, progress rings, session tracking | Medium | P2 |
| 2.10 | **Print/export** | Print-friendly layout, markdown export | Medium | P2 |
| 2.11 | **Deploy** | Cloudflare Pages, custom domain or subdomain | Low | P0 |
| 2.12 | **Update Hub Portal** | Replace "Coming Soon" with live Roundtable links | Low | P1 |

#### Roundtable Data Model

```sql
-- Core content
series (id, name, description, start_date, end_date, keywords)
sermons (id, series_id, title, date, youtube_id, spotify_id,
         duration_minutes, outline_text, transcript_text, embedding_id)
sermon_verses (id, sermon_id, book, chapter, verse, context_note)

-- Guides & engagement
guides (id, sermon_id, title, sections_json, published)
guide_responses (id, guide_id, user_session, question_id, response_text, created_at)
progress (id, user_session, series_id, sermon_id, guide_id, completed, last_updated)
```

---

### Phase 3: Ecosystem (Future)

| # | Item | Trigger |
|---|------|---------|
| 3.1 | OT Hebrew ingestion | After auth + hub are solid |
| 3.2 | BibleFlow → Roundtable pipeline (sermon transcript → AI guide) | After Roundtable deployed |
| 3.3 | OpenText NA28 Greek syntax ingestion (73 MB XML) | After pipeline is solid |
| 3.4 | Analytics across ecosystem | After launch, when there's traffic |
| 3.5 | Custom domain (`logos.bible`?) | When ready for public |
| 3.6 | MCP Gateway (full) — Shepherd + Roundtable tools | After Shepherd API + Roundtable launch |

---

## 5. Workstream Details

### WS1: Core Rebrand

| Detail | Value |
|--------|-------|
| **Effort** | Low (180-350 LOC) |
| **Files** | `wrangler.toml`, `package.json`, `src/frontend/app.tsx`, `index.html`, `README.md`, `AGENTS.md` |
| **Dependencies** | None |
| **Risks** | Workers URL change may break existing links. Coordinate deploy with DNS if custom domain. |
| **Status** | ⏳ Not started |

### WS2: Auth Layer

| Detail | Value |
|--------|-------|
| **Effort** | High (450-850 LOC) |
| **Files** | `src/index.ts`, `wrangler.toml` (secrets), new auth helper module, all 3 workers |
| **Dependencies** | Cloudflare Access dashboard config (manual step for Mike) |
| **Risks** | API key distribution to static sites (use Pages Proxy). Cloudflare Access setup is manual. |
| **Auth Model Recommendation** | Two-tier: Cloudflare Access (admin UI endpoints) + API key via `Authorization: Bearer` header (service-to-service). Public read endpoints open, AI/write endpoints require auth. API key delivered to Shepherd via Cloudflare Pages Proxy (rewrite `/api/*` → worker, adds key server-side). |
| **Rate Limits** | AI endpoints: 10 req/min per IP. Search: 30 req/min. Use Cloudflare WAF or in-Worker KV sliding window. |
| **CORS** | Restrict to: `shepherdparentcompanion.pages.dev`, `logos-core.pages.dev`, `tars-20q.pages.dev` |
| **Status** | ⏳ Not started — **highest priority** |

### WS3: Hub Portal Frontend

| Detail | Value |
|--------|-------|
| **Effort** | Med-High (1,200-2,000 LOC) |
| **Files** | `src/frontend/app.tsx`, new Q&A view, new Explain view, portal sections, `styles.css` |
| **Dependencies** | Auth layer (don't ship Q&A without auth) |
| **UI Pattern** | Adopted from gslogimaker plugin: dynamic code-block rendering (```verse → `/api/ai/explain` → togglable KJV/BSB/Greek/morphology layers) |
| **Sections** | Bible Study (Search, Parse, Q&A, Explain), Kids Ministry (→ Shepherd link), Sermon Study (Coming Soon + roadmap) |
| **Status** | ⏳ Not started |

### WS4: Shepherd Integration

| Detail | Value |
|--------|-------|
| **Effort** | Medium (550-1,000 LOC) |
| **Files (Core)** | `src/index.ts` (new batch verse endpoint) |
| **Files (Shepherd)** | `scripts/populate-scripture-text.ts`, `src/views/ScriptureExplorer.tsx`, `src/App.tsx` (footer) |
| **Dependencies** | Auth layer (Shepherd needs API key for Core calls) |
| **Status** | ⏳ Not started |

### WS5: Roundtable Backend

| Detail | Value |
|--------|-------|
| **Effort** | Very High (2,800-5,000 LOC) |
| **New Project** | `logos-roundtable` — new Workers + D1 + Vectorize project |
| **Data** | Harvest Ridge Sermon Map: 28 series, 124 sermons, 525 YouTube videos |
| **Dependencies** | Phase 1 must be complete (auth patterns, deploy pipeline) |
| **Status** | ⏳ Not started |

### WS6: Roundtable Frontend

| Detail | Value |
|--------|-------|
| **Effort** | High (2,200-4,000 LOC) |
| **Stack** | React 19 + Vite 8 + Tailwind 4 (same as Shepherd) |
| **Dependencies** | Roundtable Backend (WS5) must exist |
| **Status** | ⏳ Not started |

### WS7: MCP Gateway

| Detail | Value |
|--------|-------|
| **Effort** | High (1,400-2,500 LOC) |
| **Tools to expose** | `get_verse(ref)`, `search_verses(query)`, `ask_bible(query, deep)`, `explain_verse(ref)`, `get_shepherd_topic(id)`, `get_sermon(id)`, `search_sermons(query)`, `get_guide(id)` |
| **URI schema** | `logos://verses/ref`, `logos://shepherd/topics/id`, `logos://roundtable/sermons/id`, `logos://roundtable/guides/id` |
| **Integration** | Wire into Hermes Agent `config.yaml` under `hermes-mcp-servers` |
| **Status** | ⏳ Prototype planned for Phase 1 |

### WS8: Content Pipeline (Future)

| Detail | Value |
|--------|-------|
| **Effort** | Very High (3,500-8,000 LOC) |
| **Items** | OT Hebrew, BibleFlow→Roundtable, NA28 XML, analytics, custom domain |
| **Status** | 📅 Deferred to Phase 3 |

---

## 6. Key Decisions (Unresolved)

| Decision | Options | Recommended | Notes |
|----------|---------|-------------|-------|
| **Auth model** | Cloudflare Access vs lightweight JWT | Cloudflare Access for admin UI, API key for service-to-service | Manual dashboard setup needed for Access |
| **Domain strategy** | Workers.dev subdomains vs custom domain | Keep Workers.dev for now, acquire `logos.bible` later | Custom domain = trust signal |
| **GitHub repos** | Rename existing vs create new | Rename `bible-ai-search` → `logos-core`. Create new `logos-roundtable` | Shepherd can keep current repo |
| **Roundtable timeline** | Weeks vs months | Weeks for backend scaffold, months for full frontend + gamification | Affects Coming Soon messaging |
| **Static site API key** | Pages Proxy vs Pages Function vs expose public reads | Pages Proxy (clean, no cold start) | Don't put API key in client bundle |

---

## 7. External API Reference

Findings from 3 research sessions (May 15-17):

| API | Auth | Translations | Use Case |
|-----|------|-------------|----------|
| **AO Lab** (`bible.helloao.org`) | None | 1,000+ | ★ Bulk sync source for translation breadth |
| **BibleQL** (`bibleql.dev`) | Free | 43 (GraphQL) | Roundtable complex lookups |
| **bible-api.com** | None | KJV, WEB | Quick reference lookups |
| **getbible.net** | None | 40+ | Multi-translation addition |
| **api.bible** (Life.Church) | Free key | 50+ | Future addition |
| **ESV API** | Free key | ESV only | Niche (ESV-specific needs) |
| **bolls.life** | ❌ Rejected | — | No REST API, React SPA, Cloudflare blocks |

**Conclusion:** Your BTB interlinear data is superior to all free APIs in depth (morphology, parsing, text criticism). Use AO Lab for translation breadth only. See `knowledge/bible-api-research.md` (vault) or `bible-api-research-kb/` (repo) for full details.

---

## 8. Reference Materials

| Document | Location | Purpose |
|----------|----------|---------|
| Rebrand Plan | `.hermes/plans/logos-rebrand-and-ecosystem.md` | Brand identity, phased task lists, visual spec |
| Scope & LOE | `logos-scope-and-loe.md` | 8 workstreams with detailed tasks + LOC estimates |
| Auth Plan | `.hermes/plans/2026-05-15_bible-graph-shepherd-auth-plan.md` | Two-tier auth, CORS, rate limiting, deep-dive scope |
| Unification Strategy | `.hermes/plans/bible-unification-strategy.md` | Phase 1/2 rollout, gap analysis |
| Ecosystem Handoff | `knowledge/logos-ecosystem-handoff.md` | Session handoff, architecture decisions, execution order |
| Architecture Review | `knowledge/logos-core-kb/architecture-review.md` | Codex audit — 23 findings (1C, 7H, 10M, 5L) |
| Shared Backend Analysis | `logos-shared-backend-analysis.html` | Options A–E for shared backend (MCP Gateway selected) |
| API Research KB | `bible-api-research-kb/index.html` | Full KB with diagram of all external API candidates |
| Harvest Ridge Sermon Map | `S:\Resources\harvest-ridge-sermon-map.html` | 28 series, 124 sermons, 525 videos — Roundtable seed data |

---

## Graph Seed: Entity Relationships

logos -> is -> brand-name
logos-core -> serves_as -> central-hub
logos-core -> hosts -> bible-study-portal
logos-core -> links_to -> logos-shepherd
logos-core -> links_to -> logos-roundtable
logos-core -> requires -> auth-layer
logos-shepherd -> provides -> kids-ministry-content
logos-roundtable -> provides -> sermon-knowledge-system
logos-roundtable -> indexes -> harvest-ridge-sermons
logos-roundtable -> uses -> workers-ai
auth-layer -> split_into -> cloudflare-access
auth-layer -> split_into -> api-key-auth
mcp-gateway -> wraps -> logos-core
mcp-gateway -> wraps -> logos-shepherd
mcp-gateway -> wraps -> logos-roundtable
the-open-path -> is -> primary-logo
btb-interlinear -> feeds -> logos-core

## Retrieval Keywords
logos, roadmap, features, phased plan, rebrand, auth layer, hub portal, shepherd, roundtable, mcp gateway, ecosystem, cloudflare access, api key, cors, rate limiting, harvest ridge sermon map, gslogimaker, brand identity, the open path, workstreams, loe estimates, content pipeline

## Boundary Notes
This document is a consolidated roadmap — it synthesizes all planning artifacts into one authoritative reference. It does NOT contain implementation code, detailed component specs, or database DDL. Those are downstream work items referenced in the individual workstream docs. Auth implementation specifics (Cloudflare Access dashboard steps, exact rate limit config) are in `2026-05-15_bible-graph-shepherd-auth-plan.md`.
