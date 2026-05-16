# AGENTS.md — Bible AI Search

## Project Context

Cloudflare Workers-based Bible search and AI Q&A platform. Currently named "Bible AI Search" — undergoing rebranding.

**Stack:** Cloudflare Workers (TypeScript) + D1 + Vectorize + Workers AI + Vite/React 19 frontend
**Deployment:** Cloudflare Workers (bible-ai-api.kodakwest.workers.dev)
**Live apps in ecosystem:**
- Shepherd (kids ministry) — shepherdparentcompanion.pages.dev
- Roundtable (sermon study) — coming soon

## Design Conventions

- **Dark theme** — background `#0b0d0e`, panels `#131618`, ink `#e8e6e1`
- **Current accent:** Teal `#56b6a7` / `#22d3ee` (cyan-400)
- **Fonts:** Inter (UI), JetBrains Mono (code)
- **Rebranding is in progress** — accent color may change based on new identity

## Architecture

```
User → bible-ai-api.workers.dev
         │
         ├─ /api/ask          POST   RAG Q&A (auth required)
         ├─ /api/explain      POST   Verse deep-dive (auth required)
         ├─ /api/status       GET    DB stats (public)
         ├─ /api/verses/search GET    Keyword search (public)
         ├─ /api/verses/semantic POST Vector search
         ├─ /api/verse/morphology POST Word morphology
         ├─ /api/parse/greek  POST   Greek text analysis
         ├─ /api/upload/chapter POST  Ingest chapter (admin)
         └─ /api/upload/morphology POST Ingest morphology (admin)
```

## Visual Identity (Current — subject to rebranding)

- Dark theme, teal accent, subtle grid backgrounds
- Icon: BookOpen (lucide-react)
- Layout: 280px sidebar + content area, hash-based routing

## Rebranding Task Notes

When creating rebranding concepts:
- Reference the "path" / "way" / LogOS naming theme
- Consider Greek roots, biblical names, and modern tech naming
- Create mood board as self-contained HTML with color swatches, typography samples, logo sketches (CSS/SVG), and tagline concepts
- Present 3-5 name candidates with rationale
