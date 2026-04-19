#!/bin/bash
# pg_backup.sh — PostgreSQL backup com upload para Supabase Storage ou S3
# Retenção: 30 dias
# Schedule: cron daily 3am (ver cron-schedule.md)
#
# Env vars necessárias:
#   DATABASE_URL — connection string PostgreSQL
#   BACKUP_BUCKET — bucket name (Supabase Storage ou S3)
#   SUPABASE_SERVICE_ROLE_KEY — para upload Supabase Storage
#   SUPABASE_URL — URL do projeto Supabase
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION — se usar S3

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_money_mind_${TIMESTAMP}.sql.gz"
BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LOG_PREFIX="[BACKUP ${TIMESTAMP}]"

mkdir -p "$BACKUP_DIR"

echo "${LOG_PREFIX} Starting PostgreSQL backup..."

# ─── 1. Dump DB ──────────────────────────────────────────────────────────────
pg_dump "$DATABASE_URL" \
  --verbose \
  --no-owner \
  --no-acl \
  --format=custom \
  | gzip -9 > "${BACKUP_DIR}/${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "${LOG_PREFIX} Dump completed. Size: ${BACKUP_SIZE}"

# ─── 2. Upload ───────────────────────────────────────────────────────────────
if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
  echo "${LOG_PREFIX} Uploading to S3: s3://${BACKUP_BUCKET}/db-backups/${BACKUP_FILE}"
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" \
    "s3://${BACKUP_BUCKET}/db-backups/${BACKUP_FILE}" \
    --storage-class STANDARD_IA
  echo "${LOG_PREFIX} S3 upload complete."

elif [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "${LOG_PREFIX} Uploading to Supabase Storage: ${BACKUP_BUCKET}/db-backups/${BACKUP_FILE}"
  curl -s -X POST \
    "${SUPABASE_URL}/storage/v1/object/${BACKUP_BUCKET}/db-backups/${BACKUP_FILE}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/gzip" \
    --data-binary "@${BACKUP_DIR}/${BACKUP_FILE}" \
    | jq '.Key // .error'
  echo "${LOG_PREFIX} Supabase Storage upload complete."
else
  echo "${LOG_PREFIX} WARNING: No storage credentials configured. Backup stored locally only."
fi

# ─── 3. Limpar backups locais antigos ────────────────────────────────────────
find "$BACKUP_DIR" -name "backup_money_mind_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "${LOG_PREFIX} Old local backups cleaned (>$RETENTION_DAYS days)."

# ─── 4. Limpar backups remotos antigos (S3) ──────────────────────────────────
if [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
  CUTOFF=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
           date -v "-${RETENTION_DAYS}d" +%Y-%m-%dT%H:%M:%SZ)
  aws s3 ls "s3://${BACKUP_BUCKET}/db-backups/" \
    | awk '{print $4}' \
    | while read -r key; do
        mod_date=$(aws s3 ls "s3://${BACKUP_BUCKET}/db-backups/${key}" | awk '{print $1}')
        if [[ "$mod_date" < "${CUTOFF:0:10}" ]]; then
          aws s3 rm "s3://${BACKUP_BUCKET}/db-backups/${key}"
          echo "${LOG_PREFIX} Deleted old backup: ${key}"
        fi
      done
fi

echo "${LOG_PREFIX} Backup completed successfully: ${BACKUP_FILE}"
