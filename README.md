# MONEY MIND — BPO Financeiro

Sistema BPO financeiro multi-tenant que replica as telas do Tiny ERP e adiciona camadas de conciliação inteligente e IA. Construído para o Grupo Lauxen (BlueLight, Industrias Neon, Atacado Neon, Engagge Placas, RYU Biotech), mas arquitetado para escalar para qualquer organização.

> Status: MVP em desenvolvimento. Operador: Everton Lauxen.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript strict + shadcn/ui + Tailwind + TanStack Query + Zustand
- **Backend:** NestJS + TypeORM + class-validator + Swagger + BullMQ + Redis
- **Database:** PostgreSQL 16 (Supabase) com RLS, pg_trgm, particionamento
- **Monorepo:** Turborepo + pnpm workspaces
- **Deploy:** Vercel (web) + Render (api)

## Estrutura do monorepo

```
money-mind/
├── apps/
│   ├── web/                      # Next.js 14 (criado pelo Agente 2)
│   └── api/                      # NestJS (criado pelo Agente 3)
├── packages/
│   ├── shared-types/             # Tipos/enums/DTOs compartilhados
│   ├── utils/                    # Currency, date, cpf/cnpj, trigram, AES-256-GCM, OFX
│   └── config/                   # Presets ESLint, Tailwind, tsconfig
├── db/
│   ├── migrations/               # 9 migrations SQL (25 tabelas)
│   └── seed/                     # Seed org + empresas + categorias + formas + contas
├── docker-compose.yml            # Postgres 16 + Redis 7 (+ pgAdmin opcional)
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── README.md
```

## Pré-requisitos

- Node 20+ (veja `.nvmrc`)
- pnpm 9+
- Docker Desktop (para Postgres e Redis locais)

## Como rodar (dev)

```bash
# 1. Instalar dependências
pnpm install

# 2. Copiar .env de exemplo e preencher
cp .env.example .env

# 3. Subir Postgres 16 + Redis 7 locais
pnpm docker:up

# 4. Aplicar as 9 migrations (idempotentes)
pnpm db:migrate

# 5. Popular o banco com dados iniciais
pnpm db:seed

# 6. Subir todos os apps em paralelo (web + api)
pnpm dev
```

Endpoints padrão:

- Web: http://localhost:3000
- API: http://localhost:3333 (Swagger em /api/docs)
- pgAdmin (opcional): http://localhost:5050 — `docker compose --profile tools up -d`

## Scripts úteis

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe web e api em paralelo (turbo) |
| `pnpm build` | Build de todos os packages/apps |
| `pnpm lint` | ESLint em todo o monorepo |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm test` | Testes (vitest + jest) |
| `pnpm db:migrate` | Aplica migrations em ordem |
| `pnpm db:seed` | Popula dados iniciais |
| `pnpm db:reset` | Drop + migrate + seed (DEV apenas) |
| `pnpm docker:up` | Sobe Postgres + Redis |
| `pnpm docker:down` | Para containers |
| `pnpm format` | Prettier em todo o projeto |

## Schema do banco

25 tabelas divididas em 5 domínios:

| Domínio | Tabelas |
|---|---|
| Core | organizations, profiles, org_members, companies |
| Cadastros | contatos, categorias, marcadores, formas_pagamento |
| Bancário | contas_bancarias, import_batches, extratos_bancarios |
| Financeiro | contas_pagar, contas_receber, movimentacoes_caixa, pagamentos, recebimentos, cobrancas_bancarias |
| Conciliação | reconciliations, reconciliation_rules, ai_suggestions, padroes_conciliacao |
| Operacional | audit_log (particionada), anexos, relatorios_saved, notificacoes, sync_jobs |

Todas as tabelas multi-tenant têm coluna `org_id`, RLS ativo via função `get_org_id()`, soft delete (`deleted_at`), trigram GIN index nos campos de busca e trigger `updated_at` automático.

## Multi-tenant e segurança

- RLS ativo em todas as tabelas `org_id`-scoped. A policy lê `app.current_org_id` (session var) ou o claim `org_id` do JWT Supabase.
- Credenciais externas (Tiny, Conta Simples, Pagar.me) armazenadas como `BYTEA` encriptadas com AES-256-GCM (helpers em `@money-mind/utils/encryption`).
- Audit log imutável (trigger impede UPDATE/DELETE), particionado por mês.

## Packages compartilhados

### `@money-mind/shared-types`
Entidades (ContaPagar, ContaReceber, Contato, Company, Organization, ExtratoLinha, FormaPagamento, ContaBancaria, Categoria, Reconciliation), enums (Situacao, ReconciliationStatus, Role, TipoPessoa), DTOs (PaginationParams, PaginatedResponse, ApiResponse).

### `@money-mind/utils`
- `formatCurrency`, `parseCurrency`, `roundMoney`, `pgNumericToNumber`
- `formatDate` (dd/MM/yyyy), `formatDateTime`, `parseDateBr`, `diffDays`, `isVencida`
- `isValidCpf`, `isValidCnpj`, `isValidCpfCnpj`, `formatCpfCnpj`
- `trigramNormalize`, `trigramSimilarity`
- `encrypt`, `decrypt` (AES-256-GCM)
- `parseOfxStub`, `hashOfxContent`
- `isValidCep`, `formatCep`

### `@money-mind/config`
Presets para ESLint, Tailwind e TypeScript.

## Próximos passos (outros agentes)

- **Agente 2:** `apps/web` — Next.js 14 App Router com todas as telas
- **Agente 3:** `apps/api` — NestJS com módulos, entities TypeORM, endpoints, auth Supabase
- **Agente 4:** Deploy (Vercel + Render), CI/CD, observabilidade

## Licença

Privado — Grupo Lauxen / Everton Lauxen.
