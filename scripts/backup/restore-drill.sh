#!/bin/bash
# restore-drill.sh — Valida backup mais recente em ambiente temporário.
# Executar mensalmente em staging para garantir que backups funcionam.
#
# Env vars:
#   DATABASE_URL — DB de staging (será usado como modelo de conexão)
#   BACKUP_BUCKET — bucket com backups
#   AWS_ACCESS_KEY_ID, etc — credenciais storage

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_DB="money_mind_restore_drill_${TIMESTAMP}"
LOG_PREFIX="[RESTORE-DRILL ${TIMESTAMP}]"
BACKUP_DIR="/tmp/restore_drill_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "${LOG_PREFIX} ===== RESTORE DRILL INICIADO ====="

# ─── 1. Baixar backup mais recente ───────────────────────────────────────────
echo "${LOG_PREFIX} Buscando backup mais recente..."
LATEST_BACKUP=$(aws s3 ls "s3://${BACKUP_BUCKET}/db-backups/" \
  | sort | tail -n1 | awk '{print $4}')

if [[ -z "$LATEST_BACKUP" ]]; then
  echo "${LOG_PREFIX} ERRO: Nenhum backup encontrado em s3://${BACKUP_BUCKET}/db-backups/"
  exit 1
fi

echo "${LOG_PREFIX} Backup encontrado: ${LATEST_BACKUP}"
aws s3 cp "s3://${BACKUP_BUCKET}/db-backups/${LATEST_BACKUP}" "${BACKUP_DIR}/${LATEST_BACKUP}"

# ─── 2. Criar DB temporário ───────────────────────────────────────────────────
# Extract connection info from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | python3 -c "import sys,urllib.parse; u=urllib.parse.urlparse(sys.stdin.read()); print(u.hostname)")
DB_PORT=$(echo "$DATABASE_URL" | python3 -c "import sys,urllib.parse; u=urllib.parse.urlparse(sys.stdin.read()); print(u.port or 5432)")
DB_USER=$(echo "$DATABASE_URL" | python3 -c "import sys,urllib.parse; u=urllib.parse.urlparse(sys.stdin.read()); print(u.username)")
DB_PASS=$(echo "$DATABASE_URL" | python3 -c "import sys,urllib.parse; u=urllib.parse.urlparse(sys.stdin.read()); print(urllib.parse.unquote(u.password))")

export PGPASSWORD="$DB_PASS"

echo "${LOG_PREFIX} Criando banco temporário: ${TEST_DB}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE ${TEST_DB};" postgres

# ─── 3. Restaurar backup ──────────────────────────────────────────────────────
echo "${LOG_PREFIX} Restaurando backup..."
gunzip -c "${BACKUP_DIR}/${LATEST_BACKUP}" \
  | pg_restore \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$TEST_DB" \
    --no-owner \
    --no-acl \
    --verbose \
    2>&1 | tail -20

echo "${LOG_PREFIX} Restore concluído."

# ─── 4. Validar contagem de linhas críticas ───────────────────────────────────
echo "${LOG_PREFIX} Validando tabelas críticas..."

RESTORED_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TEST_DB}?sslmode=require"

check_table() {
  local table=$1
  local min_count=$2
  local count
  count=$(psql "$RESTORED_URL" -t -c "SELECT COUNT(*) FROM ${table};" | tr -d ' ')
  if [[ "$count" -lt "$min_count" ]]; then
    echo "${LOG_PREFIX} AVISO: ${table} tem ${count} linhas (esperado >= ${min_count})"
    return 1
  fi
  echo "${LOG_PREFIX} OK: ${table} — ${count} linhas"
  return 0
}

VALIDATION_FAILED=0

check_table "audit_log" 0 || VALIDATION_FAILED=1
check_table "organizations" 1 || VALIDATION_FAILED=1
check_table "companies" 0 || VALIDATION_FAILED=1

# Check migrations ran
MIGRATION_COUNT=$(psql "$RESTORED_URL" -t -c "SELECT COUNT(*) FROM migrations;" 2>/dev/null || echo "0")
echo "${LOG_PREFIX} Migrations aplicadas: ${MIGRATION_COUNT}"

# ─── 5. Cleanup ──────────────────────────────────────────────────────────────
echo "${LOG_PREFIX} Removendo banco temporário..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE ${TEST_DB};" postgres
rm -rf "$BACKUP_DIR"

# ─── 6. Resultado ─────────────────────────────────────────────────────────────
if [[ "$VALIDATION_FAILED" -eq 1 ]]; then
  echo "${LOG_PREFIX} RESULTADO: RESTORE DRILL FALHOU — verificar dados"
  exit 1
else
  echo "${LOG_PREFIX} RESULTADO: RESTORE DRILL PASSOU com sucesso"
  echo "${LOG_PREFIX} Backup validado: ${LATEST_BACKUP}"
fi

unset PGPASSWORD
