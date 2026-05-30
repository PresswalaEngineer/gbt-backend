#!/usr/bin/env bash
# UAT backend deploy. Run from the app dir on the VPS:  bash deploy.sh
# First-time DB seed:  SEED=1 bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

BRANCH="${BRANCH:-main}"

echo "▶ [1/6] Pulling latest ($BRANCH)…"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "▶ [2/6] Installing dependencies…"
# Skip Puppeteer's Chromium download — the server uses system Chromium
# (PUPPETEER_EXECUTABLE_PATH in .env). Avoids the unzip/extract failure.
export PUPPETEER_SKIP_DOWNLOAD=true
if [ -f package-lock.json ]; then npm ci; else npm install; fi

echo "▶ [3/6] Generating Prisma client…"
npx prisma generate

echo "▶ [4/6] Syncing database schema (db push)…"
npx prisma db push --skip-generate

if [ "${SEED:-0}" = "1" ]; then
  echo "▶ [4b] Seeding database…"
  npm run db:seed
fi

echo "▶ [5/6] Restarting PM2 process…"
mkdir -p logs
if pm2 describe gbt-backend-uat > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "▶ [6/6] Done. Live logs:  pm2 logs gbt-backend-uat"
pm2 status
