# Deployment — MONEY MIND

> Ambiente: **production** (stack padrão). Adicione `staging` replicando os mesmos passos em projetos Supabase/Render/Vercel separados.

---

## Visão geral

| Camada | Provedor | Como deploya |
|---|---|---|
| Banco | Supabase | Gerenciado (migrations via GitHub Actions) |
| API + Worker | Render | Docker (Dockerfile em `apps/api/`) |
| Web | Vercel | Next.js nativo (build em Vercel) |
| Redis | Render Managed Redis (ou Upstash) | Gerenciado |
| DNS / TLS | Cloudflare (ou similar) | CNAME → Vercel/Render |

---

## 1. Supabase (banco + auth + storage)

1. Criar projeto em https://supabase.com — região `sa-east-1` (São Paulo)
2. Coletar:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `DATABASE_URL` (Connection string → Transaction pooler 6543 p/ serverless, direct 5432 p/ migrations)
3. Configurar **Auth Providers** (email + Google, se aplicável)
4. Habilitar extensões: `pgcrypto`, `uuid-ossp`, `pg_trgm`
5. Rodar migrations (primeiro deploy):

   ```bash
   DATABASE_URL="postgresql://..." pnpm db:migrate
   ```

6. **Ativar backups diários** (Dashboard → Database → Backups)
7. **PITR** (Point-in-Time Recovery) no plano Pro — fortemente recomendado

---

## 2. Render (API + Worker + Redis)

### 2.1 Via Blueprint (`render.yaml`)

1. Dashboard Render → **New** → **Blueprint**
2. Conectar repositório → Render detecta `render.yaml`
3. Confirmar serviços: `money-mind-api` (web), `money-mind-worker`, `money-mind-redis`
4. Setar envs marcadas `sync: false` (ver seção "Secrets")
5. Deploy

### 2.2 Deploy Hook

1. Em cada serviço (api / worker): **Settings** → **Deploy Hook** → copiar URL
2. Adicionar em GitHub Secrets:
   - `RENDER_DEPLOY_HOOK_API`
   - (opcional) `API_HEALTH_URL=https://api.moneymind.com.br/health`

### 2.3 Domínio customizado

- `api.moneymind.com.br` → CNAME para `money-mind-api.onrender.com`
- Render emite TLS automaticamente

---

## 3. Vercel (Web)

### 3.1 Projeto

1. https://vercel.com/new → importar repo
2. **Root Directory:** `apps/web`
3. **Framework Preset:** Next.js
4. **Build Command:** (vazio — `vercel.json` já cobre)
5. **Install Command:** (vazio — `vercel.json` já cobre)
6. Region: `gru1` (São Paulo)

### 3.2 Environment Variables (Production)

Setar no dashboard ou via `vercel env add`:

```
NEXT_PUBLIC_API_URL=https://api.moneymind.com.br
NEXT_PUBLIC_APP_URL=https://app.moneymind.com.br
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.moneymind.com.br
```

### 3.3 CI/CD via GitHub Actions

Alternativa ao GitHub Integration da Vercel (recomendada se quiser pipeline controlado):

```
VERCEL_TOKEN        = <Vercel Account Settings → Tokens>
VERCEL_ORG_ID       = <team/account id>
VERCEL_PROJECT_ID   = <project id>
```

Obter IDs: `vercel link` dentro de `apps/web` gera `.vercel/project.json`.

### 3.4 Domínio

- `app.moneymind.com.br` → CNAME → `cname.vercel-dns.com`

---

## 4. GitHub Actions — Secrets necessários

Em **Settings → Secrets and variables → Actions**:

### Repository Secrets

| Nome | Uso |
|---|---|
| `RENDER_DEPLOY_HOOK_API` | workflow `deploy-api.yml` |
| `API_HEALTH_URL` | healthcheck pós-deploy |
| `VERCEL_TOKEN` | workflow `deploy-web.yml` |
| `VERCEL_ORG_ID` | idem |
| `VERCEL_PROJECT_ID` | idem |

### Environment Secrets (`production`, `staging`)

| Nome | Uso |
|---|---|
| `DATABASE_URL` | workflow `db-migrate.yml` |
| `SUPABASE_SERVICE_ROLE_KEY` | migrations que precisem bypassar RLS |

**Environments protegidos**: em `production`, ativar **Required reviewers** para exigir aprovação manual antes de aplicar migrations.

---

## 5. Checklist de secrets em produção (Render/Vercel)

### Render — `money-mind-api` + `money-mind-worker`

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` (Supabase pooler 6543)
- [ ] `DATABASE_SSL=true`
- [ ] `REDIS_URL` (Render Managed Redis internal URL)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SUPABASE_JWT_SECRET`
- [ ] `JWT_SECRET` (pelo menos 32 bytes)
- [ ] `ENCRYPTION_KEY` (32 bytes base64 — `openssl rand -base64 32`)
- [ ] `SENTRY_DSN`
- [ ] `LOG_LEVEL=info`
- [ ] `APP_URL=https://app.moneymind.com.br`
- [ ] Integrações: `TINY_*`, `CONTA_SIMPLES_*`, `PAGARME_*` (API keys por tenant ficam no banco cifradas)

### Vercel — `money-mind-web`

- [ ] `NEXT_PUBLIC_API_URL`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] `SENTRY_DSN`

---

## 6. Deploy manual (fora do CI)

### API (Render)

```bash
RENDER_DEPLOY_HOOK_API=https://api.render.com/deploy/srv-xxx?key=yyy \
  bash scripts/deploy-api.sh
```

### Web (Vercel)

```bash
VERCEL_TOKEN=... VERCEL_ORG_ID=... VERCEL_PROJECT_ID=... \
  bash scripts/deploy-web.sh production
```

---

## 7. Migrations em produção

Sempre via workflow `db-migrate.yml`:

1. Actions → **DB Migrate (production)** → **Run workflow**
2. `environment=production`, `dry_run=true` (primeira execução)
3. Revisar output + plano
4. Rodar novamente com `dry_run=false`
5. Job faz backup antes (`pg_dump`) e roda `SELECT 1` ao final

Rollback: restaurar o dump do artifact (ver `docs/RUNBOOK.md`).

---

## 8. Smoke test pós-deploy

```bash
API_URL=https://api.moneymind.com.br WEB_URL=https://app.moneymind.com.br \
  bash scripts/healthcheck.sh
```

Esperado: dois `[OK]`.

---

## 9. Rollback rápido

- **Web:** Vercel Dashboard → Deployments → escolher anterior → **Promote to Production**
- **API:** Render Dashboard → Deploys → selecionar anterior → **Rollback**
- **Banco:** ver `docs/RUNBOOK.md`

---

## 10. Custos estimados (MVP)

| Serviço | Plano | USD/mês |
|---|---|---|
| Supabase | Pro | ~25 |
| Render API | Starter | ~7 |
| Render Worker | Starter | ~7 |
| Render Redis | Starter | ~10 |
| Vercel | Pro (time) | 20 |
| Sentry | Team | 26 |
| **Total** | | **~95 USD/mês** |

Otimizações pós-MVP: consolidar worker no mesmo dyno da API (BullMQ inline) se volume permitir; usar Upstash free tier se Redis do Render estourar preço.
