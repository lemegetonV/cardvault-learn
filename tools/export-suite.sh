#!/usr/bin/env bash
# Copy the API test suite (tests/api) and its CI workflow from a CardVault checkout into
# data/suite/, exactly as committed at one commit, for the framework explorer.
# Usage: tools/export-suite.sh [path-to-cardvault-checkout] [commit]
# Then set suiteCommit in content/site.mjs to that commit.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
cardvault="${1:-../cardvault}"
commit="${2:-$(git -C "$cardvault" rev-parse --short origin/test/api)}"
rm -rf "$here/data/suite"
mkdir -p "$here/data/suite"
git -C "$cardvault" archive "$commit" tests/api .github/workflows/api-tests.yml \
  | tar -x -C "$here/data/suite" --exclude='tests/api/uv.lock'
echo "suite: copied tests/api and api-tests.yml at $commit"
# The site shows no keys or passwords except the public seed password. The local ones are
# fictional, but blank them anyway so the explorer never shows a key.
sed -i -E 's/^(TEST_KEY|SERVICE_KEY_TESTS|OPERATOR_HMAC_SECRET|READONLY_DB_PASSWORD)=.+$/\1=(local value, left out here)/' \
  "$here/data/suite/tests/api/envs/local.env"
