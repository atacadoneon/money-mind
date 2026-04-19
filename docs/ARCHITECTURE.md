# Arquitetura — MONEY MIND

> Resumo executivo. Para arquitetura completa (tabelas, fluxos, queues, integrações), ver `../../ARQUITETURA_TECNICA.md` na raiz do repositório de contexto.

---

## Visão geral

MONEY MIND é um BPO Financeiro SaaS multi-tenant. Cada cliente (tenant) tem seus dados isolados via RLS no Postgres. A aplicação orquestra três domínios principais:

1. **Operacional** — contas a pagar, contas a receber, categorias, centros de custo
2. **Bancário** — conciliação de extratos (OFX/CSV), saldo por conta, DRE gerencial
3. **Integrações** — Tiny ERP (v2/v3), Conta Simples, Pagar.me, ViaCEP, BrasilAPI

---

## Diagrama (alto nível)

```
┌──────────────────────────────────────────────────────────────────────┐
│                           USUÁRIOS (web)                             │
└───────────────┬──────────────────────────────────────────────────────┘
                │ HTTPS
                ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│   VERCEL — Next.js 14       │  REST   │   RENDER — NestJS API       │
│   App Router + shadcn/ui    │────────▶│   /v1/* + /health + /docs   │
│   NextAuth (Supabase)       │  JWT    │   Guards: JWT + Tenant RLS  │
└─────────────┬───────────────┘         └───────┬─────────────────────┘
              │                                 │
              │ (tempo real)                    │ TypeORM
              ▼                                 ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│   SUPABASE REALTIME         │         │   POSTGRES 16 (Supabase)    │
│   row-change subscriptions  │◀────────│   RLS por tenant_id         │
└─────────────────────────────┘         │   pgcrypto (tokens cifrad.) │
                                        └───────┬─────────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────────────────┐
                                        │   REDIS (BullMQ)            │
                                        │   queues: import, sync,     │
                                        │   reconcile, email          │
                                        └───────┬─────────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────────────────┐
                                        │   WORKER (Render)           │
                                        │   consome BullMQ            │
                                        └───────┬─────────────────────┘
                                                │
                                                ▼
                               ┌────────────────┴────────────────┐
                               │  Integrações externas            │
                               │  Tiny v2/v3  •  Conta Simples    │
                               │  Pagar.me    •  ViaCEP           │
                               │  BrasilAPI                       │
                               └──────────────────────────────────┘
```

---

## Decisões-chave (ver ADRs)

| # | Decisão | Motivo |
|---|---------|--------|
| 001 | Monorepo Turborepo + pnpm | compartilhar schemas e UI entre api/web |
| 002 | Supabase managed | auth + postgres + realtime + backups sem ops |
| 003 | NestJS sobre Express | DI, guards, modularidade para crescer |
| 004 | TypeORM sobre Prisma | melhor suporte a migrations SQL complexas e RLS |
| 005 | shadcn/ui sobre MUI | controle total de código + Tailwind nativo |
| 006 | Multi-tenant por RLS | defesa em profundidade, app nunca "esquece" tenant |
| 007 | BullMQ para queues | retries, rate-limit, observability maduro |

---

## Multi-tenant (RLS)

- Toda tabela de negócio tem `tenant_id UUID NOT NULL`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- Policy: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`
- A API faz `SET LOCAL app.tenant_id = :tenantFromJwt` a cada transação (middleware `TenantInterceptor`)
- Service role bypassa RLS apenas em edge functions controladas

---

## Fluxo típico — importar extrato OFX e conciliar

1. Usuário faz upload de OFX no `/web` → POST `/v1/bank-statements/import`
2. API valida + salva arquivo em Supabase Storage + enfileira job `reconcile:import`
3. Worker consome job, parseia OFX, cria `bank_transactions`, tenta match com `accounts_payable`/`accounts_receivable`
4. Matches ambíguos ficam com `status=pending_review`
5. UI mostra sugestões; usuário confirma → `POST /v1/reconciliation/confirm`
6. Evento `reconciled` dispara atualização de saldo e webhook (futuro)

---

## Observability

- **Logs:** Pino estruturado JSON em stdout → Render logs / Vercel logs / agregado no Sentry Logs
- **Traces:** OpenTelemetry SDK com exportador OTLP (ver `docs/OBSERVABILITY.md`)
- **Métricas:** `/metrics` Prometheus (opcional pós-MVP)
- **Erros:** Sentry para api + web com `tenant_id`, `user_id`, `release` como tags

---

## Segurança em camadas

1. **Rede:** TLS em tudo, Vercel/Render isolam ingress
2. **App:** Helmet, CORS estrito, rate-limit (Redis-backed), CSRF em rotas POST do web
3. **Auth:** Supabase Auth → JWT → Guard Nest → RLS
4. **Dados:** RLS + tokens cifrados com AES-256-GCM (chave em env)
5. **Auditoria:** tabela `audit_log` append-only para ações sensíveis

Detalhes em `docs/SECURITY.md`.
