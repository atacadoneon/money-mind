#!/usr/bin/env bash
# ============================================================
# MONEY MIND — dev.sh
# Sobe docker dependencies + turbo dev.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  echo "[FAIL] .env nao existe. Rode: bash scripts/bootstrap.sh"
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  docker compose up -d postgres redis
fi

exec pnpm turbo dev
