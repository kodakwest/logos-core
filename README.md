# LogOS Core — MVP 1.0 🥇

> **The Operating System for Truth.**

LogOS Core is a Cloudflare Workers + Vite React app for biblical search, Greek parsing, and AI-assisted study. It is the central scripture data and study surface for the LogOS ecosystem.

**Status:** MVP 1.0 — Gold (May 17, 2026)
**Live:** https://logos-core.com
**Workers subdomain:** https://logos-core.kodakwest.workers.dev

## Features

- **Magic Link Auth** — D1-backed sessions, email-based login, rate limited
- **Keyword Search** — Search verses by book, chapter, or keyword
- **Semantic Search** — Vectorize-powered meaning-based verse lookup
- **Greek Parser** — 3-tier pipeline (D1 morphology → cache → Workers AI)
- **RAG Q&A** — Ask questions, get AI answers grounded in scripture
- **Verse Deep-Dive** — Context-aware analysis with morphology and cross-references
- **Admin Upload** — BTB chapter ingestion with auto-embedding

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (TypeScript) |
| Database | D1 (7,959 verses, 139K morphology records) |
| Vector Search | Vectorize (768-dim, cosine, ~16K vectors) |
| AI | Workers AI (Llama 4 Scout) |
| Email | Workers Send Email (`no-reply@logos-core.com`) |
| Frontend | Vite + React 19 + TypeScript |
| CI/CD | GitHub Actions (typecheck → build → deploy) |

## Commands

```bash
npm install
npm run typecheck
npm run build      # Vite build → embeds HTML in worker
npm run deploy     # build + wrangler deploy
```

## Cloudflare Bindings

- `DB`: D1 database (`bible-ai-db`)
- `VECTORIZE`: Vectorize index (`bible-verse-embeddings`)
- `AI`: Workers AI
- `ASSETS`: Static assets (JS/CSS served from edge)
- `EMAIL`: Send Email (magic link delivery)

## Auth

- Public endpoints: `/api/status`, `/api/verses/search`, `/api/verses/morphology`
- Auth required: all AI endpoints, semantic search, uploads
- Login: `GET /login` → enter email → magic link → redirect to SPA
- Sessions: 24hr TTL, `__Host-session` cookie, D1-backed

## Ecosystem

- **LogOS Core** — biblical search, parsing, and AI-assisted study (you are here)
- **Shepherd** — kids ministry companion at `shepherdparentcompanion.pages.dev`
- **Roundtable** — sermon study workspace, coming soon
