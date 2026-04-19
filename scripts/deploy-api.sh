#!/usr/bin/env bash
# ============================================================
# MONEY MIND — deploy-api.sh
# Dispara deploy manual da API no Render via deploy hook.
# Requer: RENDER_DEPLOY_HOOK_API no ambiente.
# ============================================================
set -euo pipefail

: "${RENDER_DEPLOY_HOOK_API:?defina RENDER_DEPLOY_HOOK_API (Dashboard > Service > Settings > Deploy Hook)}"

echo "[INFO] disparando deploy da API no Render..."
RESP=$(curl -sS -w "\n%{http_code}" -X POST "$RENDER_DEPLOY_HOOK_API")
BODY=$(echo "$RESP" | head -n -1)
CODE=$(echo "$RESP" | tail -n1)

echo "[$CODE] $BODY"
[ "$CODE" -lt 400 ] || exit 1

echo "[OK] deploy iniciado — acompanhe em https://dashboard.render.com"
