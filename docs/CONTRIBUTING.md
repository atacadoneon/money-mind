# Contributing — MONEY MIND

> Mantenha commits pequenos, mensagens claras, testes passando.

---

## Fluxo

1. Branch a partir de `develop` (ou `main` em hotfix)
2. Commits pequenos e temáticos
3. PR → `develop` com descrição (o que, por quê, screenshot/video se UI)
4. Reviewer aprova → squash & merge
5. Release de `develop` → `main` via PR semanal

---

## Branch naming

| Tipo | Padrão |
|---|---|
| Feature | `feat/<escopo>-<slug>` — ex: `feat/accounts-payable-partial-payment` |
| Fix | `fix/<escopo>-<slug>` |
| Hotfix | `hotfix/<slug>` (saindo de `main`) |
| Chore | `chore/<slug>` |
| Docs | `docs/<slug>` |

---

## Commits — Conventional Commits (obrigatório)

Formato:

```
<type>(<scope>): <subject>

[body opcional]

[footer opcional]
```

**Tipos permitidos:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`.

**Scopes permitidos** (ver `commitlint.config.cjs`): `api`, `web`, `db`, `auth`, `billing`, `accounts-payable`, `accounts-receivable`, `reconciliation`, `integrations`, `tiny`, `conta-simples`, `pagarme`, `tenants`, `users`, `reports`, `docs`, `ci`, `deps`, `infra`, `security`, `observability`, `scripts`, `packages`, `deps-dev`, `release`.

### Exemplos

```
feat(accounts-payable): permitir baixa parcial com retencao
fix(reconciliation): corrigir match quando descricao OFX tem acento
docs(deployment): adicionar passo para rotacao de ENCRYPTION_KEY
ci(deploy-api): adicionar healthcheck pos-deploy
security(auth): validar issuer do JWT Supabase
refactor(web): extrair hook useAccountsPayable
```

### Breaking change

```
feat(api)!: renomear endpoint /v1/bills para /v1/accounts-payable

BREAKING CHANGE: consumidores devem atualizar rota.
```

---

## Hooks Git (Husky)

Primeira vez:

```bash
bash scripts/setup-husky.sh
```

Hooks ativos:

- `pre-commit` — `lint-staged` (ESLint + Prettier só no que mudou)
- `commit-msg` — `commitlint` valida o formato

Para pular em emergência (evitar): `git commit --no-verify` — use só se hook estiver quebrado, e abra PR de fix em seguida.

---

## Testes

- **Unit:** Jest / Vitest — rápidos, sem I/O
- **Integration:** com Postgres + Redis (via docker-compose)
- **E2E (web):** Playwright (pós-MVP)

Antes do PR:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

CI roda o mesmo em GitHub Actions — se falhar, PR não merge.

---

## Code style

- ESLint + Prettier (configs na raiz)
- Sem `any` sem justificativa em comentário
- Sem `console.log` em código de produção — use o logger Pino
- Sem secrets hardcoded — sempre `process.env.*` + validação via `zod` no boot
- Imports absolutos (`@/...`) preferidos sobre relativos longos

---

## Banco / migrations

- Toda mudança de schema → migration em `db/migrations/`
- Nunca `ALTER TABLE` destrutivo sem janela de manutenção
- Adicionar coluna NOT NULL → adicionar nullable primeiro + backfill + constraint
- `ENABLE ROW LEVEL SECURITY` obrigatório em tabelas multi-tenant

---

## Revisão de PR

Checklist do reviewer:

- [ ] Commits seguem Conventional Commits
- [ ] Testes cobrem o caminho feliz + 1 unhappy
- [ ] Sem secrets / PII no código
- [ ] RLS considerada (se tocou DB)
- [ ] Docs atualizados (se mudou API pública)
- [ ] Logs sem dados sensíveis
- [ ] Breaking change → bumped + comunicado

---

## Releases

- Tag semântica `vX.Y.Z` no merge `develop → main`
- Changelog gerado automaticamente (script futuro) a partir dos commits
- Deploy automático via workflow `deploy-*.yml`

---

## Reportar bug / propor feature

1. Abrir issue com template
2. Labels: `bug | feature | chore | security | docs`
3. Prioridade definida em reunião semanal

Para vulnerabilidades: **NÃO abrir issue pública** — ver `.github/SECURITY.md`.
