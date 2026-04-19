#!/usr/bin/env bash
# ============================================================
# MONEY MIND — healthcheck.sh
# Pinga /health da API e /api/health do web.
# ============================================================
set -euo pipefail

API_URL="${API_URL:-http://localhost:3333}"
WEB_URL="${WEB_URL:-http://localhost:3000}"

check() {
  local name="$1" url="$2"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
  if [ "$code" = "200" ]; then
    echo "[OK]   $name  $url  -> $code"
    return 0
  else
    echo "[FAIL] $name  $url  -> $code"
    return 1
  fi
}

ERR=0
check "api"  "$API_URL/health"    || ERR=1
check "web"  "$WEB_URL/api/health" || ERR=1
exit $ERR
