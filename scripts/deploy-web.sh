#!/usr/bin/env bash
# ============================================================
# MONEY MIND — deploy-web.sh
# Deploy manual do Next.js no Vercel via CLI.
# Requer: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/web"

: "${VERCEL_TOKEN:?defina VERCEL_TOKEN}"
: "${VERCEL_ORG_ID:?defina VERCEL_ORG_ID}"
: "${VERCEL_PROJECT_ID:?defina VERCEL_PROJECT_ID}"

ENV="${1:-production}"  # production | preview

command -v vercel >/dev/null 2>&1 || pnpm add -g vercel@latest

echo "[INFO] vercel pull ($ENV)"
vercel pull --yes --environment="$ENV" --token="$VERCEL_TOKEN"

echo "[INFO] vercel build"
if [ "$ENV" = "production" ]; then
  vercel build --prod --token="$VERCEL_TOKEN"
  vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
else
  vercel build --token="$VERCEL_TOKEN"
  vercel deploy --prebuilt --token="$VERCEL_TOKEN"
fi

echo "[OK] deploy concluido"
