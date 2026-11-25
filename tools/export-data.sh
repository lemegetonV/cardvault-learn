#!/usr/bin/env bash
# Refresh data/ from a running local CardVault stack (make up in the cardvault repo).
# Usage: tools/export-data.sh [path-to-cardvault-checkout]
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cardvault="${1:-../cardvault}"

declare -A ports=([auth]=8001 [card]=8002 [enrollment]=8003 [wallet_txn]=8004 [profile]=8005 [wallet_operator]=8101 [network]=8102)
for name in "${!ports[@]}"; do
  curl -fsS "http://localhost:${ports[$name]}/openapi.json" -o "$here/data/openapi/$name.json"
  echo "openapi: $name"
done

cp "$cardvault"/docs/events/*.schema.json "$here/data/events/"
echo "events: copied from $cardvault/docs/events"
echo "Now update cardvaultCommit in content/site.mjs to the commit you exported from."
