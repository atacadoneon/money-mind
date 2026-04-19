# MONEY MIND — BPO FINANCEIRO | ESTADO FINAL

Data: 2026-04-14
Builds: **API OK · Web OK**

---

## Números

| Métrica | Valor |
|---|---|
| Arquivos TS backend | **216** |
| Arquivos TS frontend | **168** |
| Packages compartilhados | **35 arquivos TS** |
| Migrations SQL | **15** (26+ tabelas) |
| Rotas frontend (Next.js) | **43** |
| Módulos NestJS | **30+** |
| Tests unit backend | **32 spec files** (100+ casos) |
| Tests unit frontend | **6 test files** |
| E2E Playwright | **14 specs** (~46 casos) |
| k6 load scripts | **5** (smoke/load/stress/spike/soak) |
| Docs | **21 arquivos markdown** |
| Docs legais LGPD | **8** |
| Email templates | **13** (React + HTML) |
| Help center articles | **13 MDX** |

---

## Rotas frontend (43)

### App autenticado
`/inicio`, `/onboarding`, `/cadastros/{categorias|clientes-fornecedores|clientes-fornecedores/[id]|formas-pagamento}`, `/configuracoes/{billing|lgpd|webhooks}`, `/financas/{caixa|cobranca-regua|cobrancas-bancarias|conciliacao|conta-digital|contas-a-pagar|contas-a-receber|extratos-bancarios|relatorios|transacoes-vendas}`, `/planos`

### Marketing público
`/landing`, `/precos`, `/sobre`, `/contato`, `/`

### Legal público
`/termos`, `/privacidade`, `/cookies`, `/dpa`, `/dpo`, `/sla`, `/seguranca`

### Help center público
`/help`, `/help/[category]`, `/help/[category]/[slug]`

### Infra
`/status`, `/login`, `/register`, `/api/health`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`

---

## Backend — módulos implementados

### Core
- `auth` — Supabase JWT + OrgContext + Roles guards
- `organizations`, `companies`, `profiles`, `org_members`
- `contatos`, `categorias`, `formas-pagamento`, `marcadores`
- `contas-bancarias`, `extratos-bancarios` (OFX parser multi-banco)
- `contas-pagar`, `contas-receber` (CRUD + baixa real + bulk + import/export XLSX)
- `reconciliation` (4-layer engine: exact → tolerance → trigram → Claude AI)
- `audit-log` (interceptor automático + WORM trigger DB)
- `caixa`, `conta-digital`, `cobrancas-bancarias`
- `relatorios` (DRE + Fluxo Caixa + Por Categoria + Top Contatos)

### MCPs (8 domínios)
- `mcps/tiny` — V2 + V3 clients, sync bidirecional CP/CR/contatos
- `mcps/bancos` — Sicoob (OAuth2+mTLS), Itaú, BB, Olist, Conta Simples (REAL)
- `mcps/gateways` — Pagar.me v5 (REAL), AppMax CSV, Stripe stub, Mercado Pago stub
- `mcps/comunicacao` — Gupshup WhatsApp, SendGrid, Twilio + 5 templates cobrança

### SaaS
- `billing` — Stripe subscription (checkout + portal + webhook), 4 planos, trial 14d auto, plan gate decorator
- `lgpd` — export/erasure async, consentimentos granulares, audit exportável
- `webhooks` — inbound (Pagarme/Sicoob/Gupshup) + outbound HMAC-SHA256

### Workers BullMQ
- `tiny-sync`, `extrato-parse`, `reconciliation`, `ai-suggest`
- `bancos-sync`, `gateways-sync`, `cobranca-regua`, `lgpd`

### Observability + Security
- `observability/sentry.setup.ts` — PII redact, profiling
- `observability/otel.setup.ts` — OpenTelemetry stub ativável
- `@nestjs/throttler` — rate limit 100/min/IP global, custom em endpoints pesados
- Helmet CSP + HSTS + XFO + Referrer-Policy + Permissions-Policy
- `FileValidationPipe` — magic number + MIME para OFX/XLSX/PDF/CSV
- AES-256-GCM encryption service (tokens Tiny/Conta Simples/Pagarme)

---

## Frontend — features

### Fluxos completos
- **Onboarding wizard** 8 steps (dados empresa → integração Tiny → Conta Simples → import dados → marcador CLAUDE → tour)
- **Import wizard** 5 steps (upload → mapping → validate → confirm → results)
- **Conciliação drag-to-match** com @dnd-kit, split-screen redimensionável (react-resizable-panels), sugestões IA com polling
- **Command Palette** Cmd+K (15+ ações + recentes)
- **Notification Center** com Supabase Realtime subscribe
- **Keyboard shortcuts** `g i/p/r/c`, `n p/r/c`, `/`, `?`, `Esc`

### Billing UI
- Checkout via Stripe Customer Portal
- 4 planos (Starter R$49 / Pro R$149 / Business R$449 / Enterprise)
- Trial banner + uso atual (empresas ativas, transações mês)
- Histórico faturas com PDF download
- Feature flags client-side

### LGPD UI
- Export data request (download JSON)
- Erasure request (confirmação dupla)
- Consent management granular
- Audit log do user corrente
- Cookie banner com preferências

### Observability
- Sentry client/server/edge + instrumentation.ts
- PWA: manifest + service worker stale-while-revalidate
- i18n next-intl (pt-BR completo, en-US parcial)

---

## Database (26+ tabelas)

| Migration | Conteúdo |
|---|---|
| 001 | Extensions (uuid-ossp, pg_trgm, pgcrypto) |
| 002 | Core (organizations, profiles, org_members, companies) |
| 003 | Cadastros (contatos, categorias, formas_pagamento, marcadores) |
| 004 | Bancário (contas_bancarias, extratos_bancarios, extrato_linhas, import_batches) |
| 005 | Financeiro (contas_pagar, contas_receber, pagamentos, recebimentos, movimentacoes_caixa, cobrancas_bancarias) |
| 006 | Reconciliation (reconciliations GENERATED diferenca, reconciliation_rules, ai_suggestions, padroes_conciliacao) |
| 007 | Operacional (audit_log particionado 2026-2027, anexos, relatorios_saved, notificacoes, sync_jobs) |
| 008 | RLS policies + get_org_id() function |
| 009 | Indexes (trigram GIN, btree, FKs cruzadas) |
| 010 | transacoes_vendas (gateways) |
| 011 | comunicacoes_log |
| 012 | webhooks_subscriptions |
| 013 | billing (subscriptions, invoices, plans, feature_flags_usage) |
| 014 | LGPD (consents) |
| 015 | audit_worm (trigger imutabilidade) |

---

## Docs

### Técnicos (docs/)
ARCHITECTURE, API, DATABASE, DEPLOYMENT, GETTING_STARTED, CONTRIBUTING, SECURITY, RUNBOOK, MONITORING, OBSERVABILITY, SECRETS_ROTATION, SECURITY_PENTESTING, LOAD_TEST_RESULTS, ADRs (7)

### Legais (docs/legal/)
TERMOS_DE_USO, POLITICA_PRIVACIDADE, DPA, POLITICA_COOKIES, POLITICA_SEGURANCA, SLA, CONTRATO_SAAS_PADRAO, DPO_CONTATO

### Help Center (apps/web/content/help/)
13 MDX articles em 6 categorias (primeiros passos, conciliação, CP/CR, relatórios, cobrança, billing/LGPD)

---

## CI/CD

`.github/workflows/`:
- `ci.yml` — install + lint + typecheck + test + build (matrix) + test-coverage (Codecov) + security-scan (Semgrep + Trivy) + bundle-size
- `codeql.yml` — SAST
- `deploy-api.yml` — Render webhook
- `deploy-web.yml` — Vercel CLI
- `db-migrate.yml` — manual approval
- `backup-drill.yml` — restore drill mensal + Slack notif
- `dependabot.yml` — updates automáticos

`.husky/` — pre-commit (lint-staged) + commit-msg (commitlint Conventional)

---

## Deploy

- **render.yaml** — blueprint api + redis
- **vercel.json** — config web + regions
- **Dockerfiles** — api + web multi-stage Alpine
- **docker-compose.yml** — dev local (postgres 16 + redis 7 + pgAdmin opcional)
- **docker-compose.prod.yml** — exemplo self-hosted

---

## Como rodar local

```bash
cd "C:/CLAUDECODE/CONCILIADOR FINANCEIRO/MONEY MIND - BPO FINANCEIRO"
pnpm install
cp .env.example .env                    # preencher: DATABASE_URL, REDIS_URL, SUPABASE_*, STRIPE_*, ENCRYPTION_KEY, SENTRY_DSN, ANTHROPIC_API_KEY
pnpm docker:up                          # postgres + redis
pnpm db:migrate                         # aplica 15 migrations
pnpm db:seed                            # Grupo Lauxen + 5 empresas + plano contas
pnpm dev                                # api:3001 + web:3000

# Tests
pnpm --filter api test                  # unit backend
pnpm --filter api test:cov              # coverage
pnpm --filter web test                  # unit frontend (vitest)
pnpm --filter web e2e                   # E2E Playwright (requer api rodando)

# Load
pnpm load:smoke                         # 2 VUs, 1 min
pnpm load:load                          # 100 VUs, 22 min
pnpm load:full                          # todos os cenários
```

---

## Pendências finais para go-live

### Configuração obrigatória (antes prod)
1. **CNPJs reais** das 5 empresas do Grupo Lauxen no seed (hoje `null`)
2. **Secrets em prod**: `DATABASE_URL` Supabase, `REDIS_URL`, `ENCRYPTION_KEY` (32 bytes), `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `ANTHROPIC_API_KEY`, `CORS_ORIGIN`
3. **Stripe Products + Prices** — criar 4 produtos no dashboard, preencher `stripe_price_id` na tabela `plans`
4. **Supabase Auth** — configurar providers (email, Google SSO opcional)
5. **Domínios custom** — Vercel (web) + Render (api) + moneymind.com.br
6. **DNS MX** para emails transacionais via SendGrid
7. **Webhook Stripe** apontando para `https://api.moneymind.com.br/billing/webhook`

### Não implementados (escopo futuro)
- **Pentesting externo** contratado (checklist OWASP pronto em `docs/SECURITY_PENTESTING.md`)
- **Cron jobs prod**: trial expirando, régua cobrança diária 9h — workers BullMQ prontos, faltam schedules
- **CBC DDA/remessa CNAB 240/400** — estruturas básicas existem, processamento completo pendente
- **Mobile app** nativo — PWA funcional substitui parcialmente
- **Edge functions Supabase** para latência LatAm
- **SSO SAML Enterprise** (Okta, Azure AD)
- **BYOK** (Bring Your Own Key) AWS KMS/GCP KMS

### Gaps menores conhecidos
- Pino logger instalado mas não substitui Logger Nest default (integração pendente)
- Prometheus endpoint `/metrics` com `prom-client` — MetricsService stub funcional, exporter pendente
- Driver.js tour no onboarding — step informativo estático por enquanto
- next-intl switch de idioma UI — estrutura pronta, toggle pendente
- 3 telas ainda com fallback mock quando backend retorna 404 (graceful)

---

## Validação Everton

**Antes de queimar mais tempo construindo, valide comercialmente:**

1. **Fase 1 (já entregue)**: Use no Grupo Lauxen por 30 dias. Meça horas economizadas por semana.
2. **Fase 2 (validação)**: Mostre para 5 empresas conhecidas (contadores, colegas empresários). Pergunte: "pagaria R$149/mês por isso?"
3. **Fase 3 (escala)**: Se 3+ disseram sim → implementar gaps restantes + go-to-market. Se não → pivota posicionamento.

**Custo infra mensal prod estimado**: US$ 170–250 (~R$850–1250) + variável por uso (Claude API, WhatsApp, Stripe fees).

**Decisão**: você tem produto vendável. Agora é **validação comercial**, não mais construção.
