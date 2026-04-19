#!/usr/bin/env bash
# ============================================================
# MONEY MIND — bootstrap.sh
# Setup zero-to-running em dev (Git Bash / Linux / macOS)
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
fail()  { echo -e "\033[1;31m[FAIL]\033[0m  $*"; exit 1; }

info "MONEY MIND — bootstrap iniciando em $ROOT_DIR"

# --- 1. checagem de pre-requisitos ---
command -v node    >/dev/null 2>&1 || fail "Node 20+ nao encontrado"
command -v pnpm    >/dev/null 2>&1 || fail "pnpm 9+ nao encontrado (npm i -g pnpm@9.1.0)"
command -v docker  >/dev/null 2>&1 || warn "Docker nao encontrado — pular docker:up"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 20 ] || fail "Node >= 20 obrigatorio (atual $(node -v))"

ok "pre-requisitos OK"

# --- 2. .env ---
if [ ! -f ".env" ]; then
  cp .env.example .env
  ok ".env criado a partir de .env.example — revise os valores"
else
  info ".env ja existe"
fi

# --- 3. install ---
info "instalando dependencias (pnpm install)..."
pnpm install --frozen-lockfile
ok "dependencias instaladas"

# --- 4. docker up ---
if command -v docker >/dev/null 2>&1; then
  info "subindo Postgres + Redis via docker-compose..."
  docker compose up -d postgres redis
  ok "containers de dev rodando"

  info "aguardando Postgres ficar saudavel..."
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
      ok "postgres healthy"; break
    fi
    sleep 2
  done
fi

# --- 5. migrations ---
if [ -f "db/run-migrations.ts" ]; then
  info "rodando migrations..."
  pnpm db:migrate
  ok "migrations aplicadas"
fi

# --- 6. seed ---
if [ -f "db/seed/seed.ts" ]; then
  info "rodando seed..."
  pnpm db:seed || warn "seed falhou (ok se ainda nao implementado)"
fi

# --- 7. build packages (primeira vez) ---
info "build inicial dos packages internos..."
pnpm --filter "./packages/*" build 2>/dev/null || warn "sem packages buildaveis ainda"

echo
ok "bootstrap concluido"
echo
echo "Proximos passos:"
echo "  1. revise .env (JWT_SECRET, ENCRYPTION_KEY, etc.)"
echo "  2. pnpm dev   # sobe api + web"
echo "  3. http://localhost:3000 (web) | http://localhost:3333 (api)"
