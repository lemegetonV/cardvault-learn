#!/usr/bin/env bash
# Copies the pytest suite (tests/api), the load test (tests/perf) and the Playwright suite (tests/ui) from a CardVault checkout into data/suite/,
# so the build can check that every code excerpt in a lesson still matches the real file.
# Usage: tools/export-suite.sh ../cardvault
set -euo pipefail
repo="${1:?path to the cardvault repo}"
for part in api perf ui; do
  src="$repo/tests/$part"
  dest="$(dirname "$0")/../data/suite/tests/$part"
  rm -rf "$dest" && mkdir -p "$dest"
  (cd "$src" && git ls-files -co --exclude-standard) | while read -r f; do
    mkdir -p "$dest/$(dirname "$f")" && cp "$src/$f" "$dest/$f"
  done
  echo "Copied $(find "$dest" -type f | wc -l) files into data/suite/tests/$part"
done
