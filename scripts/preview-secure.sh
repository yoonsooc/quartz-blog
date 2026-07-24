#!/usr/bin/env bash
# 배포와 동일한 산출물(암호화 + 스크럽)을 로컬에서 서빙해 확인한다.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

export SITE_PRIVATE_PASSWORD="${SITE_PRIVATE_PASSWORD:-${STATICRYPT_PASSWORD:-}}"
if [ -z "$SITE_PRIVATE_PASSWORD" ]; then
  echo "ERROR: SITE_PRIVATE_PASSWORD is not set (put it in $ROOT/.env)" >&2
  exit 1
fi

cd "$ROOT"
npm run install-plugins
npx quartz build
node scripts/scrub-private-assets.mjs

echo
echo "==> /daily/ requires password from \$SITE_PRIVATE_PASSWORD"
exec node "$ROOT/scripts/preview-server.mjs"
