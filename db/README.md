# Banco de dados — migrations

- **Fonte única:** `db/migrations/*.sql` (ordem lexicográfica `001_…` … `015_…`).
- **Aplicar:** na raiz do monorepo, `pnpm db:migrate` (requer `DATABASE_URL`).
- **Dry-run:** `pnpm db:migrate:dry-run` ou `DRY_RUN=true pnpm db:migrate`.
- **Docker dev:** o `docker-compose` monta estas SQL no `initdb` só na **primeira** criação do volume; use `pnpm db:migrate` para controle e tabela `_migrations`.
- **TypeORM:** o CLI em `apps/api` não substitui este fluxo; schema vem destes arquivos SQL.
