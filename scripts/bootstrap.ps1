# ============================================================
# MONEY MIND - bootstrap.ps1 (Windows PowerShell)
# ============================================================
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Info($m) { Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[OK]    $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "[FAIL]  $m" -ForegroundColor Red; exit 1 }

Info "MONEY MIND - bootstrap em $Root"

if (-not (Get-Command node  -ErrorAction SilentlyContinue)) { Fail "Node 20+ necessario" }
if (-not (Get-Command pnpm  -ErrorAction SilentlyContinue)) { Fail "pnpm 9+ necessario (npm i -g pnpm@9.1.0)" }
$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) { Fail "Node >= 20 obrigatorio (atual $(node -v))" }
Ok "pre-requisitos OK"

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Ok ".env criado a partir de .env.example - revise os valores"
} else {
  Info ".env ja existe"
}

Info "pnpm install..."
pnpm install --frozen-lockfile
Ok "dependencias instaladas"

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Info "subindo postgres + redis..."
  docker compose up -d postgres redis
  Ok "containers rodando"
} else {
  Warn "Docker nao detectado - pulando docker up"
}

if (Test-Path "db/run-migrations.ts") {
  Info "aplicando migrations..."
  pnpm db:migrate
  Ok "migrations aplicadas"
}

if (Test-Path "db/seed/seed.ts") {
  Info "rodando seed..."
  try { pnpm db:seed } catch { Warn "seed falhou (ok se nao implementado)" }
}

Ok "bootstrap concluido"
Write-Host ""
Write-Host "Proximos passos:"
Write-Host "  1. revise .env"
Write-Host "  2. pnpm dev"
Write-Host "  3. http://localhost:3000 (web) | http://localhost:3333 (api)"
