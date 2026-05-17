---
title: "LogOS Core — Full Transition Plan"
artifact_type: Implementation_Plan
domain: "Cloudflare Workers; Full-Stack Web; DevOps"
systems: "Cloudflare Workers; wrangler; GitHub; GitHub Actions; D1; Vectorize; Workers AI"
primary_entities: "logos-core; logos-core; logos-core.com; custom domain; repo rename; docs"
last_updated: 2026-05-17
status: ready
---

# LogOS Core — Full Transition Plan

> **For Codex:** Implement each task sequentially. This is a rename + domain transition on a live project.

**Goal:** Rename the repo from `logos-core` → `logos-core`, move the local folder from `S:\Projects\logos-core\` to `S:\Projects\logos-core\`, add the `logos-core.com` custom domain to the live Worker, and update all documentation and CI/CD to match.

**Architecture:** The Worker project name (`logos-core`), bindings (D1 `bible-ai-db`, Vectorize `bible-verse-embeddings`), and deployed worker (`logos-core.kodakwest.workers.dev`) are already correct. This plan covers the remaining surface area: GitHub repo name, local folder path, custom domain, docs, and CI/CD continuity.

**Order matters:** Tasks 1→5 must run locally first (repo rename affects git remote). Task 6 (custom domain) can run in parallel. Tasks 7+ are cleanup.

---

## Prerequisites (do first)

**All files that reference the old name or path today:**
- `README.md` — mentions `README.md` in ecosystem section (correct already, but verify)
- `SPEC.md` — line 5: `S:\Projects\logos-core\` and `logos-core/` in architecture
- `docs/API.md` — no old references found
- `logos-scope-and-loe.md` — line 10 references `kodakwest/logos-core`
- `logos-roadmap-and-features.md` — multiple references to `logos-core` path and repo name
- `HANDOFF.md` — line 14: `logos-core/` path
- `bible-api-research-kb/index.html` — lines 165, 248, 249 reference old repo name and KB path
- `.github/workflows/deploy.yml` — should work as-is (GitHub actions follow the repo)
- `scripts/deploy.sh` — references `logos-core.kodakwest.workers.dev` (correct)
- `scripts/rollback.sh` — no old references
- `wrangler.toml` — already correct (name = "logos-core")
- `vite.config.ts` — no old references
- `package.json` — correct (name "logos-core")
- `AGENTS.md` — already says LogOS Core

### Edge Cases
- **Git history preservation:** The rename must preserve all git history. `git mv` + `git remote set-url` approach, never a fresh clone.
- **Live site during transition:** The old worker at `logos-core.kodakwest.workers.dev` stays live. The custom domain `logos-core.com` is added as an additional route, not a replacement — both URLs work.
- **CI/CD continuity:** GitHub actions must not break during the rename. Repo rename on GitHub is instantaneous but the remote URL changes. Run `git remote set-url origin` locally after the rename.
- **Local breaking paths:** Any hardcoded `S:\Projects\logos-core\` paths in Hermes plans, cron jobs, or other configs will need updating. Use `search_files` to find them post-rename.
- **The dist/ folder** is gitignored. After the rename, rebuild with `npm run build` before deploy so paths are fresh.

---

## Task 1: Rename the GitHub repository

**Objective:** Rename `kodakwest/logos-core` → `kodakwest/logos-core` on GitHub

**Method:** Use `gh` CLI:

```bash
cd /mnt/s/Projects/logos-core
gh repo rename logos-core --repo kodakwest/logos-core
```

This redirects the old URL automatically (GitHub creates a redirect). No need to update forks or CI yet.

**Verification:** 
```bash
gh repo view kodakwest/logos-core --json name
```
Expected: `{"name":"logos-core"}`

If `gh` is not authenticated, use the GitHub API:
```bash
curl -X PATCH -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/kodakwest/logos-core \
  -d '{"name":"logos-core"}'
```

---

## Task 2: Update the local git remote

**Objective:** Point local repo to the new URL

```bash
cd /mnt/s/Projects/logos-core
git remote set-url origin https://github.com/kodakwest/logos-core.git
```

**Verification:**
```bash
git remote -v
```
Expected: origin → `kodakwest/logos-core.git`

---

## Task 3: Move the local project folder

**Objective:** Rename `S:\Projects\logos-core\` → `S:\Projects\logos-core\`

```bash
mv /mnt/s/Projects/logos-core /mnt/s/Projects/logos-core
```

**Important:** This breaks any absolute path references. Update Hermes memory + skills + cron jobs afterward.

**Verification:**
```bash
ls /mnt/s/Projects/logos-core/
```
Expected: all the same files, now under the new name.

---

## Task 4: Add `logos-core.com` custom domain to the Worker

**Objective:** Deploy the Worker with a custom domain so it's accessible at `logos-core.com`

**Option A: wrangler.toml (recommended)**
Add to `wrangler.toml`:
```toml
routes = [
  { pattern = "logos-core.com", custom_domain = true },
  { pattern = "logos-core.com/*", custom_domain = true }
]
```

Then deploy:
```bash
npx wrangler deploy
```

**Option B: Dashboard (manual fallback)**
If wrangler route commands don't work for custom domains:
1. Go to Cloudflare Dashboard → Workers & Pages → `logos-core`
2. Triggers → Custom Domains → Add Custom Domain → `logos-core.com`
3. Ensure DNS is configured (it should be from earlier setup)

**Verification:**
```bash
curl -s https://logos-core.com/api/status | head -5
```
Expected: valid JSON response with verse count (same as `logos-core.kodakwest.workers.dev/api/status`)

Also verify the SPA serves:
```bash
curl -s -L https://logos-core.com/ | grep -i logos
```
Expected: HTML with "LogOS" in the content

---

## Task 5: Update `wrangler.toml` with the route (if not already done in Task 4)

**Objective:** The custom domain should be in version control so new deploys don't lose it.

Add after the existing config (before or after `[assets]`):
```toml
routes = [
  { pattern = "logos-core.com", custom_domain = true },
  { pattern = "logos-core.com/*", custom_domain = true }
]
```

---

## Task 6: Update all documentation that references old name/path

**Files to update:**

| File | What to change |
|------|---------------|
| `SPEC.md` | Line 5: `logos-core` → `logos-core` (the path in the project root note) |
| `SPEC.md` | Line 42: `logos-core/` → `logos-core/` in the architecture tree |
| `logos-scope-and-loe.md` | Line 10: `kodakwest/logos-core` → `kodakwest/logos-core` |
| `logos-roadmap-and-features.md` | All path references from `logos-core/` → `logos-core/` (lines 72-79) |
| `logos-roadmap-and-features.md` | Line 162: already says `logos-core → logos-core` (this was the plan, keep) |
| `logos-roadmap-and-features.md` | Line 371: already references the rename plan |
| `logos-roadmap-and-features.md` | Line 404: `knowledge/logos-core-kb/` → `knowledge/logos-core-kb/` |
| `HANDOFF.md` | Line 14: `logos-core/` path reference |
| `bible-api-research-kb/index.html` | Line 165: repo URL |
| `bible-api-research-kb/index.html` | Lines 248-249: `knowledge/logos-core-kb/` → `knowledge/logos-core-kb/` |

**Search for any remaining references:**
```bash
grep -rn "logos-core" /mnt/s/Projects/logos-core/ --include="*.md" --include="*.html" --include="*.json" --include="*.ts" --include="*.sh" --include="*.toml" --include="*.yml" --include="*.yaml"
```

---

## Task 7: Commit and deploy

```bash
cd /mnt/s/Projects/logos-core

git add -A
git commit -m "feat: rename logos-core → logos-core, add custom domain logos-core.com"
git push origin main
```

This triggers the GitHub Actions deploy, which will deploy with the new `routes` in wrangler.toml.

**Verification (after deploy completes):**
- Visit https://logos-core.com — should show the LogOS SPA
- Visit https://logos-core.com/api/status — should return JSON
- Visit https://logos-core.kodakwest.workers.dev — should still work (redirect)

---

## Task 8: Update Hermes config references

Check for any Hermes plan files, cron jobs, or skills that reference the old absolute path:
```bash
grep -rn "logos-core" ~/.hermes/ --include="*.md" --include="*.json" --include="*.yaml" --include="*.toml" 2>/dev/null || echo "No Hermes references found"
```

Update any that exist with the new path.

Also check Memory Vault:
```bash
grep -rn "logos-core" /mnt/s/Memory\ Vault/ --include="*.md" 2>/dev/null || echo "No memory vault references found"
```

---

## Verification Checklist

Run through this after all tasks complete:

- [ ] `gh repo view kodakwest/logos-core` works
- [ ] `git remote -v` shows `kodakwest/logos-core.git`
- [ ] `ls /mnt/s/Projects/logos-core/` shows project files
- [ ] `curl https://logos-core.com/api/status` returns valid JSON
- [ ] `curl -s -L https://logos-core.com/ | grep -i LogOS` returns HTML
- [ ] `curl https://logos-core.kodakwest.workers.dev/api/status` still works (redirect)
- [ ] No remaining `logos-core` string references in the repo
- [ ] GitHub Actions deploy succeeded on push to `main`
- [ ] Hermes configs don't reference old path

## Rollback (if needed)

If the custom domain fails:
1. Remove the `routes` block from `wrangler.toml`
2. Re-deploy: `npx wrangler deploy`
3. Use dashboard to troubleshoot DNS/SSL

If the repo rename causes CI issues:
1. GitHub auto-redirects the old URL to the new one
2. Verify `CLOUDFLARE_API_TOKEN` secret is still present in the renamed repo
3. Manual trigger: GitHub → Actions → Deploy LogOS Core → Run workflow
