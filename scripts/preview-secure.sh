#!/usr/bin/env bash
# Build with encryption and serve public/ statically so the StatiCrypt gate
# can be exercised locally. Unlike `quartz build --serve`, this runs the
# post-process encryption step.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

if [ -z "${STATICRYPT_PASSWORD:-}" ]; then
  echo "ERROR: STATICRYPT_PASSWORD is not set (put it in $ROOT/.env)" >&2
  exit 1
fi

cd "$ROOT"
npx quartz build
node scripts/encrypt-private.mjs

echo
echo "==> /daily/ requires password from \$STATICRYPT_PASSWORD"
exec node "$ROOT/scripts/preview-server.mjs"
