# Bible AI Search

Cloudflare Workers + Vite React app for ingesting BTB interlinear Bible data, keyword and semantic verse search, and Greek parsing through Workers AI.

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
