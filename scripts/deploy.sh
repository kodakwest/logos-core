#!/bin/bash
# LogOS Core - Deploy + Backup Pipeline
set -e

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
