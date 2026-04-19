# ============================================================
# MONEY MIND - dev.ps1 (Windows PowerShell)
# ============================================================
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env")) {
  Write-Host "[FAIL] .env nao existe. Rode: .\scripts\bootstrap.ps1" -ForegroundColor Red
  exit 1
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker compose up -d postgres redis
}

pnpm turbo dev
