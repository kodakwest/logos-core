# LogOS Core

The Operating System for Truth.

LogOS Core is a Cloudflare Workers + Vite React app for ingesting BTB interlinear Bible data, keyword and semantic verse search, and Greek parsing through Workers AI. It is the central scripture data and study surface for the LogOS ecosystem.

## Ecosystem

- LogOS Core: biblical search, parsing, and AI-assisted study
- Shepherd: kids ministry companion at `shepherdparentcompanion.pages.dev`
- Roundtable: sermon study workspace, coming soon

## Commands

```bash
npm install
npm run typecheck
npm run build
npm run deploy
```

## Cloudflare Bindings

- `DB`: D1 database
- `VECTORIZE`: Vectorize index with 768 dimensions
- `AI`: Workers AI
- `ASSETS`: built frontend from `dist/`
