#!/usr/bin/env bash
# Build the Quartz site and push public/ to the GitHub Pages repo.
#
# Source: nkinba/quartz-blog (this repo)
# Target: nkinba/nkinba.github.io  →  https://nkinba.github.io/

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT/public"
TARGET_REPO="https://github.com/nkinba/nkinba.github.io.git"
WORK_DIR="${DEPLOY_WORK_DIR:-$HOME/.cache/quartz-blog-deploy}"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

# 0) Load secrets (STATICRYPT_PASSWORD lives here)
if [ -f "$ROOT/.env" ]; then
  log "Loading $ROOT/.env"
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

if [ -z "${STATICRYPT_PASSWORD:-}" ]; then
  echo "ERROR: STATICRYPT_PASSWORD is not set (export it or put it in .env)" >&2
  exit 1
fi

# 1) Build
log "Building Quartz site"
cd "$ROOT"
npx quartz build

if [ ! -d "$BUILD_DIR" ]; then
  echo "ERROR: build dir $BUILD_DIR not found" >&2
  exit 1
fi

# 1.5) Encrypt private routes (daily/*) + scrub index/feed/sitemap
log "Encrypting private routes"
node "$ROOT/scripts/encrypt-private.mjs"

# 2) Prepare target clone
if [ ! -d "$WORK_DIR/.git" ]; then
  log "Cloning $TARGET_REPO → $WORK_DIR"
  mkdir -p "$(dirname "$WORK_DIR")"
  git clone "$TARGET_REPO" "$WORK_DIR"
else
  log "Refreshing existing clone at $WORK_DIR"
  git -C "$WORK_DIR" fetch origin
  if git -C "$WORK_DIR" rev-parse --verify origin/main >/dev/null 2>&1; then
    git -C "$WORK_DIR" checkout -B main origin/main
  else
    git -C "$WORK_DIR" checkout -B main
  fi
fi

# 3) Sync build output (preserve .git, drop everything else)
log "Syncing build output to deploy clone"
rsync -a --delete \
  --exclude='.git' \
  "$BUILD_DIR/" "$WORK_DIR/"

# 4) GitHub Pages housekeeping
touch "$WORK_DIR/.nojekyll"  # disable Jekyll processing

# 5) Commit + push
# 빌드 레포에는 히스토리를 남기지 않는다(단일 orphan 커밋 + force push).
# 과거 배포본이 히스토리에 쌓이면 삭제·암호화 이전의 산출물(og-image, 첨부,
# 파일명)이 public 레포에서 영구 열람 가능해지기 때문.
cd "$WORK_DIR"
if [ -z "$(git status --porcelain)" ]; then
  log "No changes to deploy"
  exit 0
fi

SRC_SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
SRC_BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
TS="$(date -u +'%Y-%m-%d %H:%M UTC')"

git checkout --orphan deploy-fresh
git add -A
git commit -m "Deploy $TS

Source: nkinba/quartz-blog @ $SRC_SHA ($SRC_BRANCH)"
git branch -M deploy-fresh main

log "Pushing to origin/main (single-commit history)"
git push --force origin main

log "Done — https://nkinba.github.io/"
