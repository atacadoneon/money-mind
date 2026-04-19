#!/usr/bin/env bash
# ============================================================
# MONEY MIND — setup-husky.sh
# Instala hooks Git (pre-commit, commit-msg) via Husky.
# Rodar UMA vez apos `pnpm install`.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm nao encontrado"; exit 1
fi

# Requer husky instalado como devDep (ver docs/CONTRIBUTING.md)
pnpm exec husky install

# pre-commit: lint-staged
pnpm exec husky add .husky/pre-commit "pnpm exec lint-staged" || true

# commit-msg: commitlint
pnpm exec husky add .husky/commit-msg 'pnpm exec commitlint --edit "$1"' || true

echo "[OK] hooks Husky instalados em .husky/"
ls -la .husky/
