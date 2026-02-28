#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/7] Clean test output"
rm -rf .test-dist

echo "[2/7] Compile unit tests"
pnpm exec tsc -p tsconfig.test.json

echo "[3/7] Mark test output as ESM"
printf '{"type":"module"}\n' > .test-dist/package.json

echo "[4/7] Run unit tests"
node --loader ./scripts/test-esm-loader.mjs --test .test-dist/tests/**/*.test.js

echo "[5/7] Lint + typecheck"
pnpm run lint
pnpm exec tsc --noEmit

echo "[6/7] Build"
pnpm run build

echo "[7/7] Dist size report"
du -sh dist
du -ah dist | sort -h | tail -n 30
find dist -type f -print0 | xargs -0 ls -lh | sort -k5 -h | tail -n 20

echo "Done."
