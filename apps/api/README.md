# MONEY MIND — API (NestJS)

BPO Financeiro backend. Multi-tenant via `org_id` + Supabase Auth + TypeORM + BullMQ.

## Rodar

```bash
pnpm install
pnpm --filter api dev
```

API em `http://localhost:3333`, Swagger em `/docs`, healthcheck em `/health`.

## Variáveis .env (raiz)

- `DATABASE_URL`, `DATABASE_SSL=true`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `ENCRYPTION_KEY` (32 bytes hex)
- `CORS_ORIGIN`

## Headers obrigatórios

- `Authorization: Bearer <JWT Supabase>`
- `x-org-id: <uuid>` (exceto rotas em `/organizations` e `/health`)

## Migrations

```bash
pnpm --filter api migration:run
```

## Testes

```bash
pnpm --filter api test
```
