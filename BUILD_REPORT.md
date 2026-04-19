# MONEY MIND — Relatório de Build

Data: 2026-04-14

## Status: MVP Foundation buildável

| Workspace | Install | Typecheck | Build |
|---|---|---|---|
| `packages/shared-types` | OK | OK | — (types-only) |
| `packages/utils` | OK | OK | — |
| `packages/config` | OK | — | — |
| `apps/api` (NestJS) | OK | OK | OK (`dist/` gerado) |
| `apps/web` (Next.js 14) | OK | OK | OK (21 rotas, SSG+SSR) |

## Correções feitas nesta validação

1. `apps/api/package.json` → `ofx-js` de `^1.0.2` para `^0.2.0` (versão correta do npm)
2. `apps/web/src/types/index.ts` → `ContasReceberFilters` trocada de intersection simples para `Omit<..., "status"> &` para não colidir com `StatusContaPagar`
3. `apps/web/src/app/(app)/financas/conta-digital/page.tsx` → guard `&& contas[0]` para eliminar undefined possível
4. Root `package.json` → adicionadas devDeps `eslint-config-prettier`, `eslint-plugin-import`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`

## Rotas web geradas (21)

Auth: `/login`, `/register`
App: `/inicio`
Cadastros: `/cadastros/categorias`, `/clientes-fornecedores`, `/clientes-fornecedores/[id]`, `/formas-pagamento`
Finanças: `/caixa`, `/cobrancas-bancarias`, `/conciliacao`, `/conta-digital`, `/contas-a-pagar`, `/contas-a-receber`, `/extratos-bancarios`, `/relatorios`, `/transacoes-vendas`
Sistema: `/configuracoes`, `/api/health`

## Como rodar local

```bash
cd "C:/CLAUDECODE/CONCILIADOR FINANCEIRO/MONEY MIND - BPO FINANCEIRO"
pnpm install
cp .env.example .env          # preencher DATABASE_URL, REDIS_URL, SUPABASE_*, ENCRYPTION_KEY
pnpm docker:up                # postgres:16 + redis:7
pnpm db:migrate               # aplica 9 migrations (26 tabelas)
pnpm db:seed                  # Grupo Lauxen + 5 empresas + plano de contas
pnpm dev                      # turbo dev — api:3001 + web:3000
```

## Pendências conhecidas (não bloqueiam build)

1. **Endpoints backend faltantes** — algumas telas (caixa, conta-digital, transacoes-vendas, cobrancas-bancarias, relatorios, reconciliation/suggestions) chamam endpoints que ainda não existem no `apps/api`. Frontend trata com EmptyState no 404.
2. **CNPJs reais das 5 empresas** — seed usa `null` (BlueLight, Industrias Neon, Atacado Neon, Engagge Placas, RYU Biotech)
3. **Motor IA (Claude)** — stub apenas; integração real fica pós-MVP
4. **Integrações Tiny V2/V3, Conta Simples, Pagar.me, AppMax** — interfaces/workers stubs; MCPs não implementados (escopo PARTE IV)
5. **DateRangePicker** — tela CP/CR/caixa/relatorios usam dois inputs separados (substituir por shadcn Calendar + Popover)
6. **Filtros avançados CP/CR** — botão "Mais filtros" placeholder
7. **Tests** — framework configurado (Jest/Vitest), apenas 1-3 testes de exemplo por app
8. **Partições audit_log** — cobrem 2026–2027; adicionar rotina pg_cron em prod

## Warnings aceitáveis no build

- ESLint avisa `AxiosError` type-only import e `axios.isAxiosError` named-as-default (estilo, não blocker)
- pnpm avisa `next@14.2.15` e `eslint@8.57.1` deprecated (ainda suportadas)
- webpack cache warning em build prod web (performance, não funcional)

## Próximos passos sugeridos

1. Criar Supabase project real → popular `.env` → rodar migrations em prod DB
2. Implementar endpoints backend das telas mock (caixa, conta-digital, cobrancas, relatorios)
3. Deploy: Vercel (web) + Render (api+redis) via blueprints já prontos (`render.yaml`, `vercel.json`)
4. Adicionar integração real MCP Tiny V2/V3 (credenciais em `companies.*_enc`)
5. Integração Claude API para sugestões de conciliação (`apps/api/src/reconciliation/ai/`)
