# Security — MONEY MIND

> Defesa em profundidade. Mais detalhes em `../ARQUITETURA_TECNICA.md` (linhas 6003–7067).

---

## 1. Multi-tenant — RLS obrigatório

Toda tabela de negócio tem `tenant_id UUID NOT NULL`. Exemplo de policy:

```sql
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON accounts_payable
  FOR ALL
  USING  (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

A API faz no começo de cada transação:

```sql
SET LOCAL app.tenant_id = '<tenant-uuid-do-jwt>';
```

**Regra de ouro:** o código nunca confia em `WHERE tenant_id = ?`; confia na RLS. Se esquecer o `SET LOCAL`, a query retorna vazio, não dados vazados.

---

## 2. Autenticação

- Supabase Auth como IdP (email+senha, Google OAuth, magic link)
- Frontend usa `@supabase/auth-helpers-nextjs` → sessão JWT
- API valida JWT via `SUPABASE_JWT_SECRET` em guard global (`JwtAuthGuard`)
- Claims custom: `tenant_id`, `role` (`owner | admin | operator | viewer`)
- Refresh tokens rotativos via Supabase (default 1h access / 7d refresh)

---

## 3. Autorização

- RBAC simples: `role` no JWT + `@Roles('admin', 'owner')` decorator nos controllers
- RLS é a última linha de defesa (mesmo se o guard falhar)
- Rotas sensíveis (`/admin/*`, `/billing/*`) exigem `owner`

---

## 4. Criptografia

### Em repouso

- Postgres: TDE provido pelo Supabase
- **Tokens de integração** (Tiny, Conta Simples, Pagar.me) — AES-256-GCM com chave em `ENCRYPTION_KEY`
  - IV aleatório por registro
  - AAD = `tenant_id` para prevenir swap
  - Helper `packages/crypto/encrypt.ts`

### Em trânsito

- TLS 1.2+ obrigatório em Vercel/Render/Supabase
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (via `vercel.json`)

---

## 5. Secrets management

- Dev: `.env` local (git-ignored)
- Prod: Vercel Env + Render Env (nunca em código/repo)
- Rotação: a cada 90 dias (JWT_SECRET, ENCRYPTION_KEY); rotate imediato se vazar
- CI: GitHub Environment Secrets com approval em `production`

---

## 6. Headers HTTP (web)

Setados em `apps/web/vercel.json`:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cache-Control: no-store` em `/api/*`

API (NestJS) usa `helmet` + CSP estrito.

---

## 7. CORS

Produção:

```
allowedOrigins: ['https://app.moneymind.com.br']
allowedHeaders: ['Authorization','Content-Type','X-Tenant-Id']
credentials: true
```

Nunca `*` em prod.

---

## 8. Rate limiting

- Redis-backed (pacote `@nestjs/throttler` + store Redis)
- Default: 100 req/min por IP+user
- `/auth/*`: 10 req/min (anti brute-force)
- `/webhooks/*`: verificado por assinatura HMAC, sem rate-limit agressivo

---

## 9. CSRF

- Web usa NextAuth com `sameSite=strict` cookies
- Rotas `POST` do app server (não da API REST) exigem CSRF token
- API REST é stateless (JWT) — CSRF não se aplica

---

## 10. Validação de input

- Todos os DTOs usam `class-validator` + `class-transformer`
- `ValidationPipe` global com `whitelist: true, forbidNonWhitelisted: true`
- Schemas compartilhados via `packages/schemas` (Zod) entre api e web

---

## 11. SQL Injection

- TypeORM com parâmetros bindados sempre
- `RawQuery` proibido fora de `packages/db` com revisão obrigatória

---

## 12. Webhooks recebidos

- Assinatura HMAC SHA-256 em header `X-Signature`
- Timestamp com tolerância ±5min (anti-replay)
- IdempotencyKey persistido por 7 dias

---

## 13. Auditoria

Tabela `audit_log` append-only (nunca UPDATE/DELETE):

```
id, tenant_id, actor_user_id, action, entity, entity_id,
ip, user_agent, before_json, after_json, created_at
```

Eventos auditados: login, alteração de usuário/role, criação/baixa de AR/AP, alteração de credenciais de integração, export de dados.

---

## 14. Backups

- Supabase backups diários (retenção 7d no Free, 30d no Pro)
- PITR no Pro (1 segundo de granularidade, 7 dias)
- Dump manual antes de migrations via `db-migrate.yml`
- Dump local via `scripts/backup-db.sh`
- Restore testado trimestralmente (ver `docs/RUNBOOK.md`)

---

## 15. LGPD

### Base legal
Contrato (execução do serviço de BPO) + Consentimento (newsletter/marketing).

### Direitos dos titulares

- Acesso, retificação, exclusão, portabilidade, oposição
- Endpoint `/v1/lgpd/data-export` (próprio titular baixa seus dados)
- Endpoint `/v1/lgpd/data-erasure` (soft-delete com hash de identificação para logs legais)

### DPO

- Contato: `dpo@grupolauxen.com.br`
- SLA de resposta: 15 dias

### Retenção

- Dados de cliente ativo: pelo tempo do contrato
- Dados pós-cancelamento: 5 anos (obrigação fiscal LGPD Art. 16 II)
- Logs técnicos: 90 dias
- Backups: 30 dias

### Subprocessadores

Lista pública em `/legal/privacy` — Supabase, Render, Vercel, Sentry, Google (Auth).

---

## 16. Logs sem PII

- CPF/CNPJ: loggar apenas últimos 2 dígitos
- Email: `u***@dominio.com`
- Tokens: nunca
- Body de request: redactar campos sensíveis via middleware Pino

Config em `apps/api/src/observability/logger.ts` (ver `docs/OBSERVABILITY.md`).

---

## 17. Dependency scanning

- Dependabot semanal (ver `.github/dependabot.yml`)
- `pnpm audit --audit-level=high` no CI
- CodeQL scan em push/PR e agendado (ver `.github/workflows/codeql.yml`)

---

## 18. Incidente — plano curto

1. Detectar (alerta Sentry / paging manual)
2. Contenção (rotate secret / rollback deploy / block IP)
3. Erradicação (patch)
4. Recuperação (restore se necessário)
5. Postmortem em 7 dias úteis
6. Comunicação a titulares afetados em <72h se houver exposição de PII (Art. 48 LGPD)

Ver `docs/RUNBOOK.md` para procedimentos operacionais.

---

## 19. Hardening checklist (rodar pré-deploy)

Ver `../SECURITY_CHECKLIST.md` — gate obrigatório antes de cada release.
