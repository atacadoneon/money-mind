#!/usr/bin/env bash
# ============================================================
# MONEY MIND — reset-db.sh
# ATENCAO DESTRUTIVO: dropa o banco local e recria.
# Nunca rodar em prod. Exige digitar "RESET" para prosseguir.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# --- safety ---
if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "[FAIL] NODE_ENV=production — abortando."
  exit 1
fi

set +u
# shellcheck disable=SC1091
[ -f .env ] && source .env
set -u

if [[ "${DATABASE_URL:-}" == *"supabase.co"* ]] || [[ "${DATABASE_URL:-}" == *"render.com"* ]]; then
  echo "[FAIL] DATABASE_URL aponta para nuvem — abortando para evitar desastre."
  exit 1
fi

echo "ATENCAO: isso vai DROPAR o banco de dados local e recriar do zero."
echo "DATABASE_URL=${DATABASE_URL:-<nao definido>}"
read -r -p "Digite RESET para confirmar: " CONFIRM
[ "$CONFIRM" = "RESET" ] || { echo "abortado."; exit 1; }

echo "[INFO] recriando banco via docker-compose..."
docker compose down -v
docker compose up -d postgres redis

echo "[INFO] aguardando Postgres..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "[INFO] rodando migrations..."
pnpm db:migrate

echo "[INFO] rodando seed..."
pnpm db:seed || true

echo "[OK] reset concluido."
