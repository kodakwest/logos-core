# AGENTS.md — LogOS Core

## Project Context

Cloudflare Workers-based Bible search and AI Q&A platform. Formerly named "Bible AI Search"; now rebranding as **LogOS Core**.

**Stack:** Cloudflare Workers (TypeScript) + D1 + Vectorize + Workers AI + Vite/React 19 frontend
**Deployment:** Cloudflare Workers (logos-core.kodakwest.workers.dev)
**Live apps in ecosystem:**
- Shepherd (kids ministry) — shepherdparentcompanion.pages.dev
- Roundtable (sermon study) — coming soon

## Design Conventions

- **Dark theme** — background `#0b0d0e`, panels `#131618`, ink `#e8e6e1`
- **Current accent:** LogOS gold `#d4af37`, secondary blue `#4da8da`
- **Fonts:** Playfair Display (brand/headings), Inter (UI), JetBrains Mono (code)
- **Rebranding is in progress** — LogOS Core is the canonical project name

## Architecture

```
User → logos-core.workers.dev
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

The Worker project is named `logos-core`; service bindings remain D1, Vectorize, Workers AI, and static assets.

## Visual Identity

- Dark theme, gold accent, subtle grid backgrounds
- Icon: The Open Path inline SVG
- Layout: 280px sidebar + content area, hash-based routing

## Rebranding Task Notes

When creating rebranding concepts:
- Reference the "path" / "way" / LogOS naming theme
- Consider Greek roots, biblical names, and modern tech naming
- Create mood board as self-contained HTML with color swatches, typography samples, logo sketches (CSS/SVG), and tagline concepts
- Present 3-5 name candidates with rationale

## Knowledge Base HTML Convention

When building documentation knowledge bases for this project, follow this structure:

### File Structure
```
project-name-kb/
├── index.html       # Main page: all sections + inline SVG architecture diagram
├── styles.css       # Dark theme, responsive grid, component styles
├── app.js           # Search filter + scroll spy nav + scroll-to-top
└── README.md        # Paths, context, no-build note
```

### Required Sections (in order)
1. `#overview` — 3 callout cards with data-keywords
2. `#architecture` — SVG call flow diagram
3. `#runtime` — Canonical values table (URLs, repos, config, services)
4. Product/provider sections — features with code examples
5. `#troubleshooting` — Checkbox checklist of failure signatures
6. `#commands` — Copy-ready command blocks
7. `#patches` — Ordered timeline of recent changes

### Design System
- **Dark theme** — background `#0b0d0e`, panels `#131618`, ink `#e8e6e1`
- **LogOS brand accent:** Gold `#d4af37` (primary), Blue `#4da8da` (secondary)
- **Current accent:** Gold `#d4af37`
- **Fonts:** Playfair Display (brand/headings), Inter (UI), JetBrains Mono (code)
- Semantic colors for SVG diagrams: Frontend `#22d3ee`, Backend `#34d399`, Database `#a78bfa`, Security `#fb7185`, AI/ML `#fb923c`, External `#94a3b8`
- Double-rect masking for transparent SVG fills
- Arrowheads render behind component boxes

### CSS Component Classes
Use from the KB design system: `.app-shell`, `.sidebar`, `.status-strip`, `.kb-section`, `.section-heading`, `.callout-grid`, `.table-wrap`, `.checklist`, `.command-list`, `.timeline`, `.runtime-pill`, `.scroll-top`

### Search
- Every section MUST have `data-keywords` attribute with 5-15 searchable terms
- Filter script filters sections in real-time

### File Delivery
- Single `.html` file per artifact, all CSS and SVG inline
- No external dependencies except Google Fonts
- Mobile-responsive via CSS media queries
- Must render in any modern browser
