#!/usr/bin/env bash
# ============================================================
# MONEY MIND — backup-db.sh
# pg_dump em formato custom (.dump). Default: DATABASE_URL do .env.
# Uso:
#   bash scripts/backup-db.sh                    # backups/money_mind_<ts>.dump
#   DATABASE_URL=... bash scripts/backup-db.sh   # override
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

set +u
[ -f .env ] && source .env
set -u

: "${DATABASE_URL:?DATABASE_URL obrigatorio}"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$BACKUP_DIR/money_mind_${TS}.dump"

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump nao instalado"; exit 1; }

echo "[INFO] gerando backup em $OUT"
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  -f "$OUT"

echo "[OK] backup gerado: $(ls -lh "$OUT" | awk '{print $5, $NF}')"
echo
echo "Para restaurar:"
echo "  pg_restore --clean --if-exists --no-owner -d \$DATABASE_URL $OUT"
