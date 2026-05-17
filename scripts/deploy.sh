#!/bin/bash
# LogOS Core - Deploy + Backup Pipeline
set -eo pipefail

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN is not set."
  exit 1
fi

echo "-> Saving current version ID for potential rollback..."
CURRENT_VERSION_ID=$(npx wrangler deployments list 2>/dev/null | grep -o -E '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -n 1 || true)

if [ -n "$CURRENT_VERSION_ID" ]; then
    echo "$CURRENT_VERSION_ID" > .last_version_id
    echo "Saved version ID: $CURRENT_VERSION_ID"
else
    echo "No previous deployment found or failed to fetch."
fi

echo "-> Building..."
npm run build

echo "-> Deploying to Cloudflare..."
npx wrangler deploy 2>&1 | tee /tmp/deploy-$(date +%Y%m%d-%H%M%S).log

echo "-> Committing deploy to git..."
VERSION=$(curl -s https://logos-core.kodakwest.workers.dev/api/status | grep -o '"verses":[0-9]*' | cut -d: -f2)
git add -A
git commit -m "deploy: $(date +%Y-%m-%d-%H%M) — v$(date +%s) [${VERSION:-?} verses indexed]"
git push origin main

echo "-> Deploy complete. Version logged."
