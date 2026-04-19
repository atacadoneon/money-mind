# Getting Started — MONEY MIND

> Meta: dev rodando localmente em menos de 15 minutos.

---

## Pré-requisitos

| Ferramenta | Versão | Instalação |
|---|---|---|
| Node.js | 20+ | https://nodejs.org (ou `nvm install 20`) |
| pnpm | 9+ | `npm install -g pnpm@9.1.0` |
| Docker Desktop | 4.x+ | https://www.docker.com/products/docker-desktop |
| Git | 2.40+ | https://git-scm.com |
| (opcional) Supabase CLI | 1.180+ | https://supabase.com/docs/guides/cli |

No Windows 11: usar **Git Bash** para scripts `.sh` ou **PowerShell** para `.ps1`.

---

## 1. Clone e entre no projeto

```bash
git clone <URL_DO_REPO>
cd "MONEY MIND - BPO FINANCEIRO"
```

---

## 2. Bootstrap automatizado

### Linux / macOS / Git Bash

```bash
bash scripts/bootstrap.sh
```

### Windows PowerShell

```powershell
.\scripts\bootstrap.ps1
```

O script:

1. Verifica versões de Node/pnpm/Docker
2. Copia `.env.example` → `.env` (se não existir)
3. Roda `pnpm install --frozen-lockfile`
4. Sobe `postgres` + `redis` via `docker compose`
5. Aplica migrations
6. Roda seeds (se existirem)

---

## 3. Configurar `.env`

Abra `.env` e ajuste o mínimo necessário para dev:

```env
# Dev local (docker-compose)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/money_mind
REDIS_URL=redis://localhost:6379

# Secrets de dev — gere localmente (NÃO use em prod)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Supabase dev (crie um projeto free em supabase.com)
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Nunca** commite o `.env`. O `.gitignore` já cobre.

Gerar secrets rápido no Windows (Git Bash):

```bash
openssl rand -hex 32
openssl rand -base64 32
```

---

## 4. Rodar dev

```bash
pnpm dev
```

- **Web:** http://localhost:3000
- **API:** http://localhost:3333
- **Swagger:** http://localhost:3333/docs
- **Health api:** http://localhost:3333/health
- **Health web:** http://localhost:3000/api/health

Para checar os dois de uma vez:

```bash
bash scripts/healthcheck.sh
```

---

## 5. pgAdmin (opcional)

```bash
docker compose --profile tools up -d pgadmin
```

Acesse http://localhost:5050 — `admin@moneymind.local` / `admin`.

Server: `postgres:5432` (de dentro do docker network) ou `localhost:5432` (do host).

---

## 6. Primeiros testes

```bash
pnpm lint        # ESLint
pnpm typecheck   # TSC
pnpm test        # Jest / Vitest
pnpm build       # Build turbo
```

---

## 7. Reset do banco (cuidado — destrutivo)

```bash
bash scripts/reset-db.sh
```

Protege contra execução acidental em prod (exige digitar `RESET` e bloqueia URLs de Supabase/Render).

---

## 8. Backup local

```bash
bash scripts/backup-db.sh
# gera backups/money_mind_<timestamp>.dump
```

Restaurar:

```bash
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/arquivo.dump
```

---

## 9. Tipos do Supabase (opcional)

```bash
supabase login
SUPABASE_PROJECT_ID=abcxyz123 bash scripts/gen-types.sh
```

---

## 10. Workflow Git

Antes do primeiro commit, instale os hooks:

```bash
bash scripts/setup-husky.sh
```

Convenção de commits obrigatória (Conventional Commits):

```
feat(accounts-payable): permitir baixa parcial
fix(auth): corrigir expiração de refresh token
docs(readme): atualizar quickstart
```

Ver `docs/CONTRIBUTING.md`.

---

## Troubleshooting

| Problema | Solução |
|---|---|
| `pnpm install` falha com EPERM no Windows | Feche VSCode / antivírus; rode em Git Bash como admin |
| `docker: Cannot connect` | Abra Docker Desktop e aguarde ficar "Running" |
| Porta 5432/6379 ocupada | Mate processo local: `lsof -i :5432` (ou Task Manager) |
| `ECONNREFUSED` em `pnpm dev` | Verifique `docker compose ps` — containers UP? |
| Migrations não rodam | Cheque `DATABASE_URL` no `.env` + container healthy |
| "RLS policy violated" | Rodou como anon key em tabela com RLS — use service role key em migrations |

Qualquer outro problema → abrir issue com log completo e output de `pnpm --version`, `node --version`, `docker --version`.
