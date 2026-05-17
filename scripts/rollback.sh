#!/bin/bash
# LogOS Core - Rollback Pipeline
set -eo pipefail

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "Error: CLOUDFLARE_API_TOKEN is not set."
  exit 1
fi

if [ ! -f .last_version_id ]; then
    echo "Error: No .last_version_id file found. Cannot rollback automatically."
    exit 1
fi

VERSION_ID=$(cat .last_version_id)

if [ -z "$VERSION_ID" ]; then
    echo "Error: .last_version_id is empty."
    exit 1
fi

echo "-> Rolling back to version $VERSION_ID..."
npx wrangler rollback "$VERSION_ID"

echo "-> Rollback complete."
