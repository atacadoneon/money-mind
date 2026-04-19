#!/usr/bin/env bash
# ============================================================
# MONEY MIND — gen-types.sh
# Gera tipos TypeScript do Supabase (Database schema).
# Requer: supabase CLI + variavel SUPABASE_PROJECT_ID.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

set +u
[ -f .env ] && source .env
set -u

: "${SUPABASE_PROJECT_ID:?defina SUPABASE_PROJECT_ID (ex: abcxyz123)}"

command -v supabase >/dev/null 2>&1 || {
  echo "supabase CLI nao instalado — https://supabase.com/docs/guides/cli"
  exit 1
}

OUT="packages/db-types/src/database.ts"
mkdir -p "$(dirname "$OUT")"

echo "[INFO] gerando tipos para projeto $SUPABASE_PROJECT_ID -> $OUT"
supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_ID" \
  --schema public \
  > "$OUT"

echo "[OK] tipos gerados em $OUT ($(wc -l < "$OUT") linhas)"
