# Security Checklist — MONEY MIND

> Gate pré-deploy. Toda release para produção deve passar neste checklist. Registre versão + data + responsável ao final.

---

## 1. Segredos e configuração

- [ ] `.env` nunca commitado (verificar `git log --all --full-history -- .env`)
- [ ] Nenhum secret em código (scan `grep -rE "(password|secret|token|api_key)\s*=" --include="*.ts"`)
- [ ] `SUPABASE_JWT_SECRET` configurado (validação JWT no backend; alinhado ao projeto Supabase)
- [ ] `ENCRYPTION_KEY` com `openssl rand -hex 32` (64 caracteres hex = 32 bytes; formato exigido pelo `EncryptionService`)
- [ ] Secrets diferentes em staging e produção
- [ ] Secrets no Vercel/Render marcados como encrypted
- [ ] GitHub Environment `production` com **required reviewers**
- [ ] Rotação programada (calendário) — JWT 90d, ENCRYPTION versionado

## 2. Autenticação e autorização

- [ ] Todas as rotas (exceto públicas) atrás de `JwtAuthGuard`
- [ ] Supabase JWT validado com `SUPABASE_JWT_SECRET` e `issuer` correto
- [ ] Refresh token rotativo habilitado
- [ ] Roles (`owner/admin/operator/viewer`) checadas em rotas sensíveis
- [ ] Admin SaaS separado do admin do tenant
- [ ] Logout invalida sessão (server-side)

## 3. Multi-tenant (RLS)

- [ ] Tabelas de negócio com `org_id NOT NULL` (isolamento por organização)
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nas tabelas expostas ao PostgREST / políticas Supabase
- [ ] Policies alinhadas a `get_org_id()` e `current_setting('app.current_org_id', true)::uuid` (ver `db/migrations/008_rls.sql`)
- [ ] Serviço Nest aplica filtros por `org_id` / contexto de request; não há `TenantInterceptor` com `app.tenant_id` — validar RLS no Postgres + testes de isolamento
- [ ] Smoke test: usuário da org A não vê dados da org B (teste automatizado)
- [ ] `service_role_key` usado apenas em contextos explicitamente privilegiados

## 4. Criptografia

- [ ] TLS 1.2+ em Vercel/Render/Supabase (default)
- [ ] HSTS ativo (`Strict-Transport-Security`) no Vercel
- [ ] Tokens de integração cifrados AES-256-GCM com AAD=tenant_id
- [ ] IV aleatório por registro
- [ ] Chave ENCRYPTION_KEY nunca em log

## 5. Headers HTTP

- [ ] `helmet()` no Nest
- [ ] CSP estrito no Next (headers em `vercel.json`)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` desativando camera/mic/geo

## 6. CORS

- [ ] Em prod: allowedOrigins **lista fechada** (sem `*`)
- [ ] `credentials: true` apenas se necessário
- [ ] Preflight cacheado (`Access-Control-Max-Age: 600`)

## 7. Rate limiting

- [ ] Global: `@nestjs/throttler` — 100 req/min por IP (padrão atual; storage in-memory no processo)
- [ ] **Roadmap:** limites específicos em `/auth/*`, store Redis compartilhado entre réplicas, tracking por usuário autenticado
- [ ] CORS `exposedHeaders` inclui `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after` (quando o guard define headers)

## 8. Validação de input

- [ ] `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` global
- [ ] DTOs com `class-validator` ou Zod
- [ ] Uploads: validar mime + size + scan (pós-MVP)
- [ ] Parâmetros de query sanitizados

## 9. SQL / ORM

- [ ] Todo query parametrizada (nunca concat)
- [ ] Raw SQL revisado em PR
- [ ] Soft-delete em tabelas com LGPD (exclusão real via job)
- [ ] `statement_timeout` e `idle_in_transaction_session_timeout` configurados

## 10. Webhooks recebidos

- [ ] Assinatura HMAC SHA-256 validada
- [ ] Timestamp com tolerância ±5min
- [ ] Idempotency key persistida (7d)
- [ ] Endpoint separado por provider

## 11. Logs / Observability

- [ ] Pino com `redact` configurado (headers, body sensíveis)
- [ ] Sem CPF/CNPJ/email completos em logs
- [ ] Sentry `beforeSend` remove auth/cookie
- [ ] Request ID propagado
- [ ] Release version no Sentry (`RENDER_GIT_COMMIT`)

## 12. Backups

- [ ] Supabase backup diário habilitado
- [ ] PITR habilitado (plano Pro)
- [ ] `db-migrate.yml` gera dump antes de aplicar
- [ ] Teste de restore executado no último trimestre
- [ ] Retenção documentada (30d default)

## 13. Auditoria

- [ ] `audit_log` criada e populada em eventos sensíveis
- [ ] Append-only (sem UPDATE/DELETE via app)
- [ ] Particionamento por mês (pós-MVP se volume alto)

## 14. LGPD

- [ ] Política de privacidade publicada (`/legal/privacy`)
- [ ] Endpoint `/v1/lgpd/data-export` funcional
- [ ] Endpoint `/v1/lgpd/data-erasure` com soft-delete + tombstone
- [ ] DPO definido e contato público
- [ ] Lista de subprocessadores publicada
- [ ] Retenção de 5 anos pós-cancelamento (obrigação fiscal)

## 15. Dependências

- [ ] `pnpm audit --audit-level=high` limpo (ou aceitos com justificativa)
- [ ] Dependabot ativo
- [ ] CodeQL scan ativo
- [ ] Nenhuma dep com licença incompatível (GPL em módulo proprietário, etc.)

## 16. Infra

- [ ] API não-root no Dockerfile
- [ ] Healthcheck no Dockerfile
- [ ] `.dockerignore` e `.vercelignore` excluem `.env`, `.git`, `node_modules`
- [ ] Render service sem SSH público desnecessário
- [ ] Supabase: `auth.allowed_email_domains` configurado se aplicável

## 17. CI/CD

- [ ] Nenhum job executa com `pull_request_target` sem necessidade
- [ ] `permissions:` mínimas nos workflows
- [ ] Secrets não impressos em logs (usar `::add-mask::` ou evitar `echo`)
- [ ] Deploy para prod exige approval (environment protection)

## 18. Pós-deploy

- [ ] `scripts/healthcheck.sh` passou
- [ ] Sentry não registrando spike
- [ ] Smoke test manual em 3 fluxos críticos (login, criar AP, upload OFX)
- [ ] Monitoring dashboards abertos por 30 min após release

---

## Assinatura

```
Release:      vX.Y.Z
Data:         YYYY-MM-DD HH:MM (America/Sao_Paulo)
Responsável:  ________________
Aprovadores:  ________________
Observações:  ________________
```
