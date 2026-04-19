# Database — MONEY MIND

> Postgres 16 gerenciado pelo Supabase. Multi-tenant por **Row Level Security (RLS)**. Modelagem completa em `../ARQUITETURA_TECNICA.md`.

---

## Convenções de naming

| Elemento | Convenção | Exemplo |
|---|---|---|
| Tabelas | `snake_case` plural | `accounts_payable` |
| Colunas | `snake_case` | `due_date`, `amount_cents` |
| PKs | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| FKs | `<tabela_singular>_id` | `contact_id`, `tenant_id` |
| Booleans | `is_*` | `is_active` |
| Timestamps | `created_at`, `updated_at`, `deleted_at` | `timestamptz` |
| Dinheiro | `*_cents BIGINT` (centavos, nunca float) | `amount_cents` |
| Enums | tabela lookup ou `CREATE TYPE` | `status ap_status` |
| Índices | `idx_<tabela>_<colunas>` | `idx_ap_tenant_due` |
| Constraints | `chk_<tabela>_<regra>`, `fk_<tabela>_<col>`, `uq_<tabela>_<cols>` | `uq_users_email_tenant` |

---

## Multi-tenant

Todas as tabelas de negócio têm `tenant_id UUID NOT NULL` + RLS habilitada:

```sql
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON accounts_payable
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_mod ON accounts_payable
  FOR ALL   USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

A API seta o contexto no início da transação:

```sql
BEGIN;
SET LOCAL app.tenant_id = 'xxxxxxxx-xxxx-...';
-- queries
COMMIT;
```

Helpers em `packages/db/src/run-with-tenant.ts`.

### Tabelas que NÃO têm `tenant_id`

- `tenants` (raiz)
- `users` (pertence a múltiplos tenants via `user_tenants`)
- `plans`, `subscriptions` (billing no nível do tenant via FK)
- `audit_log` (particionada por `tenant_id` mas acessível ao owner do SaaS)

---

## Diagrama relacional (MVP)

```
tenants ─┬─< user_tenants >─ users
         │
         ├─< chart_of_accounts
         ├─< categories (receita/despesa)
         ├─< cost_centers
         ├─< contacts (clientes + fornecedores)
         │     │
         │     ├─< accounts_payable >─ category_id, cost_center_id
         │     └─< accounts_receivable
         │
         ├─< bank_accounts
         │     └─< bank_statements
         │            └─< bank_transactions
         │                    └─< reconciliations >─ accounts_payable/receivable
         │
         ├─< integrations_credentials (cifradas)
         └─< audit_log (append-only)
```

---

## Extensões Postgres usadas

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_*
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid, digest
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- busca fuzzy em conciliação
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- normalizar descrições OFX
```

---

## Migrations

- Localizadas em `db/migrations/*.sql` (Agente 1)
- Naming: `YYYYMMDDHHMMSS_descricao.sql`
- Runner: `db/run-migrations.ts` (tsx)
- Cada migration em uma transação
- `DOWN` opcional em `db/migrations/*.down.sql` (não roda em CI)

---

## Soft delete

Padrão: coluna `deleted_at timestamptz NULL` + views `v_<tabela>_active` que filtram `WHERE deleted_at IS NULL`.

API usa a view para listagens. Delete físico apenas via job de compliance (LGPD erasure) após 5 anos.

---

## Dinheiro

- Sempre `BIGINT` em **centavos** (`amount_cents`)
- Nunca `FLOAT`, `DOUBLE`, `NUMERIC` para valor — evita drift de arredondamento
- Moeda padrão: BRL. Quando multi-moeda: coluna `currency CHAR(3)` + FX histórica

---

## Timestamps

- Sempre `timestamptz` (armazenado em UTC)
- API serializa em ISO 8601 com offset local (`-03:00`)
- Timezone default da sessão: `America/Sao_Paulo` (definido em migration inicial)

---

## Índices de performance

- FKs SEMPRE indexadas
- `idx_ap_tenant_status_due ON accounts_payable(tenant_id, status, due_date)` — queries de dashboard
- `idx_bt_tenant_date ON bank_transactions(tenant_id, transaction_date)` — extratos
- `idx_bt_description_trgm USING GIN (description gin_trgm_ops)` — fuzzy match conciliação
- Revisão trimestral via `pg_stat_statements` (ativo no Supabase)

---

## Views materializadas (pós-MVP)

- `mv_cashflow_daily` — refresh nightly
- `mv_dre_monthly` — refresh nightly

---

## Backup / restore

- Supabase: backup diário automático + PITR no Pro
- Manual: `bash scripts/backup-db.sh` (ver `docs/RUNBOOK.md`)

---

## Performance tuning inicial

- `pool_max: 10` para API (Render)
- Supabase pooler (6543) modo `transaction` para API
- Conexão direta (5432) apenas para migrations
- `statement_timeout`: 30s no role da app
- `idle_in_transaction_session_timeout`: 60s

---

## Checklist para novas tabelas

- [ ] PK UUID + default
- [ ] `tenant_id UUID NOT NULL` (se multi-tenant)
- [ ] `created_at`, `updated_at` `timestamptz NOT NULL DEFAULT now()`
- [ ] Trigger `set_updated_at`
- [ ] RLS habilitada + policy tenant
- [ ] FKs indexadas
- [ ] `CHECK` constraints em enums de string (ou tipo enum dedicado)
- [ ] Soft-delete se aplicável
- [ ] Migration de rollback documentada em `*.down.sql`
- [ ] Seed de smoke-test atualizado
