# BPO FINANCEIRO — CONCILIADOR: Plano de Arquitetura Completo

## Contexto

Everton opera 4+ empresas (BlueLight, Industrias Neon, Atacado Neon, Engagge, RYU) e hoje concilia finanças manualmente via scripts Node.js + planilhas Excel. São 1.364 pedidos/mês, 4.599 CRs, múltiplos bancos (Sicoob, Olist Digital), gateways (Pagar.me, Conta Simples, AppMax). O processo atual é fragmentado, lento, e propenso a erros. Este projeto cria uma **plataforma visual de conciliação financeira** — produto premium ao nível de ClickUp/Linear para finanças.

---

## Stack Definitiva

| Camada | Tecnologia | Deploy |
|--------|-----------|--------|
| Frontend | React 18 + Vite + TypeScript strict + shadcn/ui + Tailwind + TanStack Query + react-window + cmdk + Recharts | **Vercel** |
| Backend | NestJS + BullMQ + Redis + class-validator + Swagger | **Render** ($25/mês) |
| Database | Supabase PostgreSQL + RLS + Auth + Realtime + Storage | **Supabase Pro** ($25/mês) |
| IA | Claude API (claude-sonnet-4-20250514) via @anthropic-ai/sdk | Pay-as-you-go |
| Queue | Redis (Upstash ou Render addon) | Incluso |

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                         │
│  React 18 + TS + shadcn/ui + TanStack Query + react-window  │
│  Pages: Auth, Onboarding, Dashboard, Reconciliation,        │
│         Transactions, CP, CR, Import, Settings, Audit       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + Supabase Realtime (WS)
┌────────────────────────┼────────────────────────────────────┐
│  SUPABASE              │                                    │
│  Auth (JWT) + PostgreSQL (RLS) + Realtime + Storage (OFX)   │
│  17 tabelas + 80 RLS policies + audit_log particionado      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  NESTJS BACKEND (Render)  — 11 módulos, 80 endpoints        │
│                                                              │
│  AuthModule ─── JWT/RBAC/Guards                              │
│  OrganizationModule ─── Org, Companies, Members, Invites     │
│  TinySyncModule ─── V2+V3 clients, sync CP/CR/pedidos       │
│  BankSyncModule ─── OFX parser, CSV parser, Conta Simples,   │
│                     Pagar.me, file upload, import batches     │
│  TransactionModule ─── queries, candidates, cross-reference  │
│  ReconciliationModule ─── create, reverse, auto, batch       │
│  AIMatchingModule ─── Claude API, prompt builder, scoring,   │
│                       suggestions, learning                  │
│  AuditModule ─── imutável, insert-only, export XLSX          │
│  NotificationModule ─── in-app via Supabase Realtime         │
│  ReportModule ─── KPIs, progress, export, comparison         │
│  JobModule ─── BullMQ queues, cron, monitoring               │
│                                                              │
│  ┌─────────────────────────────────────────┐                 │
│  │ BullMQ + Redis                          │                 │
│  │ Queues: tiny-sync, bank-sync,           │                 │
│  │   ai-suggestions, import-batch,         │                 │
│  │   baixa-batch, cleanup                  │                 │
│  └─────────────────────────────────────────┘                 │
└───────┬──────────┬──────────┬──────────┬────────────────────┘
        │          │          │          │
   Tiny V2/V3  ContaSimples Pagar.me  Claude API
```

---

## Database Schema — 17 Tabelas

### Core (6)
1. **organizations** — grupo econômico. Fields: id, name, slug, logo_url, plan, settings, created/updated/deleted_at
2. **profiles** — extends auth.users. Fields: id FK auth.users, name, email, avatar_url
3. **org_members** — user↔org com role (owner/admin/accountant/viewer). UNIQUE(org_id, user_id)
4. **org_invites** — convites por email com token UUID e expiry 7 dias
5. **companies** — empresas do grupo. Fields: id, org_id, name, cnpj, slug, color, is_active, settings. Credenciais encriptadas AES-256-GCM: tiny_v2_token, tiny_v3_client_id/secret/access/refresh_token, conta_simples keys, pagarme_sk
6. **bank_accounts** — contas por empresa. Fields: id, org_id, company_id, name, bank_name, bank_code, account_type (checking/savings/payment/credit_card), tiny_conta_origem (nome exato no Tiny para baixa), source_type (ofx/api/csv/manual)

### Dados Financeiros (3)
7. **bank_transactions** — transações extrato (OFX/API/CSV). Fields: id, org_id, company_id, bank_account_id, transaction_date, amount NUMERIC(14,2), description, memo, external_id (FITID), external_type, transaction_type, category, raw_data JSONB, reconciliation_status (pending/suggested/reconciled/ignored/reversed), reconciliation_id, import_batch_id. **UNIQUE(bank_account_id, external_id)** para dedup FITID. Índices: company_id, date, amount, status, trigram em description
8. **tiny_contas_pagar** — espelho CP Tiny. Fields: tiny_id BIGINT, fornecedor_nome/cpf_cnpj, historico, valor, valor_pago, data_emissao, data_vencimento, data_pagamento, situacao, categoria, marcadores JSONB, conta_origem, pedido_numero, reconciliation_status/id, last_synced_at, raw_data. **UNIQUE(company_id, tiny_id)**
9. **tiny_contas_receber** — espelho CR Tiny. Mesmos fields + forma_pagamento, meio_pagamento, parcela_info ("1/3"). **UNIQUE(company_id, tiny_id)**

### Conciliação (3)
10. **reconciliations** — registro de match. Fields: id, org/company_id, reconciliation_type (one_to_one/one_to_many/many_to_one/many_to_many), bank_transaction_ids UUID[], bank_total, conta_type (pagar/receber), conta_ids UUID[], conta_tiny_ids BIGINT[], conta_total, difference, match_method (manual/auto_exact/auto_fuzzy/ai_suggestion), confidence_score, match_criteria JSONB, status (active/reversed/pending_review), tiny_action, tiny_action_status, created_by, reversed_by/at, reversal_reason, session_id, notes
11. **reconciliation_sessions** — sessões de trabalho. Stats: total_matched/auto/manual/reversed, total_amount. Filtros salvos: date_from/to, bank_account_id, conta_type
12. **ai_suggestions** — sugestões IA. Fields: bank_transaction_ids UUID[], conta_type, conta_ids UUID[], confidence_score NUMERIC(5,2), match_reasons JSONB, ai_explanation TEXT, status (pending/accepted/rejected/expired), reconciliation_id, prompt/completion_tokens, model_used, reviewed_by/at

### Operacional (5)
13. **import_batches** — uploads OFX/CSV. file_hash SHA256 anti-duplicata. Stats: total/imported/skipped/error_records
14. **sync_jobs** — syncs com APIs. provider, job_type, status, records_fetched/created/updated, triggered_by (manual/scheduled/webhook)
15. **category_mappings** — mapa Conta Simples CC → Tiny categoria. UNIQUE(company_id, source_type, source_value)
16. **notifications** — in-app. user_id, type, title, body, data JSONB (link), is_read. Índice: (user_id, is_read, created_at DESC)
17. **audit_log** — **IMUTÁVEL**. Insert-only. Particionado por mês. Fields: action, entity_type/id, actor_id, actor_type (user/system/ai), changes JSONB (before/after), metadata JSONB (IP, user_agent). RLS: SELECT only para users, INSERT only via service_role. **ZERO UPDATE/DELETE.**

### RLS
- Função helper: `get_org_id()` retorna org_id do user autenticado
- Todas as tabelas com org_id usam `org_id = get_org_id()` para SELECT/INSERT/UPDATE/DELETE
- audit_log: SELECT only

---

## Reconciliation Engine — 4 Camadas

| Camada | Critério | Confidence | Ação |
|--------|---------|------------|------|
| 1 — Exato | Valor ±R$0.05 + Data ±2d + Ref pedido no histórico | 0.95-1.00 | Auto-reconcilia |
| 2 — Valor+Data | Valor idêntico + Data ±5d + Nome parcial match | 0.80-0.94 | Sugestão destaque |
| 3 — Parcela | Valor = total/parcelas + Mesmo pedido_numero | 0.70-0.89 | Sugestão |
| 4 — IA Fuzzy | Claude analisa descrição vs histórico, nomes abreviados, padrões | 0.50-0.85 | Sugestão (se >0.75) |

### Matching Types Suportados
- **1:1** — 1 transação banco ↔ 1 conta
- **1:N** — 1 transação banco ↔ N contas (pagamento consolidado)
- **N:1** — N transações banco ↔ 1 conta (parcelas separadas)
- **N:N** — casos complexos

### Fluxo de Estorno
1. POST /:id/reverse com motivo obrigatório
2. reconciliation.status = 'reversed'
3. bank_transactions voltam para 'pending'
4. contas voltam ao estado pré-conciliação
5. ALERTA se baixa já executada no Tiny (sem API de estorno)
6. Audit log grava before/after + motivo + actor

---

## UX/UI — Especificação Completa

### Design System

```
// Dark-first (financeiro = sessões longas)
--bg-primary:     hsl(220 20% 4%)     // fundo mais profundo
--bg-secondary:   hsl(220 18% 7%)     // cards/painéis
--bg-tertiary:    hsl(220 16% 10%)    // elementos elevados
--bg-hover:       hsl(220 14% 13%)    // hover state

--accent-blue:    hsl(210 90% 55%)    // ações primárias
--accent-green:   hsl(142 71% 45%)    // sucesso/crédito/conciliado
--accent-red:     hsl(0 84% 60%)      // erro/débito/divergente
--accent-yellow:  hsl(45 93% 55%)     // warning/sugestão IA
--accent-purple:  hsl(270 70% 60%)    // IA/automatizado

--font-body: 'Inter', system-ui
--font-mono: 'JetBrains Mono' (valores monetários)
--radius: 6px (sm) / 8px (md) / 12px (lg)

Transitions: 150ms (fast), 250ms (default), 400ms (slow)
```

### 11 Telas

#### 1. LOGIN (`/auth`)
- Viewport inteiro, card centralizado 420px, logo mark 48px
- Tabs: Entrar | Cadastrar
- Email + Senha (com eye toggle) + botão primário
- Divisor "ou" + Magic Link
- "Esqueci minha senha" link
- **States:** default, loading (spinner no botão, inputs disabled), error (toast vermelho persistente), success (redirect)
- Strength indicator na senha do cadastro (4 segmentos: gray→red→yellow→green)
- First-time: redirect para `/onboarding` se `onboarding_complete !== true`

#### 2. ONBOARDING WIZARD (`/onboarding`)
- 5 steps com progress bar (dots + lines, completed=green, current=blue pulsing, future=dashed gray)
- **Step 1:** Criar organização (nome)
- **Step 2:** Adicionar empresa (nome, CNPJ com máscara XX.XXX.XXX/XXXX-XX validado, cor — 8 swatches preset + hex custom)
- **Step 3:** Configurar Tiny ERP (toggle V2 Token / V3 OAuth, campo masked, botão [Testar Conexão] com resultado inline)
- **Step 4:** Adicionar conta bancária (tipo select: OFX/Conta Simples/Pagar.me/AppMax, campos dinâmicos por tipo)
- **Step 5:** Primeira sincronização (summary card + botão verde grande, progress animado step-by-step com checkmarks, confetti sutil ao completar)
- Botões: Voltar (outlined) | Próximo (primary), "Pular" link em steps opcionais
- Transição: fade out 150ms → fade in 150ms com slide 8px up

#### 3. DASHBOARD (`/dashboard`)
- **KPI Row:** 5 cards (Pendentes, Conciliados Hoje, Conciliados Semana, Sugestões IA, Divergências). Cada card: icon 24px + label uppercase xs + valor 2xl mono bold + trend indicator (↑↓ + %)
- **Progresso por Empresa:** card col-span-1, barra de progresso por empresa com cor da empresa, % e contagem, sorted por menor % (worst-first)
- **Alertas:** card col-span-1, lista com severity icons (red/yellow/blue), max 5 visíveis, scroll, tipos: sync error, overdue, high-value unmatched, stale data
- **Atividade Recente:** timeline vertical com dots coloridos (green=conciliação, blue=import, purple=IA, yellow=estorno), últimos 20 entries, actor + ação + timestamp relativo
- **Ações Rápidas:** grid 2x2 de botões: Iniciar Conciliação, Importar Arquivo, Forçar Sync, Relatório
- **Loading:** skeleton screens com pulse animation em todos os cards

#### 4. CONCILIAÇÃO — TELA PRINCIPAL (`/reconciliation`) ⭐

**Header Bar (52px):**
- Company selector (cor dot + nome, 200px)
- Bank account selector (icon Building2 + nome, 240px)
- Toggle Pagar/Receber (ToggleGroup, default Receber)
- Date range picker (dual calendar, presets: Hoje/Semana/Mês/Último Mês/3 Meses)
- Sync status (texto relativo + dot verde/amarelo/vermelho + botão refresh com spin durante sync)
- Session info (direita): "Sessão: 14:32 | 23 conciliados"

**Painel Esquerdo — Extrato Bancário:**
- Filter bar 44px: search 200px (debounce 300ms), amount min/max (80px cada), type select (Todos/Crédito/Débito), status multi-select (checkboxes), sort (Data/Valor/Status com asc/desc), clear filters X
- Transaction rows 48px, expandíveis para ~200px:
  - Checkbox 16px → Date (mono xs, 72px) → Description (flex-1, truncated + tooltip 200ms) → Amount (mono sm bold, 110px, green+ red-) → Source icon (20px) → Status badge (xs) → Expand arrow
  - Conciliado: opacity 0.4, green tint, checkmark overlay
  - Selecionado: blue bg 8% + ring-2 blue + left border 2px blue
  - Sugestão IA: badge purple "IA 94%"
- **Virtualização:** react-window FixedSizeList, overscan 10, infinite scroll 100 items + fetch next at 80%
- **Seleção:** Click toggle, Shift+Click range, Ctrl+Click individual, Ctrl+A all visible
- **Context menu (right-click):** Ver detalhes, Ignorar transação, Marcar como transferência, Copiar valor, Desfazer ignorar

**Painel Direito — Contas a Pagar/Receber:**
- Mesmo padrão do esquerdo com filtros adicionais: cliente/fornecedor search, situação (Aberto/Pago/Parcial/Cancelado), categoria, marcadores
- Conta rows 48px:
  - Checkbox → Type icon (CP=red ArrowDownCircle, CR=green ArrowUpCircle) → Cliente (flex-1) → Pedido # (mono xs, 60px) → Parcela ("1/3", xs, 36px) → Valor → Vencimento (vermelho se vencido) → Situação badge → Status badge → Expand

**Divisor Central:**
- ResizableHandle draggable, default 50/50, min 25% cada
- Double-click: reset 50/50
- **AI Match Lines:** SVG dotted lines purple entre itens sugeridos, dash animation flowing, click seleciona ambos

**Bottom Action Bar (56px, sticky):**
- Esquerda: "Selecionado: **R$ 1.234,56** (3 itens)" mono bold
- Direita: idem
- Centro: "Diferença: R$ 0,00" (green ≤0.05, yellow ≤5.00, red >5.00)
- **[CONCILIAR]** 160x40px: disabled=gray, ready=green com pulse animation (box-shadow scale 2s infinite), loading=spinner, success=checkmark 1s
- **[ESTORNAR]** red outlined, só visível com item conciliado selecionado
- **[IA SUGESTÕES]** purple outlined + badge count, abre drawer

**Animação de Conciliação (400ms):**
0ms: botão loading → 100ms: rows scale(0.98) → 200ms: flash green 50% → 300ms: rows comprimem 20px para centro → 400ms: checkmark fade in + opacity 0.4 → 500ms: selection clear, toast green "Conciliado! R$ 1.234,56"

**AI Suggestion Drawer (sheet right, 440px):**
- Lista de sugestões sorted por confidence desc
- Cada card: confidence bar colorida (red→yellow→green), preview banco (border-left blue), preview conta (border-left green), AI explanation italic xs, botões [Aceitar] green / [Rejeitar] red outlined / [Ver mais] ghost
- Batch accept: checkboxes + "Aceitar Selecionados" sticky bottom
- Aceitar: cards animam slide right + fade 200ms staggered 50ms

**Detail Modal (Dialog 640px):**
- Tabs: Dados (key-value + JSON toggle) | Histórico (timeline) | Relacionados (outras parcelas do mesmo pedido)

#### 5. TRANSACTIONS LIST (`/transactions`)
- DataTable completa: all columns sortable, resizable. Checkbox | Data | Descrição | Valor | Banco/Fonte | Empresa | Status | Conciliação | Ações
- Filtro colapsável, bulk actions (Ignorar/Marcar transferência), export XLSX, import button
- Pagination: "1-100 de 1.234" + page size 50/100/200

#### 6. CONTAS A PAGAR / CONTAS A RECEBER (`/contas-pagar`, `/contas-receber`)
- Espelho Tiny com todos os campos, link para reconciliação se matched, sync status per record

#### 7. IMPORT CENTER (`/import`)
- Drag & drop zone 200px (dashed border, animação no hover)
- Após drop: file info + bank account selector + preview 10 primeiras transações + duplicate detection alert (yellow) + progress bar
- Import history table: arquivo, data, records imported/skipped/errors

#### 8. INTEGRATIONS (`/settings/integrations`)
- Company tabs com cor dot
- Cards por integração: Tiny V2 (token masked, testar, last sync), Tiny V3 (OAuth flow, status), Conta Simples (key/secret, auto-sync toggle, frequência), Pagar.me (secret, auto-sync), AppMax (info CSV only)
- Category mapping table editável: source → Tiny category

#### 9. COMPANIES (`/settings/companies`)
- Grid de cards com left border cor da empresa, stats (pendentes/conciliados/last sync), health dot (green/yellow/red), ações editar/integrar/desativar

#### 10. AUDIT LOG (`/audit`)
- Timeline imutável, filtros: action type, entity, actor, date range
- Cada entry: timestamp, avatar/icon actor, action badge, description, [Expandir] para JSON
- Export XLSX/PDF

#### 11. USER MANAGEMENT (`/settings/users`)
- Tabela: avatar, nome, email, role badge (crown para owner), status (ativo/pendente/desativado), última atividade
- [Convidar] modal: email + role + company access checkboxes

### Elementos Globais

**Sidebar (240px/56px):**
- Collapsível Ctrl+B, company color stripe 3px topo
- Items com badges: Conciliação (pendentes), CP (vencidas), Integrações (erros)
- Active: left border 2px blue + bg-hover

**Top Bar (48px):**
- Breadcrumb + Global search Ctrl+K + Bell (unread badge) + Theme toggle + Avatar dropdown

**Command Palette (Ctrl+K):**
- cmdk dialog 560px, search + groups: Ações Rápidas, Navegação, Busca cross-entity

**Keyboard Shortcuts:**
| Key | Ação | Contexto |
|-----|------|---------|
| Space | Toggle seleção | Reconciliação |
| Ctrl+Enter | Executar conciliação | Items selecionados |
| Ctrl+Z | Estornar última | Reconciliação |
| Tab | Alternar painéis | Reconciliação |
| Ctrl+K | Command palette | Global |
| Ctrl+F | Focus search | Qualquer lista |
| 1-5 | Quick filter status | Reconciliação |
| Shift+Click | Range select | Qualquer lista |
| Ctrl+A | Select all visible | Qualquer lista |
| Esc | Clear/close | Global |
| ↑/↓ | Navegar rows | Qualquer lista |

**Toasts (Sonner):** bottom-right, success green 3s, error red persistente, warning yellow 5s, info blue 3s

**Loading:** Skeleton screens com pulse 1.5s, progress bar top-of-page para operações longas, optimistic updates para conciliação

**Empty States:** icon 64px + título + descrição + CTA button

---

## Backend — 11 Módulos NestJS, 80 Endpoints

### API Contract (80 endpoints organizados)

| # | Módulo | Endpoints | Responsabilidade |
|---|--------|-----------|-----------------|
| 1 | Auth | 3 | Health, ready, me |
| 2 | Organization | 15 | CRUD org/companies/members/invites |
| 3 | TinySync | 10 | Sync CP/CR/pedidos, OAuth callback, baixar CP/CR, batch baixa |
| 4 | BankSync | 12 | Import OFX/CSV, sync Conta Simples/Pagar.me, CRUD transactions, bulk actions, batches |
| 5 | Transaction | 6 | Queries unificadas, candidates, unmatched summary, pedido-CR cross-ref |
| 6 | Reconciliation | 10 | Create/list/detail, reverse, auto-reconcile (preview+execute), batch, sessions |
| 7 | AIMatching | 7 | Suggest single/batch, list/accept/reject suggestions, bulk accept, stats |
| 8 | Audit | 3 | List filtrado, export XLSX/CSV, entity history |
| 9 | Notification | 4 | List, mark read, mark all read, unread count |
| 10 | Report | 5 | Dashboard KPIs, progress, export reconciliations/unmatched, company comparison |
| 11 | Job (admin) | 5 | List jobs, detail, retry, delete, queue stats |

### Rate Limiting

| Pattern | Limite | Janela |
|---------|--------|--------|
| POST */sync/* | 5 | 1 min |
| POST */import/* | 10 | 1 min |
| POST */ai/suggest | 20 | 1 min |
| POST */ai/suggest/batch | 2 | 10 min |
| POST */reconciliations | 60 | 1 min |
| GET * | 100 | 1 min |

### BullMQ Queues

| Queue | Cron | Retry | Concurrency |
|-------|------|-------|-------------|
| tiny-sync | 4h | 3x exponential (1m/5m/15m) | 2 |
| bank-sync | 6h | 3x | 2 |
| ai-suggestions | Manual + daily 06:00 | 2x | 1 |
| import-batch | On-demand | 2x | 3 |
| baixa-batch | On-demand | 1x (sem retry p/ financeiro) | 1 |
| cleanup | Domingo 03:00 | 1x | 1 |

### Operações Críticas de DB

**Create Reconciliation:** Postgres function SERIALIZABLE com FOR UPDATE lock nas transações, validação atômica de status/valores, inserts em reconciliations + updates em bank_transactions + tiny_contas, audit_log tudo na mesma transaction.

**Reverse Reconciliation:** Mesma abordagem atômica — reverte status, grava audit com before/after, alerta se baixa já executada no Tiny.

**Import OFX:** Bulk INSERT com ON CONFLICT (bank_account_id, external_id) DO NOTHING para dedup, contadores para imported/skipped.

**Sync Tiny:** UPSERT pattern (INSERT ON CONFLICT(company_id, tiny_id) DO UPDATE) para incremental sync.

---

## Motor IA — Claude API

### Quando aciona
- Camadas 1-3 falharam (sem match determinístico)
- Descrição ambígua (PIX nome abreviado vs razão social)
- Múltiplos candidatos com mesmo valor

### Prompt
Envia: transação bancária (date, amount, memo, bank) + até 20 candidatos CP/CR (type, amount, date, name, historico) + até 5 few-shot examples de matches aceitos/rejeitados da mesma empresa + regras de matching + formato JSON output

### Scoring
- Claude retorna: candidate_index, confidence, reasoning
- Post-processing: boost +0.1 se amount exato, penalize -0.1 se date gap >15d, penalize -1.0 se direction mismatch, cap 0.99 (nunca 1.0 para IA)
- >= 0.95: auto-reconcilia (se config permite)
- 0.75-0.94: sugestão pendente review
- < 0.75: descarta

### Aprendizado
- Grava aceites/rejeições em ai_suggestions
- LearningService extrai patterns recorrentes (ex: "Meta Platforms" = "Tráfego Pago")
- Few-shot no prompt: 5 últimas decisões aceitas da empresa
- Sem fine-tuning — tudo via contexto

### Custo
- Tracker de prompt_tokens + completion_tokens por chamada
- Stats: custo mensal, custo por sugestão
- Configurable: daily cost cap por empresa

---

## Sprint Breakdown — 10 Sprints de 2 Semanas

### Sprint 1: Foundation + Auth + Multi-Company (26 SP)
**Goal:** Scaffolding, schema, auth, org/company CRUD com credenciais encriptadas

| US | Título | SP |
|----|--------|-----|
| US-001 | Project Scaffolding NestJS | 3 |
| US-002 | Database Schema — Core Tables (6 tabelas + RLS) | 5 |
| US-003 | JWT Authentication (guards, decorators, JWKS) | 5 |
| US-004 | Organization & Company CRUD (com AES-256 encryption) | 8 |
| US-005 | Member Invite Flow (email + token + accept) | 5 |

**Demo:** Criar org, adicionar 2 empresas, convidar membro, aceitar convite, mostrar credenciais encriptadas no DB

**Arquivos (42 files):** `src/main.ts`, `src/app.module.ts`, `src/common/guards/*`, `src/common/decorators/*`, `src/auth/*`, `src/organization/*`, `supabase/migrations/001-004.sql`

---

### Sprint 2: Tiny ERP Integration + Data Sync (33 SP)
**Goal:** Clientes V2+V3 com rate limiting, sync incremental CP/CR/pedidos

| US | Título | SP |
|----|--------|-----|
| US-006 | Tiny V2 API Client (rate limiter 3 req/s, retry exponential, pagination auto) | 8 |
| US-007 | Tiny V3 API Client (OAuth2, token refresh, pagination bug detection) | 5 |
| US-008 | Sync Contas a Pagar (incremental via last_synced_at, conflict resolution) | 5 |
| US-009 | Sync Contas a Receber (+ regex pedido_numero do histórico) | 5 |
| US-010 | Sync Pedidos (detail fetch, filter cancelled/draft) | 5 |
| US-011 | Sync Controllers & BullMQ Job Queue (cron 4h, retry 3x, notifications) | 5 |

**Demo:** Trigger sync BlueLight, dados aparecendo no DB, trigger novamente (incremental), mostrar histórico de sync

**Arquivos (20 files):** `src/tiny-sync/*`, `src/job/*`, `supabase/migrations/005-006.sql`

---

### Sprint 3: Bank Statement Import + OFX Parser (26 SP)
**Goal:** Import OFX/CSV, dedup por FITID, batch management com rollback

| US | Título | SP |
|----|--------|-----|
| US-012 | OFX Parser (Latin-1/UTF-8 detection, STMTTRN regex, BANKID/ACCTID extraction) | 5 |
| US-013 | CSV Parser — AppMax (quoted fields, decimal BR, filter approved only) | 3 |
| US-014 | File Upload & Batch Management (Supabase Storage, SHA256 hash, rollback) | 5 |
| US-015 | Bank Transaction CRUD & Filtering (trigram search, bulk ignore/transfer) | 8 |
| US-016 | Import Controller & Async Processing (BullMQ, progress tracking, notifications) | 5 |

**Demo:** Upload OFX Sicoob real, preview transações, importar, reimportar (dedup), buscar "Meta" (trigram), ignorar algumas, rollback batch

**Arquivos (17 files):** `src/bank-sync/*`, `supabase/migrations/007-009.sql`

---

### Sprint 4: Split-Screen UI Data API (21 SP)
**Goal:** APIs que alimentam a tela split-screen, candidates com scoring, sessions

| US | Título | SP |
|----|--------|-----|
| US-017 | Unified Transaction Query Layer (bank/CP/CR com filtros consistentes) | 5 |
| US-018 | Candidate Matching API (scoring: amount 40% + date 30% + name 30%, top 20) | 8 |
| US-019 | Reconciliation Session Management (persist filters, scroll, resume) | 3 |
| US-020 | Pedido-CR Cross-Reference (status: OK/SEM CR/DIVERGENTE com diferença) | 5 |

**Demo:** Bank transactions "painel esquerdo", selecionar uma, ver candidates "painel direito" com scores, cross-ref pedidos

---

### Sprint 5: Manual Reconciliation Engine (26 SP)
**Goal:** Engine core — create/batch/validate reconciliations com transactions atômicas

| US | Título | SP |
|----|--------|-----|
| US-021 | Manual Reconciliation — Create (SERIALIZABLE transaction, audit, opcional baixa Tiny) | 13 |
| US-022 | Manual Reconciliation — Batch (validação atômica, rollback se um falha) | 5 |
| US-023 | Reconciliation List & Detail (filtros, bank txn + contas + baixa status + audit trail) | 3 |
| US-024 | 1:N e N:1 Matching (pagamento consolidado, parcelas separadas) | 5 |

**Demo:** Conciliar débito↔CP, conciliar crédito↔3 CRs (1:N), batch 5 matches, mostrar audit log

---

### Sprint 6: Gateway Integrations (21 SP)
**Goal:** Conta Simples + Pagar.me + AppMax enhanced

| US | Título | SP |
|----|--------|-----|
| US-025 | Conta Simples (OAuth2, token refresh 25min, LIMIT=transfer, cursor pagination) | 8 |
| US-026 | Pagar.me (Basic auth, centavos/100, NÃO auto-reconciliar — regra domain) | 5 |
| US-027 | AppMax CSV Enhanced (parcela calc, fuzzy name matching) | 3 |
| US-028 | Gateway Sync Job & Monitoring (cron 6h, error notifications, dead letter queue) | 5 |

**Demo:** Sync Conta Simples, transações cartão aparecendo, LIMIT auto-tagged como transferência. Sync Pagar.me, orders importados.

---

### Sprint 7: Estorno + Audit Trail + Auto-Reconciliation (24 SP)
**Goal:** Reversal, audit imutável, engine rule-based auto

| US | Título | SP |
|----|--------|-----|
| US-029 | Estorno (reverse + audit + alerta se baixa já executada) | 8 |
| US-030 | Audit Trail Completo (listeners @OnEvent para tudo, export XLSX, RLS insert-only) | 8 |
| US-031 | Auto-Reconciliation Rule Engine (preview/dry_run, configurable thresholds, results: auto/suggested/no_match) | 8 |

**Demo:** 5 conciliações, estornar 1, auto-reconcile em date range (preview → execute), export audit XLSX

---

### Sprint 8: AI Matching Engine (24 SP)
**Goal:** Claude API integration, prompt engineering, suggestions, learning

| US | Título | SP |
|----|--------|-----|
| US-032 | Claude API Client (Anthropic SDK, temp 0.1, retry 2x, token tracking) | 5 |
| US-033 | Prompt Builder (transaction + 20 candidates + 5 few-shot + rules → JSON output) | 8 |
| US-034 | Suggestion Management (create/accept/reject, bulk accept, learning from decisions) | 8 |
| US-035 | AI Cost Controls (token tracking, monthly cost, cost per suggestion, daily cap) | 3 |

**Demo:** Transação sem match → AI sugere com reasoning → aceitar (reconciliação criada). Rejeitar outra com motivo. Batch em todos unmatched, ver resultados.

---

### Sprint 9: Pipeline Combinado + Notifications + Polish (23 SP)
**Goal:** Pipeline rules→AI→manual, realtime notifications, resilience

| US | Título | SP |
|----|--------|-----|
| US-036 | Combined Auto-Reconcile + AI Pipeline (rules primeiro → AI para resto → notification) | 8 |
| US-037 | Real-Time Notifications (Supabase Realtime subscription, unread count) | 5 |
| US-038 | Job Monitoring Dashboard API (queue stats, retry failed, dead letter) | 5 |
| US-039 | Error Recovery & Resilience (circuit breaker, re-auth automático, graceful degradation) | 5 |

**Demo:** Trigger pipeline completo, items auto-matched + AI suggestions + notificações real-time. Job monitoring.

---

### Sprint 10: Dashboard + Reports + Production (23 SP)
**Goal:** KPIs, export, deploy production-ready

| US | Título | SP |
|----|--------|-----|
| US-040 | Dashboard KPIs (total/reconciled/rate/pending/avg_time/ai_acceptance_rate) | 8 |
| US-041 | Export XLSX (sheets: Summary, Reconciled, Unmatched Bank/CP/CR) | 5 |
| US-042 | Production Config (Render deploy, env vars, health checks, migrations auto) | 5 |
| US-043 | Rate Limiting & Security Hardening (throttler matrix, CORS, Helmet, AES-256) | 5 |

**Demo:** Walkthrough completo: login → dashboard → import OFX → sync → auto-reconcile → review AI → accept/reject → dashboard update → export XLSX → audit trail

---

## Sprints Frontend (paralelos aos de backend, começando Sprint 4)

### Sprint F1 (paralelo Sprint 4): Auth + Layout + Onboarding
- Login/cadastro com Supabase Auth
- AppLayout (sidebar + topbar + outlet)
- CompanyContext + CompanySelector
- Onboarding wizard 5 steps
- Theme dark/light toggle

### Sprint F2 (paralelo Sprint 5): Split-Screen Core
- Reconciliation page com ResizablePanel
- BankPanel (filter + virtualized list + selection)
- ContasPanel (filter + virtualized list + selection)
- SelectionSummary (bottom bar com totais/diferença)
- ReconcileButton com validação + animação

### Sprint F3 (paralelo Sprint 6-7): Import + Integrations + Estorno
- Import center (drag & drop + preview + progress)
- Integration settings (cards por empresa)
- ReverseButton + confirmation dialog
- Transactions/CP/CR list pages

### Sprint F4 (paralelo Sprint 8-9): AI + Notifications
- AI Suggestion Drawer (slide right)
- AISuggestionBadge nos rows
- SVG match indicator lines entre painéis
- Notification center (bell + dropdown)
- Command palette (Ctrl+K)

### Sprint F5 (paralelo Sprint 10): Dashboard + Polish
- Dashboard com KPIs + Recharts
- Export buttons
- Keyboard shortcuts completos
- Empty states + loading skeletons
- Responsive ajustes
- Audit log timeline

---

## Error Handling Matrix

| Integração | Falha | Detecção | Recovery | User Message |
|-----------|-------|----------|----------|-------------|
| Tiny V2 API | Rate limit | HTTP 429 / timeout | Queue delay + retry 3x exponential | "Sync pausado, retentando automaticamente" |
| Tiny V2 API | Token inválido | HTTP 401 | Alert user to update | "Token Tiny expirado. Atualize em Configurações" |
| Tiny V3 OAuth | Token expirado | 401 + expires_at check | Auto refresh 5min antes | Transparente |
| Tiny V3 Pagination | Loop infinito | Detect repeated IDs | Fallback para V2 | Transparente |
| Tiny Baixa | Endpoint erro | HTTP 4xx/5xx | Reconciliation local OK, baixa status=failed | "Conciliado localmente. Baixa no Tiny falhou: [erro]" |
| OFX Import | Encoding errado | Parse exception | Try Latin-1 → UTF-8 → fallback | "Arquivo não reconhecido. Verifique formato." |
| OFX Import | FITID duplicado | UNIQUE constraint | Skip + count | "23 transações ignoradas (já importadas)" |
| Conta Simples | Token 30min expired | 401 response | Auto re-auth client_credentials | Transparente |
| Pagar.me | API down | Timeout 30s | Retry 3x, notification | "Sync Pagar.me falhou. Tentaremos novamente em 1h" |
| Claude API | Timeout/error | HTTP 5xx / timeout 60s | Retry 2x, skip transaction | "IA não disponível para algumas transações" |
| Claude API | Response mal-formatada | JSON parse failure | Regex fallback extract | Log + skip |
| Supabase | Connection drop | PG error / timeout | Retry 1x, reconnect | "Erro temporário, tente novamente" |
| Redis | Down | BullMQ connection error | Fallback sync mode | "Processamento em fila indisponível" |

---

## Verificação End-to-End

1. **Sprint 1:** Login → criar empresa → config token Tiny → ver credencial encriptada no DB
2. **Sprint 2:** Trigger sync → ver CP/CR aparecendo → trigger incremental → ver delta
3. **Sprint 3:** Upload OFX real Sicoob → preview → importar → reimportar (dedup) → buscar → ignorar → rollback
4. **Sprint 5:** Selecionar transação banco + CR → conciliar → ver dimmed → estornar → ver revertido
5. **Sprint 8:** Transação sem match → AI sugere com explicação → aceitar → conciliação criada
6. **Sprint 10:** Dashboard mostra % conciliado → export XLSX → audit trail completo

---

## Referências Existentes

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` — regras de negócio, limitações API
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliacao_titulos.js` — lógica matching pedidos×CRs
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliar_cp_indneon_ofx.js` — parser OFX funcional
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/ler_todos_ofx.js` — parsing multi-banco
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/.env` — todos os tokens V2/V3, Conta Simples, Pagar.me
- `C:/CLAUDECODE/darksales-lovable/supabase/migrations/001_full_schema.sql` — pattern multi-tenant
- `~/prompts/05-arquiteto-digital-cto.md` — framework CTO (12 pilares)


---

Now I have a complete picture. Let me produce the comprehensive feature design document.

---

# PLATAFORMA DE CONCILIACAO FINANCEIRA INTELIGENTE -- DESIGN DE 35+ FEATURES INOVADORAS

## Contexto Tecnico Atual

Apos analisar o codebase completo, o sistema atual opera da seguinte forma:
- **Scripts Node.js manuais** fazem conciliacao via Tiny API V2/V3, Pagar.me, AppMax, Conta Simples
- **Frontend React** (BusinessAnalytics) com Supabase, exibe DRE, Fluxo de Caixa, Financeiro
- **Multi-empresa** ja existe: `unidades_negocio` no Supabase (Grupo Lauxen: BlueLight, Industrias Neon, Atacado Neon, Engagge)
- **Matching atual**: comparacao bruta por valor com tolerancia de R$0.02 e janela de 30 dias
- **Tabelas Supabase existentes**: `fato_financeiro` (origem, tipo_movimento, categoria, subcategoria, valor, data, unidade_negocio_id), `fato_vendas`, `unidades_negocio`, `user_profiles`
- **Sem inteligencia**: nenhum ML, nenhum pattern learning, nenhuma automacao alem de scripts rodados manualmente

---

## A. CONCILIACAO INTELIGENTE (Alem do Matching Basico)

### A1. Oraculo de Recebimentos (Predictive Reconciliation)

**Pitch**: Preve quais pagamentos vao chegar nos proximos 7/15/30 dias com base no historico de comportamento de cada cliente e gateway, antes do dinheiro cair na conta.

**User Story**: Como CFO do Grupo Lauxen, quero ver na segunda-feira quais recebimentos da Pagar.me provavelmente cairao na conta Olist Digital essa semana, para planejar pagamentos a fornecedores sem consultar extratos manualmente.

**Especificacao de Comportamento Detalhada**:

- **Estado Inicial**: Dashboard mostra timeline visual tipo Gantt horizontal com 3 faixas: "Previsto Hoje", "Proximos 7 dias", "Proximos 30 dias"
- **Calculo de Previsao**: Para cada CR aberta no Tiny, o sistema calcula:
  - `data_provavel_recebimento = data_vencimento + atraso_medio_cliente + lag_gateway`
  - `lag_gateway`: Pagar.me = D+30 cartao credito, D+1 PIX/boleto; AppMax = D+30 cartao; Sicoob = D+0
  - `atraso_medio_cliente`: media movel ponderada dos ultimos 12 recebimentos daquele CNPJ/CPF
  - `confianca`: 0-100% baseado em desvio padrao do historico
- **Interacoes**:
  - Clicar em um item previsto expande detalhes: CR original, pedido vinculado, historico do cliente, gateway
  - Botao "Confirmar recebimento" quando o dinheiro chegar (auto-match se extrato OFX disponivel)
  - Botao "Remarcar previsao" se souber que vai atrasar (ajusta modelo)
  - Toggle "Mostrar apenas alta confianca (>80%)" 
- **Edge Cases**:
  - Cliente novo (sem historico): usa media do segmento (PF vs PJ) + gateway padrao
  - Pedido cancelado apos previsao: marca como "Cancelado" com linha tachada
  - Renegociacao: permite vincular nova data mantendo historico
  - Gateway fora do ar: alerta amarelo "Previsao pode ter atraso - gateway com incidentes"

**Implementacao Tecnica**:
```
Tabela: prediction_models
- id, entity_type (cliente|gateway|categoria), entity_id, avg_delay_days, 
  stddev_days, sample_count, last_trained_at, model_params (jsonb)

Tabela: predicted_receivables  
- id, conta_receber_id, predicted_date, confidence_score, 
  predicted_amount, status (pending|confirmed|missed|cancelled),
  actual_date, actual_amount, created_at

API: POST /api/predictions/train (roda batch noturno)
API: GET /api/predictions/receivables?horizon=7d&min_confidence=0.7
API: PATCH /api/predictions/:id/confirm
```
- Algoritmo: Regressao linear simples sobre historico de delays por (cliente, gateway, dia_semana) com fallback para mediana do segmento
- Claude API: Gera narrativa diaria "Resumo de previsoes para hoje: R$42.800 esperados, 3 com risco de atraso"

**Fosso Competitivo**: Omie/Conta Azul nao tem modelagem preditiva. Requer historico granular por cliente+gateway que so se acumula com uso contínuo. Quanto mais dados, melhor o modelo -- lock-in natural.

**Impacto**: Reduz tempo de planejamento de caixa de 2h/dia para 10min. CFOs de holdings com 4+ empresas economizam 8h/semana.

---

### A2. Memoria de Padroes (Pattern Memory Engine)

**Pitch**: O sistema lembra que "todo dia 5 cai R$1.200 do fornecedor X via Sicoob" e "a AppMax repassa em 3 parcelas de R$333,33 toda compra de R$999,99", aplicando esse conhecimento automaticamente.

**User Story**: Como analista financeiro, quero que o sistema reconheca que a parcela de R$2.450,00 que caiu hoje no Sicoob e provavelmente o pagamento mensal do cliente ABC Ltda que sempre paga no dia 5, e ja sugira o match automaticamente.

**Especificacao Detalhada**:

- **Aprendizado**: Cada vez que um usuario confirma um match manual, o sistema registra o "padrao":
  - `(cliente_cpf_cnpj, valor_exato_ou_range, dia_do_mes, banco_origem, categoria_tiny, frequencia)`
- **Reconhecimento**: Quando um novo lancamento bancario chega, o sistema busca padroes similares:
  - Match exato de valor: confianca 95%
  - Match com tolerancia 2%: confianca 80%
  - Match por cliente + faixa de valor + periodicidade: confianca 70%
- **UI de Padroes Aprendidos**:
  - Tela "Padroes Reconhecidos" com lista tipo cards
  - Cada card mostra: icone de recorrencia, nome do padrao (auto-gerado ou editavel), frequencia, ultimo match, proximo esperado
  - Botao "Desativar padrao" e "Editar regra"
  - Badge de quantas vezes acertou vs errou
- **Auto-aplicacao**: Padroes com confianca >90% e taxa de acerto >95% (minimo 5 matches anteriores) sao aplicados automaticamente sem interacao humana. Os demais aparecem como "Sugestao"
- **Edge Cases**:
  - Valor muda (reajuste contratual): sistema detecta variacao gradual e propoe atualizar padrao
  - Parcela faltou um mes: nao descarta padrao, marca como "pulou" e espera proximo ciclo
  - Dois padroes conflitantes para mesmo lancamento: mostra ambos rankeados por confianca

**Implementacao Tecnica**:
```
Tabela: reconciliation_patterns
- id, company_id, pattern_hash (unique), counterparty_doc, 
  counterparty_name, amount_min, amount_max, amount_exact,
  day_of_month, bank_account_id, tiny_category_id, 
  frequency (monthly|weekly|biweekly|quarterly),
  match_count, miss_count, last_matched_at, 
  auto_apply (boolean), confidence_score, status (active|paused|archived),
  created_by, created_at

Tabela: pattern_match_log
- id, pattern_id, transaction_id, conta_id, match_type, 
  was_correct (boolean), corrected_by, created_at

API: POST /api/patterns/learn (chamado apos cada match manual)
API: GET /api/patterns?company_id=X&status=active
API: POST /api/patterns/:id/apply (aplica padrao a transacao pendente)
```

**Fosso Competitivo**: O volume de padroes aprendidos cria uma base de conhecimento proprietaria por empresa. Migrar para Omie perde todo o historico de aprendizado. Concorrentes teriam que comecar do zero.

**Impacto**: Apos 3 meses de uso, 60-70% das conciliacoes sao automaticas. Tempo de conciliacao mensal cai de 2 dias para 4 horas.

---

### A3. Split Intelligence (Inteligencia de Desmembramento)

**Pitch**: Detecta automaticamente quando um unico deposito bancario corresponde a multiplas faturas, ou quando varias parcelas de um parcelamento formam o valor total de um pedido.

**User Story**: Como financeiro da BlueLight, recebo um PIX de R$8.750,00 do cliente X e preciso que o sistema identifique sozinho que esse valor corresponde as faturas de R$3.200 + R$2.800 + R$2.750 = R$8.750, e reconcilie as tres de uma vez.

**Especificacao Detalhada**:

- **Deteccao Automatica**: Quando uma transacao bancaria nao tem match 1:1, o sistema roda:
  1. **Subset Sum Solver**: Busca combinacoes de CRs abertas do mesmo cliente cujo soma = valor do deposito (tolerancia configuravel, default R$0.50)
  2. **Installment Detector**: Se o historico (campo `historico` da CR) contem "parcela X/Y", agrupa parcelas do mesmo pedido
  3. **Cross-pedido**: Se cliente tem multiplos pedidos, tenta combinar CRs de pedidos diferentes
- **UI de Resolucao de Split**:
  - Lancamento bancario no centro da tela
  - Lista de CRs candidatas ao redor, com checkbox
  - Barra de progresso mostrando soma selecionada vs valor do deposito
  - Quando soma bate: botao verde "Conciliar Split" pulsa
  - Se diferenca < tolerancia: mostra badge "Diferenca de R$0.12 sera lancada como ajuste"
- **Algorimo de Priorizacao**:
  - Prioridade 1: Mesmo CNPJ/CPF + soma exata
  - Prioridade 2: Mesmo CNPJ/CPF + soma com tolerancia
  - Prioridade 3: Mesmo nome (fuzzy match) + soma exata
  - Prioridade 4: Qualquer combinacao + soma exata (flag "Verificar manualmente")
- **Edge Cases**:
  - Deposito corresponde a faturas de empresas diferentes do grupo (ex: cliente compra de BlueLight e Industrias Neon, paga tudo junto): mostra cross-company match com alerta
  - Deposito maior que todas as CRs combinadas: sugere que pode haver credito a registrar
  - 50+ CRs abertas para mesmo cliente: limita busca combinatoria a top 20 por proximidade de data

**Implementacao Tecnica**:
```
Tabela: split_reconciliations
- id, bank_transaction_id, total_amount, tolerance_used,
  status (suggested|confirmed|rejected), created_at, confirmed_by

Tabela: split_reconciliation_items
- id, split_reconciliation_id, conta_receber_id, amount_matched,
  adjustment_amount (para diferencas de centavos)

API: POST /api/splits/detect { transaction_id }
API: POST /api/splits/confirm { split_id, items: [...] }

Algoritmo: Knapsack simplificado com early termination quando soma exata encontrada.
Limite: max 20 itens na combinacao para performance.
Cache: resultados de splits por 1h para evitar recomputo.
```

**Fosso Competitivo**: Nenhum concorrente brasileiro faz subset-sum matching. Bling e Granatum exigem match 1:1. Esse recurso sozinho justifica a troca de plataforma para empresas com alto volume de pedidos parcelados.

**Impacto**: Resolve o problema numero 1 do Grupo Lauxen (identificado nos scripts `cruzar_appmax_v2.js`): parcelas AppMax que nao batem 1:1 com CRs do Tiny.

---

### A4. Conciliacao Intercompany (Cross-Company Reconciliation)

**Pitch**: Identifica e elimina automaticamente as transferencias entre empresas do grupo, garantindo que o DRE consolidado nao conte receita/despesa duplicada.

**User Story**: Como controller do Grupo Lauxen, quando a BlueLight transfere R$50.000 para a conta da Industrias Neon no Sicoob, quero que o sistema identifique que o debito na BL e o credito na IN sao a mesma operacao, e classifique ambas como "Transferencia Intercompany" sem impactar o DRE.

**Especificacao Detalhada**:

- **Deteccao Automatica**: O sistema cruza extratos de todas as empresas do grupo:
  - Debito na Empresa A + Credito na Empresa B, mesmo valor (tolerancia D+1 por conta de compensacao), mesma data (+/- 2 dias uteis
  - Padroes conhecidos: "Conta Simples LIMIT" = recarga que veio de outra conta
- **Dashboard Intercompany**:
  - Diagrama Sankey mostrando fluxo de dinheiro entre empresas do grupo
  - Tabela com todas as transferencias detectadas no periodo
  - Coluna "Status": Auto-eliminada, Pendente Confirmacao, Divergente
  - KPI: "Total eliminado do consolidado: R$XXX.XXX"
- **Regras de Matching Intercompany**:
  - Contas bancarias do grupo sao cadastradas com flag `is_group_account`
  - Transferencia = debito em conta do grupo + credito em outra conta do grupo
  - Se valor diverge: alerta "Possivel taxa bancaria de R$X.XX na transferencia"
- **Edge Cases**:
  - Transferencia com taxa (TED R$8,50): o debito e maior que o credito. Sistema detecta diferenca e lanca taxa como despesa financeira
  - Transferencia parcial: R$50k saiu mas R$30k chegou no mesmo dia e R$20k no dia seguinte (split de lotes)
  - Conta compartilhada: mesma conta bancaria usada por 2 empresas (nao recomendado, mas acontece)

**Implementacao Tecnica**:
```
Tabela: intercompany_transfers
- id, source_company_id, target_company_id, 
  source_transaction_id, target_transaction_id,
  amount, fee_amount, transfer_date, 
  status (auto_matched|pending|confirmed|divergent),
  matched_at, confirmed_by

Tabela: group_bank_accounts
- id, company_id, bank_name, account_number, 
  is_group_account (boolean), linked_ofx_folder

View: v_consolidated_financeiro (exclui intercompany do fato_financeiro)

API: POST /api/intercompany/detect-all { period }
API: GET /api/intercompany/sankey-data { period }
API: PATCH /api/intercompany/:id/confirm
```

**Fosso Competitivo**: Nenhum concorrente no Brasil oferece reconciliacao intercompany automatica. Holdings com 4+ empresas (segmento-alvo) nao tem alternativa.

**Impacto**: Elimina 2-3 horas semanais de trabalho manual de eliminacao intercompany. DRE consolidado fica correto automaticamente.

---

### A5. Motor de Regras de Tolerancia (Visual Tolerance Rules Builder)

**Pitch**: Interface visual estilo Zapier/n8n onde o CFO configura regras como "Se categoria = Trafego Pago E fornecedor = Meta E diferenca < 3%, aceitar automaticamente".

**User Story**: Como CFO, quero configurar que cobracas de Meta Ads podem ter variacao de ate 5% (por causa de cambio USD/BRL) e serem conciliadas automaticamente, sem passar por aprovacao.

**Especificacao Detalhada**:

- **Builder Visual**:
  - Interface drag-and-drop com blocos:
    - **CONDICAO**: Categoria, Fornecedor, Banco, Valor Min/Max, Empresa, Tipo (CR/CP)
    - **TOLERANCIA**: Absoluta (R$), Percentual (%), Dias de atraso
    - **ACAO**: Auto-conciliar, Sugerir, Alertar, Aprovar com supervisor
  - Cada regra tem nome, descricao, prioridade (1-100), e status (ativa/inativa)
  - Preview: "Esta regra teria afetado 47 transacoes no ultimo mes"
- **Regras Pre-configuradas (Templates)**:
  - "Gateway de Pagamento" (tolera D+30 e taxas de gateway ate 5%)
  - "Assinatura Recorrente" (tolera variacao de 2% para SaaS com cambio)
  - "Parcela de Boleto" (tolera diferenca de centavos por arredondamento)
  - "Imposto Retido" (detecta ISS/PIS/COFINS retidos e ajusta automaticamente)
- **Log de Execucao**: Cada aplicacao de regra gera log com: regra aplicada, valor original, valor aceito, diferenca tolerada, timestamp
- **Edge Cases**:
  - Regras conflitantes: regra com maior prioridade vence
  - Regra atinge limite de valor acumulado (ex: "tolerar ate R$500/mes total de diferencas"): bloqueia e escala para aprovacao
  - Regra retroativa: permite rodar regra em transacoes ja pendentes

**Implementacao Tecnica**:
```
Tabela: tolerance_rules
- id, company_id, name, description, priority (1-100),
  conditions (jsonb): [{ field, operator, value }],
  tolerance (jsonb): { type: 'percent'|'absolute'|'days', value },
  action (enum): auto_reconcile|suggest|alert|require_approval,
  max_monthly_tolerance (decimal), current_month_used (decimal),
  is_active, created_by, created_at

Tabela: tolerance_rule_log
- id, rule_id, transaction_id, original_amount, matched_amount,
  difference, tolerance_applied, action_taken, created_at

API: GET /api/rules
API: POST /api/rules (com validacao de conflito)
API: POST /api/rules/:id/preview { period }
API: POST /api/rules/evaluate { transaction_id }
```

**Fosso Competitivo**: Concorrentes tem tolerancia fixa (geralmente centavos). Um motor de regras visual com condicoes compostas e limites mensais e nivel enterprise que PMEs brasileiras nunca viram.

**Impacto**: Reduz false negatives em 40%. Transacoes que antes ficavam "pendentes" por R$0.50 de diferenca agora sao auto-resolvidas.

---

### A6. Heatmap de Confianca da Conciliacao

**Pitch**: Visualizacao tipo heatmap mostrando em tempo real o grau de confianca de cada match, com zonas verdes (auto-reconciliado), amarelas (precisa verificar) e vermelhas (divergente).

**User Story**: Como gerente financeiro, quero abrir o painel e imediatamente ver onde estao os problemas: quais empresas do grupo tem mais pendencias, quais periodos tem menor taxa de conciliacao.

**Especificacao Detalhada**:

- **Visualizacao Principal**: Grid com eixo X = semanas do mes, eixo Y = empresas do grupo + bancos
  - Cada celula: cor baseada na % de conciliacao (verde >95%, amarelo 80-95%, vermelho <80%)
  - Hover mostra: "BlueLight / Sicoob / Semana 2: 87% conciliado, 12 pendentes (R$34.200)"
  - Click: abre drill-down com lista de itens pendentes daquela celula
- **Visoes Alternativas**:
  - Por categoria (Marketing, Logistica, Folha, Vendas)
  - Por fornecedor/cliente (top 20 por volume)
  - Por banco/gateway
  - Timeline: evolucao da taxa de conciliacao ao longo dos meses
- **KPIs**:
  - "Saude Geral: 91.3% conciliado"
  - "Itens criticos (>5 dias sem match): 7"
  - "Valor total pendente: R$127.450"
  - "Tempo medio de resolucao: 2.3 dias"

**Implementacao Tecnica**:
```
View: v_reconciliation_heatmap
- company_id, bank_account_id, week_number, year,
  total_transactions, matched_count, pending_count,
  confidence_avg, total_pending_amount

API: GET /api/heatmap?period=2026-04&view=company_bank
API: GET /api/heatmap/drill-down?company=X&bank=Y&week=2

Materialized view refreshed every 15min via Supabase cron.
```

**Fosso Competitivo**: Nenhum concorrente tem visualizacao de confianca. E um conceito de ML/observabilidade aplicado a financas.

**Impacto**: CFO identifica problemas em 5 segundos ao inves de navegar por 10 telas.

---

### A7. Smart Grouping (Deteccao Automatica de Sequencias de Parcelas)

**Pitch**: Agrupa automaticamente parcelas dispersas (1/6, 2/6... 6/6) do mesmo pedido, mostrando visualmente o progresso de recebimento de cada parcelamento.

**User Story**: Como financeiro, quero ver que o pedido #12345 de R$6.000 em 6x esta com parcelas 1 a 4 recebidas, parcela 5 vence amanha, e parcela 6 vence em 30 dias.

**Especificacao Detalhada**:

- **Agrupamento**: O sistema detecta sequencias por:
  - Campo `historico` contendo "parcela X/Y" (regex ja usado nos scripts atuais)
  - Mesmo pedido numero + mesmo cliente + valores iguais em sequencia
  - Mesma `nota_fiscal` ou `pedido_id` com datas incrementais
- **UI de Parcelamento**:
  - Card visual tipo "progress bar" por pedido parcelado
  - Cada parcela e um bloco: verde (recebida), azul (no prazo), amarelo (vence em <3 dias), vermelho (vencida)
  - Valor total, valor recebido, valor pendente, % completado
  - Botao "Cobrar parcelas vencidas" (gera mensagem WhatsApp/email)
- **Filtros**: Por cliente, por status (com atraso, no prazo, completo), por empresa
- **Alertas**: Notificacao quando parcela esta a 3 dias do vencimento e nao tem match no extrato

**Implementacao Tecnica**:
```
Tabela: installment_groups
- id, company_id, order_number, customer_doc, customer_name,
  total_amount, installment_count, 
  received_count, received_amount,
  status (in_progress|complete|overdue|partial_overdue),
  created_at, updated_at

Tabela: installment_group_items
- id, group_id, conta_receber_id, installment_number,
  amount, due_date, status (pending|received|overdue),
  received_date, received_amount

API: POST /api/installments/detect-groups (batch)
API: GET /api/installments?status=overdue&company_id=X
API: POST /api/installments/:id/send-reminder
```

**Fosso Competitivo**: Bling mostra parcelas individuais sem agrupamento. Essa visao consolidada de progresso de parcelamento e unica.

**Impacto**: Visibilidade completa do ciclo de parcelamentos. Reduz inadimplencia com alertas proativos.

---

## B. INTELIGENCIA FINANCEIRA & ANALYTICS

### B1. DRE em Tempo Real com Impacto por Conciliacao

**Pitch**: Cada vez que uma transacao e conciliada, o DRE atualiza em tempo real mostrando o impacto exato daquela operacao na margem bruta e no EBITDA.

**User Story**: Como CFO, ao conciliar a fatura de R$15.000 de materia-prima, quero ver instantaneamente que a margem bruta caiu 1.2pp e o EBITDA reduziu R$15k, sem precisar ir para outra tela.

**Especificacao Detalhada**:

- **Widget Inline**: Na tela de conciliacao, sidebar direita mostra mini-DRE:
  - Antes da conciliacao: valores atuais
  - Depois: valores projetados com a transacao sendo conciliada
  - Destaque em verde/vermelho nas linhas afetadas
  - Animacao de transicao suave nos numeros
- **Impacto Acumulado do Dia**: "Hoje voce conciliou 34 transacoes. Impacto: Receita +R$82k, Custos +R$31k, Margem +R$51k"
- **Alerta de Limiar**: "Atencao: essa despesa de marketing fara o EBITDA ficar negativo no mes"

**Implementacao Tecnica**:
```
Real-time subscription via Supabase Realtime no fato_financeiro.
Compute DRE incrementalmente (delta) ao inves de recalcular tudo.

API: GET /api/dre/impact-preview { transaction_id, category, amount }
WebSocket: subscribe to 'fato_financeiro:changes' para atualizar DRE em tempo real.
```

**Fosso Competitivo**: Nenhum concorrente mostra impacto no DRE durante a conciliacao. E a fusao de dois workflows separados.

**Impacto**: CFO toma decisoes informadas durante a conciliacao, nao depois.

---

### B2. Motor de Predicao de Fluxo de Caixa (Cash Flow Prediction Engine)

**Pitch**: Preve o saldo de caixa para os proximos 30/60/90 dias usando historico de pagamentos, sazonalidade, e dados de CRs/CPs previstas, com cenarios otimista/realista/pessimista.

**User Story**: Como CFO do Grupo Lauxen, quero saber se terei caixa suficiente em 15 de maio para pagar a folha de R$85.000, considerando os recebimentos previstos e as contas a pagar agendadas.

**Especificacao Detalhada**:

- **Grafico de Projecao**: Area chart com 3 faixas:
  - Banda superior (otimista): todos recebimentos no prazo + 10% antecipacao
  - Linha central (realista): recebimentos com atraso historico medio aplicado
  - Banda inferior (pessimista): 20% de inadimplencia + atrasos 2x historico
- **Marcos Financeiros**: Linhas verticais no grafico para:
  - Dia de pagamento de folha
  - Vencimento de impostos (DAS, DARF)
  - Pagamento de fornecedores grandes
  - Renovacao de contratos
- **Alerta de Deficit**: "Em 12/05/2026, cenario realista projeta saldo de -R$14.200. Sugestao: antecipar R$30.000 de recebiveis ou postergar pagamento do fornecedor X"
- **Simulador What-If**: 
  - "E se eu antecipar 50% dos recebiveis de cartao?" (calcula taxa de antecipacao)
  - "E se eu postergar o pagamento do fornecedor X em 15 dias?"
  - "E se eu fechar o deal de R$120k nessa semana?"

**Implementacao Tecnica**:
```
Tabela: cashflow_projections
- id, company_id, projection_date, scenario (optimistic|realistic|pessimistic),
  projected_balance, projected_inflow, projected_outflow,
  confidence_interval_low, confidence_interval_high,
  generated_at

Tabela: cashflow_milestones
- id, company_id, date, description, amount, type (inflow|outflow),
  is_recurring, recurrence_pattern

API: GET /api/cashflow/projection?horizon=90d&company_id=X
API: POST /api/cashflow/simulate { adjustments: [...] }

Claude API: Gera narrativa do tipo "Seus proximos 30 dias: o caixa esta saudavel ate dia 18, quando a folha de pagamento..."
```

**Fosso Competitivo**: Conta Azul tem "previsao de caixa" basica (soma de CRs - CPs). A nossa usa ML com sazonalidade, comportamento historico por cliente, e simulacao de cenarios.

**Impacto**: Previne crises de caixa. Feature #1 pedida por CFOs em pesquisas de mercado.

---

### B3. Payment Behavior Score (Scoring de Comportamento de Pagamento)

**Pitch**: Score de 0 a 1000 para cada cliente e fornecedor baseado em pontualidade, volume, consistencia e tendencia, estilo "Serasa para o seu negocio".

**User Story**: Como financeiro, quero saber que o cliente "ABC Comercio" tem score 870 (otimo pagador, sempre antecipa) e o fornecedor "XYZ Insumos" tem score 420 (frequentemente atrasa 15+ dias), para priorizar cobrcancas e negociacoes.

**Especificacao Detalhada**:

- **Calculo do Score** (0-1000):
  - Pontualidade (40%): % de pagamentos no prazo nos ultimos 12 meses
  - Volume (20%): valor total transacionado (normalizado por segmento)
  - Consistencia (20%): desvio padrao do atraso (menor = melhor)
  - Tendencia (20%): score melhorando ou piorando nos ultimos 3 meses
- **Visualizacao**:
  - Card por entidade com gauge visual (vermelho/amarelo/verde)
  - Historico de score nos ultimos 12 meses (sparkline)
  - Top 10 melhores e piores pagadores
  - Distribuicao: grafico de histograma com bell curve
- **Acoes Vinculadas**:
  - Score < 300: alerta automatico "Cliente de risco" ao criar novo pedido
  - Score < 500: sugere pagamento antecipado ou garantia
  - Score > 800: sugere condicoes especiais de pagamento
- **Export**: Relatorio PDF "Analise de Risco de Carteira" para diretoria

**Implementacao Tecnica**:
```
Tabela: entity_scores
- id, entity_type (customer|supplier), entity_doc, entity_name,
  company_id, current_score, previous_score, 
  punctuality_score, volume_score, consistency_score, trend_score,
  score_history (jsonb: [{date, score}]),
  total_transactions, avg_delay_days,
  risk_level (low|medium|high|critical),
  last_calculated_at

API: GET /api/scores?type=customer&sort=score&order=asc&limit=20
API: GET /api/scores/:doc/history
API: POST /api/scores/recalculate (batch noturno)
```

**Fosso Competitivo**: Nenhum ERP brasileiro tem scoring proprietario. Serasa e externo e caro. Nosso score usa dados internos que so nos temos.

**Impacto**: Reduz inadimplencia em 15-20% com gestao proativa baseada em dados.

---

### B4. Detector de Anomalias Financeiras (Anomaly Detection)

**Pitch**: IA identifica transacoes anomalas em tempo real: valores fora do padrao, horarios incomuns, fornecedores novos com valores altos, duplicidades suspeitas.

**User Story**: Como CFO, quero ser alertado imediatamente se aparecer uma conta a pagar de R$45.000 para um fornecedor que normalmente cobra R$5.000, ou se houver duas cobracas identicas no mesmo dia.

**Especificacao Detalhada**:

- **Tipos de Anomalia Detectados**:
  1. **Valor atipico**: transacao com valor > 3 desvios padrao da media historica daquele fornecedor/categoria
  2. **Fornecedor novo + valor alto**: primeira transacao com um fornecedor acima de R$5.000
  3. **Duplicidade**: duas transacoes com mesmo valor, mesma data, mesmo counterparty
  4. **Timing anomalo**: pagamento em feriado/fim de semana, ou fora do padrao de dia do mes
  5. **Sequencia quebrada**: parcela 4/6 recebida sem parcela 3/6
  6. **Categoria inconsistente**: lancamento em categoria diferente do historico daquele fornecedor
  7. **Velocidade anomala**: 5+ transacoes do mesmo fornecedor em 1 dia (normalmente 1/mes)
- **Severidade**: Critica (bloqueia auto-conciliacao), Alta (alerta CFO), Media (log), Baixa (info)
- **UI de Anomalias**:
  - Feed tipo timeline com icones de severidade
  - Cada anomalia: descricao em linguagem natural (gerada por Claude), botoes "Ignorar", "Investigar", "Bloquear"
  - Dashboard: "7 anomalias hoje (2 criticas)"
  - Grafico: tendencia de anomalias por semana

**Implementacao Tecnica**:
```
Tabela: anomaly_detections
- id, company_id, transaction_id, anomaly_type, severity,
  description, details (jsonb), 
  status (open|investigating|dismissed|resolved),
  resolved_by, resolution_notes, created_at

Edge function (Supabase): trigger on INSERT fato_financeiro que roda checagem
Claude API: gera descricao em linguagem natural da anomalia
Z-score calculation: media e desvio padrao por (fornecedor, categoria) rolling 90 dias
```

**Fosso Competitivo**: Nenhum concorrente tem deteccao de anomalias. E feature de compliance enterprise (SOX) trazida para PMEs.

**Impacto**: Previne fraudes e erros. Descoberta rapida de cobracas duplicadas pode economizar R$10k+/mes.

---

### B5. Financial Health Score por Empresa

**Pitch**: Score unico de 0 a 100 que resume a saude financeira de cada empresa do grupo, combinando liquidez, rentabilidade, eficiencia operacional e tendencia.

**User Story**: Como CEO do Grupo Lauxen, quero ver num unico numero que a BlueLight esta com saude 82/100 (otima) e a Industrias Neon esta com 54/100 (atencao), para priorizar decisoes.

**Especificacao Detalhada**:

- **Componentes do Score**:
  - Liquidez (25%): saldo de caixa / despesas fixas dos proximos 30 dias
  - Rentabilidade (25%): EBITDA % da receita (benchmark por setor)
  - Eficiencia (25%): % de conciliacao automatica + tempo medio de resolucao
  - Tendencia (25%): variacao MoM dos 3 indicadores acima
- **Visualizacao**: Dashboard com cards de cada empresa, gauge visual, sparkline de evolucao
- **Comparativo**: Radar chart comparando empresas do grupo
- **Alertas**: Score < 40 dispara alerta para diretoria com recomendacoes geradas por Claude

**Implementacao Tecnica**:
```
Tabela: company_health_scores
- id, company_id, score, liquidity_score, profitability_score,
  efficiency_score, trend_score, details (jsonb),
  recommendations (text[]), calculated_at

Materialized view refresh diario.
Claude API: gera recomendacoes tipo "Industrias Neon: considere renegociar prazo com fornecedor X para melhorar liquidez"
```

**Fosso Competitivo**: Score holístico que combina dados operacionais (conciliacao) com financeiros. Impossivel de replicar sem a plataforma completa.

**Impacto**: CEO gerencia grupo de 4 empresas com uma unica tela.

---

### B6. Budget vs Actual Tracker

**Pitch**: Orcamento mensal por categoria com tracking em tempo real, mostrando desvios e projecao de como o mes vai fechar.

**User Story**: Como CFO, defini orcamento de Marketing de R$25.000/mes. Estamos no dia 15 e ja gastamos R$18.000. Quero ver que estamos 44% acima do ritmo e o sistema projeta R$36.000 no fim do mes.

**Especificacao Detalhada**:

- **Setup de Orcamento**: Tabela editavel por categoria e mes, com copy de mes anterior
- **Tracking**: Barra de progresso por categoria com 3 marcadores: real, orcado ate hoje, orcado total
- **Projecao**: extrapolacao linear + sazonalidade historica
- **Alertas**: "Marketing atingiu 80% do orcamento com 50% do mes restante"
- **Aprovacao**: gastos acima do orcamento requerem aprovacao (integrado com workflow B do item C2)

**Implementacao Tecnica**:
```
Tabela: budgets
- id, company_id, category, year, month, budgeted_amount,
  actual_amount (computed), variance, 
  status (on_track|warning|over_budget), created_by

API: GET /api/budgets?company_id=X&year=2026&month=4
API: PUT /api/budgets/:id { budgeted_amount }
API: GET /api/budgets/variance-report?period=2026-Q1
```

**Fosso Competitivo**: Granatum tem orcamento basico. O nosso com projecao inteligente e alertas proativos e diferente.

**Impacto**: Controle orcamentario automatizado. Previne estouros.

---

### B7. Cross-Reference Fiscal (NF-e Matching)

**Pitch**: Importa XMLs de NF-e e cruza automaticamente com contas a pagar/receber e extratos, garantindo que toda nota fiscal tem correspondencia financeira.

**User Story**: Como contador, quero importar os XMLs do mes e ver instantaneamente quais notas nao tem conta financeira correspondente no Tiny, e quais contas nao tem nota fiscal.

**Especificacao Detalhada**:

- **Import**: Upload de XMLs em lote ou integracaoo via SEFAZ API
- **Matching**: NF-e.valor vs CP/CR.valor + NF-e.cnpj_emitente vs CP/CR.fornecedor/cliente
- **Dashboard**: 3 listas - "NFs com match", "NFs sem conta financeira", "Contas sem NF"
- **Acoes**: "Criar CP a partir da NF-e" (pre-preenche com dados do XML)

**Implementacao Tecnica**:
```
Tabela: notas_fiscais
- id, company_id, chave_nfe, numero, serie, cnpj_emitente, 
  cnpj_destinatario, valor_total, data_emissao, 
  matched_conta_id, status, xml_data (jsonb)

API: POST /api/nfe/import (aceita ZIP de XMLs)
API: GET /api/nfe/unmatched
API: POST /api/nfe/:id/create-conta
```

**Fosso Competitivo**: Nibo e Omie tem import de XML mas nao fazem cross-reference automatico com conciliacao bancaria. Nosso fecha o triangulo: NF-e + Conta Financeira + Extrato Bancario.

**Impacto**: Compliance fiscal completo. Reduz risco de autuacao.

---

## C. AUTOMACAO & WORKFLOWS

### C1. Visual Rule Builder (Se/Entao para Financas)

**Pitch**: Interface visual tipo n8n/Zapier onde o usuario monta regras de automacao financeira: "SE deposito > R$10k E banco = Sicoob E horario = dia util ENTAO criar CR + categorizar como Vendas + notificar financeiro".

**User Story**: Como gestor financeiro, quero criar uma regra que automaticamente baixe toda CR cujo valor confere com um credito no extrato Olist, sem que eu precise olhar item por item.

**Especificacao Detalhada**:

- **Tipos de Trigger**:
  - Novo lancamento bancario (via OFX import ou webhook)
  - Nova CR/CP criada no Tiny
  - CR/CP vencida
  - Valor acima de threshold
  - Horario programado (diario, semanal)
- **Tipos de Condicao**:
  - Comparadores: igual, contem, maior que, menor que, entre, regex
  - Campos: valor, banco, categoria, fornecedor, cliente, data, marcadores
  - Logica: E, OU, NAO, agrupamento com parenteses
- **Tipos de Acao**:
  - Auto-conciliar (match + baixa)
  - Criar CP/CR
  - Categorizar
  - Adicionar marcador no Tiny
  - Enviar alerta (email, WhatsApp)
  - Mover para fila de aprovacao
  - Executar webhook externo
- **UI**: Canvas com blocos conectados por setas. Preview de "dry run" antes de ativar
- **Templates pre-prontos**: 15+ recipes para cenarios comuns do mercado brasileiro

**Implementacao Tecnica**:
```
Tabela: automation_rules
- id, company_id, name, description, is_active,
  trigger_type, trigger_config (jsonb),
  conditions (jsonb): [{ field, operator, value, logic }],
  actions (jsonb): [{ type, config }],
  execution_count, last_executed_at, created_by

Tabela: automation_executions
- id, rule_id, trigger_data (jsonb), result (success|error|skipped),
  actions_executed (jsonb), error_message, created_at

API: POST /api/automations
API: POST /api/automations/:id/dry-run { sample_data }
API: POST /api/automations/:id/execute
API: GET /api/automations/:id/history
```

**Fosso Competitivo**: Nenhum software financeiro brasileiro tem automacao visual. Isso e tecnologia de iPaaS (Make, n8n) aplicada especificamente para financas.

**Impacto**: Transforma tarefas manuais repetitivas em automacoes. O Grupo Lauxen poderia automatizar 80% do trabalho feito nos scripts JS atuais.

---

### C2. Workflow de Aprovacoes Configuravel

**Pitch**: Cadeia de aprovacao customizavel: "Conciliacao < R$5k = auto-aprovada. R$5k a R$20k = analista aprova. >R$20k = CFO aprova. >R$50k = CEO aprova."

**User Story**: Como CFO, quero que baixas de contas acima de R$20.000 passem pela minha aprovacao no celular antes de serem efetivadas no Tiny.

**Especificacao Detalhada**:

- **Configuracao**: Interface visual de "escada" de aprovacao
  - Cada degrau: faixa de valor + aprovador(es) + SLA (horas para aprovar)
  - Opcao de "qualquer um do grupo" ou "todos do grupo" (paralelo vs sequencial)
  - Regras por empresa, por categoria, por tipo (CR vs CP)
- **Fluxo**: Item chega na fila de aprovacao -> notificacao push/email/WhatsApp -> aprovador vê detalhes -> Aprova/Rejeita/Pede revisao -> Proximo aprovador se necessario -> Acao executada
- **Dashboard de Aprovacoes**: Lista com filtros, SLA ticker (vermelho se atrasado), bulk approve
- **Escalacao**: Se aprovador nao responde em X horas, escala para nivel acima

**Implementacao Tecnica**:
```
Tabela: approval_workflows
- id, company_id, name, conditions (jsonb), 
  steps (jsonb): [{ level, approvers: [user_ids], mode: 'any'|'all', sla_hours }]

Tabela: approval_requests
- id, workflow_id, entity_type, entity_id, amount,
  current_step, status (pending|approved|rejected|escalated),
  requested_by, created_at

Tabela: approval_decisions
- id, request_id, step_level, approver_id, 
  decision (approved|rejected|revision_requested),
  notes, decided_at

API: GET /api/approvals/pending?user_id=X
API: POST /api/approvals/:id/decide { decision, notes }
```

**Fosso Competitivo**: ERPs brasileiros tem aprovacao sim/nao basica. Cadeia multi-nivel com SLA, escalacao e paralelo e feature enterprise.

**Impacto**: Controle interno nivel SOX para PMEs. Reduz risco de fraude interna.

---

### C3. Cobranca Automatizada via WhatsApp/Email

**Pitch**: CRs vencidas geram automaticamente mensagens de cobranca personalizadas via WhatsApp (integrado com API) e email, com escalonamento progressivo.

**User Story**: Como financeiro, quero que no D+1 de vencimento o cliente receba um lembrete amigavel no WhatsApp. No D+7, um email mais firme. No D+15, notificacao ao comercial que vendeu.

**Especificacao Detalhada**:

- **Escalonamento Configuravel**:
  - D+1: WhatsApp amigavel "Oi [nome], tudo bem? Notamos que a parcela de R$X venceu ontem..."
  - D+3: Email formal com boleto/PIX atualizado
  - D+7: WhatsApp + email mais direto
  - D+15: Notificacao interna ao vendedor responsavel
  - D+30: Marca como "inadimplente" e bloqueia novos pedidos
- **Personalizacao**: Templates editaveis com variaveis ({nome}, {valor}, {vencimento}, {empresa})
- **Respostas**: Se cliente responde no WhatsApp, a mensagem aparece na timeline da CR
- **Opt-out**: Cliente pode responder "PARAR" para bloquear mensagens
- **Dashboard**: "Cobracas ativas: 23 | Valor total vencido: R$87.400 | Recuperado esse mes: R$42.100"

**Implementacao Tecnica**:
```
Tabela: collection_campaigns
- id, company_id, name, escalation_steps (jsonb):
  [{ day_offset, channel, template_id, notify_internal: [user_ids] }]

Tabela: collection_messages
- id, campaign_id, conta_receber_id, customer_doc,
  channel (whatsapp|email|internal), step_number,
  message_content, status (sent|delivered|read|replied|failed),
  sent_at, delivered_at, read_at

Integracoes: Gupshup API (ja usada pelo grupo), Resend/SES para email
API: POST /api/collections/run-daily (cron)
API: GET /api/collections/dashboard
```

**Fosso Competitivo**: Omie tem cobranca por email. WhatsApp com escalonamento inteligente e respostas bidirecionais nao existe em nenhum concorrente.

**Impacto**: Recuperacao de 30-40% dos valores vencidos de forma automatizada.

---

### C4. Auto-Categorizacao Inteligente

**Pitch**: Aprende com o historico de categorizacoes do usuario e sugere/aplica automaticamente a categoria correta para novas transacoes.

**User Story**: Como financeiro, toda vez que aparece um debito da "ANTHROPIC" no extrato, quero que o sistema ja saiba que e "Despesas com Tecnologia - Grupo" sem eu precisar classificar.

**Especificacao Detalhada**:

- **Aprendizado**: Cada vez que usuario categoriza uma transacao, o sistema salva:
  - `(descricao_normalizada, fornecedor, valor_range, banco) -> categoria`
- **Matching**: Para nova transacao, busca por similaridade:
  - Match exato de fornecedor: 95% confianca
  - Match de descricao (fuzzy/tf-idf): 80% confianca
  - Match de valor range + banco: 60% confianca
- **Auto-apply**: Confianca > 90% + 3+ matches anteriores = aplica automaticamente
- **Feedback Loop**: Se usuario corrige, ajusta modelo imediatamente

**Implementacao Tecnica**:
```
Tabela: categorization_rules
- id, company_id, counterparty_pattern, description_pattern,
  amount_min, amount_max, bank_account_id,
  target_category_id, target_category_name,
  confidence, match_count, last_used_at

API: POST /api/categorize/suggest { description, amount, bank }
API: POST /api/categorize/learn { transaction_id, category_id }
```

Ja existe mapeamento parcial no codigo atual (funcoes `getCategoria` e `getCategoriaFromItems` em `conciliar_pedidos.js`). Esse feature generaliza e automatiza.

**Fosso Competitivo**: Nibo tem categorias fixas. Nosso aprende e evolui. Apos 3 meses, 90%+ das transacoes sao auto-categorizadas.

**Impacto**: Elimina trabalho mecanico de classificacao. Dados financeiros sempre categorizados corretamente.

---

### C5. Reconciliacao Agendada com Relatorios

**Pitch**: Agenda runs de conciliacao automatica (diario, semanal) que rodam em background, conciliam o que puderem, e enviam relatorio por email/WhatsApp com o resumo.

**User Story**: Como CFO, quero que toda segunda-feira as 7h o sistema rode a conciliacao da semana anterior e me envie um email com "127 transacoes conciliadas automaticamente, 8 pendentes de revisao, valor total pendente R$23.400".

**Especificacao Detalhada**:

- **Configuracao**: Frequencia (diario/semanal/mensal), horario, empresas incluidas, regras a aplicar
- **Execucao**: Job em background que:
  1. Puxa extratos novos (OFX/API)
  2. Puxa CRs/CPs novas do Tiny
  3. Aplica regras de tolerancia
  4. Aplica pattern matching
  5. Aplica split intelligence
  6. Gera relatorio
- **Relatorio**: PDF/HTML com metricas + lista de pendencias

**Implementacao Tecnica**:
```
Tabela: scheduled_reconciliations
- id, company_id, name, cron_expression, 
  rules_to_apply (jsonb), notification_channels (jsonb),
  last_run_at, next_run_at, status

Tabela: reconciliation_runs
- id, schedule_id, started_at, finished_at,
  total_processed, auto_matched, pending, errors,
  report_url, summary (jsonb)

Supabase Edge Function + pg_cron para scheduling.
```

**Fosso Competitivo**: Nenhum concorrente tem conciliacao agendada automatica com relatorio.

**Impacto**: O financeiro chega na empresa e ja sabe o que precisa resolver. Zero tempo gasto em conciliacao de rotina.

---

## D. COLABORACAO & MULTI-USUARIO

### D1. Conciliacao Colaborativa em Tempo Real

**Pitch**: Multiplos contadores trabalham simultaneamente na mesma tela de conciliacao, vendo cursores uns dos outros, sem conflitos de lock.

**User Story**: Como gerente financeiro, quero que 2 analistas trabalhem na conciliacao de abril ao mesmo tempo - um faz CRs e outro faz CPs - vendo o progresso um do outro em tempo real.

**Especificacao Detalhada**:

- **Presence**: Avatares dos usuarios online na tela, com indicador de "trabalhando em: [transacao X]"
- **Lock Otimista**: Quando usuario A clica em uma transacao, ela fica com borda azul para A e borda cinza (locked) para B
- **Resolucao de Conflito**: Se B tenta conciliar algo que A esta editando, popup "Ana esta trabalhando neste item. Aguardar ou tomar controle?"
- **Progress Synced**: Barra de progresso "72% conciliado" atualiza em tempo real para todos
- **Chat Inline**: Bolha de chat por transacao para discutir duvidas sem sair da tela

**Implementacao Tecnica**:
```
Supabase Realtime channels:
- Channel: reconciliation:{company_id}:{period}
- Broadcast: user_presence, item_lock, item_reconciled, chat_message

Tabela: reconciliation_locks
- item_id, locked_by, locked_at, expires_at (TTL 5min)

Supabase Presence API para avatares online.
```

**Fosso Competitivo**: Nenhum software financeiro brasileiro tem colaboracao real-time. Isso e Google Docs para financas.

**Impacto**: Time de 3 pessoas faz em 1h o que antes levava 3h (trabalho sequencial).

---

### D2. Sistema de Atribuicao de Lotes

**Pitch**: Distribui automaticamente transacoes pendentes entre membros da equipe por regras (banco, empresa, categoria, valor).

**User Story**: Como gerente, quero que as CRs da BlueLight vao para Ana, as CPs da Industrias Neon para Bruno, e tudo acima de R$50k para mim.

**Especificacao Detalhada**:

- **Regras de Distribuicao**: Configuracao por campo (empresa, tipo, banco, faixa de valor) -> responsavel
- **Dashboard por Pessoa**: "Ana: 34 pendentes (R$127k) | Bruno: 21 pendentes (R$89k)"
- **Load Balancing**: Opcao de distribuicao automatica equilibrada (round-robin por volume ou valor)
- **Metricas**: Tempo medio de resolucao por pessoa, taxa de acerto, produtividade

**Implementacao Tecnica**:
```
Tabela: assignment_rules
- id, company_id, conditions (jsonb), assigned_to (user_id), priority

Tabela: reconciliation_assignments
- id, transaction_id, assigned_to, assigned_at, 
  completed_at, status, assignment_rule_id
```

**Fosso Competitivo**: Feature de gestao de equipe que nenhum concorrente tem. Transforma financeiro de "cada um faz o que quer" para operacao gerenciada.

**Impacto**: Visibilidade total da produtividade da equipe financeira.

---

### D3. Notas e Discussao por Transacao

**Pitch**: Comentarios threaded em qualquer transacao, CR, CP ou conciliacao, com mencoes (@usuario) e historico completo.

**User Story**: Como analista, quero anotar na CR #12345 "Valor diverge R$150 - confirmei com comercial que e desconto autorizado pelo gerente" para que o auditor entenda a decisao.

**Especificacao Detalhada**:

- **Threaded**: Comentario principal + respostas
- **Mencoes**: @nome notifica por email/push
- **Anexos**: Upload de comprovantes, prints, PDFs
- **Historico de Alteracoes**: "Ana mudou categoria de 'Marketing' para 'Tecnologia' em 12/04 15:23"
- **Pesquisavel**: Busca global por texto em comentarios

**Implementacao Tecnica**:
```
Tabela: transaction_comments (ja existe ComentariosPanel.tsx no codebase)
- id, entity_type, entity_id, user_id, content, 
  parent_id (para threads), mentions (user_ids[]),
  attachments (jsonb), created_at

Tabela: entity_audit_log
- id, entity_type, entity_id, user_id, action, 
  field_changed, old_value, new_value, created_at
```

**Fosso Competitivo**: Contexto e rastreabilidade que auditores adoram. Concorrentes nao tem historico de decisoes.

**Impacto**: Compliance e memoria institucional. Novo funcionario entende decisoes passadas.

---

## E. INGESTAO DE DADOS & CONECTIVIDADE

### E1. Open Finance Brasil (Conexao Direta com Bancos)

**Pitch**: Conecta diretamente com bancos via Open Finance API, eliminando necessidade de baixar e importar OFX manualmente.

**User Story**: Como financeiro, quero que os extratos do Sicoob e Olist Digital aparecam automaticamente na plataforma toda manhã, sem que eu precise entrar no internet banking.

**Especificacao Detalhada**:

- **Onboarding**: Fluxo OAuth com cada banco (consentimento via app do banco)
- **Sync Automatico**: Pull de transacoes a cada 4 horas
- **Reconciliacao Imediata**: Novas transacoes disparam pipeline de matching automaticamente
- **Multi-banco**: Conectar N contas de N bancos de N empresas em uma unica tela
- **Status**: Dashboard de conexoes mostrando status de cada banco (conectado, expirado, erro)

**Implementacao Tecnica**:
```
Tabela: bank_connections
- id, company_id, bank_code, consent_id, 
  access_token_encrypted, refresh_token_encrypted,
  last_sync_at, next_sync_at, status, error_log

Tabela: bank_transactions_raw
- id, connection_id, external_id, date, amount, 
  description, type (credit|debit), balance_after,
  reconciliation_status, imported_at

API: POST /api/banks/connect { bank_code }
API: POST /api/banks/:id/sync
API: GET /api/banks/connections

Open Finance API endpoints (BCB): 
- /accounts/v2/accounts
- /accounts/v2/accounts/{id}/transactions
```

**Fosso Competitivo**: Integracao com Open Finance e regulamentada pelo BCB. Requer certificacao. Barreira tecnica e regulatoria altissima.

**Impacto**: Elimina trabalho manual de download/upload de OFX. Dados em tempo quase-real.

---

### E2. OCR de Extratos em PDF

**Pitch**: Upload de extrato bancario em PDF (quando OFX nao esta disponivel) e o sistema extrai automaticamente todas as transacoes usando OCR + IA.

**User Story**: Como financeiro, alguns bancos so dao extrato em PDF. Quero fazer upload e ter as transacoes extraidas automaticamente.

**Especificacao Detalhada**:

- **Upload**: Drag-and-drop de PDF
- **Processamento**: OCR (Tesseract ou Claude Vision) extrai tabela de transacoes
- **Revisao**: Tela de "conferencia" mostrando PDF lado a lado com dados extraidos
- **Correcao**: Click em qualquer campo extraido para corrigir antes de importar
- **Templates por Banco**: Apos primeira extracao, sistema aprende layout do banco para proximos PDFs

**Implementacao Tecnica**:
```
Tabela: pdf_imports
- id, company_id, file_url, bank_detected, 
  extraction_status, transactions_extracted (jsonb),
  reviewed_by, imported_at

Claude Vision API: enviar imagem da pagina do PDF para extracao estruturada
Fallback: pdf-parse + regex por layout de banco conhecido
```

**Fosso Competitivo**: Conta Azul aceita OFX. Ninguem aceita PDF com OCR inteligente.

**Impacto**: Cobre 100% dos bancos, mesmo os que nao exportam OFX.

---

### E3. Universal CSV Mapper (Mapeador Universal)

**Pitch**: Interface drag-and-drop para mapear colunas de qualquer CSV para o formato da plataforma, com deteccao automatica de formato e salvamento de templates.

**User Story**: Como financeiro, recebo CSVs da AppMax, da Conta Simples e de fornecedores, todos com formatos diferentes. Quero arrastar colunas para mapear e salvar o template para proxima vez.

**Especificacao Detalhada**:

- **Auto-detect**: Sistema analisa cabeCalhos e sugere mapeamento (ex: "total_venda" -> Valor, "criado_em" -> Data)
- **UI**: Colunas do CSV a esquerda, campos do sistema a direita, linhas conectando
- **Preview**: Tabela mostrando 5 primeiras linhas mapeadas
- **Templates Salvos**: "AppMax Transacoes", "Conta Simples Extrato", etc.
- **Transformacoes**: Funcoes inline (converter "1.234,56" para 1234.56, formatar data BR para ISO)

**Implementacao Tecnica**:
```
Tabela: csv_templates
- id, company_id, name, source_name, 
  column_mappings (jsonb): [{ source_col, target_field, transform }],
  date_format, decimal_format, encoding,
  created_by, usage_count

API: POST /api/csv/analyze (envia amostra, retorna sugestao de mapeamento)
API: POST /api/csv/import { template_id, file }
```

**Fosso Competitivo**: Ninguem tem mapper visual com templates salvos. Omie exige formato fixo.

**Impacto**: Qualquer fonte de dados pode ser importada em 2 minutos.

---

### E4. Webhook Receiver (Push de Atualizacoes)

**Pitch**: Endpoint unico que recebe webhooks do Tiny, Pagar.me, AppMax e qualquer outro sistema, processando eventos em tempo real.

**User Story**: Como desenvolvedor/integrador, quero que quando um pedido e faturado no Tiny, a plataforma receba o evento automaticamente e ja inicie o processo de conciliacao.

**Especificacao Detalhada**:

- **Endpoints**: `POST /webhooks/{source}` (tiny, pagarme, appmax, generic)
- **Processamento**: Cada webhook dispara pipeline: parse -> enrich -> match -> categorize -> notify
- **Dashboard de Webhooks**: Log de todos os eventos recebidos com status (processed, failed, queued)
- **Retry**: Eventos falhados sao re-tentados 3x com backoff exponencial
- **Seguranca**: Validacao de signature/HMAC por source

**Implementacao Tecnica**:
```
Tabela: webhook_events
- id, source, event_type, payload (jsonb), 
  processing_status, processed_at, error_message,
  retry_count, created_at

Supabase Edge Function: /functions/v1/webhook-receiver
Queue: pg_net ou Supabase Queues para processamento assincrono
```

Ja existem webhooks no codebase (`all_webhooks.json`, `temp_webhook/`). Esse feature formaliza e produtiza.

**Fosso Competitivo**: Processamento em tempo real de webhooks com pipeline inteligente. Concorrentes fazem sync periodico, nao event-driven.

**Impacto**: Conciliacao quase instantanea. Dado chega -> match feito em segundos.

---

## F. REPORTING & COMPLIANCE

### F1. Gerador de Relatorio de Conciliacao Profissional

**Pitch**: PDF automatico com formatacao profissional contendo resumo executivo, detalhamento, graficos e assinaturas, pronto para auditoria.

**User Story**: Como contador, quero gerar um relatorio PDF da conciliacao de marco/2026 com logo da empresa, graficos, tabela de divergencias e espaco para assinatura, para entregar ao auditor.

**Especificacao Detalhada**:

- **Conteudo**:
  - Capa com logo, periodo, empresa
  - Resumo executivo (gerado por Claude): "No periodo de marco/2026, foram processadas 847 transacoes totalizando R$2.3M..."
  - KPIs: % conciliado, valor pendente, tempo medio
  - Graficos: evolucao diaria, distribuicao por banco, categorias
  - Tabela completa de divergencias
  - Assinaturas: responsavel + aprovador
- **Customizacao**: Templates editaveis (cores, logo, campos)
- **Formatos**: PDF, XLSX, CSV
- **Agendamento**: Gerar automaticamente no 1o dia util do mes e enviar por email

**Implementacao Tecnica**:
```
Puppeteer/Playwright para gerar PDF a partir de template HTML.
Claude API para gerar narrativa do resumo executivo.
Supabase Storage para armazenar relatorios gerados.

Tabela: generated_reports
- id, company_id, type, period, format, file_url, 
  generated_by, generated_at
```

**Fosso Competitivo**: Relatorio com narrativa gerada por IA e nivel de consultoria Big 4.

**Impacto**: Profissionaliza a entrega. Auditores ficam impressionados.

---

### F2. Aging Analysis (Analise de Vencimentos)

**Pitch**: Visualizacao classica de aging buckets (0-30, 31-60, 61-90, 90+ dias) para recebiveis e pagaveis, com drill-down por cliente/fornecedor.

**User Story**: Como CFO, quero ver que tenho R$450k em recebiveis vencidos ha mais de 60 dias, concentrados em 3 clientes, para decidir acoes de cobranca.

**Especificacao Detalhada**:

- **Buckets**: Corrente, 1-30, 31-60, 61-90, 91-120, 120+ dias
- **Visualizacao**: Stacked bar chart + tabela detalhada
- **Drill-down**: Clicar em bucket abre lista de CRs/CPs
- **Comparativo**: Aging deste mes vs mes anterior (melhorou ou piorou?)
- **Por Entidade**: Top 20 clientes/fornecedores por valor em atraso
- **KPIs**: DSO (Days Sales Outstanding), DPO (Days Payable Outstanding)

**Implementacao Tecnica**:
```
View materializada: v_aging_analysis
- entity_type, entity_doc, entity_name, bucket, total_amount, count

API: GET /api/aging?type=receivables&company_id=X&date=2026-04-13
```

**Fosso Competitivo**: Aging e basico, mas a combinacao com scoring (B3) e cobranca automatizada (C3) cria um ciclo completo que ninguem tem.

**Impacto**: Gestao profissional de capital de giro.

---

### F3. SLA de Conciliacao (Reconciliation SLA Tracking)

**Pitch**: Define e acompanha metas de tempo para conciliacao: "toda transacao deve ser conciliada em ate 48h".

**User Story**: Como gerente financeiro, quero saber que o time esta conciliando 92% das transacoes dentro do SLA de 48h, mas a BlueLight esta com 78% (abaixo da meta de 90%).

**Especificacao Detalhada**:

- **Configuracao**: SLA por empresa, por tipo, por faixa de valor
- **Dashboard**: Gauge por empresa, ranking de analistas, tendencia semanal
- **Alertas**: Transacao proxima do SLA dispara push notification
- **Gamificacao**: Badge "Conciliador do Mes" para quem tem melhor performance

**Implementacao Tecnica**:
```
Tabela: sla_configs
- id, company_id, transaction_type, max_hours, warning_hours

View: v_sla_compliance
- company_id, period, total_transactions, within_sla, breached, compliance_pct
```

**Fosso Competitivo**: Nenhum concorrente tem SLA de conciliacao. Conceito de DevOps/SRE aplicado a financas.

**Impacto**: Accountability da equipe. Ninguem "esquece" transacoes pendentes.

---

### F4. Exportacao Audit-Ready (SOX-Compliant)

**Pitch**: Exporta dados no formato exigido por auditorias (SOX 404, CVM, Big 4), com trail de auditoria completo.

**User Story**: Como controller, o auditor da PwC pediu o log completo de conciliacoes com quem fez, quando, e qual a justificativa para cada ajuste. Quero gerar isso em 1 click.

**Especificacao Detalhada**:

- **Conteudo**: Cada conciliacao com: timestamp, usuario, regra aplicada, valores antes/depois, justificativa, aprovador
- **Formato**: XLSX com abas separadas por tipo + PDF sumario
- **Filtros**: Periodo, empresa, materialidade (acima de R$X)
- **Hash**: Cada exportacao gera hash SHA-256 para prova de integridade

**Implementacao Tecnica**:
```
View: v_audit_trail
- Juncao de: reconciliation_log + approval_decisions + transaction_comments + entity_audit_log

API: GET /api/audit/export?period=2026-Q1&company_id=X&min_amount=10000
```

**Fosso Competitivo**: Compliance-grade audit trail. Posiciona a plataforma para mid-market e enterprise.

**Impacto**: Reduz tempo de auditoria de semanas para dias.

---

### F5. Executive Summary Generator (Resumo Executivo por IA)

**Pitch**: Claude gera narrativa executiva dos resultados financeiros do periodo, com insights e recomendacoes, no tom de um CFO apresentando ao board.

**User Story**: Como CEO, quero receber todo dia 1 um email com "Resumo Financeiro de Marco: Receita cresceu 12% MoM, EBITDA de 18%, 3 fornecedores com atraso cronico, recomendo renegociar com fornecedor X."

**Especificacao Detalhada**:

- **Inputs**: DRE, Fluxo de Caixa, Aging, Scores, Anomalias, SLA do periodo
- **Output**: Texto de 300-500 palavras em portugues, profissional, com bullets
- **Tom Configuravel**: Tecnico (para board), Resumido (para CEO), Detalhado (para auditoria)
- **Envio**: Email programado, PDF anexo, ou visualizacao na plataforma

**Implementacao Tecnica**:
```
Claude API com prompt estruturado contendo todos os KPIs do periodo.
System prompt: "Voce e um CFO experiente apresentando resultados ao conselho..."
Temperature: 0.3 (conservador, factual)

Tabela: executive_summaries
- id, company_id, period, tone, content, generated_at
```

**Fosso Competitivo**: IA gerativa aplicada a relatorios financeiros. Nenhum concorrente brasileiro usa LLM para insights financeiros.

**Impacto**: Democratiza analise financeira. Empresas sem controller tem insights de nivel consultoria.

---

## G. MOBILE & NOTIFICACOES

### G1. Mobile Companion (App de Aprovacoes)

**Pitch**: PWA otimizado para celular focado em 3 acoes: aprovar, rejeitar, consultar saldo de conciliacao.

**User Story**: Como CFO em viagem, quero aprovar a baixa de R$35.000 do fornecedor X no celular em 10 segundos, sem abrir laptop.

**Especificacao Detalhada**:

- **Telas**: Dashboard resumido, Fila de aprovacoes, Detalhes de transacao, Alertas
- **Gestos**: Swipe right = aprovar, swipe left = rejeitar, tap = detalhes
- **Biometria**: Face ID/Fingerprint para aprovacoes acima de threshold
- **Offline**: Cache de aprovacoes pendentes, sincroniza quando conectar

**Implementacao Tecnica**:
```
PWA com React + Workbox para service worker.
Supabase Realtime para push de novas aprovacoes.
Web Push API para notificacoes.
```

**Fosso Competitivo**: Omie tem app mas nao tem aprovacao de conciliacao. Experiencia mobile-first para financas.

**Impacto**: Tempo de aprovacao cai de horas para minutos.

---

### G2. WhatsApp Bot para Alertas e Aprovacoes

**Pitch**: Bot no WhatsApp que envia alertas, recebe aprovacoes por resposta, e responde consultas tipo "qual o saldo pendente da BlueLight?".

**User Story**: Como CFO, quero receber no WhatsApp "Nova aprovacao pendente: CP R$28.000 para Meta Ads. Responda SIM para aprovar ou NAO para rejeitar."

**Especificacao Detalhada**:

- **Alertas Proativos**: Aprovacoes, anomalias, SLA breaches, previsoes de caixa
- **Respostas**: SIM/NAO para aprovacoes, numero para selecionar opcao
- **Consultas**: "saldo bluelight", "pendencias hoje", "dre marco"
- **Seguranca**: Validacao do numero do celular cadastrado, PIN para operacoes sensíveis

**Implementacao Tecnica**:
```
Gupshup API (ja usada pelo grupo) para WhatsApp Business API.
NLU basico com Claude para interpretar consultas livres.
State machine para fluxos conversacionais (aprovacao, consulta, configuracao).
```

**Fosso Competitivo**: WhatsApp e o canal #1 no Brasil. Nenhum software financeiro tem bot funcional de WhatsApp.

**Impacto**: CFO gerencia financas sem abrir computador.

---

### G3. Alertas Configuraveis (Smart Alert Rules)

**Pitch**: Regras tipo "Se valor pendente de conciliacao > R$50k por mais de 3 dias, alertar CFO por WhatsApp + Email."

**User Story**: Como CFO, quero ser alertado proativamente quando algo nao esta certo, sem precisar olhar dashboards.

**Especificacao Detalhada**:

- **Builder de Regras**: Interface similar ao A5 (Tolerance Rules) mas para alertas
- **Condicoes**: Valor pendente, dias sem conciliar, score de saude, anomalias, SLA, aging
- **Canais**: Email, WhatsApp, Push, Slack
- **Frequencia**: Imediato, consolidado diario, consolidado semanal
- **Snooze**: "Mute este alerta por 24h"

**Implementacao Tecnica**:
```
Tabela: alert_rules
- id, company_id, name, conditions (jsonb), 
  channels (jsonb), frequency, is_active,
  last_triggered_at, snooze_until

Tabela: alert_history
- id, rule_id, triggered_at, message, channels_sent, acknowledged_at
```

**Fosso Competitivo**: Alertas granulares e configuraveis. Concorrentes tem notificacoes fixas.

**Impacto**: CFO dorme tranquilo sabendo que sera alertado se algo sair do normal.

---

### G4. Daily Digest Email

**Pitch**: Email matinal com resumo completo do status de conciliacao, pendencias criticas, e previsoes do dia.

**User Story**: Como gerente financeiro, quero receber as 7h um email com "Ontem: 89 transacoes conciliadas. Pendente: 12 itens (R$34k). Hoje espera-se receber: R$67k. Vencendo hoje: 3 CPs totalizando R$22k."

**Especificacao Detalhada**:

- **Secoes**: Resumo do dia anterior, Pendencias criticas, Previsoes para hoje, Metricas da equipe
- **Design**: HTML responsivo com graficos inline (sparklines)
- **Personalizacao**: Cada usuario escolhe quais secoes e quais empresas

**Implementacao Tecnica**:
```
Template HTML com Handlebars/React Email.
Cron job diario as 6h (antes do expediente).
Resend ou SES para envio.
```

**Fosso Competitivo**: Email profissional e personalizado. Concorrentes enviam notificacoes genericas.

**Impacto**: Produtividade. Equipe chega sabendo prioridades.

---

## H. WHITE-LABEL & ESCALABILIDADE

### H1. Modo BPO Multi-Tenant

**Pitch**: Escritorio de contabilidade gerencia 50+ clientes numa unica plataforma, com isolamento de dados, visao consolidada e precificacao por uso.

**User Story**: Como dono de escritorio contabil, quero ver o status de conciliacao de todos os meus 47 clientes numa unica tela, priorizar os mais urgentes, e delegar para minha equipe.

**Especificacao Detalhada**:

- **Onboarding de Cliente**: Formulario que cria tenant isolado com configuracoes pre-definidas
- **Dashboard BPO**: Grid de clientes com badges de status (ok, atencao, critico)
- **Switch de Contexto**: Trocar entre clientes com 1 click (sem logout/login)
- **Billing**: Metricas de uso por cliente (transacoes processadas, storage) para faturamento
- **Permissoes**: Funcionario do escritorio ve so clientes atribuidos

**Implementacao Tecnica**:
```
Tabela: bpo_tenants (extends unidades_negocio)
- id, parent_org_id, client_name, client_doc, 
  plan, usage_metrics (jsonb), billing_status

Row-Level Security no Supabase por tenant.
Superadmin view para dashboard consolidado do BPO.
```

**Fosso Competitivo**: Cria network effect: escritorio adota -> 50 clientes entram. Concorrentes nao tem modo BPO nativo.

**Impacto**: Canal de distribuicao massivo. 1 escritorio = 50 clientes.

---

### H2. Portal do Cliente

**Pitch**: Cliente do escritorio contabil acessa portal read-only vendo status de suas conciliacoes, relatorios e pendencias, com branding do escritorio.

**User Story**: Como cliente de um escritorio contabil, quero ver que 95% das minhas conciliacoes estao em dia, baixar o relatorio de marco e ver quais notas fiscais faltam.

**Especificacao Detalhada**:

- **Telas**: Dashboard resumido, Relatorios para download, Pendencias de documentos, Chat com contador
- **Permissoes**: Read-only, sem acesso a dados de outros clientes
- **Branding**: Logo e cores do escritorio (white-label)
- **Upload**: Cliente pode subir documentos solicitados pelo contador

**Implementacao Tecnica**:
```
Tabela: client_portal_access
- id, tenant_id, client_user_id, permissions (jsonb), 
  branding_config (jsonb)

Rota separada: /portal/:tenant_slug
SSR com Next.js para SEO/performance.
```

**Fosso Competitivo**: Portal white-label para escritorios. Nenhum concorrente oferece isso.

**Impacto**: Diferencial para escritorios venderam "servico digital" aos clientes.

---

### H3. Relatorios com Marca do Escritorio

**Pitch**: Todos os PDFs e emails gerados pelo sistema levam logo, cores e dados do escritorio contabil, nao da plataforma.

**User Story**: Como dono de escritorio, quero que o relatorio de conciliacao do meu cliente tenha meu logo e meus dados de contato, nao da plataforma de software.

**Especificacao Detalhada**:

- **Configuracao**: Upload de logo, definicao de cores primaria/secundaria, dados de contato, CNPJ
- **Aplicacao**: PDFs, emails, portal do cliente, exportacoes XLSX (header)
- **Preview**: Visualizar antes de ativar

**Implementacao Tecnica**:
```
Tabela: branding_configs
- id, org_id, logo_url, primary_color, secondary_color,
  company_name, company_doc, contact_info (jsonb),
  custom_footer_text

Template engine: variáveis de branding injetadas em todos os templates.
```

**Fosso Competitivo**: White-label completo. Escritorios promovem a propria marca.

**Impacto**: Stickiness. Escritorio nao troca porque a marca dele esta integrada.

---

### H4. Analytics de Uso e Billing

**Pitch**: Dashboard interno mostrando metricas de uso por tenant: transacoes processadas, usuarios ativos, storage, chamadas API, para precificacao baseada em consumo.

**User Story**: Como admin da plataforma, quero saber que o escritorio ABC processou 12.000 transacoes em marco, tem 8 usuarios ativos e usou 2.3GB de storage, para cobrar R$1.200 no plano variavel.

**Especificacao Detalhada**:

- **Metricas Trackeadas**: Transacoes, usuarios ativos, storage, API calls, relatorios gerados, PDFs processados
- **Dashboard**: Graficos de uso por tenant, tendencia, projecao de faturamento
- **Alertas**: Tenant se aproximando do limite do plano
- **Billing**: Integracao com Stripe/Asaas para cobranca automatica

**Implementacao Tecnica**:
```
Tabela: usage_metrics
- id, tenant_id, metric_type, period (YYYY-MM), value, recorded_at

Tabela: billing_events
- id, tenant_id, period, plan, usage_summary (jsonb),
  amount_brl, invoice_url, status

Metricas coletadas via triggers no Supabase + aggregation cron diario.
```

**Fosso Competitivo**: Monetizacao sofisticada baseada em valor entregue, nao features travadas.

**Impacto**: Modelo SaaS escalavel com unit economics claros.

---

## RESUMO DE IMPACTO E PRIORIZACAO

### Features de Maior Impacto Imediato (Quick Wins - Mes 1-2):
1. **A2 - Pattern Memory** (resolve 60% da conciliacao manual atual)
2. **A3 - Split Intelligence** (resolve o problema #1 do grupo: parcelas AppMax)
3. **C4 - Auto-Categorizacao** (elimina classificacao manual)
4. **E3 - CSV Mapper** (substitui scripts de import)
5. **G4 - Daily Digest** (valor imediato sem complexidade)

### Features de Maior Diferencial Competitivo (Mes 2-4):
6. **A1 - Oraculo de Recebimentos** (predicao e o holy grail)
7. **B2 - Predicao de Fluxo de Caixa** (feature #1 pedida por CFOs)
8. **C1 - Visual Rule Builder** (substitui todos os scripts JS atuais)
9. **A4 - Intercompany** (unico no Brasil para holdings)
10. **B4 - Detector de Anomalias** (seguranca e compliance)

### Features de Escala (Mes 4-6):
11. **H1 - Modo BPO** (escala via escritorios)
12. **E1 - Open Finance** (diferencial regulatorio)
13. **D1 - Conciliacao Colaborativa** (produtividade de equipe)
14. **F1 - Relatorio Profissional** (monetizacao via profissionalismo)
15. **B5 - Financial Health Score** (feature de CEO)

---

### Critical Files for Implementation
- `/c/CLAUDECODE/BusinessAnalytics/src/hooks/useFinanceiroData.ts` (hook principal de dados financeiros que precisa ser estendido para novos features)
- `/c/CLAUDECODE/BusinessAnalytics/src/integrations/supabase/types.ts` (tipos do Supabase que precisam das 15+ novas tabelas)
- `/c/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliacao_titulos.js` (logica de conciliacao atual que deve ser migrada para o backend NestJS)
- `/c/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` (documentacao de regras de negocio e APIs que fundamentam todas as features)
- `/c/CLAUDECODE/BusinessAnalytics/src/pages/DRE.tsx` (pagina DRE existente que sera base para o DRE em tempo real - B1)

---

I need to write the plan file. Let me check what tools I have for writing.

The system says I can write to the plan file at `C:\Users\Dell\.claude\plans\breezy-snacking-church-agent-a7346a6f09854daf5.md`. But I don't have a Write tool available. Let me provide the complete specification directly in my response, which is the expected output format for a planning task.

---

# CONCILIADOR FINANCEIRO -- Micro-Interaction Design Specification

## Architecture Context

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui (Radix primitives) + Sonner toasts + react-resizable-panels + cmdk (command palette) + tailwindcss-animate

**Design System Foundation:**
- Dark mode default, background `hsl(222 25% 8%)`
- Primary cyan `hsl(201 90% 60%)`, accent green `hsl(142 71% 45%)`
- Fonts: Inter (body), Sora (headings)
- Border radius: `0.875rem`
- Glass cards with `backdrop-blur`
- HSL CSS custom property system via `var(--primary)` etc.

**New tokens required for the reconciliation platform:**
- `--color-ai-purple: hsl(270 70% 60%)` -- AI suggestion accent
- `--color-match-green: hsl(142 71% 45%)` -- confirmed match
- `--color-warning-amber: hsl(38 92% 50%)` -- tolerance warnings
- `--color-amount-positive: hsl(142 71% 45%)`
- `--color-amount-negative: hsl(0 84% 60%)`
- `--font-mono: 'JetBrains Mono', monospace` -- financial amounts

**Additional dependencies needed:**
- `framer-motion` (^11.x) -- spring physics, layout animations, AnimatePresence
- `@dnd-kit/core` + `@dnd-kit/sortable` -- accessible drag-and-drop
- `@dnd-kit/utilities` -- sensor utilities
- No additional dependencies for SVG path animations (native CSS + React refs)

---

## 1. DRAG-TO-MATCH

### State Machine

```
IDLE -> INTENT -> DRAGGING -> OVER_VALID -> OVER_INVALID -> DROPPED_VALID -> DROPPED_INVALID -> MERGED -> IDLE
                            -> CANCELLED -> IDLE
```

**States:**
| State | Entry Condition | Visual |
|-------|----------------|--------|
| `IDLE` | Default | Normal row appearance |
| `INTENT` | `pointerdown` held >150ms OR `pointermove` >5px | Row gets `box-shadow: 0 1px 3px rgba(0,0,0,0.1)` |
| `DRAGGING` | Drag threshold crossed (5px) | Ghost card follows pointer, source fades to 40% opacity |
| `OVER_VALID` | Ghost intersects compatible right-panel item | Target glows with `--color-match-green` ring |
| `OVER_INVALID` | Ghost intersects incompatible item | Target shows red dashed border, cursor `not-allowed` |
| `DROPPED_VALID` | Release over valid target | Fly-to-target animation |
| `DROPPED_INVALID` | Release over invalid target OR outside panels | Rubber-band snap-back |
| `MERGED` | Fly animation complete | Both items compress into single reconciled row |
| `CANCELLED` | `Escape` key during drag | Snap-back, same as invalid drop |

### Animation Specifications

**Drag Start (IDLE to DRAGGING):**
```typescript
// Framer Motion variant
const dragStartVariant = {
  scale: 1.03,
  rotate: 1.5, // degrees, subtle tilt
  boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(var(--primary-rgb), 0.2)',
  transition: { type: 'spring', stiffness: 300, damping: 25 }
};
```
- Duration: spring-driven, settles in ~250ms
- Source row: opacity transitions to 0.4 over 200ms ease-out
- Cursor: changes to `grabbing`
- Left panel items not being dragged: `translateY` compress by 2px each (subtle), 200ms ease-out

**Ghost Card (while DRAGGING):**
- Follows pointer with 0-frame lag (using `onPointerMove` with `requestAnimationFrame`)
- Card width: fixed at source card width (captured on drag start)
- `will-change: transform` applied on drag start, removed on end
- `pointer-events: none` on ghost
- Ghost uses `position: fixed` for viewport-relative positioning
- Z-index: 9999

**Right Panel Highlighting (OVER_VALID):**
- Compatibility determined by: amount within 5% tolerance AND date within 7 days
- Valid targets get animated ring: `box-shadow: 0 0 0 2px var(--color-match-green), 0 0 12px rgba(var(--match-green-rgb), 0.3)`
- Ring pulses: opacity oscillates 0.6-1.0, 1.5s infinite
- Background subtly shifts to `rgba(var(--match-green-rgb), 0.05)`
- Transition in: 200ms ease-out
- Best match (closest amount) gets stronger glow: `0 0 20px` spread

**Invalid Drop (rubber-band snap-back):**
```typescript
const snapBackVariant = {
  x: 0, y: 0, // back to origin
  scale: 1,
  rotate: 0,
  transition: {
    type: 'spring',
    stiffness: 500,
    damping: 30,
    // overshoots origin slightly, then settles
  }
};
```
- Duration: ~400ms total (spring overshoot)
- Ghost card opacity: 1.0 during flight, source row fades back to 1.0
- Red flash on the ghost card border: 100ms

**Valid Drop (fly-to-target + merge):**
```typescript
// Phase 1: Fly to target (300ms)
const flyToTargetVariant = {
  x: targetRect.x - ghostRect.x,
  y: targetRect.y - ghostRect.y,
  scale: 0.95,
  rotate: 0,
  transition: { type: 'spring', stiffness: 400, damping: 35 }
};

// Phase 2: Merge (400ms, starts after fly completes)
// Both items scale down to 0.98, then a new "reconciled" row
// expands from the center point with scale 0->1 + fade 0->1
```
- Green flash on merge: `background: rgba(var(--match-green-rgb), 0.15)` for 300ms, then fades
- Both source and target items get `layout` animation via Framer Motion for smooth list reflow

**Multi-drag:**
- Select multiple items first (Shift+click or Ctrl+click, checkboxes)
- Dragging any selected item drags all: ghost shows stacked cards (up to 3 visible, then "+N" badge)
- Stack offset: each card 4px down and 4px right from previous
- Selection count badge: position top-right of stack, primary cyan background, white text, scale pop animation (0 -> 1.1 -> 1.0, 200ms)

### Accessibility
- **Keyboard equivalent:** Select item with Space, then press `M` to enter match mode. Arrow keys to navigate right panel. Enter to confirm match. Escape to cancel.
- **Screen reader:** "Transacao bancaria selecionada: R$ 1.500,00, Fornecedor X, 10 de abril. Pressione M para iniciar conciliacao."
- On match mode enter: "Modo de conciliacao ativo. Use setas para navegar registros compativeis."
- On match confirm: "Conciliacao criada: transacao R$ 1.500,00 vinculada a conta a pagar R$ 1.500,00."
- `aria-grabbed`, `aria-dropeffect`, ARIA live region for status updates

### Performance
- `will-change: transform, box-shadow` on drag start, removed on end
- Ghost card promoted to GPU layer via `transform: translateZ(0)`
- Compatibility calculation debounced at 16ms (one frame) during drag movement
- Right panel items: only recalculate visibility highlight when ghost Y position changes by >20px (reduces repaints)
- Use `@dnd-kit` sensors with activation constraint: `distance: 5` (prevents accidental drags)

### Error Recovery
- Network failure on reconciliation save: ghost card pauses at merge point, shows inline retry button with warning icon. "Erro ao salvar conciliacao. Tentar novamente?"
- Undo: bottom toast with "Desfazer" action button, 8-second window. Clicking undo animates the merge in reverse (split apart, fly back).

---

## 2. RECONCILIATION CONFIRMATION RITUAL

### State Machine

```
IDLE -> SAVING -> SAVED_NORMAL | SAVED_HIGH_VALUE -> CELEBRATION -> COUNTER_ANIMATING -> COMPLETE -> IDLE
```

**Threshold:** R$ 5.000,00 triggers high-value path.

### Animation Specifications

**Normal reconciliation (<R$5000):**
- Status badge transitions from "Pendente" (amber) to "Conciliado" (green): background color morph 300ms ease-in-out
- Checkmark icon draws itself (SVG stroke-dashoffset animation, 400ms ease-out)
- Session counter in header: number morphs with digit-roll animation, 300ms

**High-value reconciliation (>=R$5000):**

**Phase 1 -- Amount Counter (0ms - 1200ms):**
```typescript
// useCountUp hook
const counterConfig = {
  from: 0,
  to: finalAmount,
  duration: 1200,
  easing: 'easeOutExpo', // fast start, slow end for drama
  formatFn: (val) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val),
};
```
- Font: JetBrains Mono, 28px, bold
- Each digit rolls independently (CSS `transform: translateY` with overflow hidden)
- Final number "settles" with a tiny overshoot: scale 1.0 -> 1.02 -> 1.0 (100ms spring)

**Phase 2 -- Particle Effects (400ms - 2000ms, overlaps with counter):**
- NOT confetti. Subtle luminous particles rising upward, like Bloomberg terminal data visualization.
- 12-16 particles, each: circle 3-5px, colors from palette (cyan primary, green accent, white)
- Particles emit from the amount number position
- Each particle: `translateY` -40px to -120px, `opacity` 1 to 0, `scale` 1 to 0.5, random `translateX` drift +/- 30px
- Duration per particle: 800-1200ms (randomized)
- Stagger: 50ms between particles
- Implementation: Canvas overlay (not DOM nodes) for performance. 60fps target.

**Phase 3 -- Status Bar Pulse (800ms - 1400ms):**
- Bottom action bar background: brief green wash `rgba(var(--match-green-rgb), 0.1)` -> transparent
- Duration: 600ms, ease-out
- Session counter increments with the same digit-roll as described above

**Phase 4 -- Settle (1400ms - 2000ms):**
- All animations decay to rest
- The reconciled row gets a brief green left-border accent (3px solid green, fades after 3 seconds)
- Total: the entire ritual takes exactly 2 seconds. Feels celebratory but does NOT block workflow.

### Sound Design (optional, off by default)
- Toggle in settings: "Sons de confirmacao"
- High-value: soft ascending chime, two notes (C5-E5), 400ms, volume 15%
- Normal: single soft click/tap, 100ms, volume 10%
- Implementation: Web Audio API with pre-decoded AudioBuffers, <5KB each

### Accessibility
- Screen reader: "Conciliacao de alto valor criada com sucesso. Valor: R$ 12.500,00. Total da sessao: 47 conciliacoes."
- `prefers-reduced-motion`: skip particle effects, counter shows final value immediately, keep the checkmark draw animation (it's informational)
- No sound plays if system accessibility sound settings indicate reduced audio

---

## 3. SPLIT-SCREEN RESIZE

### State Machine

```
IDLE -> HOVER -> ACTIVE_DRAG -> SNAPPING -> COLLAPSED_LEFT | COLLAPSED_RIGHT -> IDLE
      -> DOUBLE_CLICK -> CYCLING_SNAP -> IDLE
```

**Snap Points:** 50/50, 60/40, 40/60, 70/30, 30/70

### Animation Specifications

**Handle Hover:**
- Handle width: 1px (idle) -> 4px (hover), 200ms ease-out
- Handle color: `var(--border)` -> `var(--primary)` at 60% opacity
- Grip dots icon: opacity 0 -> 1, 150ms, appears centered on handle
- Cursor: `col-resize`

**Active Drag:**
- Handle stays at 4px width, color becomes `var(--primary)` at 100%
- Both panels resize in real-time (react-resizable-panels handles this natively)
- CSS `user-select: none` on both panels during drag
- `will-change: width` on both panels

**Magnetic Snap (within 3% of a snap point):**
```typescript
const SNAP_POINTS = [30, 40, 50, 60, 70];
const SNAP_THRESHOLD = 3; // percentage points

// During drag, if currentPercent is within threshold of snap point:
// Apply spring force toward snap point
const snapTransition = {
  type: 'spring',
  stiffness: 600,
  damping: 40,
  // settles in ~200ms
};
```
- Visual feedback: when entering snap zone, handle briefly pulses (opacity 1 -> 0.6 -> 1, 200ms)
- Haptic feedback if supported: `navigator.vibrate(10)` (mobile only)

**Auto-Collapse (panel < 15%):**
- Panel content crossfades to icon-only view: content `opacity: 1 -> 0` (150ms), icons `opacity: 0 -> 1` (150ms, 100ms delay)
- Panel width settles at exactly `48px` (icon column width)
- Expand button appears: small arrow icon pointing toward collapsed panel
- Click expand button: panel springs to last non-collapsed width

**Double-Click Cycle:**
- Cycles through snap points: 50/50 -> 60/40 -> 70/30 -> 50/50
- Transition: 300ms spring (stiffness 400, damping 30)
- Content reflows fluidly during transition

**Column Adaptation:**
- Width > 600px: all columns visible
- Width 400-600px: hide "Categoria" and "Marcador" columns (fade out 200ms)
- Width 200-400px: show only "Valor", "Data", "Descricao" (truncated)
- Width < 200px: icon view, collapse trigger
- Column transitions use `opacity` + `width` animation (200ms ease-out)

### Accessibility
- **Keyboard:** Focus handle with Tab, then Left/Right arrows to resize in 5% increments. Home/End to snap to min/max. Enter to cycle snap points.
- **Screen reader:** "Divisor de paineis. Painel esquerdo: 50%. Use setas para redimensionar."
- After resize: "Painel esquerdo: 60%. Painel direito: 40%."

### Performance
- Both panels use `contain: layout style` during resize
- Content inside panels uses `content-visibility: auto` for off-screen elements
- Throttle resize events to animation frame (requestAnimationFrame)
- `react-resizable-panels` already handles most performance concerns natively

---

## 4. FILTER CHIPS SYSTEM

### State Machine (per chip)

```
HIDDEN -> APPEARING -> VISIBLE -> EDITING -> VISIBLE -> REMOVING -> HIDDEN
```

### Animation Specifications

**Chip Appear (filter applied):**
```typescript
const chipAppearVariant = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: [0, 1.1, 1.0],
    opacity: 1,
    transition: {
      scale: { times: [0, 0.6, 1], duration: 0.3, ease: 'easeOut' },
      opacity: { duration: 0.15 }
    }
  }
};
```
- Chip enters from the left side of the filter bar
- Uses `AnimatePresence` + `layoutId` for smooth reordering

**Chip Color by Type:**
| Filter Type | Background | Border |
|------------|-----------|--------|
| Data | `hsl(201 90% 60% / 0.15)` | `hsl(201 90% 60% / 0.3)` |
| Valor | `hsl(142 71% 45% / 0.15)` | `hsl(142 71% 45% / 0.3)` |
| Status | `hsl(38 92% 50% / 0.15)` | `hsl(38 92% 50% / 0.3)` |
| Empresa | `hsl(270 70% 60% / 0.15)` | `hsl(270 70% 60% / 0.3)` |
| Categoria | `hsl(340 75% 55% / 0.15)` | `hsl(340 75% 55% / 0.3)` |

**Chip Remove (X click):**
```typescript
const chipRemoveVariant = {
  exit: {
    scale: 0.8,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.2, ease: 'easeIn' }
  }
};
```
- Remaining chips slide left to fill gap: `layout` transition 200ms spring

**Chip Inline Edit (click chip body):**
- Chip expands smoothly to reveal inline edit field (width grows, 200ms spring)
- Input auto-focused, pre-filled with current value
- Background brightens slightly during edit
- Enter or blur: commits edit, chip shrinks back
- If value cleared: chip removes

**Chip Drag Reorder:**
- Use `@dnd-kit/sortable` for reorder within the chip bar
- Dragged chip: scale 1.05, shadow elevation, 150ms
- Drop: layout animation repositions all chips, 200ms spring
- Reorder affects filter priority (first chip = primary filter)

**Preset Chips:**
- Preset chips have a different visual: filled background (not outlined), with a bookmark icon
- "Salvar como preset" button appears when 2+ filters active
- Click: popover with name input. Default name generated from filter contents: "Pendentes > R$5.000"
- Preset chip appear: same pop animation but with a brief shimmer (left-to-right gradient sweep, 500ms)

### Accessibility
- Chips are an `aria-list` with `role="option"` items
- Screen reader: "Filtro ativo: Data, ultimos 7 dias. Pressione Delete para remover."
- Keyboard: Tab to chip bar, arrow keys to navigate chips, Delete to remove, Enter to edit, Ctrl+S to save as preset

---

## 5. AI SUGGESTION REVEAL

### State Machine

```
HIDDEN -> REVEALING -> VISIBLE -> ACCEPTED | REJECTED -> HIDDEN
                    -> HOVER_DETAIL -> VISIBLE
```

### Animation Specifications

**Reveal Sequence (triggered when AI returns suggestion):**

**Phase 0 -- Badge Glow (0ms):**
- AI badge (top of suggestion area) emits purple glow
- `box-shadow: 0 0 0 0 rgba(var(--ai-purple-rgb), 0.4)` -> `0 0 20px 8px rgba(var(--ai-purple-rgb), 0.2)`
- Pulses twice: 600ms each, ease-in-out
- Badge icon: sparkle/wand animates with a brief rotation (0 -> 15deg -> 0, 300ms)

**Phase 1 -- Connection Line Draw (200ms - 1000ms):**
```typescript
// SVG path from left item center-right to right item center-left
// Using cubic bezier curve for elegant S-shape
const pathD = `M ${leftX},${leftY} C ${leftX + 80},${leftY} ${rightX - 80},${rightY} ${rightX},${rightY}`;

// CSS animation
.connection-line {
  stroke: var(--color-ai-purple);
  stroke-width: 2;
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  animation: draw-line 800ms ease-out 200ms forwards;
  filter: drop-shadow(0 0 4px rgba(var(--ai-purple-rgb), 0.3));
}

@keyframes draw-line {
  to { stroke-dashoffset: 0; }
}
```
- Line style: dashed (4px dash, 4px gap), purple, with subtle glow filter
- Line draws left-to-right, 800ms, ease-out (starts fast, decelerates)
- Small animated dots travel along the path (2 dots, looping, 2s period) after line is drawn

**Phase 2 -- Item Tinting (600ms - 1000ms):**
- Both matched items: background transitions to `rgba(var(--ai-purple-rgb), 0.06)`
- Left border accent appears: 3px solid purple, opacity 0->1, 300ms
- Duration: 400ms, ease-out
- This overlaps with the line drawing for a cohesive feel

**Phase 3 -- Confidence Score (800ms - 1400ms):**
- Score counter: 0% -> final value (e.g., 94%)
- Duration: 600ms, easeOutExpo
- Font: JetBrains Mono, 14px
- Color: interpolates based on value: <70% amber, 70-85% cyan, >85% green
- Micro-interaction: small circular progress ring around the percentage, fills as number counts up

**Hover Detail:**
- After 300ms hover on either item or the connection line:
- Tooltip card appears below the connection line midpoint
- Content: "IA identificou: Valor identico (R$ 1.500,00), data com 1 dia de diferenca, descricao similar (87%)."
- Card: glass morphism background, `backdrop-blur: 12px`, purple top border
- Appear: `opacity: 0, translateY: 8px` -> `opacity: 1, translateY: 0`, 200ms ease-out

**Accept:**
```typescript
// Line solidifies and turns green
const acceptLineAnimation = {
  strokeDasharray: 'none', // solid
  stroke: 'var(--color-match-green)',
  transition: { duration: 0.3 }
};

// Items compress together (same merge as drag-to-match)
// Confidence badge morphs to checkmark
```
- Line: dashed -> solid (200ms), purple -> green (200ms, simultaneous)
- Items: compress toward center, merge animation (400ms spring)
- Confidence text changes to "Conciliado" with checkmark
- Traveling dots on line: accelerate and converge to center point, disappear

**Reject:**
```typescript
// Line disintegrates
const rejectLineAnimation = {
  strokeDashoffset: pathLength, // reverse draw
  opacity: 0,
  transition: { duration: 0.4, ease: 'easeIn' }
};
```
- Line: reverse draw (right to left), 400ms ease-in, plus fade
- Item tints: fade back to normal, 300ms
- Badge: "Rejeitada" appears briefly in red, then fades (1.5s)
- Items return to normal appearance
- Traveling dots: scatter outward and fade

### Accessibility
- Screen reader: "Sugestao da IA: vincular transacao R$ 1.500,00 de 10/04 com conta a pagar R$ 1.500,00 de 09/04. Confianca: 94%. Pressione Enter para aceitar, Delete para rejeitar."
- Focus management: when suggestion reveals, focus moves to the first suggested item
- `prefers-reduced-motion`: skip line animation, show connection as static dotted line immediately. Skip particle effects. Keep color transitions.

### Performance
- SVG connection line: single `<path>` element, GPU-composited via `will-change: stroke-dashoffset`
- Traveling dots: CSS animations on 2 `<circle>` elements with `offset-path`, not JavaScript-driven
- Confidence counter: `requestAnimationFrame` loop, not `setInterval`
- Pre-calculate path length with `getTotalLength()` on mount

---

## 6. TRANSACTION ROW EXPAND/COLLAPSE

### State Machine

```
COLLAPSED -> EXPANDING -> EXPANDED -> COLLAPSING -> COLLAPSED
```

### Animation Specifications

**Arrow Rotation:**
```css
.expand-arrow {
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1); /* slight overshoot */
}
.expand-arrow[data-expanded="true"] {
  transform: rotate(180deg);
}
```

**Row Height Expansion:**
```typescript
const expandVariant = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { type: 'spring', stiffness: 300, damping: 30 }, // ~350ms
      opacity: { duration: 0.2, delay: 0.1 }
    }
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { type: 'spring', stiffness: 400, damping: 35 }, // ~250ms, faster collapse
      opacity: { duration: 0.15 }
    }
  }
};
```

**Staggered Content Reveal:**
```typescript
const contentFieldVariant = {
  initial: { opacity: 0, x: -8 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.05 * i + 0.15, duration: 0.2, ease: 'easeOut' }
  })
};
// Fields: Descricao completa, Categoria, Marcadores, Historico, Observacoes
// Each field staggers by 50ms
```

**Background Change:**
- Expanded row: `background: rgba(var(--primary-rgb), 0.03)` (very subtle cyan tint)
- Left border: 2px solid primary, opacity 0->1, 200ms

**Auto-scroll:**
- After expansion settles (350ms), check if expanded content overflows viewport
- If so: `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the row
- Scroll duration: browser-controlled smooth scroll (~300ms)

**Click outside to collapse:**
- Listener on document, check if click target is within any expanded row
- If not: collapse all expanded rows simultaneously
- Each row collapses with the exit variant (stagger not needed for simultaneous collapse)

### Accessibility
- Expand button: `aria-expanded="true|false"`, `aria-controls="row-detail-{id}"`
- Expanded content: `role="region"`, `aria-labelledby="row-summary-{id}"`
- Screen reader: "Expandir detalhes da transacao R$ 1.500,00" / "Detalhes expandidos. Descricao: Pagamento fornecedor XYZ..."
- Keyboard: Enter/Space on arrow to toggle. Focus trapped within expanded content when open (Tab cycles through detail fields).

### Performance
- Use `AnimatePresence` with `mode="sync"` for multiple simultaneous expand/collapse
- Expanded content lazy-rendered (not in DOM when collapsed) -- `AnimatePresence` handles mount/unmount
- `overflow: hidden` on row container during animation to prevent content flash
- `content-visibility: auto` on expanded detail panels not currently visible in scroll

---

## 7. BULK SELECTION PROGRESS

### State Machine

```
EMPTY -> SELECTING -> PARTIAL_MATCH -> EXACT_MATCH -> OVER_TOLERANCE -> RECONCILING -> COMPLETE
```

### Animation Specifications

**Selection Counter (bottom action bar):**
```typescript
// Each increment: number rolls up (translateY animation on individual digits)
const CounterDigit = ({ value }) => (
  <motion.span
    key={value}
    initial={{ y: 12, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: -12, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
  >
    {value}
  </motion.span>
);
```
- Counter format: "3 itens selecionados" with the number being the animated part
- Each digit change: 200ms spring with slight overshoot (bouncy feel)

**Running Total:**
- Displayed as: `Total esquerdo: R$ 4.500,00 | Total direito: R$ 4.350,00`
- Each amount uses the digit-roll animation independently
- Update triggers on every selection change (debounced 50ms for rapid multi-select)

**Difference Indicator:**
```typescript
const getDifferenceColor = (diff: number, tolerance: number) => {
  const ratio = Math.abs(diff) / tolerance;
  if (ratio === 0) return 'var(--color-match-green)';       // exact match
  if (ratio <= 0.5) return 'hsl(142 71% 45%)';              // green
  if (ratio <= 1.0) return 'hsl(38 92% 50%)';               // amber
  return 'hsl(0 84% 60%)';                                   // red - over tolerance
};
```
- Color transitions: 300ms ease-out on `color` and `background-color`
- Difference text: "Diferenca: R$ 150,00" with the color applied
- When difference hits 0: brief green flash on the entire bottom bar (`background: rgba(var(--match-green-rgb), 0.08)`, 400ms, ease-out, then fade)

**Exact Match Celebration:**
- Bottom bar: green background flash (as above)
- Checkmark icon briefly appears next to the difference (scale 0->1.1->1.0, 300ms)
- The "RECONCILIAR" button transforms:

**Button Enable Transition:**
```typescript
const buttonEnableVariant = {
  disabled: {
    opacity: 0.4,
    scale: 1,
    background: 'var(--muted)',
  },
  enabled: {
    opacity: 1,
    scale: [1, 1.05, 1],
    background: 'var(--color-match-green)',
    transition: {
      scale: { times: [0, 0.5, 1], duration: 0.4 },
      opacity: { duration: 0.2 },
      background: { duration: 0.3 }
    }
  }
};
```
- Button text changes: "Selecione itens" -> "Reconciliar (3 itens)"
- Text crossfade: 200ms

### Accessibility
- Live region: `aria-live="polite"` on the bottom bar
- Screen reader: "3 itens selecionados. Total esquerdo: R$ 4.500,00. Total direito: R$ 4.350,00. Diferenca: R$ 150,00."
- When exact match: "Valores coincidem. Botao Reconciliar disponivel."
- Keyboard: Ctrl+A to select all visible, Shift+Arrow to extend selection, Ctrl+Enter to reconcile

---

## 8. SYNC PULSE ANIMATION

### State Machine

```
IDLE -> SYNCING -> PROCESSING -> COMPLETING -> SUCCESS | ERROR -> IDLE
```

### Animation Specifications

**Sync Icon (radar sweep, not spinner):**
```css
@keyframes radar-sweep {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.sync-icon-container {
  position: relative;
}

.sync-icon-sweep {
  position: absolute;
  inset: 0;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(var(--primary-rgb), 0.3) 60deg,
    transparent 120deg
  );
  border-radius: 50%;
  animation: radar-sweep 2s linear infinite;
}
```
- The sweep is a conic gradient that rotates, creating a radar effect
- Icon underneath: static refresh/sync icon in primary color
- Container: 32x32px circle

**Company Color Dot Pulse:**
```css
.company-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--company-color);
  animation: dot-pulse 1.5s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.7; }
}
```

**Data Packet Flow (abstract, subtle):**
- 3 small dots (4px) that travel along a curved path from left (API icon) to right (DB icon)
- Path: horizontal with slight arc
- Each dot staggered by 400ms
- Dot: opacity pulses 0.3->1.0->0.3 along its journey
- Total travel: 1.2s per dot
- Implementation: CSS `offset-path` with `motion-path`

**Progress Counter:**
- "Processando: 147 / 1.203 registros"
- Number uses the digit-roll animation
- Progress bar underneath: thin (2px), fills left to right, primary cyan color
- Bar uses `scaleX` transform for GPU-composited animation

**Completion:**
```typescript
const completionSequence = {
  // 1. Radar sweep decelerates (2s -> 4s -> stop)
  // 2. Checkmark overlays the sync icon (SVG path draw, 400ms)
  // 3. Green flash on container: box-shadow pulse
  // 4. "1.203 registros sincronizados" - counter does final roll to total
  // 5. After 3s, icon returns to idle state
};
```

**Error:**
```typescript
const errorSequence = {
  // 1. Radar sweep stops abruptly
  // 2. Icon color: primary -> red, 200ms
  // 3. Shake: translateX [0, -4, 4, -4, 0], 300ms (3 shakes)
  // 4. Error message appears below: red text, fade in 200ms
  // 5. Icon stays red until user acknowledges or retries
};
```

### Accessibility
- `role="status"`, `aria-live="polite"` on sync container
- Screen reader: "Sincronizacao em andamento. 147 de 1203 registros processados."
- On completion: "Sincronizacao concluida. 1203 registros sincronizados."
- On error: "Erro na sincronizacao. Detalhes: timeout de conexao."
- `prefers-reduced-motion`: static spinner instead of radar sweep, no data packet animation

---

## 9. ONBOARDING PROGRESSIVE DISCLOSURE

### State Machine

```
STEP_N_ENTERING -> STEP_N_ACTIVE -> STEP_N_VALIDATING -> STEP_N_COMPLETE -> STEP_N+1_ENTERING
```

### Animation Specifications

**Step Transition (parallax slide):**
```typescript
const stepTransition = {
  enter: {
    content: { x: '100%', opacity: 0 },
    background: { x: '30%' }, // moves slower = parallax
  },
  active: {
    content: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 200, damping: 25 } },
    background: { x: 0, transition: { type: 'spring', stiffness: 200, damping: 30 } }, // slightly slower
  },
  exit: {
    content: { x: '-100%', opacity: 0 },
    background: { x: '-30%' },
  }
};
```
- Content layer moves full distance, background pattern moves 30% -- creates depth
- Duration: ~500ms total (spring-driven)

**Form Field Stagger:**
```typescript
const fieldStagger = {
  container: {
    animate: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } }
  },
  field: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
  }
};
```
- Each field: fade in + slide up from 16px, 300ms
- Stagger delay: 80ms between fields
- First field auto-focuses after its animation completes

**Field Validation Checkmark:**
```typescript
const validationCheckmark = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: [0, 1.2, 1.0],
    opacity: 1,
    transition: { duration: 0.3, times: [0, 0.6, 1] }
  }
};
```
- Green checkmark icon appears to the right of the field
- Invalid: red X with same animation but `var(--destructive)` color
- Validation triggers on blur or after 500ms of no typing (debounced)

**Step Dot Completion:**
```css
.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--border);
  transition: all 300ms ease-out;
}

.step-dot.complete {
  background: var(--primary);
  border-color: var(--primary);
  animation: dot-pop 300ms ease-out;
}

@keyframes dot-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
}
```

**Progress Line (liquid fill):**
```css
.progress-line {
  height: 2px;
  background: var(--border);
  position: relative;
}

.progress-line::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--primary);
  transition: width 500ms cubic-bezier(0.34, 1.56, 0.64, 1); /* spring-like overshoot */
}
```
- Width transitions smoothly as steps complete
- The overshoot easing gives a "liquid settling" feel

### Accessibility
- Steps use `aria-current="step"` on active step
- Progress: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Screen reader: "Passo 2 de 5: Configurar empresa. Campo nome da empresa, obrigatorio."
- All animations respect `prefers-reduced-motion`

---

## 10. NOTIFICATION TOAST STACK

### State Machine (per toast)

```
ENTERING -> VISIBLE -> HOVERING -> TIMING_OUT -> EXITING -> REMOVED
                                -> CLICKED -> NAVIGATING -> REMOVED
```

### Animation Specifications

**Enter (slide up from bottom-right):**
```typescript
const toastEnterVariant = {
  initial: { x: '100%', opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 400, damping: 30 } // ~300ms
  }
};
```

**Stack Shift (existing toasts move up):**
```typescript
// Each toast uses layoutId for automatic reflow
// Spring animation: stiffness 300, damping 25
// Toasts beyond position 3: scale down to 0.95, then 0.9, opacity 0.7 -> 0.5
// Toast at position 4: exits upward with fade
```

**Max Stack (3 visible):**
- Newest toast: full size, full opacity
- Second toast: `scale: 0.97`, `opacity: 0.9`, `y: -4px`
- Third toast: `scale: 0.94`, `opacity: 0.8`, `y: -8px`
- Fourth+ toast: compressed to 0px height, removed from DOM

**Hover Behavior:**
- Toast expands slightly: `scale: 1.02`, 150ms ease-out
- Timer bar pauses (the thin progress bar at the bottom freezes)
- Shadow increases: `box-shadow: 0 8px 24px rgba(0,0,0,0.2)`

**Toast Variants:**

Success toast:
```css
.toast-success {
  border-left: 3px solid var(--color-match-green);
}
.toast-success .checkmark-icon {
  /* SVG path draw animation */
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: draw-check 400ms ease-out 200ms forwards;
}
```

Error toast:
```css
.toast-error {
  border-left: 3px solid var(--destructive);
  animation: toast-shake 300ms ease-out;
}
@keyframes toast-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
```
- Error toasts: no auto-dismiss, require explicit close
- Red pulse on first appearance: `box-shadow: 0 0 0 0 rgba(239,68,68,0.4)` -> `0 0 0 8px rgba(239,68,68,0)`, 600ms

**Click to Navigate:**
- Toast slides out to the right: `x: '110%'`, 200ms ease-in
- Page navigates to relevant context

**Timer Bar:**
- 2px bar at bottom of toast, fills left to right
- Color matches toast type (green/red/cyan)
- Default duration: 5s for success, 8s for warning, persistent for error
- Animation: `scaleX: 0 -> 1`, linear timing

### Accessibility
- `role="alert"` for error toasts, `role="status"` for success
- `aria-live="assertive"` for errors, `"polite"` for success
- Screen reader: "Notificacao: Conciliacao criada com sucesso. 3 itens conciliados."
- Close button: `aria-label="Fechar notificacao"`
- Keyboard: `Escape` closes the most recent toast. `Tab` focuses toast actions.

---

## 11. DARK/LIGHT MODE TOGGLE

### State Machine

```
DARK -> TRANSITIONING_TO_LIGHT -> LIGHT -> TRANSITIONING_TO_DARK -> DARK
```

### Animation Specifications

**Sun/Moon Morph:**
```typescript
// SVG morph between sun and moon shapes
// Sun: circle with rays (lines extending outward)
// Moon: circle with crescent cutout
const sunMoonTransition = {
  sun: {
    circle: { cx: 12, cy: 12, r: 5 },
    rays: { opacity: 1, scale: 1 },
    mask: { cx: 12, cy: 12, r: 0 }, // no mask = full circle
  },
  moon: {
    circle: { cx: 12, cy: 12, r: 5 },
    rays: { opacity: 0, scale: 0 },
    mask: { cx: 16, cy: 8, r: 4 }, // creates crescent
  },
  transition: { duration: 0.5, ease: 'easeInOut' }
};
```
- Rays retract (scale to 0) as circle morphs to crescent: 500ms total
- Slight rotation during transition: 0 -> 180deg -> 360deg

**Ripple Effect:**
```typescript
const ThemeRipple = () => {
  // 1. Get toggle button position
  // 2. Create full-screen overlay, positioned at button center
  // 3. Ripple: circle expands from 0 to cover viewport diagonal
  //    - clip-path: circle(0% at X Y) -> circle(150% at X Y)
  //    - Duration: 500ms, ease-out
  //    - The new theme color fills as the circle expands
  // 4. Once ripple covers viewport, apply theme class, remove overlay
};
```
- The ripple carries the new background color, "washing" over the UI
- Elements underneath transition at different speeds:
  - Background: immediate (carried by ripple)
  - Text color: 100ms delay
  - Borders: 150ms delay
  - Shadows: 200ms delay
- Total perceived duration: 500ms

**Implementation:**
```css
:root {
  --theme-transition-bg: 0ms;
  --theme-transition-text: 100ms;
  --theme-transition-border: 150ms;
}

.theme-transitioning * {
  transition:
    background-color 300ms ease-out var(--theme-transition-bg),
    color 200ms ease-out var(--theme-transition-text),
    border-color 200ms ease-out var(--theme-transition-border) !important;
}
```
- `.theme-transitioning` class added during ripple, removed after 500ms
- `localStorage.setItem('theme', newTheme)` on click, before animation starts (instant persistence)

### Accessibility
- Button: `aria-label="Alternar para modo claro"` / `"Alternar para modo escuro"`
- `prefers-reduced-motion`: instant switch, no ripple. Colors change in 0ms.
- Respects `prefers-color-scheme` on first load if no localStorage value
- Screen reader: "Modo escuro ativado" / "Modo claro ativado"

### Performance
- Ripple uses `clip-path` animation (GPU-composited)
- Only apply transition classes during the switch (removed immediately after)
- The overlay div is created/destroyed dynamically, not persistently in DOM
- `will-change: clip-path` on the ripple element

---

## 12. COMMAND PALETTE (Ctrl+K)

### State Machine

```
CLOSED -> OPENING -> OPEN_EMPTY -> TYPING -> RESULTS_VISIBLE -> ITEM_SELECTED -> EXECUTING -> CLOSED
                                           -> NO_RESULTS -> TYPING
```

### Animation Specifications

**Open (<100ms render target):**
```typescript
const paletteOpenVariant = {
  overlay: {
    initial: { opacity: 0, backdropFilter: 'blur(0px)' },
    animate: {
      opacity: 1,
      backdropFilter: 'blur(12px)',
      transition: { duration: 0.15 }
    }
  },
  panel: {
    initial: { opacity: 0, scale: 0.96, y: -8 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 500, damping: 35 } // ~200ms
    }
  }
};
```
- Panel width: 560px, max-height: 400px
- Positioned: center horizontal, 20% from top
- Input auto-focused at 0ms (focus happens in the same frame as render)
- Border: 1px solid `var(--border)`, subtle shadow: `0 16px 40px rgba(0,0,0,0.3)`
- Background: `var(--popover)` with glassmorphism

**Recent Items (before typing):**
- Show last 5 actions: "Recentes" section header
- Items render immediately (cached in memory)
- Each item: icon + label + keyboard shortcut hint (muted, right-aligned)

**Search Results (debounce 100ms):**
```typescript
const useCommandSearch = (query: string) => {
  const [results, setResults] = useState([]);
  const debouncedQuery = useDebounce(query, 100); // 100ms, NOT 300ms

  useEffect(() => {
    if (!debouncedQuery) return setResults(recentItems);
    // Fuzzy search across: pages, actions, transactions, companies
    const matches = fuseInstance.search(debouncedQuery);
    setResults(matches.slice(0, 10));
  }, [debouncedQuery]);

  return results;
};
```

**Result Item Highlight (arrow key navigation):**
```typescript
const resultHighlightVariant = {
  // Background highlight slides smoothly between items
  // NOT a jump -- the highlight background animates translateY
  layout: true, // Framer Motion layout animation
  transition: { type: 'spring', stiffness: 500, damping: 35 }
};
```
- Highlight: `background: var(--accent)`, `border-radius: var(--radius)`
- The highlight "slides" between items rather than jumping (layout animation)

**Categories:**
- "Paginas", "Acoes", "Transacoes", "Empresas"
- Small 11px uppercase header, `var(--muted-foreground)` color
- Thin separator line between categories

**Execute + Close:**
```typescript
const paletteCloseVariant = {
  panel: {
    exit: {
      opacity: 0,
      scale: 0.96,
      y: -4,
      transition: { duration: 0.15, ease: 'easeIn' }
    }
  },
  overlay: {
    exit: { opacity: 0, transition: { duration: 0.15 } }
  }
};
```

**Escape Close:**
- Same exit animation but slightly faster: 120ms

### Accessibility
- `role="dialog"`, `aria-modal="true"`, `aria-label="Paleta de comandos"`
- Input: `role="combobox"`, `aria-expanded`, `aria-activedescendant`
- Results: `role="listbox"`, each item `role="option"`
- Screen reader: "Paleta de comandos aberta. Digite para buscar. 5 resultados recentes disponiveis."
- Full keyboard navigation: Arrow keys, Enter, Escape, Tab (cycles through result actions)

### Performance
- Fuzzy search: use `fuse.js` with pre-built index (built on app load, not on palette open)
- Results DOM: virtualized if >20 items (unlikely but defensive)
- Palette component: lazy-loaded (`React.lazy`) but pre-loaded after first idle
- Overlay uses `backdrop-filter` which is GPU-composited
- Input is uncontrolled (ref-based) to avoid React re-renders on every keystroke; only debounced value triggers search

---

## 13. TABLE ROW HOVER PREVIEW

### State Machine

```
IDLE -> HOVERING -> PREVIEW_DELAY -> PREVIEW_VISIBLE -> PREVIEW_HOVER -> PREVIEW_VISIBLE
                                                     -> MOUSE_LEAVE -> PREVIEW_EXITING -> IDLE
      -> MOUSE_LEAVE -> IDLE (if <500ms)
```

### Animation Specifications

**Delay + Appear:**
- 500ms hover delay before preview shows (prevents flicker on quick mouse movement)
- Cancel timer if mouse leaves before 500ms

```typescript
const previewVariant = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.98,
    transition: { duration: 0.15, ease: 'easeIn' }
  }
};
```

**Card Design:**
- Width: 320px, max-height: 280px
- Position: above the row if space, below if near top of viewport
- Never obscures the hovered row (offset by row height + 8px gap)
- Glass card: `backdrop-blur: 12px`, `background: var(--popover)`, `border: 1px solid var(--border)`
- Shadow: `0 8px 24px rgba(0,0,0,0.2)`
- Content: full description, dates (emissao, vencimento, pagamento), amount breakdown, category, notes
- If AI suggestion exists: purple-bordered section showing suggested match with mini confidence badge

**Stay-on-Card:**
- When mouse moves from row to preview card: preview stays visible (no gap issue due to invisible bridge element)
- Invisible bridge: 8px tall transparent div connecting row and card
- Mouse on card: card stays. Mouse leaves card AND row: 150ms exit animation.

### Accessibility
- Preview is `role="tooltip"` with `aria-describedby` on the row
- Content is not essential (supplementary detail), so no focus trap
- Keyboard: not triggered by keyboard focus (detail available via row expand instead)
- Screen reader: preview content is accessible via the expand/collapse mechanism (interaction 6)

### Performance
- Preview content fetched/computed on hover start (during the 500ms delay), not on show
- Preview card rendered with `React.createPortal` to `document.body` (avoids table overflow issues)
- `will-change: opacity, transform` during animation only
- Single preview instance (reused, not created per row)

---

## 14. AMOUNT FORMATTING

### Design Specifications

**Typography:**
```css
.amount {
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
  letter-spacing: -0.02em;
}

.amount-currency {
  color: var(--muted-foreground);
  font-weight: 400;
  margin-right: 4px;
}

.amount-value {
  font-weight: 600;
}

.amount-positive {
  color: var(--color-amount-positive);
}

.amount-negative {
  color: var(--color-amount-negative);
}
```

**Format:** `R$ 1.234.567,89` (Brazilian standard)
- `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Split rendering: `R$` in muted gray 400-weight, number in 600-weight colored

**Negative:** `-R$ 1.500,00` (minus sign, red, never parentheses)
**Positive context-dependent:** `+R$ 1.500,00` (plus sign, green -- only in difference/delta views)

**Morphing Number Animation:**
```typescript
const MorphingAmount = ({ value, duration = 600 }) => {
  // Each digit position animates independently
  // Digit rolls: translateY from old digit position to new
  // Decimal and thousand separators: static (don't animate)
  // Uses layoutId per digit position for smooth reflow if digit count changes

  const formattedOld = formatBRL(previousValue);
  const formattedNew = formatBRL(value);

  // Align from the decimal point (right-align logic)
  // Each character that changes: rolls vertically through intermediate digits
  // e.g., 3 -> 7 rolls through 4, 5, 6, 7
  // Duration per digit: 400-600ms spring
  // Stagger: rightmost digit starts first, leftmost last (50ms stagger)
};
```

**Table Alignment:**
- All amounts right-aligned
- Decimal points aligned vertically across rows (consistent `width` on amount column, `text-align: right`)
- `tabular-nums` font feature ensures all digits are same width

### Accessibility
- Screen reader: `aria-label="R$ 1.234,56 positivo"` (full spoken amount with sign context)
- Color is never the only indicator: negative has minus sign, positive has plus sign
- High contrast mode: amounts remain readable (no reliance on subtle color differences)

---

## 15. EMPTY STATE ANIMATIONS

### General Approach
- All illustrations are SVG-based, inline, themed with CSS custom properties
- Total animation duration: 2-3 seconds, then settles into a subtle idle loop
- All respect `prefers-reduced-motion` (static illustration, no animation)

### No Transactions ("Nenhuma transacao encontrada")

**SVG: Receipt with question mark**
```typescript
// Phase 1: Receipt outline draws itself (stroke-dashoffset animation)
// - Top edge, right edge, serrated bottom, left edge
// - Duration: 1.2s, ease-in-out
// - Stroke: var(--muted-foreground) at 40% opacity

// Phase 2: Three horizontal lines inside (representing text) draw left-to-right
// - Stagger: 150ms each
// - Duration: 400ms each

// Phase 3: Question mark appears in center
// - Scale 0 -> 1.1 -> 1.0, 400ms
// - Color: var(--primary) at 60% opacity

// Idle loop: receipt has subtle floating motion
// translateY: 0 -> -4px -> 0, 3s, ease-in-out, infinite
```

**Text:** "Nenhuma transacao encontrada"
**Subtext:** "Importe extratos ou sincronize dados para comecar."

### No Matches ("Nenhuma correspondencia")

**SVG: Two puzzle pieces that don't fit**
```typescript
// Phase 1: Left piece slides in from left, right from right
// - Duration: 600ms each, spring
// - They approach each other but stop with a 12px gap

// Phase 2: Both pieces attempt to connect
// - Move toward each other: 4px
// - Then bounce back: spring overshoot
// - Duration: 400ms

// Idle loop: subtle lateral drift
// Left piece: translateX 0 -> -3px -> 0, 4s
// Right piece: translateX 0 -> 3px -> 0, 4s (opposite phase)
```

**Text:** "Nenhuma correspondencia encontrada"
**Subtext:** "Tente ajustar os filtros ou a tolerancia de valores."

### All Reconciled ("Tudo conciliado!")

**SVG: Checkmark with sparkles**
```typescript
// Phase 1: Large circle draws itself
// - stroke-dashoffset, 600ms

// Phase 2: Checkmark draws inside circle
// - stroke-dashoffset, 400ms, 400ms delay

// Phase 3: Sparkles appear around the circle
// - 6 sparkles at even angles
// - Each: scale 0 -> 1, opacity 0 -> 1 -> 0.6
// - Stagger: 80ms
// - Duration: 300ms each

// Phase 4 (optional, if celebrating): confetti burst
// - 20 small rectangles in brand colors
// - Emit from center, spread outward
// - Each: translateX/Y random, rotate random, opacity 1->0
// - Duration: 1.2s, gravity curve (ease-in for Y)

// Idle loop: sparkles gently pulse
// opacity: 0.4 -> 0.8 -> 0.4, 2s, staggered
```

**Text:** "Tudo conciliado!"
**Subtext:** "Todas as transacoes foram conciliadas com sucesso."
**Color:** Green tones throughout

### No Companies ("Nenhuma empresa cadastrada")

**SVG: Building that builds itself block by block**
```typescript
// Grid of 3x4 blocks forming a building silhouette
// Each block: rectangle that scales from 0 to 1
// Build order: bottom-left to top-right (construction feel)
// Stagger: 100ms per block
// Duration per block: 200ms, ease-out
// Total: ~1.4s

// Roof/triangle draws last
// Windows (small squares inside blocks) appear after structure completes
// Each window: scale pop, 150ms, stagger 50ms

// Idle: one window blinks (opacity pulse), random window every 3s
```

**Text:** "Nenhuma empresa cadastrada"
**Subtext:** "Adicione sua primeira empresa para comecar a conciliar."

### Loading Failed ("Falha ao carregar dados")

**SVG: Cloud with X**
```typescript
// Phase 1: Cloud shape draws itself (stroke-dashoffset)
// Duration: 800ms

// Phase 2: X appears inside cloud
// Two strokes of the X, 200ms each, 100ms stagger

// Phase 3: Shake
// Cloud: translateX [0, -3, 3, -3, 0], 300ms

// Idle: cloud has subtle opacity pulse
// opacity: 0.6 -> 0.8 -> 0.6, 2s
```

**Text:** "Falha ao carregar dados"
**Subtext:** "Verifique sua conexao e tente novamente."
**Action button:** "Tentar novamente" (primary button)

### Accessibility (all empty states)
- SVG: `role="img"`, `aria-label` describing the illustration
- Text: semantic heading (h3) + paragraph
- Action buttons: properly labeled, keyboard-focusable
- `prefers-reduced-motion`: static SVG at final state (no draw animation), text appears immediately

---

## Implementation Sequencing

### Phase 1 -- Foundation (Week 1)
1. Add `framer-motion`, `@dnd-kit/core`, `@dnd-kit/sortable`, `fuse.js` to dependencies
2. Add JetBrains Mono font
3. Extend Tailwind config with new color tokens (ai-purple, match-green, amount colors, font-mono)
4. Create animation utility hooks: `useCountUp`, `useMorphingNumber`, `useDelayedHover`, `useSVGPathDraw`
5. Create `AmountDisplay` component (interaction 14) -- used everywhere

### Phase 2 -- Core Interactions (Week 2)
6. Split-screen layout with resizable panels (interaction 3)
7. Transaction row with expand/collapse (interaction 6)
8. Filter chips system (interaction 4)
9. Notification toast stack (interaction 10)

### Phase 3 -- Reconciliation Flow (Week 3)
10. Drag-to-match (interaction 1)
11. Bulk selection progress (interaction 7)
12. Reconciliation confirmation ritual (interaction 2)
13. AI suggestion reveal (interaction 5)

### Phase 4 -- Polish (Week 4)
14. Command palette (interaction 12)
15. Table row hover preview (interaction 13)
16. Sync pulse animation (interaction 8)
17. Dark/light mode toggle (interaction 11)
18. Empty state animations (interaction 15)
19. Onboarding progressive disclosure (interaction 9)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/reconciliation/DragToMatch.tsx` | Drag-and-drop matching container |
| `src/components/reconciliation/ReconciliationConfirmation.tsx` | High-value celebration ritual |
| `src/components/reconciliation/AIMatchSuggestion.tsx` | AI suggestion reveal with SVG connections |
| `src/components/reconciliation/BulkSelectionBar.tsx` | Bottom bar with running totals |
| `src/components/reconciliation/SplitScreenLayout.tsx` | Resizable panels with snap points |
| `src/components/reconciliation/TransactionRow.tsx` | Expandable row with stagger animation |
| `src/components/ui/FilterChips.tsx` | Chip-based filter system |
| `src/components/ui/CommandPalette.tsx` | Ctrl+K command palette |
| `src/components/ui/AmountDisplay.tsx` | Formatted amount with morphing animation |
| `src/components/ui/MorphingNumber.tsx` | Digit-roll animation component |
| `src/components/ui/ToastStack.tsx` | Enhanced toast with stacking behavior |
| `src/components/ui/ThemeToggle.tsx` | Sun/moon morph with ripple |
| `src/components/ui/SyncIndicator.tsx` | Radar sweep sync animation |
| `src/components/ui/EmptyState.tsx` | SVG animated empty states |
| `src/components/onboarding/OnboardingWizard.tsx` | Progressive disclosure wizard |
| `src/components/ui/HoverPreview.tsx` | Delayed hover preview card |
| `src/hooks/useCountUp.ts` | Animated counter hook |
| `src/hooks/useMorphingNumber.ts` | Digit-roll animation hook |
| `src/hooks/useDelayedHover.ts` | Hover with delay hook |
| `src/hooks/useSVGPathDraw.ts` | SVG stroke animation hook |
| `src/hooks/useCommandPalette.ts` | Palette search + keyboard navigation |
| `src/hooks/useDragToMatch.ts` | DnD kit integration for matching |
| `src/lib/animations.ts` | Shared Framer Motion variants |
| `src/lib/formatAmount.ts` | Brazilian currency formatting utility |

---

### Critical Files for Implementation
- `C:/CLAUDECODE/darksales-lovable/tailwind.config.ts` -- must extend with new tokens (ai-purple, match-green, font-mono, new keyframes for all 15 interactions)
- `C:/CLAUDECODE/darksales-lovable/package.json` -- must add framer-motion, @dnd-kit/core, @dnd-kit/sortable, fuse.js, and JetBrains Mono font
- `C:/CLAUDECODE/darksales-lovable/src/components/ui/resizable.tsx` -- must extend react-resizable-panels wrapper with snap-point logic, magnetic behavior, and collapse detection
- `C:/CLAUDECODE/darksales-lovable/src/components/ui/toast.tsx` -- must extend with stacking behavior, variant-specific animations (checkmark draw, error shake), and timer bar
- `C:/CLAUDECODE/darksales-lovable/src/components/ui/command.tsx` -- must extend cmdk wrapper with blur overlay, sliding highlight, recent items section, and optimized 100ms debounce search

---

# PARTE II — MÓDULOS OPERACIONAIS AVANÇADOS

> Contas a Pagar (Orquestração de Pagamentos), Contas a Receber (Cobrança Automatizada Inteligente), e Cadastros (Fornecedores, Clientes, Bancos/Gateways).

---


---

# MODULO DE CONTAS A PAGAR -- ESPECIFICACAO COMPLETA

## Plataforma BPO Financeiro | Grupo Lauxen

---

# 1. FLUXOS DE PAGAMENTO DISRUPTIVOS (18 Features Inovadoras)

## F1. MOTOR DE ORQUESTRACAO DE PAGAMENTOS (Payment Orchestration Engine)

### Visao de Negocio
Pagar nao e "clicar em pagar". E uma decisao estrategica. Quando pagar? Com qual dinheiro? De qual conta? Com qual meio? Nenhum sistema brasileiro trata pagamento como uma decisao orquestrada. Omie tem botao "pagar" e pronto. Conta Azul tem "marcar como pago". Isso e nivel amador.

O Motor de Orquestracao analisa TODAS as contas a pagar em aberto, cruza com saldo disponivel em cada conta bancaria do grupo, considera custo de oportunidade, data de corte bancaria, e gera um PLANO DE PAGAMENTO otimizado para o dia.

### Comportamento Detalhado
- Toda manha as 7h (configuravel), o sistema gera o "Plano de Pagamento do Dia" contendo:
  - Lista priorizada de pagamentos a fazer HOJE
  - Conta bancaria recomendada para cada pagamento (menor custo ou melhor saldo)
  - Meio de pagamento recomendado (PIX vs Boleto vs TED) com justificativa
  - Saldo projetado APOS todos os pagamentos
  - Alertas se algum pagamento vai deixar conta abaixo do minimo operacional
- O usuario abre o app e ve: "Seu plano de hoje: 12 pagamentos, total R$47.800. Saldo final projetado: R$23.200 (acima do minimo de R$15.000)."
- Pode ajustar: arrastar pagamento para amanha, trocar conta bancaria, mudar meio de pagamento
- Ao confirmar o plano, o sistema executa as baixas no Tiny via API V2

### Regras de Negocio Embutidas
- NUNCA sugerir pagamento na sexta depois das 16h (TED nao compensa, boleto cai no limbo)
- NUNCA sugerir pagamento em feriado bancario (consulta calendario ANBIMA)
- Priorizar PIX para valores ate R$5.000 (instantaneo, sem custo na maioria dos bancos)
- Priorizar TED para valores acima de R$5.000 se banco cobrar tarifa de boleto registrado
- Se boleto esta vencido, calcular: juros+multa vs solicitar novo boleto ao fornecedor
- Manter sempre 30 dias de despesa fixa como reserva operacional ANTES de aprovar qualquer pagamento

### Schema PostgreSQL
```sql
CREATE TABLE payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    plan_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','executing','completed','cancelled')),
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    projected_balance_after NUMERIC(14,2),
    min_operational_balance NUMERIC(14,2) DEFAULT 15000,
    generated_by TEXT NOT NULL DEFAULT 'system' CHECK (generated_by IN ('system','manual')),
    confirmed_by UUID REFERENCES profiles(id),
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, plan_date)
);

CREATE TABLE payment_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
    conta_pagar_id UUID NOT NULL REFERENCES tiny_contas_pagar(id),
    tiny_id BIGINT NOT NULL,
    fornecedor_nome TEXT NOT NULL,
    fornecedor_doc TEXT,
    valor_original NUMERIC(14,2) NOT NULL,
    valor_a_pagar NUMERIC(14,2) NOT NULL, -- pode diferir se juros/desconto
    data_vencimento DATE NOT NULL,
    dias_atraso INTEGER DEFAULT 0,
    juros_multa NUMERIC(14,2) DEFAULT 0,
    desconto_antecipacao NUMERIC(14,2) DEFAULT 0,
    bank_account_id UUID REFERENCES bank_accounts(id),
    payment_method TEXT CHECK (payment_method IN ('pix','boleto','ted','debito_automatico','cartao')),
    payment_method_reason TEXT, -- justificativa da recomendacao
    priority INTEGER NOT NULL DEFAULT 50, -- 1=critico, 100=pode esperar
    priority_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','executing','paid','failed','postponed','cancelled')),
    postponed_to DATE,
    tiny_baixa_status TEXT CHECK (tiny_baixa_status IN ('pending','success','failed','not_applicable')),
    tiny_baixa_error TEXT,
    execution_order INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_plans_company_date ON payment_plans(company_id, plan_date);
CREATE INDEX idx_payment_plan_items_plan ON payment_plan_items(plan_id);
CREATE INDEX idx_payment_plan_items_status ON payment_plan_items(status);
```

### Endpoints NestJS
```
POST   /api/v1/payment-plans/generate          -- Gera plano para data especifica
GET    /api/v1/payment-plans/:date              -- Busca plano do dia
PATCH  /api/v1/payment-plans/:id/confirm        -- Confirma plano
PATCH  /api/v1/payment-plans/:id/cancel         -- Cancela plano
PATCH  /api/v1/payment-plan-items/:id           -- Atualiza item (trocar banco, postpone, etc)
POST   /api/v1/payment-plans/:id/execute        -- Executa baixas no Tiny
GET    /api/v1/payment-plans/:id/simulation      -- Simula impacto no caixa
```

Request/Response `POST /generate`:
```json
// Request
{ "company_id": "uuid", "date": "2026-04-14", "include_overdue": true }
// Response
{
  "plan": {
    "id": "uuid", "plan_date": "2026-04-14", "status": "draft",
    "total_amount": 47800.00, "projected_balance_after": 23200.00,
    "alerts": [
      { "type": "low_balance", "message": "Saldo ficara abaixo de R$20k na conta Sicoob" },
      { "type": "friday_warning", "message": "Sexta-feira: TED apos 16h nao compensa hoje" }
    ],
    "items": [
      {
        "conta_pagar_id": "uuid", "fornecedor_nome": "Meta Platforms",
        "valor_a_pagar": 3200.00, "payment_method": "pix",
        "payment_method_reason": "Valor abaixo de R$5k, PIX e instantaneo e gratuito",
        "bank_account_id": "uuid-sicoob", "priority": 10,
        "priority_reason": "Marketing ativo - parar campanha afeta faturamento"
      }
    ]
  }
}
```

### Jobs BullMQ
```
Queue: payment-plan-generation
  Cron: 0 7 * * 1-5 (seg-sex 7h)
  Retry: 2x exponential
  Concurrency: 1

Queue: payment-execution
  On-demand (trigger apos confirmacao)
  Retry: 0 (financeiro NUNCA faz retry automatico -- duplo pagamento)
  Concurrency: 1
  Backoff: manual only
```

---

## F2. OTIMIZADOR DE CAIXA (Cash Float Maximizer)

### Visao de Negocio
Quem gerencia financeiro de verdade sabe: o dinheiro no banco RENDE. Mesmo que seja 100% CDI em conta remunerada, todo dia que voce segura o dinheiro sem pagar fornecedor e um dia de rendimento. A questao e: como pagar TUDO em dia, sem atrasar ninguem, mas segurando o maximo possivel o maximo de tempo possivel?

O Otimizador analisa: dado o saldo atual de R$150k, com R$80k em contas a pagar nos proximos 30 dias, qual a ordem OTIMA de pagamentos para maximizar o float? "Se pagar o fornecedor A no dia 10 (vencimento dia 12), voce perde 2 dias de rendimento de R$15k = R$2.50. Mas se pagar no dia 12, garante esses R$2.50."

Parece pouco? Em 4 empresas, 200+ pagamentos/mes, com saldos medios de R$200k, estamos falando de R$500-2.000/mes so em otimizacao de float. Em 12 meses, R$6k-24k. Dinheiro de graca.

### Comportamento Detalhado
- Calcula rendimento diario de cada conta bancaria (CDI * % do banco, configuravel)
- Para cada CP em aberto, calcula: data ideal de pagamento = data_vencimento (nunca antes, a menos que haja desconto)
- Exibe grafico de "rendimento capturado" vs "rendimento perdido" por pagar antecipado
- Integra com F1 (Orquestracao): o plano diario ja vem otimizado para float

### Schema
```sql
CREATE TABLE bank_account_yields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
    yield_type TEXT NOT NULL CHECK (yield_type IN ('cdi_percentage','fixed_daily','none')),
    cdi_percentage NUMERIC(5,2) DEFAULT 100, -- ex: 100% CDI
    fixed_daily_rate NUMERIC(8,6), -- taxa diaria fixa
    min_balance_for_yield NUMERIC(14,2) DEFAULT 0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE float_optimization_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_float_earned NUMERIC(10,2), -- rendimento capturado
    total_float_lost NUMERIC(10,2),   -- rendimento perdido por pagar antecipado
    optimization_score NUMERIC(5,2),   -- 0-100
    details JSONB, -- breakdown por pagamento
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Endpoints
```
GET    /api/v1/float-optimizer/analysis?company_id=X&horizon=30
POST   /api/v1/float-optimizer/simulate { payments: [...], yield_config }
GET    /api/v1/float-optimizer/report?period=2026-04
```

---

## F3. NEGOCIADOR INTELIGENTE DE DESCONTO ANTECIPADO

### Visao de Negocio
Fornecedor oferece 3% de desconto se pagar 10 dias antes do vencimento. Seu dinheiro rende 1.2%/mes no banco. Vale a pena? Calcular: desconto de 3% em 10 dias equivale a uma taxa de 9%/mes. Seu custo de capital e 1.2%/mes. CLARO que vale. Voce esta ganhando 7.8%/mes nessa operacao.

Mas e se o desconto fosse 0.5% para 10 dias? Ai e 1.5%/mes vs custo de capital 1.2%. Margem de apenas 0.3%. Provavelmente NAO vale o risco.

O Negociador calcula isso automaticamente para CADA conta a pagar e gera alertas: "Fornecedor X oferece 2% para pagamento antecipado. Seu ganho liquido seria R$340. RECOMENDACAO: ANTECIPAR."

### Schema
```sql
CREATE TABLE supplier_discount_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    conta_pagar_id UUID REFERENCES tiny_contas_pagar(id),
    fornecedor_doc TEXT NOT NULL,
    fornecedor_nome TEXT NOT NULL,
    valor_original NUMERIC(14,2) NOT NULL,
    desconto_percentual NUMERIC(5,2) NOT NULL,
    dias_antecipacao INTEGER NOT NULL,
    valor_com_desconto NUMERIC(14,2) NOT NULL,
    economia_bruta NUMERIC(14,2) NOT NULL,
    taxa_equivalente_mensal NUMERIC(8,4) NOT NULL, -- taxa do desconto anualizada
    custo_capital_mensal NUMERIC(8,4) NOT NULL,
    ganho_liquido NUMERIC(14,2) NOT NULL,
    recommendation TEXT CHECK (recommendation IN ('antecipar','nao_antecipar','avaliar')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
    accepted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE capital_cost_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    cost_type TEXT NOT NULL CHECK (cost_type IN ('cdi_spread','fixed_rate','weighted_average')),
    annual_rate NUMERIC(8,4), -- taxa anual
    monthly_rate NUMERIC(8,4), -- taxa mensal
    effective_from DATE NOT NULL,
    notes TEXT,
    UNIQUE(company_id, effective_from)
);
```

### Endpoints
```
GET    /api/v1/discount-analyzer/opportunities?company_id=X
POST   /api/v1/discount-analyzer/calculate { conta_pagar_id, desconto_pct, dias_antecipacao }
POST   /api/v1/discount-analyzer/:id/accept
POST   /api/v1/discount-analyzer/:id/reject
GET    /api/v1/discount-analyzer/report?period=2026-Q1
```

---

## F4. DETECTOR DE DUPLICATAS COM IA

### Visao de Negocio
Duplicata de pagamento e o MAIOR ralo de dinheiro de empresas brasileiras. Nao estamos falando so de "mesmo valor + mesmo CNPJ" (qualquer sistema faz isso). Estamos falando de:
- Fornecedor emitiu NF com valor ligeiramente diferente (R$5.000 vs R$5.050 com frete)
- Mesmo fornecedor com razao social diferente ("XPTO LTDA" vs "XPTO COMERCIO")
- Boleto reenviado com novo numero mas mesma divida
- CP criada manualmente E sincronizada do Tiny (duplicata de sistema)
- Conta Simples debitou E boleto foi pago (mesmo fornecedor, meios diferentes)

O Detector usa multiplas heuristicas + Claude API para identificar padroes suspeitos que humanos nao percebem.

### Schema
```sql
CREATE TABLE duplicate_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    detection_type TEXT NOT NULL CHECK (detection_type IN (
        'exact_match','similar_amount','same_period_same_supplier',
        'cross_system','different_payment_method','ai_detected'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
    conta_pagar_id_a UUID NOT NULL,
    conta_pagar_id_b UUID NOT NULL,
    similarity_score NUMERIC(5,2) NOT NULL, -- 0-100
    match_details JSONB NOT NULL, -- quais campos matcharam
    ai_explanation TEXT, -- explicacao em linguagem natural
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','confirmed_duplicate','not_duplicate','merged','dismissed')),
    resolved_by UUID REFERENCES profiles(id),
    resolution_notes TEXT,
    amount_at_risk NUMERIC(14,2), -- valor que seria pago em duplicata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_duplicates_company_status ON duplicate_detections(company_id, status);
CREATE INDEX idx_duplicates_severity ON duplicate_detections(severity);
```

### Endpoints
```
POST   /api/v1/duplicates/scan { company_id, period_start, period_end }
GET    /api/v1/duplicates?company_id=X&status=open&severity=critical
PATCH  /api/v1/duplicates/:id/resolve { status, notes }
POST   /api/v1/duplicates/:id/merge  -- une duas CPs em uma
GET    /api/v1/duplicates/stats?company_id=X&period=2026-04
```

### Job BullMQ
```
Queue: duplicate-scanner
  Cron: 0 6 * * * (diario 6h, antes do plano de pagamento das 7h)
  Retry: 1x
  Concurrency: 1
```

---

## F5. APROVACAO CONTEXTUAL (Context-Aware Approval)

### Visao de Negocio
Aprovar pagamento sem contexto e assinar cheque em branco. Quando o CFO aprova um pagamento de R$25.000, ele precisa saber:
- Qual o impacto no DRE? (essa despesa vai estourar o orcamento de marketing?)
- Qual o impacto no caixa? (vou ter dinheiro para folha na semana que vem?)
- Esse fornecedor esta aderente ao contrato? (era pra ser R$20k, por que virou R$25k?)
- Historico: quanto ja paguei para esse fornecedor nos ultimos 12 meses?
- Budget: o departamento ainda tem verba para isso?

### Schema
```sql
CREATE TABLE approval_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id),
    dre_impact JSONB, -- { line: "Despesa Marketing", before: 45000, after: 70000, budget: 60000, variance_pct: 16.7 }
    cashflow_impact JSONB, -- { balance_before: 150000, balance_after: 125000, min_30d: 95000, risk: "low" }
    supplier_history JSONB, -- { total_12m: 180000, avg_monthly: 15000, trend: "increasing", last_payment: "2026-03-10" }
    budget_adherence JSONB, -- { category: "Marketing", used: 45000, limit: 60000, remaining: 15000, pct_used: 75 }
    contract_check JSONB, -- { has_contract: true, contract_value: 20000, deviation: 25, deviation_pct: 25 }
    supplier_score INTEGER, -- score do fornecedor (0-1000)
    ai_recommendation TEXT, -- recomendacao gerada por Claude
    risk_level TEXT CHECK (risk_level IN ('low','medium','high','critical')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Endpoints
```
GET    /api/v1/approvals/:id/context     -- Gera contexto completo para aprovacao
POST   /api/v1/approvals/:id/decide      -- Aprova/rejeita com contexto visivel
GET    /api/v1/approvals/pending          -- Lista aprovacoes pendentes com mini-contexto
```

---

## F6. CALENDARIO FINANCEIRO VISUAL (Financial Gantt)

### Visao de Negocio
Um Gantt financeiro onde o eixo X e o tempo (dias do mes) e o eixo Y sao as contas a pagar, com barras coloridas mostrando: data de emissao, data de vencimento, data de pagamento planejado. Sobreposto, uma linha de saldo projetado dia a dia.

Isso permite ao CFO ver de relance: "dia 15 tem um pico de pagamentos (R$120k entre folha + fornecedores), preciso garantir que os recebimentos do dia 10-14 realmente entrem."

### Schema
```sql
CREATE TABLE payment_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'cp_vencimento','cp_pagamento_planejado','cp_pagamento_executado',
        'folha_pagamento','imposto_vencimento','contrato_renovacao',
        'recebimento_previsto','saldo_projetado','alerta_deficit'
    )),
    event_date DATE NOT NULL,
    amount NUMERIC(14,2),
    description TEXT,
    entity_id UUID, -- referencia a CP, contrato, etc
    color TEXT, -- cor no calendario
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT, -- cron-like para recorrentes
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_company_date ON payment_calendar_events(company_id, event_date);
```

### Endpoints
```
GET    /api/v1/calendar?company_id=X&start=2026-04-01&end=2026-04-30
GET    /api/v1/calendar/daily-balance?company_id=X&start=2026-04-01&end=2026-05-31
POST   /api/v1/calendar/events   -- evento manual (marco financeiro)
DELETE /api/v1/calendar/events/:id
```

---

## F7. PAYMENT BATCHING (Agrupamento Inteligente)

### Visao de Negocio
Se voce tem 8 pagamentos para fazer hoje via TED pelo Sicoob, e cada TED custa R$8,50, sao R$68 em taxas. Mas se 3 desses fornecedores aceitam PIX e 2 estao no mesmo banco (transferencia entre contas = gratis), voce pode reduzir para 3 TEDs (R$25,50). Economia de R$42,50 num dia. Em um mes, R$800+.

O Payment Batching agrupa automaticamente pagamentos pelo criterio de menor custo total de transferencia.

### Schema
```sql
CREATE TABLE payment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES payment_plans(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
    payment_method TEXT NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL,
    total_fees NUMERIC(10,2) NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
    remessa_file_url TEXT, -- arquivo CNAB 240 se aplicavel
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_fee_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
    fee_type TEXT NOT NULL CHECK (fee_type IN ('ted','doc','pix','boleto','transfer_same_bank')),
    fee_amount NUMERIC(8,2) NOT NULL,
    free_monthly_limit INTEGER DEFAULT 0, -- TED gratis por mes
    current_month_used INTEGER DEFAULT 0,
    effective_from DATE NOT NULL,
    UNIQUE(bank_account_id, fee_type, effective_from)
);
```

### Endpoints
```
POST   /api/v1/batches/optimize { plan_id }  -- gera batches otimizados a partir do plano
GET    /api/v1/batches?plan_id=X
POST   /api/v1/batches/:id/execute
GET    /api/v1/batches/fee-savings?period=2026-04
```

---

## F8. SUPPLIER SCORING (Pontuacao de Fornecedores)

### Visao de Negocio
Todo empresario tem fornecedores "de confianca" e fornecedores "problematicos", mas essa classificacao vive na cabeca das pessoas. O Supplier Scoring quantifica: pontualidade de entrega, consistencia de precos, frequencia de reajuste, confiabilidade, volume, e gera um score objetivo de 0 a 1000.

Quando for hora de renegociar contrato ou trocar fornecedor, o dado esta la: "Fornecedor A: score 820, nunca atrasou, reajustou 2x em 12 meses (IPCA+2%). Fornecedor B: score 340, atrasou 4x, reajustou 5x em 12 meses (IPCA+15%)."

### Schema
```sql
CREATE TABLE supplier_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    fornecedor_doc TEXT NOT NULL,
    fornecedor_nome TEXT NOT NULL,
    current_score INTEGER NOT NULL DEFAULT 500, -- 0-1000
    punctuality_score INTEGER, -- pagamentos recebidos no prazo
    price_stability_score INTEGER, -- consistencia de precos
    delivery_score INTEGER, -- pontualidade de entrega (se disponivel)
    volume_score INTEGER, -- volume transacionado
    trend TEXT CHECK (trend IN ('improving','stable','declining')),
    total_paid_12m NUMERIC(14,2) DEFAULT 0,
    avg_monthly_12m NUMERIC(14,2) DEFAULT 0,
    payment_count_12m INTEGER DEFAULT 0,
    avg_price_change_pct NUMERIC(5,2) DEFAULT 0, -- reajuste medio
    last_price_change_date DATE,
    risk_level TEXT CHECK (risk_level IN ('low','medium','high','critical')),
    score_history JSONB DEFAULT '[]', -- [{date, score, event}]
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, fornecedor_doc)
);

CREATE INDEX idx_supplier_scores_company ON supplier_scores(company_id);
CREATE INDEX idx_supplier_scores_risk ON supplier_scores(risk_level);
```

### Endpoints
```
GET    /api/v1/suppliers/scores?company_id=X&sort=score&order=asc
GET    /api/v1/suppliers/:doc/profile  -- perfil completo com historico
POST   /api/v1/suppliers/recalculate   -- batch recalculo
GET    /api/v1/suppliers/ranking?top=20&metric=price_stability
```

---

## F9. ALERTA DE REAJUSTE AUTOMATICO

### Visao de Negocio
Fornecedor sobe preco de R$1.000 para R$1.050 um mes, R$1.100 no outro. Ninguem percebe porque e "so 5%". Em 12 meses, subiu 50%. O Alerta de Reajuste detecta automaticamente variacoes de preco acima do IPCA/IGPM e notifica: "Meta Platforms aumentou gastos em 23% nos ultimos 3 meses. Inflacao no periodo: 3.2%. Reajuste REAL: 19.8%."

### Schema
```sql
CREATE TABLE price_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    fornecedor_doc TEXT NOT NULL,
    fornecedor_nome TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('above_inflation','sudden_spike','gradual_increase','new_category_expense')),
    severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
    price_before NUMERIC(14,2),
    price_after NUMERIC(14,2),
    variation_pct NUMERIC(8,2),
    inflation_pct NUMERIC(8,2), -- IPCA do periodo
    real_increase_pct NUMERIC(8,2), -- acima da inflacao
    period_months INTEGER,
    status TEXT DEFAULT 'open' CHECK (status IN ('open','acknowledged','action_taken','dismissed')),
    action_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Integracao Externa
- API do IBGE/IPEA para dados de IPCA/IGPM mensais
- Endpoint: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json` (IPCA mensal)

### Job BullMQ
```
Queue: price-alert-scanner
  Cron: 0 8 1 * * (primeiro dia util do mes, 8h)
  Analisa: ultimos 3 meses de pagamentos por fornecedor
  Compara: variacao vs IPCA do periodo
```

---

## F10. ANTECIPACAO ESTRATEGICA (Simulador de Custo de Oportunidade)

### Visao de Negocio
Fornecedor parcelou compra em 6x de R$5.000. Voce tem caixa para quitar tudo. Mas vale a pena? Se ele cobrar 1.5%/mes embutido no parcelamento, e seu dinheiro rende 1%/mes no banco, vale sim -- voce economiza 0.5%/mes. Mas se o parcelamento for sem juros e seu dinheiro rende 1%/mes, NAO vale -- voce perde rendimento.

### Schema
```sql
CREATE TABLE prepayment_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    fornecedor_doc TEXT,
    parcelas_restantes INTEGER NOT NULL,
    valor_parcela NUMERIC(14,2) NOT NULL,
    valor_total_restante NUMERIC(14,2) NOT NULL,
    valor_quitacao NUMERIC(14,2), -- se fornecedor informou
    desconto_quitacao_pct NUMERIC(5,2),
    taxa_implicita_mensal NUMERIC(8,4), -- taxa embutida no parcelamento
    custo_capital_mensal NUMERIC(8,4), -- custo de oportunidade
    economia_liquida NUMERIC(14,2), -- positivo = vale antecipar
    recommendation TEXT CHECK (recommendation IN ('antecipar','manter_parcelas','negociar_desconto')),
    ai_analysis TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## F11. CASH WATERFALL (Prioridade Automatica de Pagamentos)

### Visao de Negocio
Quando o caixa aperta, quem pagar primeiro? Essa decisao vive na cabeca do CFO e muda todo mes. O Cash Waterfall define uma hierarquia EXPLICITA e configuravel:

1. FOLHA DE PAGAMENTO + ENCARGOS (nao pagar = processo trabalhista)
2. IMPOSTOS COM MULTA (DAS, DARF, FGTS -- multa e DIARIA)
3. ALUGUEL + UTILITIES (nao pagar = perder sede)
4. FORNECEDOR ESTRATEGICO (materia-prima = para producao)
5. FORNECEDOR REGULAR (servicos, marketing)
6. ASSINATURAS E RECORRENTES (SaaS, ferramentas)
7. OUTROS

### Schema
```sql
CREATE TABLE payment_priority_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    priority_level INTEGER NOT NULL, -- 1 = maximo
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL, -- { categories: [...], suppliers: [...], keywords: [...] }
    color TEXT, -- cor no calendario
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, priority_level)
);
```

---

## F12. PIX vs BOLETO vs TED OPTIMIZER

### Visao de Negocio
Cada meio de pagamento tem custo, tempo de compensacao, e risco diferentes. O sistema recomenda automaticamente:
- PIX: valores ate R$5k, instantaneo, geralmente gratuito, melhor para fornecedores que precisam receber rapido
- Boleto: quando ha desconto no boleto, ou quando e a unica opcao do fornecedor
- TED: valores altos (>R$5k) quando PIX nao esta disponivel no banco destinatario
- Debito Automatico: para recorrentes com valor fixo (aluguel, planos)

### Regras de Negocio Invisiveis
- Boleto bancario: pagar ANTES das 20h (senao pode nao compensar no dia)
- Boleto vencido: recalcular com juros+multa. Se juros > 5%, solicitar 2a via sem juros
- TED: enviar antes das 16h30 (horario de corte da maioria dos bancos)
- PIX: sem horario de corte, mas verificar limite diario de PIX da conta
- Transferencia entre contas do mesmo banco: sempre gratuita, usar de preferencia

---

## F13. PAGAMENTO RECORRENTE INTELIGENTE

### Visao de Negocio
Nao e "repetir boleto todo mes". E um sistema que:
- Detecta automaticamente pagamentos recorrentes no historico (aluguel, SaaS, salarios)
- Ajusta valor com base em reajuste contratual (IGPM + X% ao ano)
- Ajusta com base em consumo (ex: AWS varia, mas segue padrao sazonal)
- Alerta quando recorrente nao apareceu ("Aluguel de abril nao foi lancado -- esqueceram?")
- Gera CP automaticamente quando recorrente e previsivel (>95% confianca)

### Schema
```sql
CREATE TABLE recurring_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    fornecedor_doc TEXT,
    fornecedor_nome TEXT NOT NULL,
    description TEXT NOT NULL,
    category_id BIGINT,
    category_name TEXT,
    expected_amount NUMERIC(14,2) NOT NULL,
    amount_tolerance_pct NUMERIC(5,2) DEFAULT 5,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','annual')),
    expected_day INTEGER, -- dia do mes
    bank_account_id UUID REFERENCES bank_accounts(id),
    payment_method TEXT,
    auto_create_cp BOOLEAN DEFAULT false, -- cria CP automaticamente
    auto_pay BOOLEAN DEFAULT false, -- paga automaticamente (so com aprovacao)
    adjustment_rule JSONB, -- { type: 'igpm_plus', rate: 0.05, anniversary_month: 1 }
    status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
    next_expected_date DATE,
    last_paid_date DATE,
    last_paid_amount NUMERIC(14,2),
    streak_count INTEGER DEFAULT 0, -- meses consecutivos pagos
    miss_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recurring_payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_id UUID NOT NULL REFERENCES recurring_payments(id),
    period_date DATE NOT NULL,
    expected_amount NUMERIC(14,2),
    actual_amount NUMERIC(14,2),
    conta_pagar_id UUID,
    status TEXT CHECK (status IN ('paid','pending','missed','late','overpaid')),
    days_late INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## F14. COMPLIANCE AUTOMATICO PRE-PAGAMENTO

### Visao de Negocio
Antes de liberar qualquer pagamento acima de R$10k, o sistema verifica automaticamente:
- CNPJ do fornecedor na Receita Federal (situacao cadastral ativa?)
- Certidoes negativas de debito (se disponivel via API)
- Lista de sancionados (PEP, CEIS, CNEP, CEPIM)
- Situacao do fornecedor no Simples Nacional

Pagar para CNPJ inapto, baixado, ou com debitos pode gerar problemas fiscais e de compliance.

### Schema
```sql
CREATE TABLE supplier_compliance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    fornecedor_doc TEXT NOT NULL,
    check_type TEXT NOT NULL CHECK (check_type IN ('receita_federal','certidao_negativa','sanctions_list','simples_nacional')),
    result TEXT NOT NULL CHECK (result IN ('clean','alert','blocked','error','pending')),
    details JSONB NOT NULL, -- dados retornados da API
    expires_at TIMESTAMPTZ, -- cache de 30 dias
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_supplier ON supplier_compliance_checks(fornecedor_doc, check_type);
```

### Integracoes Externas
```
- Receita Federal: https://www.receitaws.com.br/v1/cnpj/{cnpj} (consulta gratuita com rate limit)
- Portal da Transparencia: API de sancionados (CEIS/CNEP/CEPIM)
- Simples Nacional: consulta optante
```

---

## F15. PORTAL DO FORNECEDOR

### Visao de Negocio
Toda empresa brasileira perde HORAS por semana atendendo ligacao de fornecedor perguntando: "Meu pagamento ja saiu?" O Portal do Fornecedor e uma pagina publica (com token de acesso) onde o fornecedor consulta:
- Status de cada nota/fatura (em analise, aprovado, agendado, pago)
- Data prevista de pagamento
- Comprovante de pagamento (quando pago)
- Historico completo de transacoes

### Schema
```sql
CREATE TABLE supplier_portal_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    fornecedor_doc TEXT NOT NULL,
    fornecedor_nome TEXT NOT NULL,
    fornecedor_email TEXT,
    access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    is_active BOOLEAN DEFAULT true,
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE(company_id, fornecedor_doc)
);

CREATE TABLE supplier_portal_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES supplier_portal_tokens(id),
    ip_address INET,
    user_agent TEXT,
    pages_viewed JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Endpoints (rota publica, sem auth de usuario)
```
GET    /api/v1/portal/supplier/:token            -- dados do fornecedor
GET    /api/v1/portal/supplier/:token/payments    -- lista de pagamentos
GET    /api/v1/portal/supplier/:token/payments/:id/receipt  -- comprovante
```

---

## F16. PREVISAO DE INADIMPLENCIA DO FORNECEDOR

### Visao de Negocio
Se fornecedor esta atrasando entregas, e sinal de que pode estar em dificuldade financeira. O sistema monitora:
- Atrasos na entrega vinculados a pedidos (dados do Tiny)
- Variacao brusca de precos (pode indicar desespero)
- Mudanca de condicoes de pagamento (pedindo adiantamento = sinal de alerta)
- Noticias sobre o fornecedor (se CNPJ grande o suficiente)

Quando score de risco do fornecedor cai abaixo de 300, sugere: "Segurar proximo pagamento ate confirmar entrega" ou "Buscar fornecedor alternativo."

---

## F17. SPLIT DE PAGAMENTO INTELIGENTE

### Visao de Negocio
Conta a pagar de R$50.000 vai estourar o caixa? O sistema sugere: "Negocie com fornecedor: pagar R$25k agora e R$25k em 15 dias. Seu caixa fica acima do minimo operacional." Com simulacao visual do impacto no fluxo de caixa.

---

## F18. HISTORICO DE NEGOCIACOES POR FORNECEDOR

### Visao de Negocio
Registro completo de todas as negociacoes: descontos conseguidos, prazos estendidos, condicoes especiais. Quando for renegociar, o historico esta la: "Em janeiro conseguimos 5% de desconto para pagamento antecipado. Em marco, estendemos prazo de 30 para 45 dias."

### Schema
```sql
CREATE TABLE supplier_negotiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    fornecedor_doc TEXT NOT NULL,
    fornecedor_nome TEXT NOT NULL,
    negotiation_type TEXT CHECK (negotiation_type IN ('discount','extended_terms','price_reduction','volume_deal','payment_split','other')),
    description TEXT NOT NULL,
    original_value NUMERIC(14,2),
    negotiated_value NUMERIC(14,2),
    savings NUMERIC(14,2),
    new_terms TEXT,
    negotiated_by UUID REFERENCES profiles(id),
    negotiation_date DATE NOT NULL,
    valid_until DATE,
    attachments JSONB, -- emails, prints de conversa
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

# 2. ARQUITETURA TECNICA DO MODULO

## Estrutura de Modulos NestJS

```
src/
  accounts-payable/
    accounts-payable.module.ts
    controllers/
      payment-plan.controller.ts      -- F1
      float-optimizer.controller.ts    -- F2
      discount-analyzer.controller.ts  -- F3
      duplicate-detector.controller.ts -- F4
      approval.controller.ts           -- F5
      calendar.controller.ts           -- F6
      batch.controller.ts              -- F7
      supplier.controller.ts           -- F8, F9, F15, F16, F18
      recurring.controller.ts          -- F13
      compliance.controller.ts         -- F14
    services/
      payment-orchestration.service.ts
      float-optimization.service.ts
      discount-analysis.service.ts
      duplicate-detection.service.ts
      approval-context.service.ts
      calendar.service.ts
      batch-optimizer.service.ts
      supplier-scoring.service.ts
      price-alert.service.ts
      recurring-payment.service.ts
      compliance-check.service.ts
      supplier-portal.service.ts
      cash-waterfall.service.ts
      payment-method-optimizer.service.ts
    processors/
      payment-plan.processor.ts        -- BullMQ job processor
      duplicate-scan.processor.ts
      price-alert.processor.ts
      compliance-check.processor.ts
      recurring-detect.processor.ts
      supplier-score.processor.ts
    entities/
      payment-plan.entity.ts
      payment-plan-item.entity.ts
      supplier-score.entity.ts
      duplicate-detection.entity.ts
      ... (todas as entities dos schemas acima)
    dto/
      create-payment-plan.dto.ts
      update-plan-item.dto.ts
      ... (DTOs para cada endpoint)
    guards/
      portal-token.guard.ts           -- guard para rotas do portal do fornecedor
```

## Integracao com Tiny ERP (via modulo existente TinySyncModule)

A execucao de pagamentos reutiliza o `TinyV2Client` existente:
```
POST https://api.tiny.com.br/api2/conta.pagar.baixar.php
Body: { "conta": { "id": "TINY_ID", "data": "DD/MM/YYYY", "valorPago": 0.00, "contaOrigem": "Nome Banco" } }
```

Regras ja documentadas no `PROCESSOS_FINANCEIRO.md` (linhas 29-33):
- Campo `contaOrigem` deve ser o nome EXATO do banco no Tiny
- NUNCA baixar pelo "Caixa" generico
- API V2 NAO tem endpoint de estorno

## Integracoes Externas Completas

| Servico | Endpoint | Uso | Rate Limit |
|---------|----------|-----|------------|
| Tiny V2 | conta.pagar.baixar.php | Baixa de CP | 3 req/s |
| Tiny V3 | /contas-pagar | Sync de CPs | 3 req/s |
| BCB (IPCA) | /dados/serie/bcdata.sgs.433 | Dados inflacao | 100/dia |
| ReceitaWS | /v1/cnpj/{cnpj} | Consulta CNPJ | 3/min free |
| ANBIMA | Calendario feriados | Feriados bancarios | Cache anual |
| Gupshup | WhatsApp Business API | Notificacoes fornecedor | Ja integrado |

---

# 3. MICRO-INTERACOES E UX (5 Interacoes Principais)

## MI1. Confirmacao do Plano de Pagamento Diario

### State Machine
```
[idle] --usuario_abre_plano--> [reviewing]
[reviewing] --ajusta_item--> [reviewing] (loop)
[reviewing] --clica_confirmar--> [confirming]
[confirming] --animation_complete--> [confirmed]
[confirmed] --clica_executar--> [executing]
[executing] --item_por_item--> [executing] (progress)
[executing] --all_done--> [completed]
[executing] --item_failed--> [partial_failure]
[partial_failure] --retry_item--> [executing]
```

### Specs de Animacao (Framer Motion)
```typescript
// Card do plano aparecendo
const planCardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

// Confirmacao: botao pulsa verde
const confirmPulse = {
  scale: [1, 1.02, 1],
  boxShadow: [
    "0 0 0 0 rgba(34, 197, 94, 0.4)",
    "0 0 0 12px rgba(34, 197, 94, 0)",
    "0 0 0 0 rgba(34, 197, 94, 0)"
  ],
  transition: { duration: 2, repeat: Infinity }
};

// Execucao: cada item faz checkmark sequencial
const itemExecuted = {
  backgroundColor: ["transparent", "rgba(34, 197, 94, 0.1)", "transparent"],
  transition: { duration: 0.6, ease: "easeOut" }
};

// Stagger: 100ms entre cada item
const staggerChildren = { staggerChildren: 0.1 };
```

### Fluxo Visual
1. **Estado `reviewing`**: Lista de items com drag handles para reordenar. Cada item mostra fornecedor, valor, banco recomendado (badge azul), meio de pagamento (icone). Bottom bar fixa: "Total: R$47.800 | Saldo apos: R$23.200" com barra de progresso do saldo (verde se acima minimo, vermelho se abaixo).
2. **Estado `confirming`**: Overlay semitransparente com spinner 1s, cards fazem scale(0.99) com blur(1px). Botao vira loading.
3. **Estado `confirmed`**: Confetti sutil (4-5 particulas, nao exagerado), badge verde "CONFIRMADO" aparece com spring animation. Botao muda para "EXECUTAR PAGAMENTOS" amarelo.
4. **Estado `executing`**: Progress bar no topo. Cada item muda sequencialmente: spinner -> checkmark verde (se sucesso) ou X vermelho (se falha). Numeros atualizam: "8/12 executados".
5. **Estado `completed`**: Toast verde "12 pagamentos executados com sucesso. Economia de float: R$124". Cards com opacity 0.5.

---

## MI2. Deteccao de Duplicata com Acao

### State Machine
```
[scanning] --duplicata_encontrada--> [alert_shown]
[alert_shown] --clica_ver_detalhes--> [comparing]
[comparing] --clica_nao_duplicata--> [dismissed]
[comparing] --clica_confirma_duplicata--> [merging]
[merging] --merge_complete--> [resolved]
```

### Specs de Animacao
```typescript
// Alerta de duplicata aparece como banner
const duplicateAlert = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: "auto", opacity: 1,
    transition: { height: { duration: 0.3 }, opacity: { duration: 0.2, delay: 0.1 } }
  }
};

// Comparacao side-by-side: os dois items deslizam para o centro
const compareSlideLeft = {
  initial: { x: -100, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }
};
const compareSlideRight = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } }
};

// Campos iguais pulsam verde, diferentes pulsam vermelho
const fieldHighlight = (isMatch: boolean) => ({
  backgroundColor: isMatch
    ? ["transparent", "rgba(34,197,94,0.2)", "transparent"]
    : ["transparent", "rgba(239,68,68,0.2)", "transparent"],
  transition: { duration: 1, repeat: 2 }
});
```

---

## MI3. Aprovacao Contextual Swipe

### State Machine
```
[pending] --abre_contexto--> [viewing_context]
[viewing_context] --swipe_right--> [approving]
[viewing_context] --swipe_left--> [rejecting]
[approving] --confirmed--> [approved]
[rejecting] --reason_provided--> [rejected]
```

### Specs de Animacao
```typescript
// Card de aprovacao com gesture
const approvalCard = {
  drag: "x",
  dragConstraints: { left: -150, right: 150 },
  dragElastic: 0.2,
  // Ao arrastar direita: fundo fica verde gradual
  // Ao arrastar esquerda: fundo fica vermelho gradual
  onDragEnd: (_, info) => {
    if (info.offset.x > 100) approve();
    if (info.offset.x < -100) reject();
  }
};

// Contexto aparece como accordion expandivel
const contextExpand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  transition: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }
};

// DRE impact: numeros fazem count-up animation
const countUp = { from: 0, to: targetValue, duration: 0.8 };
```

---

## MI4. Calendario Financeiro Drag-to-Reschedule

### State Machine
```
[viewing] --clica_evento--> [event_detail]
[viewing] --drag_evento--> [dragging]
[dragging] --drop_new_date--> [rescheduling]
[rescheduling] --confirmed--> [rescheduled]
[rescheduling] --cancelled--> [viewing]
```

### Specs de Animacao
```typescript
// Evento sendo arrastado
const dragEvent = {
  whileDrag: { scale: 1.05, boxShadow: "0 8px 30px rgba(0,0,0,0.3)", zIndex: 50 },
  transition: { type: "spring", stiffness: 300, damping: 25 }
};

// Data de destino iluminando
const dropTarget = {
  whileHover: { backgroundColor: "rgba(59, 130, 246, 0.1)" },
  transition: { duration: 0.15 }
};

// Saldo projetado atualizando em tempo real durante drag
const balanceLine = {
  // Recalcula curva de saldo enquanto evento e arrastado
  // Usa layout animation para transicao suave do grafico SVG
  transition: { type: "spring", stiffness: 200, damping: 20 }
};
```

---

## MI5. Portal do Fornecedor -- Status Timeline

### State Machine
```
[loading] --data_loaded--> [viewing_list]
[viewing_list] --clica_pagamento--> [viewing_detail]
[viewing_detail] --clica_comprovante--> [viewing_receipt]
```

### Specs de Animacao
```typescript
// Timeline de status com steps animados
const timelineStep = (index: number) => ({
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.3, delay: index * 0.1, ease: "easeOut" }
});

// Status badge com color coding
// "Em analise" = amarelo pulsante
// "Aprovado" = azul
// "Agendado" = roxo
// "Pago" = verde com checkmark
const paidBadge = {
  initial: { scale: 0 },
  animate: { scale: 1, transition: { type: "spring", stiffness: 400, damping: 15 } }
};
```

---

# 4. SPRINT BREAKDOWN

## Sprint CP-1: Foundation + Payment Plans (semanas 1-2)

**Goal**: Schema de CP, integracao com dados existentes, geracao basica de plano de pagamento

### User Stories

**US-CP-001**: Gerar plano de pagamento diario automaticamente
- **Given** o sistema tem CPs em aberto sincronizadas do Tiny para a empresa BlueLight
- **When** o cron roda as 7h da manha de um dia util
- **Then** um plano de pagamento e gerado contendo todas CPs vencendo hoje e atrasadas, priorizadas por criticidade

**US-CP-002**: Visualizar e ajustar plano de pagamento
- **Given** um plano de pagamento foi gerado para hoje com 12 items
- **When** o usuario abre a pagina de Contas a Pagar
- **Then** ele ve a lista priorizada com fornecedor, valor, banco recomendado, e meio de pagamento
- **And** pode arrastar items para reordenar prioridade
- **And** pode postergar item para outra data
- **And** ve o saldo projetado atualizar em tempo real

**US-CP-003**: Confirmar e executar plano de pagamento
- **Given** o usuario revisou e ajustou o plano
- **When** clica em "Confirmar Plano"
- **Then** o plano muda para status "confirmed"
- **And** quando clica "Executar", cada CP e baixada no Tiny via API V2 sequencialmente
- **And** progresso e exibido item por item
- **And** falhas sao exibidas inline com opcao de retry manual

**US-CP-004**: Regras de dia util e horario de corte
- **Given** hoje e sexta-feira e sao 17h
- **When** o plano e gerado
- **Then** items TED/boleto mostram alerta "Pode nao compensar hoje"
- **And** sistema sugere postergar para segunda-feira
- **And** items PIX continuam disponíveis sem alerta

**Arquivos estimados**: 18 files (migrations, entities, DTOs, controller, service, processor, tests)

---

## Sprint CP-2: Float Optimizer + Discount Analyzer (semanas 3-4)

**Goal**: Otimizacao de caixa e analise de desconto por antecipacao

### User Stories

**US-CP-005**: Analisar oportunidade de desconto antecipado
- **Given** fornecedor Meta oferece 3% de desconto para pagamento 10 dias antes do vencimento
- **When** usuario registra a oferta no sistema
- **Then** o sistema calcula: taxa equivalente mensal do desconto = 9%, custo de capital = 1.2%/mes, ganho liquido = 7.8%, e recomenda "ANTECIPAR"

**US-CP-006**: Visualizar float capturado vs perdido
- **Given** a empresa tem R$200k de saldo medio e pagou 150 CPs no mes
- **When** abre relatorio de otimizacao de float
- **Then** ve: "Float capturado: R$340 | Float perdido (pagamentos antecipados): R$85 | Score de otimizacao: 80/100"

**US-CP-007**: Simular antecipacao de parcelas
- **Given** fornecedor tem parcelamento 6x R$5.000 com 4 parcelas restantes
- **When** usuario simula quitacao com 5% de desconto
- **Then** ve comparativo: manter parcelas vs quitar, com impacto no fluxo de caixa

**Arquivos estimados**: 12 files

---

## Sprint CP-3: Duplicate Detection + Supplier Scoring (semanas 5-6)

**Goal**: Deteccao de duplicatas com IA e scoring de fornecedores

### User Stories

**US-CP-008**: Detectar duplicatas automaticamente
- **Given** o scanner roda diariamente as 6h
- **When** encontra duas CPs para "XPTO LTDA" com valores R$5.000 e R$5.050 na mesma semana
- **Then** cria alerta de duplicata com severity "high" e similarity score 92%
- **And** mostra explicacao: "Mesmo fornecedor, valores com diferenca de 1%, mesmo periodo. Possivel fatura duplicada com frete."

**US-CP-009**: Resolver duplicata
- **Given** alerta de duplicata aberto com dois items lado a lado
- **When** usuario confirma como duplicata e clica "Mesclar"
- **Then** uma CP e mantida e a outra e marcada como "merged"
- **And** audit log registra a decisao
- **And** valor economizado e contabilizado: "Voce evitou pagar R$5.050 em duplicata este mes"

**US-CP-010**: Consultar score de fornecedor
- **Given** empresa tem historico de 12 meses com fornecedor "ABC Insumos"
- **When** abre perfil do fornecedor
- **Then** ve score 720/1000, breakdown (pontualidade 85%, estabilidade preco 70%, volume alto), trend "estavel", e historico de 12 meses em sparkline

**Arquivos estimados**: 15 files

---

## Sprint CP-4: Approval Context + Cash Waterfall (semanas 7-8)

**Goal**: Sistema de aprovacao com contexto completo e priorizacao automatica

### User Stories

**US-CP-011**: Aprovar pagamento com contexto completo
- **Given** CP de R$25.000 requer aprovacao do CFO
- **When** CFO abre a aprovacao no celular
- **Then** ve: impacto no DRE (Marketing vai para 115% do orcamento), impacto no caixa (saldo cai para R$45k, acima do minimo), historico do fornecedor (pagamos R$180k nos ultimos 12 meses, media R$15k), score do fornecedor (820)
- **And** pode swipe-right para aprovar ou swipe-left para rejeitar

**US-CP-012**: Priorizar pagamentos em caixa apertado
- **Given** empresa tem R$50k de saldo e R$80k em CPs vencendo esta semana
- **When** sistema gera plano de pagamento
- **Then** prioriza: folha (R$35k, priority 1) > impostos (R$15k, priority 2)
- **And** posterga automaticamente fornecedores nao criticos
- **And** alerta: "Deficit de R$30k previsto. Sugestao: antecipar recebiveis ou negociar prazo."

**Arquivos estimados**: 14 files

---

## Sprint CP-5: Calendar + Batching + Recurring (semanas 9-10)

**Goal**: Calendario visual, agrupamento de pagamentos, e recorrentes

### User Stories

**US-CP-013**: Visualizar calendario financeiro
- **Given** empresa tem 45 CPs agendadas para abril
- **When** abre calendario
- **Then** ve Gantt horizontal com barras coloridas por prioridade, linha de saldo projetado dia a dia, marcos (folha dia 5, impostos dia 20)
- **And** pode arrastar CP para outra data (reschedule) com recalculo instantaneo do saldo

**US-CP-014**: Agrupar pagamentos para reduzir taxas
- **Given** plano do dia tem 8 TEDs totalizando R$68 em taxas
- **When** otimizador roda
- **Then** agrupa: 3 viram PIX (gratis), 2 viram transferencia mesmo banco (gratis), 3 TEDs restantes
- **And** economia exibida: "Economia de R$42,50 em taxas bancarias"

**US-CP-015**: Detectar e gerenciar pagamentos recorrentes
- **Given** empresa paga aluguel de R$8.500 todo dia 5 ha 8 meses consecutivos
- **When** sistema analisa historico
- **Then** cria pagamento recorrente automaticamente com confianca 98%
- **And** no dia 1 de cada mes, gera CP automatica se `auto_create_cp = true`
- **And** se dia 5 chega e nao ha CP para aluguel, alerta: "Pagamento recorrente nao detectado: Aluguel R$8.500"

**Arquivos estimados**: 16 files

---

## Sprint CP-6: Compliance + Portal Fornecedor + Alertas (semanas 11-12)

**Goal**: Verificacao automatica pre-pagamento, portal publico, e alertas de reajuste

### User Stories

**US-CP-016**: Verificar compliance antes de pagamento alto
- **Given** CP de R$30k para fornecedor novo "XYZ Servicos LTDA"
- **When** sistema executa compliance check automatico
- **Then** consulta CNPJ na ReceitaWS (situacao ativa, atividade economica, capital social)
- **And** se CNPJ inapto ou baixado, BLOQUEIA pagamento com alerta critico
- **And** se tudo OK, mostra badge verde "Compliance OK" no item do plano

**US-CP-017**: Fornecedor consulta status de pagamento
- **Given** empresa gerou token de acesso para fornecedor "ABC Insumos"
- **When** fornecedor acessa `app.example.com/portal/abc123token`
- **Then** ve timeline: NF recebida (12/04) -> Em analise (13/04) -> Aprovado (14/04) -> Pagamento agendado 18/04
- **And** apos pagamento, ve comprovante para download
- **And** empresa NAO recebe mais ligacao de fornecedor perguntando sobre pagamento

**US-CP-018**: Detectar reajuste acima da inflacao
- **Given** fornecedor Meta cobrava R$3.000/mes em janeiro e agora cobra R$3.800/mes em abril
- **When** scanner mensal roda
- **Then** cria alerta: "Meta Platforms aumentou 26.7% em 3 meses. IPCA no periodo: 2.1%. Reajuste REAL: 24.6%."
- **And** sugere: "Renegociar ou buscar alternativa. Economia potencial: R$800/mes"

**Arquivos estimados**: 14 files

---

# 5. REGRAS DE NEGOCIO INVISIVEIS

## Regras de Calendario Bancario

1. **NUNCA pagar na sexta depois das 16h30**: TED nao compensa, boleto pode nao processar. O sistema bloqueia e sugere segunda-feira.
2. **NUNCA pagar em feriado bancario**: O sistema consulta calendario ANBIMA anualmente e bloqueia automaticamente. Feriados municipais (padroeira, etc) sao configurados por empresa.
3. **Boleto: pagar antes das 20h**: Boleto pago depois das 20h geralmente so compensa no dia util seguinte. O sistema alerta a partir das 19h.
4. **TED: enviar antes das 16h30**: Horario de corte COMPE. O sistema mostra countdown quando faltam menos de 2h para o corte.
5. **PIX: sem horario de corte, MAS verificar limite diario**: Alguns bancos limitam PIX a R$1.000 entre 20h-6h. O sistema verifica e alerta.
6. **Compensacao de boleto: D+1 ou D+2**: Boleto pago hoje so e compensado amanha (ou depois de amanha em alguns bancos). O saldo projetado considera esse delay.

## Regras de Caixa Operacional

7. **Manter SEMPRE 30 dias de despesa fixa como reserva**: Antes de aprovar qualquer pagamento, o sistema verifica se o saldo apos pagamento cobre 30 dias de despesa fixa. Se nao, ALERTA CRITICO.
8. **Separar despesa fixa de variavel**: O sistema classifica automaticamente com base no historico. Recorrente com variacao < 10% = fixa. Resto = variavel. Isso alimenta o calculo de break-even.
9. **Nunca pagar adiantado sem desconto**: Se nao ha desconto, o dinheiro rende melhor no banco. O sistema nunca sugere antecipar pagamento sem beneficio explicito.
10. **Verificar se boleto esta vencido ANTES de pagar**: Boleto vencido tem juros+multa calculados automaticamente. Se juros > 5% do valor, o sistema sugere solicitar 2a via ao fornecedor.

## Regras de DRE e Classificacao

11. **Toda despesa DEVE ter categoria**: O sistema nao permite baixa de CP sem categoria definida no Tiny. Se CP esta sem categoria, bloqueia e pede classificacao.
12. **Transferencias NAO sao despesa**: Quando detecta transferencia intercompany (debito Empresa A, credito Empresa B), classifica como "Transferencia" e exclui do DRE. Ja codificado no script `criar_contas_pagar.js` (linha 64: `return 'TRANSFERENCIAS'`).
13. **Recargas de Conta Simples sao transferencias**: Tipo "LIMIT" na Conta Simples e recarga que veio de outra conta. Nao entra no DRE.
14. **IOF e despesa financeira**: Cobrado automaticamente em compras internacionais (SaaS em dolar). Classificar como "Despesa Financeira".
15. **Separar gasto por centro de custo para cada empresa**: O mapeamento ja existe no `PROCESSOS_FINANCEIRO.md` (linhas 135-146). O sistema aplica automaticamente.

## Regras de Fornecedor

16. **Negociar desconto quando fornecedor esta em dificuldade**: Se score do fornecedor cai abaixo de 400, e momento de negociar -- ele precisa de dinheiro e pode aceitar condicoes melhores. O sistema sugere: "Score do fornecedor caiu 30% em 2 meses. Pode ser momento de renegociar prazo ou pedir desconto."
17. **Fornecedor novo: pagamento so apos entrega**: Para primeiros 3 pedidos com fornecedor novo, o sistema recomenda: "Fornecedor sem historico. Recomendacao: pagar somente apos confirmacao de entrega."
18. **Manter historico de reajuste por fornecedor**: Toda vez que preco muda, registrar data, valor anterior, valor novo. Em renegociacao anual, ter DADOS para argumentar.

## Regras de Compliance

19. **CNPJ inapto = nao pagar**: Pagamento para CNPJ com situacao cadastral "inapta", "baixada" ou "nula" pode gerar problemas fiscais. O sistema bloqueia.
20. **Nota fiscal vs conta a pagar: valores devem bater**: Se diferenca > 5% entre NF e CP, alerta para verificar antes de pagar.
21. **Retencao de impostos**: Em servicos acima de R$215,05 (ISS) ou R$5.000 (PIS/COFINS/CSLL), verificar se ha retencao obrigatoria e se o fornecedor e optante do Simples.

## Regras Operacionais Especificas do Tiny

22. **Sempre baixar CP com banco correto (contaOrigem)**: Como documentado no PROCESSOS_FINANCEIRO.md, nunca usar "Caixa" generico. O nome deve ser EXATO: "Conta Simples - BlueLight", "Sicoob - Atacado Neon", etc.
23. **Sempre criar CP com categoria definida**: A API V2 nao permite atualizar CP depois. Se criou sem categoria, tem que excluir e criar de novo.
24. **Marcador CLAUDE em tudo que o sistema cria**: Para auditoria, todo registro criado automaticamente recebe marcador "CLAUDE" via API V3.
25. **API V3 nao salva categoria (BUG)**: Usar V3 para marcadores e V2 para criacao com categoria. Fluxo hibrido ja documentado.
26. **Paginacao V3 tem bug de loop**: Detectar IDs repetidos e fallback para V2. Ja implementado no PRD existente.

---

### Critical Files for Implementation
- /c/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md
- /c/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md
- /c/CLAUDECODE/CONCILIADOR FINANCEIRO/criar_contas_pagar.js
- /c/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliar_cp_extratos.js
- /c/CLAUDECODE/CONCILIADOR FINANCEIRO/criar_contas_pagar_producao.js

---


---

# MODULO CONTAS A RECEBER + COBRANCA AUTOMATIZADA INTELIGENTE

## Especificacao Completa para Plataforma BPO Financeiro

Baseado na analise do codebase existente -- especificamente o PRD do BPO Financeiro em `C:\CLAUDECODE\CONCILIADOR FINANCEIRO\PRD_BPO_FINANCEIRO.md`, a tabela `tiny_contas_receber` ja mapeada, os processos documentados em `PROCESSOS_FINANCEIRO.md`, e a arquitetura NestJS + Supabase + BullMQ ja definida -- este modulo ESTENDE o sistema de conciliacao existente adicionando uma camada de inteligencia ativa sobre os dados de contas a receber que ja estao sendo sincronizados do Tiny ERP.

---

## 1. MOTOR DE COBRANCA INTELIGENTE -- 20 FEATURES COM SPEC COMPLETA

### Feature 1: ORQUESTRACAO MULTI-CANAL COM SEQUENCIA INTELIGENTE

**Justificativa de Negocio:** O Atacado Neon com R$1M/mes tem centenas de CRs abertas simultaneamente. Mandar WhatsApp para todo mundo as 9h da manha e ter 200 mensagens sem resposta e pior que nao cobrar. A orquestracao garante que cada canal e usado na hora certa, na ordem certa, com cooldown entre tentativas.

**Logica:** Cada titulo entra numa "cadencia de cobranca" que define canal + timing + template para cada etapa. O sistema nao dispara o canal 2 ate o canal 1 ter sido tentado e ter passado o cooldown. Se o cliente responde em qualquer canal, o fluxo pausa e entra em modo "negociacao".

**Schema PostgreSQL:**

```sql
CREATE TABLE collection_cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID REFERENCES companies(id), -- null = padrao org
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  target_segment TEXT DEFAULT 'all', -- all, premium, new, delinquent, high_value
  steps JSONB NOT NULL, -- array de CollectionStep
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, company_id, is_default) WHERE is_default = true
);

-- Cada step da cadencia:
-- { "order": 1, "days_offset": -3, "channel": "whatsapp", "template_id": "uuid", 
--   "time_window": {"start": "08:00", "end": "18:00"}, "cooldown_hours": 24,
--   "skip_if": {"score_above": 90, "amount_below": 50}, "escalation_level": "L0" }

CREATE TABLE collection_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  conta_receber_id UUID NOT NULL REFERENCES tiny_contas_receber(id),
  cadence_id UUID NOT NULL REFERENCES collection_cadences(id),
  current_step INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, cancelled, negotiating
  started_at TIMESTAMPTZ DEFAULT now(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  pause_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE collection_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES collection_executions(id),
  step_index INT NOT NULL,
  channel TEXT NOT NULL, -- whatsapp, email, sms, phone, portal
  template_id UUID,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled', -- scheduled, sent, delivered, read, responded, failed, skipped, cancelled
  external_message_id TEXT, -- id no WhatsApp/email provider
  response_content TEXT,
  error_details JSONB,
  cost NUMERIC(8,4) DEFAULT 0, -- custo do envio (SMS, WhatsApp template)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Endpoints NestJS:**

```
POST   /api/v1/collections/cadences              -- criar cadencia
GET    /api/v1/collections/cadences               -- listar cadencias
PUT    /api/v1/collections/cadences/:id           -- editar cadencia
DELETE /api/v1/collections/cadences/:id           -- soft delete
POST   /api/v1/collections/cadences/:id/duplicate -- duplicar
POST   /api/v1/collections/execute                -- iniciar cobranca para CRs selecionadas
POST   /api/v1/collections/execute/bulk           -- iniciar cobranca em massa (por filtro)
PUT    /api/v1/collections/executions/:id/pause   -- pausar execucao
PUT    /api/v1/collections/executions/:id/resume  -- retomar
PUT    /api/v1/collections/executions/:id/cancel  -- cancelar
GET    /api/v1/collections/executions             -- listar execucoes com filtros
GET    /api/v1/collections/actions                -- historico de acoes enviadas
```

**BullMQ Jobs:**

```
Queue: collection-orchestrator
  - Cron: a cada 5 minutos
  - Job: verifica todas execucoes ativas, calcula proximo step, agenda acoes
  - Concurrency: 2
  - Retry: 3x exponential

Queue: collection-sender
  - On-demand (triggered pelo orchestrator)
  - Job: envia mensagem no canal especificado (WhatsApp/Email/SMS)
  - Concurrency: 5 (respeitando rate limits dos providers)
  - Retry: 2x

Queue: collection-response-processor
  - Webhook-triggered (quando cliente responde)
  - Job: analisa resposta, decide se pausa fluxo ou escala
  - Concurrency: 3
```

---

### Feature 2: TIMING DE COBRANCA POR COMPORTAMENTO (BEHAVIORAL TIMING ENGINE)

**Justificativa de Negocio:** O dono da padaria paga segunda de manha depois de contar o caixa do fim de semana. O distribuidor paga dia 15 porque e quando o faturamento dele cai. A empresa de engenharia paga 48h apos receber a cobranca por email. Se voce manda cobranca no momento errado, a taxa de resposta cai 60%. Se manda no momento certo, sobe 40%.

**Logica:** O sistema analisa o historico de pagamento do cliente (data de vencimento vs data de pagamento real, dia da semana, hora do dia) e constroi um perfil temporal. Usa regressao simples para prever o melhor momento de envio.

**Schema:**

```sql
CREATE TABLE customer_payment_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  customer_cpf_cnpj TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  -- patterns aprendidos
  preferred_payment_day_of_week INT, -- 0=dom, 1=seg... 6=sab
  preferred_payment_day_of_month INT, -- 1-31
  preferred_payment_hour INT, -- 0-23
  avg_days_after_due NUMERIC(5,1), -- media de dias apos vencimento que paga
  median_days_after_due NUMERIC(5,1),
  stddev_days_after_due NUMERIC(5,1),
  best_reminder_channel TEXT, -- canal com melhor taxa de resposta
  best_reminder_timing TEXT, -- 'pre_due_3d', 'due_day', 'post_due_1d', etc
  response_rate_whatsapp NUMERIC(5,2),
  response_rate_email NUMERIC(5,2),
  response_rate_sms NUMERIC(5,2),
  -- contadores
  total_invoices INT DEFAULT 0,
  paid_on_time INT DEFAULT 0,
  paid_late INT DEFAULT 0,
  never_paid INT DEFAULT 0,
  -- scores
  payment_score INT DEFAULT 50, -- 0-100
  risk_level TEXT DEFAULT 'medium', -- low, medium, high, critical
  -- refresh
  last_calculated_at TIMESTAMPTZ,
  data_points INT DEFAULT 0, -- quantas CRs usou para calcular
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, company_id, customer_cpf_cnpj)
);

CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  customer_cpf_cnpj TEXT NOT NULL,
  conta_receber_id UUID,
  event_type TEXT NOT NULL, -- invoice_created, reminder_sent, reminder_read, 
                            -- reminder_responded, payment_received, payment_partial,
                            -- negotiation_started, negotiation_accepted, promise_made,
                            -- promise_broken, dispute_opened
  channel TEXT, -- whatsapp, email, sms, portal, manual
  event_data JSONB DEFAULT '{}',
  event_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_events_customer ON payment_events(org_id, company_id, customer_cpf_cnpj, event_at DESC);
CREATE INDEX idx_behavior_score ON customer_payment_behavior(org_id, company_id, payment_score);
```

**BullMQ Job:**

```
Queue: behavior-analyzer
  - Cron: diario 02:00 AM
  - Job: recalcula payment_behavior para todos os clientes com novos payment_events
  - Logica: busca todos CRs pagos do cliente, calcula medias, 
    identifica padrao de dia da semana (mode), hora (mode),
    calcula score (0-100) baseado em:
      70% pontualidade (paid_on_time / total)
      15% tendencia (melhorando ou piorando nos ultimos 6 meses)
      15% valor medio (clientes de ticket alto sao mais valiosos)
  - Concurrency: 1 (batch processing)
```

---

### Feature 3: ESCADA DE ESCALACAO AUTOMATICA COM GATES

**Justificativa de Negocio:** Hoje o Everton descobre que um cliente deve R$50k quando ja esta 90 dias atrasado porque ninguem acompanhou. A escada de escalacao garante que cada titulo passa por niveis progressivos de cobranca, com portas (gates) que impedem escalacao prematura e garantem que houve tentativa genuina antes de escalar.

**State Machine completa (a ser detalhada na secao 2):**

```
EMITIDO [D-7 a D-1]
  -> PRE_VENCIMENTO [D-3 a D-1]: lembrete gentil
  -> NO_VENCIMENTO [D+0]: aviso dia
  -> GRACE_PERIOD [D+1 a D+3]: periodo de graca (feriados, compensacao bancaria)
  -> COBRANCA_L1 [D+4 a D+14]: cobranca amigavel (WhatsApp + Email)
    GATE: minimo 2 tentativas de contato em canais diferentes
  -> COBRANCA_L2 [D+15 a D+29]: cobranca firme (telefone + email formal)
    GATE: minimo 1 tentativa L1 entregue + sem resposta
  -> COBRANCA_L3 [D+30 a D+59]: ultima chance (carta formal + ameaca de negativacao)
    GATE: supervisor aprovou escalacao
  -> NEGATIVACAO [D+60 a D+89]: inclusao Serasa/SPC
    GATE: gestor financeiro aprovou + valor minimo R$500
  -> JURIDICO [D+90+]: encaminhamento para departamento juridico
    GATE: diretor aprovou + valor minimo R$2.000
  -> PERDA [qualquer momento]: titulo dado como perda (PDD)
  -> BAIXADO [qualquer momento]: pagamento recebido
```

**Schema:**

```sql
CREATE TABLE collection_state_machine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  conta_receber_id UUID NOT NULL REFERENCES tiny_contas_receber(id),
  customer_cpf_cnpj TEXT NOT NULL,
  -- estado atual
  current_state TEXT NOT NULL DEFAULT 'emitido',
  previous_state TEXT,
  state_entered_at TIMESTAMPTZ DEFAULT now(),
  -- valores
  original_amount NUMERIC(14,2) NOT NULL,
  current_amount NUMERIC(14,2) NOT NULL, -- pode mudar com juros/multa/desconto
  paid_amount NUMERIC(14,2) DEFAULT 0,
  -- datas
  due_date DATE NOT NULL,
  days_overdue INT GENERATED ALWAYS AS (GREATEST(0, CURRENT_DATE - due_date)) STORED,
  -- controle de gates
  gate_approvals JSONB DEFAULT '{}', -- {"L3": {"approved_by": "uuid", "at": "timestamp"}}
  -- contadores de tentativas
  contact_attempts INT DEFAULT 0,
  contact_attempts_l1 INT DEFAULT 0,
  contact_attempts_l2 INT DEFAULT 0,
  successful_contacts INT DEFAULT 0, -- entregue + lido
  -- flags
  has_promise_to_pay BOOLEAN DEFAULT false,
  promise_date DATE,
  is_in_negotiation BOOLEAN DEFAULT false,
  is_blocked_erp BOOLEAN DEFAULT false, -- bloqueado no ERP
  is_negativated BOOLEAN DEFAULT false,
  negativation_date DATE,
  -- metadata
  assigned_to UUID, -- responsavel humano
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, conta_receber_id)
);

CREATE TABLE state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_machine_id UUID NOT NULL REFERENCES collection_state_machine(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  trigger TEXT NOT NULL, -- auto_timeout, manual, payment_received, gate_approved, promise_made
  triggered_by UUID, -- user ou null para sistema
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  transitioned_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_csm_state ON collection_state_machine(org_id, company_id, current_state);
CREATE INDEX idx_csm_overdue ON collection_state_machine(org_id, company_id, days_overdue) WHERE current_state NOT IN ('baixado', 'perda');
```

---

### Feature 4: SCORE DE PAGAMENTO DO CLIENTE (PAYMENT SCORE 0-100)

**Justificativa de Negocio:** Voce tem 500 clientes. Quem merece prazo de 60 dias e quem deveria pagar antecipado? Sem score, voce trata todo mundo igual. Com score, voce faz gestao de risco real -- o vendedor sabe ANTES de fechar o pedido se aquele cliente e bom pagador.

**Calculo detalhado do score:**

```
PAYMENT_SCORE (0-100) = 
  (PONTUALIDADE * 0.40) +        -- % de titulos pagos no prazo
  (REGULARIDADE * 0.20) +        -- consistencia (baixo desvio padrao)
  (HISTORICO_RECENTE * 0.20) +   -- peso maior nos ultimos 6 meses
  (VOLUME * 0.10) +              -- quanto mais compra, mais pontos (fidelidade)
  (TENDENCIA * 0.10)             -- melhorando ou piorando

Faixas:
  90-100: OURO     -- prazo estendido, prioridade baixa na cobranca
  70-89:  PRATA    -- prazo normal, cobranca padrao
  50-69:  BRONZE   -- prazo reduzido, cobranca antecipada
  30-49:  ATENCAO  -- antecipado ou garantia, cobranca agressiva
  0-29:   CRITICO  -- somente a vista, cobranca imediata pos-vencimento
```

**Endpoints:**

```
GET  /api/v1/customers/scores                    -- ranking de clientes por score
GET  /api/v1/customers/:cpf_cnpj/score           -- score detalhado de um cliente
GET  /api/v1/customers/:cpf_cnpj/history         -- historico completo de pagamentos
POST /api/v1/customers/scores/recalculate        -- forcar recalculo
GET  /api/v1/customers/score-distribution         -- distribuicao (quantos em cada faixa)
```

---

### Feature 5: COBRANCA PERSONALIZADA POR PERFIL

**Justificativa de Negocio:** Mandar a mesma mensagem generica para um cliente que compra R$100k/mes e para um que compra R$500/mes e suicidio comercial. O cliente grande precisa de toque humano. O cliente pequeno pode ser 100% automatizado.

**Logica de segmentacao:**

```sql
CREATE TABLE customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL, -- 'VIP', 'Regular', 'Novo', 'Problema', 'Inativo'
  rules JSONB NOT NULL, -- regras de enquadramento automatico
  -- {"conditions": [
  --   {"field": "avg_monthly_revenue", "operator": ">=", "value": 50000},
  --   {"field": "payment_score", "operator": ">=", "value": 80}
  -- ], "logic": "AND"}
  cadence_id UUID REFERENCES collection_cadences(id), -- cadencia especifica
  communication_tone TEXT DEFAULT 'professional', -- friendly, professional, formal, urgent
  max_auto_discount_pct NUMERIC(5,2) DEFAULT 0, -- desconto max automatico
  escalation_speed TEXT DEFAULT 'normal', -- slow (VIP), normal, fast (problema)
  human_handoff_at TEXT DEFAULT 'L2', -- quando envolve humano: L1, L2, L3, never
  block_at_days INT DEFAULT 30, -- dias para bloquear no ERP (0 = nunca)
  negativation_enabled BOOLEAN DEFAULT true,
  priority INT DEFAULT 50, -- maior = avaliado primeiro (para regras conflitantes)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customer_segment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  customer_cpf_cnpj TEXT NOT NULL,
  segment_id UUID NOT NULL REFERENCES customer_segments(id),
  assigned_method TEXT DEFAULT 'auto', -- auto, manual
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, customer_cpf_cnpj)
);
```

---

### Feature 6: NEGOCIACAO AUTOMATICA COM LINK DE PAGAMENTO

**Justificativa de Negocio:** 40% dos clientes que atrasam NAO sao maus pagadores -- estao com fluxo apertado e so precisam de uma proposta. Se voce manda "pague hoje com 5% de desconto" com link PIX na mensagem, o cara paga em 5 minutos. Sem negociacao automatica, o titulo fica 30 dias parado ate alguem ligar.

**Schema:**

```sql
CREATE TABLE negotiation_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  execution_id UUID REFERENCES collection_executions(id),
  conta_receber_id UUID NOT NULL,
  customer_cpf_cnpj TEXT NOT NULL,
  -- proposta
  original_amount NUMERIC(14,2) NOT NULL,
  proposed_amount NUMERIC(14,2) NOT NULL,
  discount_pct NUMERIC(5,2),
  discount_amount NUMERIC(14,2),
  installments INT DEFAULT 1, -- parcelas
  installment_amount NUMERIC(14,2),
  -- condicoes
  valid_until TIMESTAMPTZ NOT NULL, -- proposta expira
  payment_method TEXT, -- pix, boleto, cartao
  payment_link TEXT, -- link gerado (PIX qrcode, boleto URL)
  pix_qrcode TEXT, -- payload PIX copia e cola
  pix_txid TEXT, -- identificador PIX para rastrear
  boleto_url TEXT,
  boleto_barcode TEXT,
  -- status
  status TEXT DEFAULT 'pending', -- pending, sent, viewed, accepted, rejected, expired, paid, partially_paid
  sent_via TEXT, -- whatsapp, email, sms, portal
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(14,2),
  -- regras usadas
  rule_applied JSONB, -- qual regra de desconto foi usada
  approved_by UUID, -- null se dentro do limite automatico
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE negotiation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  -- condicoes para aplicar
  min_days_overdue INT DEFAULT 0,
  max_days_overdue INT,
  min_amount NUMERIC(14,2),
  max_amount NUMERIC(14,2),
  customer_score_min INT,
  customer_score_max INT,
  -- proposta
  discount_pct NUMERIC(5,2) NOT NULL, -- ex: 5.00
  max_installments INT DEFAULT 1,
  valid_hours INT DEFAULT 48, -- horas de validade da proposta
  -- limites
  max_discount_amount NUMERIC(14,2), -- teto em R$
  requires_approval_above NUMERIC(14,2), -- acima deste valor, precisa aprovacao
  max_uses_per_month INT, -- limite de uso
  uses_this_month INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Endpoints:**

```
POST /api/v1/negotiations/proposals              -- criar proposta (auto ou manual)
GET  /api/v1/negotiations/proposals               -- listar propostas
GET  /api/v1/negotiations/proposals/:id           -- detalhe
PUT  /api/v1/negotiations/proposals/:id/approve   -- aprovar proposta (quando acima do limite)
POST /api/v1/negotiations/proposals/:id/send      -- enviar ao cliente
GET  /api/v1/negotiations/proposals/:id/payment-link -- gerar/regenerar link de pagamento
POST /api/v1/negotiations/rules                   -- CRUD regras
GET  /api/v1/negotiations/rules
PUT  /api/v1/negotiations/rules/:id
```

---

### Feature 7: FACILIDADE DE PAGAMENTO -- PIX + BOLETO INSTANTANEO

**Justificativa de Negocio:** Cada segundo de friccao entre "quero pagar" e "paguei" custa dinheiro. Se o cara precisa ligar para pedir o boleto, desiste. Se clica no link do WhatsApp e paga via PIX em 10 segundos, converte.

**Integracoes:**

- **PIX API**: Integracao com Pagar.me ou banco (Sicoob) para gerar QR Code dinamico com valor exato e identificador unico (txid) para reconciliacao automatica
- **Boleto**: Geracao via API do banco ou gateway com registro automatico
- **Link de pagamento**: Pagina hosted com opcoes PIX/Boleto/Cartao

**BullMQ Job:**

```
Queue: payment-link-generator
  - On-demand
  - Job: gera PIX QR code e/ou boleto via API do gateway
  - Retry: 2x
  - Concurrency: 5

Queue: payment-webhook-processor
  - Webhook-triggered
  - Job: recebe confirmacao de pagamento, baixa no state machine,
         inicia reconciliacao automatica no Tiny
  - Concurrency: 3
```

---

### Feature 8: PREVISAO DE INADIMPLENCIA (PREDICTIVE DEFAULT ENGINE)

**Justificativa de Negocio:** Prever quem vai atrasar ANTES do vencimento permite acao preventiva. Se o sistema detecta que cliente X tem 85% de chance de atrasar o titulo de R$30k que vence sexta, voce pode ligar na quarta e negociar.

**Schema:**

```sql
CREATE TABLE default_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  conta_receber_id UUID NOT NULL,
  customer_cpf_cnpj TEXT NOT NULL,
  -- previsao
  probability_default NUMERIC(5,2) NOT NULL, -- 0.00 a 1.00
  predicted_days_late INT, -- estimativa de quantos dias vai atrasar
  confidence NUMERIC(5,2), -- confianca do modelo
  -- fatores
  factors JSONB NOT NULL,
  -- {"historical_late_rate": 0.6, "recent_trend": "worsening", 
  --  "amount_vs_avg": 1.5, "days_to_due": 3, "day_of_week_pattern": "avoids_monday",
  --  "similar_customers_default_rate": 0.3}
  -- acao recomendada
  recommended_action TEXT, -- early_reminder, call, adjust_terms, no_action
  action_taken TEXT,
  action_taken_at TIMESTAMPTZ,
  -- resultado real
  actual_result TEXT, -- paid_on_time, paid_late, defaulted
  actual_days_late INT,
  -- modelo
  model_version TEXT DEFAULT 'v1_heuristic',
  calculated_at TIMESTAMPTZ DEFAULT now()
);
```

**Logica do modelo v1 (heuristico, sem ML complexo):**

```
PROBABILIDADE = 
  (TAXA_ATRASO_HISTORICA_CLIENTE * 0.35) +
  (TENDENCIA_RECENTE * 0.20) +            -- piorando = +0.15
  (RATIO_VALOR_VS_MEDIA * 0.15) +         -- titulo acima da media = mais risco
  (PADRAO_DIA_SEMANA * 0.10) +            -- vence em dia que nunca paga = risco
  (TAXA_DEFAULT_SEGMENTO * 0.10) +        -- setor/regiao do cliente
  (CONCENTRACAO_RECEBIVEIS * 0.10)        -- muito exposto neste cliente = risco
```

**BullMQ Job:**

```
Queue: default-predictor
  - Cron: diario 06:00 AM
  - Job: calcula predicao para todos CRs com vencimento nos proximos 7 dias
  - Gera alertas para predicoes > 0.70
  - Concurrency: 1
```

---

### Feature 9: AGING ANALYSIS DINAMICO EM TEMPO REAL

**Justificativa de Negocio:** A tabela de aging estatica do Excel que o Everton imprime todo mes so mostra a foto. O aging dinamico mostra o FILME -- voce ve o envelhecimento acontecendo em tempo real, com drill-down ate o titulo individual.

**Endpoints:**

```
GET /api/v1/receivables/aging                     -- aging por faixa com drill-down
GET /api/v1/receivables/aging/by-customer          -- aging agrupado por cliente
GET /api/v1/receivables/aging/by-salesperson        -- aging por vendedor
GET /api/v1/receivables/aging/by-product            -- aging por produto/categoria
GET /api/v1/receivables/aging/trend                 -- evolucao do aging ao longo do tempo
GET /api/v1/receivables/aging/concentration          -- concentracao por cliente (Pareto)
```

**Faixas de aging:**

```
A vencer (0 dias)
Vencido 1-7 dias
Vencido 8-14 dias
Vencido 15-30 dias
Vencido 31-60 dias
Vencido 61-90 dias
Vencido 90+ dias
```

Cada faixa retorna: quantidade de titulos, valor total, % do total, top 5 clientes, tendencia vs mes anterior.

---

### Feature 10: DASHBOARD DE RECUPERACAO DE RECEITA

**Justificativa de Negocio:** Se voce nao mede, nao gerencia. O dashboard mostra exatamente quanto dinheiro a cobranca automatizada recuperou vs quanto teria sido perdido sem ela. Isso justifica o investimento no sistema.

**Schema:**

```sql
CREATE TABLE collection_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL, -- daily, weekly, monthly
  -- recuperacao
  total_overdue_amount NUMERIC(14,2), -- valor total vencido no periodo
  recovered_amount NUMERIC(14,2), -- valor recuperado pela cobranca
  recovery_rate NUMERIC(5,2), -- %
  -- eficiencia
  avg_days_to_recover NUMERIC(5,1),
  first_contact_recovery_rate NUMERIC(5,2), -- % que paga no primeiro contato
  -- canais
  recovered_via_whatsapp NUMERIC(14,2),
  recovered_via_email NUMERIC(14,2),
  recovered_via_sms NUMERIC(14,2),
  recovered_via_phone NUMERIC(14,2),
  recovered_via_portal NUMERIC(14,2),
  recovered_via_negotiation NUMERIC(14,2),
  -- custos
  total_messages_sent INT,
  total_cost_messages NUMERIC(10,2),
  cost_per_recovery NUMERIC(10,2),
  roi_collection NUMERIC(8,2), -- recuperado / custo
  -- negociacao
  total_proposals_sent INT,
  proposals_accepted INT,
  total_discount_given NUMERIC(14,2),
  net_recovered NUMERIC(14,2), -- recuperado - descontos
  -- provisao
  pdd_estimate NUMERIC(14,2), -- provisao para devedores duvidosos
  write_off_amount NUMERIC(14,2), -- valor dado como perda
  
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, company_id, period_start, period_type)
);
```

**Endpoints:**

```
GET /api/v1/receivables/metrics/recovery           -- dashboard de recuperacao
GET /api/v1/receivables/metrics/roi                -- ROI da cobranca
GET /api/v1/receivables/metrics/channel-performance -- performance por canal
GET /api/v1/receivables/metrics/team               -- performance por responsavel
```

---

### Feature 11: COMISSAO CONDICIONADA A PAGAMENTO

**Justificativa de Negocio:** O vendedor fecha R$100k de pedidos com prazo de 90 dias para clientes duvidosos e recebe comissao na hora. Quando 30% nao paga, a empresa ja pagou a comissao e agora esta com prejuizo duplo: perdeu a venda E a comissao. A comissao condicionada alinha incentivos.

**Schema:**

```sql
CREATE TABLE commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- percentage, fixed, tiered
  base_rate NUMERIC(5,2), -- % padrao
  -- condicoes de liberacao
  release_trigger TEXT DEFAULT 'payment_confirmed', -- payment_confirmed, reconciled, days_after_sale
  release_days INT DEFAULT 0, -- dias apos a venda para liberar (se trigger = days_after_sale)
  -- penalizacoes
  late_payment_deduction_pct NUMERIC(5,2) DEFAULT 0, -- desconto na comissao se cliente atrasar
  default_clawback BOOLEAN DEFAULT true, -- estornar comissao se cliente nao pagar
  clawback_after_days INT DEFAULT 90, -- dias para considerar default
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  salesperson_id UUID,
  salesperson_name TEXT,
  conta_receber_id UUID,
  order_id TEXT, -- pedido no Tiny
  -- valores
  sale_amount NUMERIC(14,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(14,2) NOT NULL,
  -- status
  status TEXT DEFAULT 'pending', -- pending, released, partially_released, clawed_back, adjusted
  released_amount NUMERIC(14,2) DEFAULT 0,
  clawback_amount NUMERIC(14,2) DEFAULT 0,
  -- datas
  sale_date DATE,
  payment_due_date DATE,
  payment_received_date DATE,
  released_at TIMESTAMPTZ,
  clawback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Feature 12: BLOQUEIO INTELIGENTE NO ERP

**Justificativa de Negocio:** Cliente devendo R$30k com 45 dias de atraso faz novo pedido de R$20k. Sem bloqueio, o vendedor processa o pedido e a divida sobe para R$50k. Com bloqueio, o sistema nao permite novo pedido ate regularizar.

**Logica:**

```
Regras configuráveis:
  - Bloquear se dias_atraso >= X (padrao: 30)
  - Bloquear se valor_vencido >= Y (padrao: R$1.000)
  - Bloquear se payment_score <= Z (padrao: 30)
  - Excecoes: segmento VIP pode ter regras diferentes
  - Override manual: gestor pode liberar pedido especifico com justificativa
  
Integracao Tiny:
  - API V2: alterar situacao do cliente para "bloqueado" (se suportado)
  - Webhook: interceptar novos pedidos e validar status
  - Dashboard: alerta visual quando cliente bloqueado tenta comprar
```

**Schema:**

```sql
CREATE TABLE customer_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  customer_cpf_cnpj TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  -- bloqueio
  block_type TEXT NOT NULL, -- auto_overdue, auto_score, manual
  block_reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT now(),
  blocked_by UUID, -- null se automatico
  -- valores que geraram o bloqueio
  overdue_amount NUMERIC(14,2),
  overdue_days INT,
  payment_score INT,
  -- desbloqueio
  unblocked_at TIMESTAMPTZ,
  unblocked_by UUID,
  unblock_reason TEXT,
  -- status
  is_active BOOLEAN DEFAULT true,
  -- override
  override_allowed BOOLEAN DEFAULT false,
  override_by UUID,
  override_reason TEXT,
  override_until DATE, -- desbloqueio temporario
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Feature 13: ALERTA DE CONCENTRACAO DE RECEBIVEIS

**Justificativa de Negocio:** Se um unico cliente representa 25% do seu faturamento e atrasa, voce tem uma crise de caixa. O sistema monitora concentracao e alerta quando passa dos limites de seguranca.

**Logica:**

```
Alarmes configuráveis:
  - AMARELO: cliente > 10% do recebivel total
  - VERMELHO: cliente > 20% do recebivel total
  - CRITICO: top 3 clientes > 50% do recebivel total
  
Metricas:
  - Indice Herfindahl-Hirschman (HHI) do portfolio de recebiveis
  - Curva ABC (80/20) atualizada em tempo real
  - Alerta de tendencia: "Cliente X cresceu de 8% para 15% nos ultimos 3 meses"
```

---

### Feature 14: COBRANCA POR CONTEXTO (MARGEM DO PRODUTO)

**Justificativa de Negocio:** Se o cliente comprou produto com 60% de margem, voce pode dar 10% de desconto na negociacao e ainda lucrar. Se comprou com 15% de margem, nao tem espaco para desconto. O sistema cruza dados de margem do pedido com a cobranca.

**Logica:**

```
Integração com dados do Tiny:
  - Buscar pedido vinculado ao CR
  - Calcular margem bruta do pedido (preco venda - custo)
  - Definir teto de desconto na negociacao = margem * fator_seguranca
  
Regra:
  IF margem > 50%: desconto max 15%
  IF margem 30-50%: desconto max 8%
  IF margem 15-30%: desconto max 3%
  IF margem < 15%: desconto 0% (sem negociacao de valor)
```

---

### Feature 15: RECONCILIACAO AUTOMATICA DE PAGAMENTO (PIX/TED -> BAIXA TINY)

**Justificativa de Negocio:** O dinheiro caiu na conta. Alguem precisa abrir o Tiny, achar o titulo, dar baixa manual. Com 4.599 CRs/mes, sao horas de trabalho manual. A reconciliacao automatica detecta o pagamento no extrato e baixa o CR correspondente no Tiny.

**Logica:** Esta feature ESTENDE o motor de reconciliacao ja existente no PRD do BPO (ReconciliationModule). A diferenca e que aqui o trigger e automatico -- quando o bank-sync detecta credito novo, o sistema verifica se corresponde a algum CR aberto e, se a confianca for >= 0.95, executa a baixa automaticamente via API Tiny V2.

**BullMQ Job:**

```
Queue: auto-payment-reconciler
  - Triggered: apos cada bank-sync que importa novas transacoes de credito
  - Job: para cada credito novo, busca CRs abertos com valor compativel,
         aplica matching (valor exato + nome parcial + data proxima),
         se confidence >= 0.95: baixa automatica no Tiny + atualiza state machine
         se confidence 0.75-0.94: cria sugestao para revisao humana
  - Concurrency: 2
```

---

### Feature 16: CARTA DE ANUENCIA AUTOMATICA

**Justificativa de Negocio:** Cliente pagou uma divida que estava negativada. Voce precisa emitir carta de anuencia em ate 5 dias uteis (obrigacao legal). Se nao emite, pode ser processado. O sistema gera automaticamente.

**Logica:**

```
Trigger: titulo muda de estado para BAIXADO e was_negativated = true
Action:
  1. Gerar PDF de carta de anuencia com dados do cliente e titulo
  2. Solicitar remocao da negativacao no Serasa/SPC via API
  3. Enviar carta ao cliente via email + disponibilizar no portal
  4. Registrar no audit_log
```

---

### Feature 17: PORTAL DO CLIENTE (SELF-SERVICE)

**Justificativa de Negocio:** 30% dos clientes pagariam se tivessem acesso facil aos boletos. O portal permite que o cliente veja seus titulos, gere segunda via, negocie parcelamento e pague online -- sem precisar ligar ou mandar WhatsApp.

**Schema:**

```sql
CREATE TABLE customer_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  customer_cpf_cnpj TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  -- auth
  access_token TEXT NOT NULL, -- token unico por cliente
  magic_link_token TEXT, -- token para login por link
  magic_link_expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Endpoints publicos (autenticados por token do cliente):**

```
GET  /api/v1/portal/:token/invoices               -- listar titulos do cliente
GET  /api/v1/portal/:token/invoices/:id            -- detalhe do titulo
POST /api/v1/portal/:token/invoices/:id/payment    -- solicitar link de pagamento
POST /api/v1/portal/:token/invoices/:id/negotiate  -- solicitar negociacao
GET  /api/v1/portal/:token/history                  -- historico de pagamentos
GET  /api/v1/portal/:token/clearance-letters        -- cartas de anuencia
```

---

### Feature 18: DDA AUTOMATICO E PRE-CONFIRMACAO

**Justificativa de Negocio:** Alguns clientes pagam via boleto bancario registrado. O DDA permite consultar se o boleto foi pago antes da compensacao oficial (1-2 dias antes). Isso melhora a previsao de caixa e evita cobrar quem ja pagou.

---

### Feature 19: WHATSAPP INTERATIVO COM BOTOES DE ACAO

**Justificativa de Negocio:** Mensagem de texto pura tem taxa de resposta de 15%. Mensagem com botoes interativos (Pagar Agora / Negociar / Falar com Atendente) tem taxa de 45%. A diferenca e brutal.

**Integracao:**
- **ChatGuru/Gupshup**: envio de template messages com botoes (WhatsApp Business API)
- **Botoes disponiveis**: "Pagar via PIX", "Ver boleto", "Negociar", "Ja paguei", "Falar com atendente"
- **Webhook de resposta**: quando o cliente clica, o webhook processa e aciona a acao correspondente

---

### Feature 20: COBRANCA INTELIGENTE POR SAFRA (VINTAGE ANALYSIS)

**Justificativa de Negocio:** Analise de safra mostra que pedidos de dezembro tem 3x mais inadimplencia que pedidos de julho. Ou que clientes adquiridos pelo vendedor X atrasam 2x mais que os do vendedor Y. Isso muda politica comercial.

**Schema:**

```sql
CREATE TABLE vintage_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  cohort_month DATE NOT NULL, -- mes da emissao (safra)
  -- snapshot mensal
  snapshot_month DATE NOT NULL,
  months_since_emission INT,
  -- metricas
  total_issued_count INT,
  total_issued_amount NUMERIC(14,2),
  paid_on_time_count INT,
  paid_on_time_amount NUMERIC(14,2),
  paid_late_count INT,
  paid_late_amount NUMERIC(14,2),
  still_open_count INT,
  still_open_amount NUMERIC(14,2),
  defaulted_count INT,
  defaulted_amount NUMERIC(14,2),
  -- rates
  on_time_rate NUMERIC(5,2),
  late_rate NUMERIC(5,2),
  default_rate NUMERIC(5,2),
  recovery_rate NUMERIC(5,2),
  
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, company_id, cohort_month, snapshot_month)
);
```

---

## 2. FLUXO DE COBRANCA VISUAL -- STATE MACHINE COMPLETO

### Estado: EMITIDO

**Descricao:** Titulo criado no Tiny, sincronizado para o sistema. Ainda nao venceu.

**Acoes automaticas:**
- Sincronizar dados do titulo (valor, vencimento, cliente, pedido vinculado)
- Calcular payment_score do cliente (se nao existir)
- Classificar segmento do cliente
- Gerar predicao de inadimplencia
- Selecionar cadencia de cobranca adequada ao segmento

**Condicao de transicao:**
- Para PRE_VENCIMENTO: quando faltam 3 dias uteis para o vencimento
- Para BAIXADO: se pagamento detectado antes do vencimento

**Timeout:** Nenhum (aguarda data)

---

### Estado: PRE_VENCIMENTO

**Descricao:** Faltam 1-3 dias uteis para o vencimento. Momento do lembrete gentil.

**Acoes automaticas:**
- Enviar lembrete via canal preferido do cliente (WhatsApp ou Email)
- Incluir link de pagamento (PIX + Boleto)
- Se predicao de inadimplencia > 0.70: enviar mensagem com tom mais urgente
- Se cliente VIP: pular este estado (nao incomodar)

**Canal:** WhatsApp (primario) ou Email (secundario)

**Template WhatsApp (PRE_VENCIMENTO):**
> Ola {nome_cliente}! Tudo bem?
>
> Passando para lembrar que o titulo no valor de *R$ {valor}* referente ao pedido *#{numero_pedido}* vence em *{dias_restantes} dia(s)* ({data_vencimento}).
>
> Para sua comodidade, segue o link para pagamento:
> {link_pagamento}
>
> PIX Copia e Cola: {pix_copiaecola}
>
> Qualquer duvida, estamos a disposicao!
> {nome_empresa}

**Condicao de transicao:**
- Para NO_VENCIMENTO: quando data = data_vencimento
- Para BAIXADO: se pagamento detectado

---

### Estado: NO_VENCIMENTO

**Descricao:** Dia do vencimento. Ultimo aviso amigavel.

**Acoes automaticas:**
- Se nao houve lembrete pre-vencimento ou lembrete nao foi lido: enviar aviso
- Se lembrete foi lido mas nao houve pagamento: enviar lembrete breve

**Canal:** WhatsApp (mensagem curta)

**Condicao de transicao:**
- Para GRACE_PERIOD: quando D+1 (proximo dia util)
- Para BAIXADO: se pagamento detectado

---

### Estado: GRACE_PERIOD

**Descricao:** D+1 a D+3. Periodo para compensacao bancaria, feriados, finais de semana. Nenhuma acao agressiva.

**Acoes automaticas:**
- Monitorar pagamentos (reconciliacao automatica)
- Nenhuma mensagem de cobranca enviada
- Se pagamento parcial detectado: registrar e aguardar complemento

**Condicao de transicao:**
- Para COBRANCA_L1: quando D+4 sem pagamento
- Para BAIXADO: se pagamento total detectado

**Timeout:** 3 dias uteis

---

### Estado: COBRANCA_L1 (Cobranca Amigavel)

**Descricao:** D+4 a D+14. Primeira rodada de cobranca ativa.

**Acoes automaticas:**
- D+4: WhatsApp firme mas educado
- D+7: Email formal + WhatsApp follow-up (se nao leu D+4)
- D+10: SMS curto e direto
- D+12: WhatsApp com proposta de negociacao (se regra permite desconto)
- Gerar proposta de negociacao automatica conforme regras

**Canal:** WhatsApp + Email + SMS

**Template WhatsApp (D+4):**
> Ola {nome_cliente},
>
> Identificamos que o titulo no valor de *R$ {valor}* venceu em *{data_vencimento}* e ainda esta em aberto.
>
> Sabemos que imprevistos acontecem. Para facilitar, segue o link para pagamento imediato:
> {link_pagamento}
>
> Caso ja tenha efetuado o pagamento, por favor desconsidere esta mensagem.
>
> Ficamos a disposicao.
> Financeiro {nome_empresa}

**Template WhatsApp (D+7 - urgencia):**
> {nome_cliente}, seu titulo de *R$ {valor}* (pedido #{numero_pedido}) esta vencido ha *{dias_atraso} dias*.
>
> E importante regularizar para evitar restricoes em novos pedidos.
>
> Pague agora: {link_pagamento}
>
> Precisa negociar? Responda esta mensagem.

**Template Email Formal (D+7):**
> Assunto: Aviso de titulo vencido - {nome_empresa} - Pedido #{numero_pedido}
>
> Prezado(a) {nome_cliente},
>
> Informamos que identificamos em nossos registros o(s) seguinte(s) titulo(s) em atraso:
>
> | Titulo | Vencimento | Valor | Dias em Atraso |
> |--------|-----------|-------|----------------|
> | #{numero_titulo} | {data_vencimento} | R$ {valor} | {dias_atraso} |
>
> Solicitamos a regularizacao no prazo de 5 dias uteis para evitar medidas administrativas.
>
> Para pagamento: {link_pagamento}
>
> Caso ja tenha efetuado o pagamento, solicitamos o envio do comprovante para identificacao.
>
> Atenciosamente,
> Departamento Financeiro
> {nome_empresa}
> {telefone} | {email}

**Template SMS (D+10):**
> {nome_empresa}: Titulo R${valor} vencido ha {dias_atraso}d. Pague agora: {link_curto} ou responda JA PAGUEI

**Gate para L2:** Minimo 2 tentativas de contato em canais diferentes, todas sem resposta ou sem pagamento.

**Condicao de transicao:**
- Para COBRANCA_L2: quando D+15 E gate satisfeito
- Para NEGOCIANDO: se cliente respondeu e iniciou negociacao
- Para BAIXADO: se pagamento detectado

---

### Estado: COBRANCA_L2 (Cobranca Firme)

**Descricao:** D+15 a D+29. Escalacao com tom mais formal.

**Acoes automaticas:**
- D+15: WhatsApp com tom de ultima chance + proposta de desconto
- D+18: Ligacao telefonica (task criada para responsavel humano)
- D+22: Email formal com aviso de negativacao iminente
- D+25: WhatsApp final antes de negativacao
- Bloquear novo pedidos no ERP (se regra de bloqueio ativa)
- Notificar vendedor responsavel

**Canal:** WhatsApp + Email + Telefone

**Template WhatsApp (D+15 - ultima chance):**
> {nome_cliente}, esta e uma comunicacao importante.
>
> O titulo de *R$ {valor}* referente ao pedido *#{numero_pedido}* esta vencido ha *{dias_atraso} dias*.
>
> Queremos ajudar a resolver: pagando ate {data_proposta_valida}, oferecemos *{desconto_pct}% de desconto*, ficando em *R$ {valor_com_desconto}*.
>
> Link para pagamento com desconto: {link_pagamento_desconto}
>
> Apos esta data, medidas administrativas serao necessarias.
>
> Financeiro {nome_empresa}

**Template Email (D+22 - Aviso de negativacao):**
> Assunto: URGENTE - Aviso previo de negativacao - {nome_empresa}
>
> Prezado(a) {nome_cliente},
>
> Apesar de nossas tentativas anteriores de contato, o titulo abaixo permanece em aberto:
>
> Titulo: #{numero_titulo}
> Valor: R$ {valor}
> Vencimento: {data_vencimento}
> Dias em atraso: {dias_atraso}
>
> Informamos que, caso a regularizacao nao ocorra em ate 5 dias uteis, seremos obrigados a registrar a pendencia nos orgaos de protecao ao credito (Serasa/SPC), conforme previsto no Codigo de Defesa do Consumidor.
>
> Para evitar esta medida, entre em contato imediatamente ou efetue o pagamento:
> {link_pagamento}
>
> Atenciosamente,
> Departamento Financeiro
> {nome_empresa}

**Gate para L3:** Supervisor deve aprovar escalacao (via dashboard, com um clique).

**Condicao de transicao:**
- Para COBRANCA_L3: quando D+30 E gate aprovado
- Para NEGOCIANDO: se negociacao iniciada
- Para BAIXADO: se pagamento detectado

---

### Estado: COBRANCA_L3 (Pre-Negativacao)

**Descricao:** D+30 a D+59. Ultimo estagio antes da negativacao formal.

**Acoes automaticas:**
- Carta formal digital enviada por email com AR (aviso de recebimento digital)
- Notificacao extrajudicial (se valor justifica)
- Bloqueio total no ERP
- Alerta ao diretor/proprietario

**Gate para NEGATIVACAO:** Gestor financeiro aprova + valor minimo R$500.

**Condicao de transicao:**
- Para NEGATIVACAO: quando D+60 E gate aprovado E valor >= R$500
- Para BAIXADO: se pagamento detectado

---

### Estado: NEGATIVACAO

**Descricao:** D+60 a D+89. Inclusao nos orgaos de protecao ao credito.

**Acoes automaticas:**
- Registrar negativacao no Serasa/SPC via API
- Enviar notificacao ao cliente informando negativacao
- Gerar task para equipe juridica avaliar
- Continuar monitorando pagamentos

**Integracao Serasa:** API de inclusao de negativacao, consulta de status, exclusao apos pagamento.

**Condicao de transicao:**
- Para JURIDICO: quando D+90 E diretor aprova E valor >= R$2.000
- Para BAIXADO: se pagamento detectado (gera carta de anuencia automatica + exclusao Serasa)

---

### Estado: JURIDICO

**Descricao:** D+90+. Encaminhamento para cobranca judicial.

**Acoes automaticas:**
- Gerar dossiê do caso (historico completo de cobranca, provas de entrega, NFs)
- Notificar escritorio juridico (via email ou integracao)
- Suspender cobranca automatizada (evitar prejudicar processo)
- Contabilizar como PDD (Provisao para Devedores Duvidosos)

**Condicao de transicao:**
- Para PERDA: se determinado judicialmente como incobravavel OU aprovacao do diretor
- Para BAIXADO: se pagamento judicial recebido

---

### Estado: NEGOCIANDO

**Descricao:** Cliente respondeu e esta negociando. Fluxo de cobranca pausado.

**Acoes automaticas:**
- Pausar cadencia de cobranca
- Se ha proposta pendente: aguardar resposta por 48h
- Se proposta aceita: gerar novo link de pagamento com condicoes negociadas
- Se proposta expirada: voltar ao estado anterior
- Registrar promessa de pagamento (se houver)

**Condicao de transicao:**
- Para estado_anterior: se negociacao falha ou expira
- Para BAIXADO: se pagamento recebido
- Para PROMESSA: se cliente prometeu data de pagamento

---

### Estado: PROMESSA

**Descricao:** Cliente prometeu pagar em data especifica. Aguardando.

**Acoes automaticas:**
- Lembrete 1 dia antes da data prometida
- Se data passou sem pagamento: registrar "promessa quebrada" e voltar ao fluxo de cobranca
- Cada promessa quebrada reduz payment_score em 5 pontos

**Condicao de transicao:**
- Para COBRANCA_L1/L2/L3: se promessa quebrada (volta para o nivel adequado conforme dias de atraso)
- Para BAIXADO: se pagamento recebido

---

### Estado: BAIXADO

**Descricao:** Pagamento recebido e confirmado. Estado terminal.

**Acoes automaticas:**
- Baixar titulo no Tiny via API V2
- Atualizar payment_score do cliente (positivamente)
- Se estava negativado: iniciar processo de remocao + carta de anuencia
- Registrar metricas de recuperacao
- Calcular comissao do vendedor (se condicionada)
- Enviar agradecimento ao cliente (opcional, configuravel)

---

### Estado: PERDA

**Descricao:** Titulo dado como incobravavel. Estado terminal.

**Acoes automaticas:**
- Contabilizar como perda (write-off)
- Atualizar payment_score do cliente para 0
- Bloquear permanentemente no ERP (ate revisao manual)
- Registrar metricas de perda
- Alimentar modelo preditivo (este perfil e input para prever futuros defaults)

---

## 3. TEMPLATES DE COBRANCA (ja incluidos na secao 2 acima, consolidando aqui os faltantes)

### Template WhatsApp Pre-Vencimento (D-3) -- Tom Gentil

> Ola {nome_cliente}! Tudo bem? 
>
> Este e um lembrete amigavel: o titulo de *R$ {valor}* (pedido #{numero_pedido}) vence em *{data_vencimento}*.
>
> Pague com facilidade:
> PIX: {pix_copiaecola}
> Boleto: {link_boleto}
>
> Qualquer duvida, so responder aqui!
> {nome_empresa}

### Template Email de Negociacao com Proposta de Desconto

> Assunto: Proposta especial para regularizacao - {nome_empresa}
>
> Prezado(a) {nome_cliente},
>
> Sabemos que imprevistos podem dificultar o pagamento em dia. Por isso, preparamos uma condicao especial para regularizar seu titulo em aberto:
>
> **Situacao atual:**
> - Titulo: #{numero_titulo}
> - Valor original: R$ {valor_original}
> - Vencimento: {data_vencimento}
> - Dias em atraso: {dias_atraso}
>
> **Proposta especial (valida ate {data_proposta_valida}):**
> - Valor com desconto: **R$ {valor_com_desconto}** ({desconto_pct}% off)
> - Opcao de parcelamento: ate {max_parcelas}x de R$ {valor_parcela}
>
> Para aproveitar, clique no link abaixo:
> {link_pagamento}
>
> Esta proposta tem validade de {horas_validade} horas.
>
> Atenciosamente,
> Departamento Financeiro
> {nome_empresa}

### Template SMS Curto (D+10)

> {nome_empresa}: Titulo R${valor} vencido {dias_atraso}d. Pague: {link_curto} Duvidas: {telefone}

---

## 4. ARQUITETURA TECNICA CONSOLIDADA

### Tabelas PostgreSQL (Total: 14 novas tabelas)

1. `collection_cadences` -- definicao de sequencias de cobranca
2. `collection_executions` -- execucao ativa de cobranca por titulo
3. `collection_actions` -- cada acao enviada (mensagem, email, etc)
4. `customer_payment_behavior` -- perfil comportamental de pagamento
5. `payment_events` -- eventos de pagamento (timeline)
6. `collection_state_machine` -- estado atual de cobranca por titulo
7. `state_transitions` -- historico de transicoes de estado
8. `negotiation_proposals` -- propostas de negociacao
9. `negotiation_rules` -- regras automaticas de desconto
10. `customer_segments` -- segmentos de cliente
11. `customer_segment_assignments` -- vinculo cliente-segmento
12. `collection_metrics` -- metricas de recuperacao
13. `customer_blocks` -- bloqueios de cliente
14. `customer_portal_access` -- acesso ao portal do cliente
15. `commission_rules` -- regras de comissao
16. `commission_entries` -- lancamentos de comissao
17. `default_predictions` -- predicoes de inadimplencia
18. `vintage_analysis` -- analise de safra
19. `collection_templates` -- templates de mensagem

### Modulos NestJS (6 novos modulos)

```
CollectionModule        -- orquestracao de cobranca, cadencias, execucoes
  CollectionController  -- 12 endpoints
  CollectionService     -- logica de negocio
  OrchestratorProcessor -- BullMQ worker
  SenderProcessor       -- BullMQ worker

CustomerScoreModule     -- score, comportamento, segmentos
  CustomerScoreController -- 8 endpoints
  BehaviorAnalyzerProcessor -- BullMQ worker
  PredictorProcessor    -- BullMQ worker

NegotiationModule       -- propostas, regras, pagamentos
  NegotiationController -- 8 endpoints
  NegotiationService
  PaymentLinkProcessor  -- BullMQ worker

ReceivablesModule       -- aging, metricas, concentracao
  ReceivablesController -- 10 endpoints
  MetricsProcessor      -- BullMQ worker (calculo diario)

CustomerPortalModule    -- portal self-service
  PortalController      -- 7 endpoints publicos
  PortalAuthGuard       -- autenticacao por token

CommissionModule        -- comissoes condicionadas
  CommissionController  -- 5 endpoints
  CommissionProcessor   -- BullMQ worker
```

### BullMQ Queues (8 novas filas)

| Queue | Trigger | Retry | Concurrency | Descricao |
|-------|---------|-------|-------------|-----------|
| collection-orchestrator | Cron 5min | 3x exp | 2 | Avanca state machine, agenda acoes |
| collection-sender | On-demand | 2x | 5 | Envia mensagens (WA/Email/SMS) |
| collection-response | Webhook | 2x | 3 | Processa respostas de clientes |
| behavior-analyzer | Cron diario 02:00 | 1x | 1 | Recalcula scores e comportamentos |
| default-predictor | Cron diario 06:00 | 1x | 1 | Predicoes de inadimplencia |
| payment-link-gen | On-demand | 2x | 5 | Gera PIX/Boleto |
| payment-webhook | Webhook | 3x | 3 | Processa confirmacao de pagamento |
| metrics-calculator | Cron diario 03:00 | 1x | 1 | Calcula metricas de recuperacao |

### Integracoes Externas

| Sistema | Tipo | Uso |
|---------|------|-----|
| Tiny ERP V2 | REST API | Baixa de CR, consulta de pedidos |
| ChatGuru/Gupshup | REST + Webhook | Envio/recebimento WhatsApp |
| Resend | REST | Envio de emails transacionais |
| SMS Provider (Twilio/Zenvia) | REST | Envio de SMS |
| Pagar.me | REST + Webhook | Geracao PIX/Boleto + confirmacao |
| Serasa/SPC | REST | Negativacao/consulta/exclusao |
| Banco (Sicoob) | REST/API | PIX API para QR dinamico |

### Webhooks Recebidos

```
POST /webhooks/whatsapp/message    -- mensagem recebida do cliente
POST /webhooks/whatsapp/status     -- status de entrega (sent/delivered/read)
POST /webhooks/payment/pix         -- confirmacao de pagamento PIX
POST /webhooks/payment/boleto      -- confirmacao de pagamento boleto
POST /webhooks/tiny/cr-update      -- atualizacao de CR no Tiny (se configurado)
```

---

## 5. MICRO-INTERACOES E UX -- 5 INTERACOES CRITICAS

### Interacao 1: DASHBOARD DE AGING COM DRILL-DOWN

**State Machine UI:**
```
OVERVIEW -> HOVER_BAR -> CLICK_BAR -> DRILL_DOWN_LIST -> CLICK_CUSTOMER -> CUSTOMER_DETAIL
```

**Specs de animacao:**
- Barras de aging: Framer Motion `layoutId` para transicao suave entre visualizacoes
- Hover em barra: scale(1.02) + tooltip com valor/quantidade + 150ms ease-out
- Click em barra: barra expande para ocupar largura total (300ms spring) + lista de titulos slide-up abaixo
- Drill-down: lista aparece com stagger de 30ms por item, fade-in + translateY(8px)
- Click em cliente: sheet lateral 480px slide-in da direita (250ms ease-out) com historico completo

**Cores das faixas:**
```
A vencer:    hsl(210, 90%, 55%)  -- azul
1-7 dias:    hsl(45, 93%, 55%)   -- amarelo
8-14 dias:   hsl(30, 90%, 55%)   -- laranja claro
15-30 dias:  hsl(15, 85%, 55%)   -- laranja escuro
31-60 dias:  hsl(0, 84%, 60%)    -- vermelho
61-90 dias:  hsl(0, 70%, 45%)    -- vermelho escuro
90+ dias:    hsl(0, 50%, 30%)    -- vermelho muito escuro (quase perda)
```

### Interacao 2: TIMELINE DE COBRANCA POR TITULO

**State Machine UI:**
```
CLOSED -> HOVER_TITULO -> CLICK_TITULO -> TIMELINE_EXPANDED -> HOVER_EVENT -> CLICK_EVENT -> EVENT_DETAIL
```

**Specs de animacao:**
- Timeline vertical com dots coloridos por tipo de evento (enviado=blue, entregue=green, lido=purple, respondido=yellow, pago=green-bold)
- Linha conectora entre dots: animated dash (SVG stroke-dasharray) fluindo de cima para baixo
- Cada evento: fade-in staggered 50ms + translateX(-8px)
- Estado atual: dot pulsando (box-shadow scale 2s infinite) + badge com estado
- Hover em evento: card expande 200ms com detalhes (template usado, canal, resposta)
- Transicao de estado: animacao de "gate" (icone de cadeado abrindo) quando aprovado

### Interacao 3: PROPOSTA DE NEGOCIACAO INTERATIVA

**State Machine UI:**
```
VIEW_TITULO -> CLICK_NEGOTIATE -> PROPOSAL_BUILDER -> PREVIEW -> SEND -> AWAITING -> RESPONSE_RECEIVED
```

**Specs de animacao:**
- Modal de negociacao: dialog 560px com slider de desconto (drag interativo)
- Slider atualiza valor em tempo real (numero animando com counting effect 300ms)
- Preview do template: card com borda colorida mostrando exatamente como o cliente vera
- Botao "Enviar Proposta": pulso verde enquanto disponivel, spinner ao clicar
- Status tracker: mini progress bar horizontal (Criada -> Enviada -> Visualizada -> Respondida -> Paga)
- Cada transicao: dot preenche com animacao radial 400ms + confetti sutil quando "Paga"

### Interacao 4: SCORE CARD DO CLIENTE

**State Machine UI:**
```
LIST_VIEW -> HOVER_SCORE -> CLICK_SCORE -> SCORE_DETAIL -> EXPAND_FACTORS
```

**Specs de animacao:**
- Score exibido como gauge circular (SVG arc) com cor gradiente (vermelho->amarelo->verde)
- Animacao de preenchimento: arc cresce de 0 ao valor final em 800ms (ease-out-cubic)
- Abaixo: 5 barras horizontais mostrando fatores (pontualidade, regularidade, etc)
- Cada barra: animacao de preenchimento staggered 100ms
- Tendencia: seta animada (subindo/descendo) com micro-animacao bounce
- Historico: mini sparkline dos ultimos 12 meses de score

### Interacao 5: ENVIO DE COBRANCA EM MASSA

**State Machine UI:**
```
SELECT_FILTER -> PREVIEW_LIST -> CONFIRM -> PROCESSING -> RESULTS
```

**Specs de animacao:**
- Filtro: selectores inline com contagem live ("234 titulos selecionados")
- Preview: tabela virtual com checkbox, total atualiza com counting animation
- Confirm: modal de confirmacao com resumo (quantidade, valor total, canais)
- Processing: progress bar com porcentagem + contador de enviados/erros em tempo real
- Results: summary card com metricas (enviados com sucesso, falhas, custo estimado)
- Toast de sucesso: "234 cobranças enviadas. Custo: R$ 23,40. Previsão de recuperação: R$ 89.500"

---

## 6. SPRINT BREAKDOWN -- 8 SPRINTS DE 2 SEMANAS

### Sprint 1: FOUNDATION -- Schema + State Machine + Sync CR (28 SP)

**Goal:** Criar todas as tabelas, implementar state machine core, conectar com CR existente do Tiny.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-001 | Database Schema -- 14 novas tabelas + RLS + indices | 8 | **Given** migrations executadas, **When** consulto as tabelas, **Then** todas existem com RLS ativo e org_id isolation |
| US-CR-002 | State Machine Service -- transicoes de estado com validacao de gates | 8 | **Given** um CR no estado COBRANCA_L1, **When** tento transicionar para L2 sem gate satisfeito, **Then** recebo erro 422 com mensagem explicativa |
| US-CR-003 | State Machine Auto-Initializer -- ao sincronizar CR do Tiny, criar entrada no state machine | 5 | **Given** um novo CR sincronizado do Tiny, **When** o job de sync completa, **Then** existe uma entrada em collection_state_machine com estado baseado na data de vencimento |
| US-CR-004 | Cadence CRUD -- criar, editar, duplicar, ativar/desativar cadencias | 5 | **Given** uma org com 2 empresas, **When** crio uma cadencia com 5 steps, **Then** ela aparece na listagem e pode ser editada |
| US-CR-005 | State Transition History -- registrar toda transicao com metadata | 2 | **Given** um titulo que transiciona de L1 para L2, **When** consulto o historico, **Then** vejo trigger, timestamp, actor, e metadata completa |

**Demo:** Mostrar CR sincronizado do Tiny entrando no state machine, visualizar estados, transicionar manualmente, ver historico.

---

### Sprint 2: ORCHESTRATOR + SENDER -- Motor de Cobranca (30 SP)

**Goal:** Motor que avanca state machine automaticamente e envia mensagens.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-006 | Collection Orchestrator Job -- cron 5min que avanca state machines | 8 | **Given** 50 CRs no estado PRE_VENCIMENTO que passaram do timeout, **When** o job roda, **Then** todos transicionam para NO_VENCIMENTO e acoes sao agendadas |
| US-CR-007 | WhatsApp Sender Integration (ChatGuru/Gupshup) | 8 | **Given** uma acao agendada com canal=whatsapp, **When** o sender processa, **Then** a mensagem e enviada via API e o status atualiza para 'sent', e ao receber webhook de entrega atualiza para 'delivered' |
| US-CR-008 | Email Sender Integration (Resend) | 5 | **Given** uma acao com canal=email, **When** o sender processa, **Then** email e enviado com template renderizado e tracking de abertura |
| US-CR-009 | SMS Sender Integration | 3 | **Given** uma acao com canal=sms, **When** o sender processa, **Then** SMS e enviado e custo e registrado |
| US-CR-010 | Response Processor -- webhook de resposta pausa fluxo | 5 | **Given** um cliente que responde "quero negociar" no WhatsApp, **When** o webhook e recebido, **Then** a execucao muda para status 'negotiating' e o fluxo pausa |
| US-CR-011 | Template Engine -- renderizacao de templates com variaveis | 1 | **Given** um template com {nome_cliente} e {valor}, **When** renderizo, **Then** variaveis sao substituidas com dados reais formatados |

**Demo:** Titulo vence, sistema envia WhatsApp automatico, cliente recebe, cliente responde, fluxo pausa.

---

### Sprint 3: CUSTOMER SCORE + SEGMENTATION (24 SP)

**Goal:** Score de pagamento, perfil comportamental, segmentos automaticos.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-012 | Payment Score Calculator | 8 | **Given** um cliente com 20 CRs historicas (15 no prazo, 5 atrasadas), **When** o calculo roda, **Then** o score e ~75 (faixa PRATA) e os fatores estao detalhados |
| US-CR-013 | Behavioral Timing Engine | 5 | **Given** um cliente que pagou os ultimos 8 titulos em terças-feiras entre 9h-11h, **When** analiso o comportamento, **Then** preferred_payment_day_of_week=2 e preferred_payment_hour=10 |
| US-CR-014 | Customer Segments CRUD + Auto-Assignment | 5 | **Given** regras de segmento (VIP: score>=90 E receita>=50k/mes), **When** o job de reclassificacao roda, **Then** clientes que atendem os criterios sao movidos para segmento VIP |
| US-CR-015 | Score Dashboard API + Ranking | 3 | **Given** 100 clientes com scores calculados, **When** consulto GET /scores?sort=asc, **Then** recebo ranking do pior ao melhor com drill-down |
| US-CR-016 | Default Prediction Engine (v1 Heuristic) | 3 | **Given** um CR de R$30k vencendo em 3 dias para cliente com score=35, **When** o predictor roda, **Then** gera predicao com probabilidade >= 0.70 e recomenda acao 'early_reminder' |

**Demo:** Ver ranking de clientes por score, drill-down em perfil comportamental, ver predicao de inadimplencia para titulos proximos do vencimento.

---

### Sprint 4: NEGOCIACAO + PAGAMENTO (26 SP)

**Goal:** Propostas de desconto automaticas, geracao de PIX/Boleto, webhook de pagamento.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-017 | Negotiation Rules Engine | 5 | **Given** regras (5% desconto se 15-30 dias atraso, 3% se 7-14), **When** um titulo atinge D+15, **Then** proposta e gerada automaticamente com 5% de desconto |
| US-CR-018 | PIX QR Code Generation (Pagar.me ou Sicoob API) | 8 | **Given** uma proposta de R$ 4.750 aceita, **When** gero link de pagamento, **Then** PIX QR dinamico e criado com txid rastreavel e payload copia-e-cola |
| US-CR-019 | Boleto Generation | 5 | **Given** uma proposta, **When** solicito boleto, **Then** boleto registrado e gerado com URL e codigo de barras |
| US-CR-020 | Payment Webhook Processor | 5 | **Given** um PIX pago com txid=ABC123, **When** webhook e recebido, **Then** proposta atualiza para 'paid', state machine transiciona para BAIXADO, e baixa no Tiny e executada |
| US-CR-021 | Auto-Baixa no Tiny ao confirmar pagamento | 3 | **Given** um pagamento confirmado via webhook, **When** o processor roda, **Then** a baixa e executada via Tiny API V2 com data e valor corretos |

**Demo:** Titulo vencido recebe proposta de desconto automatica via WhatsApp, cliente clica no PIX, paga, sistema baixa automaticamente.

---

### Sprint 5: AGING + METRICAS + DASHBOARD (22 SP)

**Goal:** Aging analysis, metricas de recuperacao, dashboard completo.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-022 | Aging Analysis API com drill-down | 5 | **Given** 500 CRs em diversos estados, **When** consulto aging, **Then** recebo distribuicao por faixa com valor total, quantidade, top clientes, e comparacao vs mes anterior |
| US-CR-023 | Collection Metrics Calculator | 5 | **Given** 1 mes de cobrancas, **When** o job de metricas roda, **Then** calcula taxa de recuperacao, custo por recuperacao, ROI, e performance por canal |
| US-CR-024 | Concentration Alert Engine | 3 | **Given** um cliente com 18% do recebivel total, **When** o alerta e verificado, **Then** notificacao AMARELA e gerada (threshold 10%) com detalhes |
| US-CR-025 | Recovery Dashboard UI | 5 | **Given** metricas calculadas, **When** acesso o dashboard, **Then** vejo KPIs (valor recuperado, taxa, ROI), grafico de evolucao, e performance por canal |
| US-CR-026 | Vintage Analysis Job | 4 | **Given** 6 meses de dados, **When** o job de vintage roda, **Then** posso ver que safra de dezembro tem 15% de default vs 5% de julho |

---

### Sprint 6: BLOQUEIO + COMISSAO + PORTAL (24 SP)

**Goal:** Bloqueio inteligente, comissao condicionada, portal do cliente.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-027 | Customer Block Engine | 5 | **Given** um cliente com titulo 35 dias vencido, **When** o orchestrator verifica, **Then** bloqueio automatico e criado e notificacao e enviada |
| US-CR-028 | Commission Rules + Conditional Release | 5 | **Given** uma venda de R$10k com comissao 5%, **When** cliente paga no dia 45 (15 dias atrasado), **Then** comissao e liberada com deducao de 2% (R$400 ao inves de R$500) |
| US-CR-029 | Customer Self-Service Portal -- UI | 8 | **Given** um cliente com token de acesso, **When** acessa o portal, **Then** ve seus titulos, pode gerar segunda via de boleto, e pode iniciar negociacao |
| US-CR-030 | Clearance Letter Generator | 3 | **Given** um titulo negativado que foi pago, **When** a baixa e confirmada, **Then** carta de anuencia PDF e gerada e enviada ao cliente, e exclusao Serasa e solicitada |
| US-CR-031 | Block Override Workflow | 3 | **Given** um cliente bloqueado com pedido urgente, **When** gestor solicita override, **Then** desbloqueio temporario e concedido com justificativa registrada em audit |

---

### Sprint 7: UI COMPLETA + MICRO-INTERACOES (28 SP)

**Goal:** Todas as telas frontend com animacoes.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-032 | Tela de Aging Analysis com drill-down animado | 5 | **Given** dados de aging carregados, **When** clico em uma barra, **Then** ela expande com animacao e mostra lista de titulos com stagger |
| US-CR-033 | Timeline de Cobranca por titulo | 5 | **Given** um titulo com 8 acoes de cobranca, **When** abro o detalhe, **Then** vejo timeline vertical animada com todos os eventos |
| US-CR-034 | Modal de Negociacao com slider de desconto | 5 | **Given** um titulo vencido, **When** clico em negociar, **Then** vejo modal com slider interativo e preview do template |
| US-CR-035 | Score Card visual (gauge + fatores) | 5 | **Given** um cliente com score 73, **When** visualizo o card, **Then** vejo gauge animado + barras de fatores + tendencia |
| US-CR-036 | Envio em massa com progress tracker | 5 | **Given** 200 titulos selecionados, **When** inicio cobranca em massa, **Then** vejo barra de progresso em tempo real com contadores |
| US-CR-037 | Tela do Portal do Cliente (responsiva) | 3 | **Given** um cliente no celular, **When** acessa o portal, **Then** ve interface limpa e responsiva com botoes de acao grandes |

---

### Sprint 8: INTEGRACAO FINAL + TESTES + REFINAMENTO (22 SP)

**Goal:** Testes end-to-end, integracoes finais, refinamentos.

| US | Titulo | SP | AC |
|----|--------|----|----|
| US-CR-038 | Testes E2E do fluxo completo de cobranca | 8 | **Given** um titulo criado, **When** simulo todo o ciclo (emissao -> pre-vencimento -> vencido -> L1 -> L2 -> negociacao -> pagamento -> baixa), **Then** todos os estados transitam corretamente e metricas sao calculadas |
| US-CR-039 | Serasa/SPC Integration (se API disponivel) | 5 | **Given** um titulo em estado NEGATIVACAO, **When** o sistema processa, **Then** registro e enviado ao Serasa e status e confirmado |
| US-CR-040 | Performance tuning -- queries otimizadas para 10k+ CRs | 5 | **Given** 10.000 CRs no sistema, **When** o orchestrator roda, **Then** completa em < 30s com uso de memoria < 256MB |
| US-CR-041 | Documentacao + onboarding de configuracao | 2 | **Given** um novo usuario, **When** acessa o modulo, **Then** wizard de configuracao guia pela criacao de cadencia, regras de desconto, e templates |
| US-CR-042 | Monitoramento + alertas de falha | 2 | **Given** uma falha no envio de WhatsApp, **When** 5 falhas consecutivas ocorrem, **Then** alerta e gerado e fila e pausada para investigacao |

---

## 7. INTELIGENCIA FINANCEIRA

### 7.1 Custo Real da Inadimplencia

O valor que aparece como "a receber" na planilha NAO e o custo real da inadimplencia. O custo real inclui:

**Formula do Custo Real:**

```
CUSTO_REAL_INADIMPLENCIA = 
  VALOR_NOMINAL +                           -- o que o cliente deve
  CUSTO_CAPITAL (valor * taxa_CDI * dias/252) +  -- custo de oportunidade do dinheiro parado
  CUSTO_COBRANCA (mensagens + tempo_equipe * custo_hora) +  -- quanto gastou cobrando
  CUSTO_DESGASTE (probabilidade_perder_cliente * LTV_cliente) + -- valor futuro perdido
  CUSTO_CONTABIL (tempo_conciliacao * custo_hora_contador) +  -- trabalho contabil
  CUSTO_JURIDICO (se aplicavel) +
  CUSTO_PROVISIONAMENTO (impacto no balanco) +
  CUSTO_MENTAL (dificil de quantificar mas real -- desgaste do empresario)
```

**Exemplo pratico para Atacado Neon (R$1M/mes):**
- Se 8% e inadimplencia media: R$80.000/mes em risco
- Custo de capital (CDI 13.75%): R$80k * 13.75%/12 = R$917/mes
- Custo de cobranca (2h/dia de 1 pessoa a R$3k/mes): R$3.000/mes
- Custo contabil: R$1.500/mes em horas de conciliacao
- Total real: R$85.417/mes (6.8% a mais que o valor nominal)
- Em 12 meses: R$1.025.000 de destruicao de valor vs R$960.000 nominal

### 7.2 Precificacao do Risco de Credito

**Modelo:**

```
PRECO_AJUSTADO = PRECO_BASE / (1 - TAXA_DEFAULT_ESPERADA - CUSTO_COBRANCA_PCT)

Exemplo:
  - Produto custa R$100 (preco base com margem 30%)
  - Cliente com score 45 (ATENCAO): taxa default historica 15%
  - Custo de cobranca estimado: 3%
  
  PRECO_AJUSTADO = 100 / (1 - 0.15 - 0.03) = 100 / 0.82 = R$121,95
  
  Ou seja: para manter a margem, esse cliente deveria pagar 22% mais caro.
  Alternativa: prazo menor (a vista com 10% desconto = equivalente a eliminar o risco)
```

**Regras automaticas sugeridas:**
- Score 90-100: prazo normal, desconto por antecipacao 2%
- Score 70-89: prazo normal, sem desconto
- Score 50-69: prazo maximo 30 dias, incremento de 5% no preco a prazo
- Score 30-49: somente a vista ou com garantia
- Score 0-29: venda bloqueada sem autorizacao da diretoria

### 7.3 Dados de Cobranca Alimentando Politica Comercial

O sistema gera insights acionaveis:

**Insight 1 -- Prazo por Perfil:**
"Clientes com prazo > 45 dias tem 3x mais inadimplencia que clientes com prazo < 30 dias. Recomendacao: reduzir prazo padrao de 60 para 30 dias e oferecer desconto de 3% para pagamento antecipado."

**Insight 2 -- Vendedor e Inadimplencia:**
"Vendedor X tem 18% de inadimplencia nos clientes dele vs media de 7% da empresa. 60% dos clientes inadimplentes dele foram prospectados nos ultimos 3 meses (clientes novos). Recomendacao: exigir analise de credito para novos clientes do vendedor X."

**Insight 3 -- Produto e Risco:**
"Produto Y (ticket medio R$15k) tem 22% de inadimplencia vs media de 8%. Hipotese: clientes compram alem da capacidade. Recomendacao: exigir entrada de 30% para pedidos acima de R$10k."

**Insight 4 -- Sazonalidade:**
"Dezembro tem 3x mais inadimplencia. Recomendacao: em novembro/dezembro, reduzir prazos em 15 dias e aumentar rigor de credito."

### 7.4 Cobranca Alimentando Previsao de Caixa

O modulo de cobranca e a fonte de verdade para previsao de recebiveis no fluxo de caixa:

```
PREVISAO_RECEBIMENTO[data] = SUM(
  para cada CR com vencimento na data:
    SE estado = BAIXADO: valor_pago (certeza)
    SE estado = PROMESSA: valor * 0.70 (probabilidade de cumprir)
    SE estado = NEGOCIANDO: valor_proposta * 0.50
    SE estado = EMITIDO e score >= 80: valor * 0.95
    SE estado = EMITIDO e score 50-79: valor * 0.80
    SE estado = EMITIDO e score < 50: valor * 0.50
    SE estado = COBRANCA_L1: valor * 0.60
    SE estado = COBRANCA_L2: valor * 0.30
    SE estado = COBRANCA_L3: valor * 0.15
    SE estado = NEGATIVACAO/JURIDICO: valor * 0.05
)
```

Esta previsao ponderada e MUITO mais precisa que simplesmente somar todos os CRs abertos. O Everton sabe exatamente quanto vai receber na semana -- nao com esperanca, mas com probabilidade matematica baseada em dados reais.

**Endpoint:**

```
GET /api/v1/receivables/cash-forecast?start=2026-04-13&end=2026-05-13
  Response: array diario com valor_previsto, confianca_media, breakdown por faixa de score
```

---

### Critical Files for Implementation

- `C:\CLAUDECODE\CONCILIADOR FINANCEIRO\PRD_BPO_FINANCEIRO.md` -- PRD existente do BPO Financeiro com schema base (tiny_contas_receber), modulos NestJS, e arquitetura BullMQ que sera estendida
- `C:\CLAUDECODE\CONCILIADOR FINANCEIRO\PROCESSOS_FINANCEIRO.md` -- Documentacao dos processos reais do Tiny ERP (baixa de CR via API V2, limitacoes V3) que define as restricoes de integracao
- `C:\CLAUDECODE\DarkSales_CRM_Architecture.md` -- Arquitetura do DarkSales com definicao de WhatsApp (Evolution API + Meta Cloud API), BullMQ workers, e stack tecnologica que sera reusada
- `C:\CLAUDECODE\BusinessAnalytics\src\lib\types.ts` -- Tipos TypeScript existentes (FatoFinanceiro, FatoVendas) que precisam ser estendidos com interfaces de cobranca
- `C:\CLAUDECODE\BusinessAnalytics\src\pages\Financeiro.tsx` -- Pagina financeira existente que serve de referencia para pattern de UI (KpiCard, Recharts, design system)

---


---

# MODULOS DE CADASTRO -- FORNECEDORES, CLIENTES E BANCOS/GATEWAYS

## Plano de Arquitetura Completo para Plataforma BPO Financeiro

---

## 1. VISAO GERAL DA ARQUITETURA

Os tres modulos de cadastro se encaixam na arquitetura existente do PRD (`C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md`) como extensao das 17 tabelas ja definidas. O schema existente ja possui `organizations`, `profiles`, `org_members`, `companies` e `bank_accounts`. Os cadastros de Fornecedores e Clientes serao tabelas novas que espelham os contatos do Tiny ERP e servem como fonte de verdade enriquecida. O cadastro de Bancos/Gateways vai estender a tabela `bank_accounts` existente com campos adicionais.

**Principios de design seguidos:**
- UUID PK, `created_at`, `updated_at`, `deleted_at` (soft delete), `org_id` para multi-tenant -- conforme padrao do PRD
- RLS via `get_org_id()` helper function ja definida no schema DarkSales (`C:/CLAUDECODE/darksales-lovable/supabase/migrations/001_full_schema.sql`, linha 68)
- pg_trgm para busca fuzzy (extensao ja usada no projeto)
- Sync bidirecional com Tiny ERP usando o padrao UPSERT `ON CONFLICT(company_id, tiny_id) DO UPDATE` ja definido no PRD
- Credenciais criptografadas com AES-256-GCM conforme ja definido para `companies`

---

## 2. SCHEMA POSTGRESQL -- CADASTRO DE FORNECEDORES

### 2.1 Tabela principal: `suppliers`

```sql
CREATE TABLE suppliers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  
  -- Tiny ERP mirror fields
  tiny_id           BIGINT,
  tipo_pessoa       TEXT NOT NULL DEFAULT 'J' CHECK (tipo_pessoa IN ('F', 'J')),
  nome              TEXT NOT NULL,
  nome_fantasia     TEXT,
  cpf_cnpj          TEXT NOT NULL,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  rg                TEXT,
  contribuinte_icms TEXT DEFAULT 'nao' CHECK (contribuinte_icms IN ('sim', 'nao', 'isento')),
  
  -- Endereco
  cep               TEXT,
  logradouro        TEXT,
  numero            TEXT,
  complemento       TEXT,
  bairro            TEXT,
  cidade            TEXT,
  uf                TEXT CHECK (uf IS NULL OR length(uf) = 2),
  pais              TEXT DEFAULT 'Brasil',
  ibge_code         TEXT,
  
  -- Contato
  telefone          TEXT,
  celular           TEXT,
  email             TEXT,
  fax               TEXT,
  website           TEXT,
  contato_nome      TEXT,
  contato_cargo     TEXT,
  
  -- Tiny sync
  tiny_tipo         TEXT DEFAULT 'fornecedor',
  tiny_situacao     TEXT DEFAULT 'A' CHECK (tiny_situacao IN ('A', 'I', 'S', 'E')),
  tiny_marcadores   JSONB DEFAULT '[]',
  tiny_observacoes  TEXT,
  last_synced_at    TIMESTAMPTZ,
  raw_tiny_data     JSONB,
  
  -- EXTRAS: Score
  score_total       NUMERIC(5,2) DEFAULT 0 CHECK (score_total >= 0 AND score_total <= 100),
  score_pontualidade NUMERIC(5,2) DEFAULT 0,
  score_qualidade   NUMERIC(5,2) DEFAULT 0,
  score_preco       NUMERIC(5,2) DEFAULT 0,
  score_relacionamento NUMERIC(5,2) DEFAULT 0,
  score_updated_at  TIMESTAMPTZ,
  
  -- EXTRAS: Comercial
  dependencia_percentual NUMERIC(5,2) DEFAULT 0, -- % do total de compras
  total_compras_periodo  NUMERIC(14,2) DEFAULT 0,
  total_compras_lifetime NUMERIC(14,2) DEFAULT 0,
  primeiro_pedido_at     TIMESTAMPTZ,
  ultimo_pedido_at       TIMESTAMPTZ,
  
  -- EXTRAS: Portal
  portal_token       UUID DEFAULT uuid_generate_v4(),
  portal_enabled     BOOLEAN DEFAULT false,
  portal_last_access TIMESTAMPTZ,
  
  -- EXTRAS: Receita Federal
  cnpj_data          JSONB, -- dados completos da consulta CNPJ
  cnpj_consulted_at  TIMESTAMPTZ,
  cnpj_situacao_rf   TEXT, -- ATIVA, BAIXADA, SUSPENSA, INAPTA, NULA
  cnpj_natureza_juridica TEXT,
  cnpj_porte         TEXT,
  cnpj_atividade_principal TEXT,
  
  -- Metadata
  situacao          TEXT DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'inativo', 'bloqueado', 'pendente')),
  tags              JSONB DEFAULT '[]',
  custom_fields     JSONB DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  
  UNIQUE(org_id, cpf_cnpj),
  UNIQUE(company_id, tiny_id)
);

-- Indices
CREATE INDEX idx_suppliers_org ON suppliers(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_company ON suppliers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_cpf_cnpj ON suppliers(org_id, cpf_cnpj);
CREATE INDEX idx_suppliers_nome_trgm ON suppliers USING gin(nome gin_trgm_ops);
CREATE INDEX idx_suppliers_fantasia_trgm ON suppliers USING gin(nome_fantasia gin_trgm_ops);
CREATE INDEX idx_suppliers_score ON suppliers(org_id, score_total DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_situacao ON suppliers(org_id, situacao) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_tiny_id ON suppliers(company_id, tiny_id) WHERE tiny_id IS NOT NULL;
CREATE INDEX idx_suppliers_tags ON suppliers USING gin(tags);

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (org_id = get_org_id());
CREATE POLICY suppliers_insert ON suppliers FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY suppliers_update ON suppliers FOR UPDATE USING (org_id = get_org_id());
CREATE POLICY suppliers_delete ON suppliers FOR DELETE USING (org_id = get_org_id());
```

### 2.2 Tabelas auxiliares de Fornecedor

```sql
-- Condicoes comerciais por fornecedor
CREATE TABLE supplier_commercial_terms (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  descricao         TEXT NOT NULL,
  prazo_pagamento_dias INTEGER DEFAULT 30,
  forma_pagamento   TEXT, -- boleto, pix, transferencia, cartao
  desconto_percentual NUMERIC(5,2) DEFAULT 0,
  desconto_prazo_dias INTEGER, -- desconto para pagamento antecipado
  frete_tipo        TEXT CHECK (frete_tipo IN ('CIF', 'FOB', 'gratis')),
  frete_valor       NUMERIC(10,2),
  pedido_minimo     NUMERIC(14,2),
  moeda             TEXT DEFAULT 'BRL',
  vigencia_inicio   DATE,
  vigencia_fim      DATE,
  is_current        BOOLEAN DEFAULT true,
  observacoes       TEXT,
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_supplier_terms ON supplier_commercial_terms(supplier_id) WHERE deleted_at IS NULL;
ALTER TABLE supplier_commercial_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY sct_select ON supplier_commercial_terms FOR SELECT USING (org_id = get_org_id());
CREATE POLICY sct_insert ON supplier_commercial_terms FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY sct_update ON supplier_commercial_terms FOR UPDATE USING (org_id = get_org_id());
CREATE POLICY sct_delete ON supplier_commercial_terms FOR DELETE USING (org_id = get_org_id());

-- Historico de precos de fornecedor
CREATE TABLE supplier_price_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  produto_servico   TEXT NOT NULL,
  produto_codigo    TEXT,
  unidade           TEXT DEFAULT 'UN',
  preco_anterior    NUMERIC(14,4),
  preco_novo        NUMERIC(14,4) NOT NULL,
  variacao_percentual NUMERIC(7,2),
  data_vigencia     DATE NOT NULL,
  fonte             TEXT DEFAULT 'manual', -- manual, nf_importada, cotacao
  nf_numero         TEXT,
  observacoes       TEXT,
  
  -- Alertas de reajuste
  inflacao_periodo  NUMERIC(5,2), -- IPCA acumulado do periodo
  acima_inflacao    BOOLEAN DEFAULT false,
  alerta_gerado    BOOLEAN DEFAULT false,
  
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sph_supplier ON supplier_price_history(supplier_id, data_vigencia DESC);
CREATE INDEX idx_sph_produto ON supplier_price_history(supplier_id, produto_servico, data_vigencia DESC);
ALTER TABLE supplier_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY sph_select ON supplier_price_history FOR SELECT USING (org_id = get_org_id());
CREATE POLICY sph_insert ON supplier_price_history FOR INSERT WITH CHECK (org_id = get_org_id());

-- Documentos do fornecedor
CREATE TABLE supplier_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  tipo              TEXT NOT NULL CHECK (tipo IN (
    'contrato', 'certidao_negativa', 'comprovante_endereco', 
    'inscricao_estadual', 'alvara', 'fgts', 'inss', 'outro'
  )),
  nome_arquivo      TEXT NOT NULL,
  storage_path      TEXT NOT NULL, -- Supabase Storage path
  mime_type         TEXT,
  tamanho_bytes     BIGINT,
  data_validade     DATE,
  is_expired        BOOLEAN GENERATED ALWAYS AS (data_validade < CURRENT_DATE) STORED,
  observacoes       TEXT,
  uploaded_by       UUID REFERENCES profiles(id),
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_sdocs_supplier ON supplier_documents(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sdocs_expiry ON supplier_documents(data_validade) WHERE deleted_at IS NULL AND data_validade IS NOT NULL;
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdocs_select ON supplier_documents FOR SELECT USING (org_id = get_org_id());
CREATE POLICY sdocs_insert ON supplier_documents FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY sdocs_delete ON supplier_documents FOR DELETE USING (org_id = get_org_id());

-- SLA Tracking do fornecedor
CREATE TABLE supplier_sla_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  pedido_referencia TEXT,
  conta_pagar_id    UUID, -- FK para tiny_contas_pagar se existir
  data_pedido       DATE NOT NULL,
  prazo_combinado   DATE NOT NULL,
  data_entrega_real DATE,
  dias_atraso       INTEGER GENERATED ALWAYS AS (
    CASE WHEN data_entrega_real IS NOT NULL 
         THEN GREATEST(0, data_entrega_real - prazo_combinado)
         ELSE NULL END
  ) STORED,
  within_sla        BOOLEAN GENERATED ALWAYS AS (
    CASE WHEN data_entrega_real IS NOT NULL 
         THEN data_entrega_real <= prazo_combinado 
         ELSE NULL END
  ) STORED,
  valor_pedido      NUMERIC(14,2),
  nota_qualidade    INTEGER CHECK (nota_qualidade >= 1 AND nota_qualidade <= 5),
  observacoes       TEXT,
  
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sla_supplier ON supplier_sla_records(supplier_id, data_pedido DESC);
ALTER TABLE supplier_sla_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY sla_select ON supplier_sla_records FOR SELECT USING (org_id = get_org_id());
CREATE POLICY sla_insert ON supplier_sla_records FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY sla_update ON supplier_sla_records FOR UPDATE USING (org_id = get_org_id());

-- Dados bancarios do fornecedor (para pagamento)
CREATE TABLE supplier_bank_accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  banco_nome        TEXT NOT NULL,
  banco_codigo      TEXT,
  agencia           TEXT,
  conta             TEXT,
  tipo_conta        TEXT DEFAULT 'corrente' CHECK (tipo_conta IN ('corrente', 'poupanca')),
  pix_tipo          TEXT CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_chave         TEXT,
  titular           TEXT,
  titular_cpf_cnpj  TEXT,
  is_primary        BOOLEAN DEFAULT false,
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_sba_supplier ON supplier_bank_accounts(supplier_id) WHERE deleted_at IS NULL;
ALTER TABLE supplier_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY sba_select ON supplier_bank_accounts FOR SELECT USING (org_id = get_org_id());
CREATE POLICY sba_insert ON supplier_bank_accounts FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY sba_update ON supplier_bank_accounts FOR UPDATE USING (org_id = get_org_id());
```

**Total de tabelas para Fornecedores: 6** (`suppliers`, `supplier_commercial_terms`, `supplier_price_history`, `supplier_documents`, `supplier_sla_records`, `supplier_bank_accounts`)

---

## 3. SCHEMA POSTGRESQL -- CADASTRO DE CLIENTES

### 3.1 Tabela principal: `customers`

```sql
CREATE TABLE customers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  
  -- Tiny ERP mirror fields (identico ao suppliers em estrutura)
  tiny_id           BIGINT,
  tipo_pessoa       TEXT NOT NULL DEFAULT 'J' CHECK (tipo_pessoa IN ('F', 'J')),
  nome              TEXT NOT NULL,
  nome_fantasia     TEXT,
  cpf_cnpj          TEXT NOT NULL,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  rg                TEXT,
  contribuinte_icms TEXT DEFAULT 'nao' CHECK (contribuinte_icms IN ('sim', 'nao', 'isento')),
  
  -- Endereco
  cep               TEXT,
  logradouro        TEXT,
  numero            TEXT,
  complemento       TEXT,
  bairro            TEXT,
  cidade            TEXT,
  uf                TEXT CHECK (uf IS NULL OR length(uf) = 2),
  pais              TEXT DEFAULT 'Brasil',
  ibge_code         TEXT,
  
  -- Contato
  telefone          TEXT,
  celular           TEXT,
  email             TEXT,
  fax               TEXT,
  website           TEXT,
  contato_nome      TEXT,
  contato_cargo     TEXT,
  
  -- Tiny sync
  tiny_tipo         TEXT DEFAULT 'cliente',
  tiny_situacao     TEXT DEFAULT 'A' CHECK (tiny_situacao IN ('A', 'I', 'S', 'E')),
  tiny_marcadores   JSONB DEFAULT '[]',
  tiny_observacoes  TEXT,
  last_synced_at    TIMESTAMPTZ,
  raw_tiny_data     JSONB,
  
  -- EXTRAS: Score de pagamento
  score_total         NUMERIC(5,2) DEFAULT 0 CHECK (score_total >= 0 AND score_total <= 100),
  score_pontualidade  NUMERIC(5,2) DEFAULT 0,
  score_volume        NUMERIC(5,2) DEFAULT 0,
  score_frequencia    NUMERIC(5,2) DEFAULT 0,
  score_ticket_medio  NUMERIC(5,2) DEFAULT 0,
  score_updated_at    TIMESTAMPTZ,
  
  -- EXTRAS: Credito
  limite_credito       NUMERIC(14,2) DEFAULT 0,
  limite_credito_usado NUMERIC(14,2) DEFAULT 0,
  limite_credito_auto  BOOLEAN DEFAULT true, -- calculo automatico baseado no score
  
  -- EXTRAS: Segmentacao
  segmento           TEXT DEFAULT 'D' CHECK (segmento IN ('A', 'B', 'C', 'D')),
  segmento_updated_at TIMESTAMPTZ,
  
  -- EXTRAS: Concentracao
  receita_percentual  NUMERIC(5,2) DEFAULT 0, -- % da receita total
  total_compras_periodo NUMERIC(14,2) DEFAULT 0,
  total_compras_lifetime NUMERIC(14,2) DEFAULT 0,
  ticket_medio        NUMERIC(14,2) DEFAULT 0,
  primeiro_pedido_at  TIMESTAMPTZ,
  ultimo_pedido_at    TIMESTAMPTZ,
  
  -- EXTRAS: Previsao
  proxima_compra_prevista DATE,
  frequencia_media_dias   INTEGER,
  
  -- EXTRAS: Cobranca
  cobranca_canal_preferido TEXT DEFAULT 'whatsapp' CHECK (cobranca_canal_preferido IN ('whatsapp', 'email', 'telefone', 'sms')),
  cobranca_melhor_horario  TEXT, -- ex: "09:00-12:00"
  cobranca_observacoes     TEXT,
  
  -- EXTRAS: Bloqueio
  is_blocked          BOOLEAN DEFAULT false,
  blocked_reason      TEXT,
  blocked_at          TIMESTAMPTZ,
  blocked_by          UUID REFERENCES profiles(id),
  block_rule_id       UUID, -- FK para regra de bloqueio automatico
  block_days_threshold INTEGER DEFAULT 30, -- bloquear se titulo vencido > X dias
  
  -- EXTRAS: Portal
  portal_token        UUID DEFAULT uuid_generate_v4(),
  portal_enabled      BOOLEAN DEFAULT false,
  portal_last_access  TIMESTAMPTZ,
  
  -- EXTRAS: Receita Federal
  cnpj_data           JSONB,
  cnpj_consulted_at   TIMESTAMPTZ,
  cnpj_situacao_rf    TEXT,
  cnpj_natureza_juridica TEXT,
  cnpj_porte          TEXT,
  cnpj_atividade_principal TEXT,
  
  -- Metadata
  situacao           TEXT DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'inativo', 'bloqueado', 'pendente')),
  tags               JSONB DEFAULT '[]',
  custom_fields      JSONB DEFAULT '{}',
  created_by         UUID REFERENCES profiles(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  
  UNIQUE(org_id, cpf_cnpj),
  UNIQUE(company_id, tiny_id)
);

-- Indices (mesmo padrao do suppliers)
CREATE INDEX idx_customers_org ON customers(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_company ON customers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_cpf_cnpj ON customers(org_id, cpf_cnpj);
CREATE INDEX idx_customers_nome_trgm ON customers USING gin(nome gin_trgm_ops);
CREATE INDEX idx_customers_fantasia_trgm ON customers USING gin(nome_fantasia gin_trgm_ops);
CREATE INDEX idx_customers_score ON customers(org_id, score_total DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_segmento ON customers(org_id, segmento) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_situacao ON customers(org_id, situacao) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_blocked ON customers(org_id) WHERE is_blocked = true AND deleted_at IS NULL;
CREATE INDEX idx_customers_tiny_id ON customers(company_id, tiny_id) WHERE tiny_id IS NOT NULL;
CREATE INDEX idx_customers_tags ON customers USING gin(tags);

-- RLS (mesmo padrao)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_select ON customers FOR SELECT USING (org_id = get_org_id());
CREATE POLICY customers_insert ON customers FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY customers_update ON customers FOR UPDATE USING (org_id = get_org_id());
CREATE POLICY customers_delete ON customers FOR DELETE USING (org_id = get_org_id());
```

### 3.2 Tabelas auxiliares de Cliente

```sql
-- Aging de titulos do cliente (view materializada, nao tabela)
CREATE MATERIALIZED VIEW mv_customer_aging AS
SELECT
  c.org_id,
  c.id AS customer_id,
  c.cpf_cnpj,
  c.nome,
  COUNT(*) FILTER (WHERE cr.data_vencimento >= CURRENT_DATE) AS titulos_a_vencer,
  COUNT(*) FILTER (WHERE CURRENT_DATE - cr.data_vencimento BETWEEN 1 AND 30) AS vencidos_1_30,
  COUNT(*) FILTER (WHERE CURRENT_DATE - cr.data_vencimento BETWEEN 31 AND 60) AS vencidos_31_60,
  COUNT(*) FILTER (WHERE CURRENT_DATE - cr.data_vencimento BETWEEN 61 AND 90) AS vencidos_61_90,
  COUNT(*) FILTER (WHERE CURRENT_DATE - cr.data_vencimento > 90) AS vencidos_90_plus,
  COALESCE(SUM(cr.valor) FILTER (WHERE cr.data_vencimento >= CURRENT_DATE), 0) AS valor_a_vencer,
  COALESCE(SUM(cr.valor) FILTER (WHERE CURRENT_DATE - cr.data_vencimento BETWEEN 1 AND 30), 0) AS valor_1_30,
  COALESCE(SUM(cr.valor) FILTER (WHERE CURRENT_DATE - cr.data_vencimento BETWEEN 31 AND 60), 0) AS valor_31_60,
  COALESCE(SUM(cr.valor) FILTER (WHERE CURRENT_DATE - cr.data_vencimento BETWEEN 61 AND 90), 0) AS valor_61_90,
  COALESCE(SUM(cr.valor) FILTER (WHERE CURRENT_DATE - cr.data_vencimento > 90), 0) AS valor_90_plus,
  COALESCE(SUM(cr.valor) FILTER (WHERE cr.situacao = 'aberto'), 0) AS total_em_aberto
FROM customers c
LEFT JOIN tiny_contas_receber cr ON cr.fornecedor_cpf_cnpj = c.cpf_cnpj 
  AND cr.situacao = 'aberto'
  AND cr.org_id = c.org_id
WHERE c.deleted_at IS NULL
GROUP BY c.org_id, c.id, c.cpf_cnpj, c.nome;

CREATE UNIQUE INDEX idx_mv_aging ON mv_customer_aging(org_id, customer_id);
-- Refresh via cron: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_aging;

-- Historico de interacoes de cobranca
CREATE TABLE customer_collection_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  canal             TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'telefone', 'sms', 'portal', 'presencial')),
  tipo              TEXT NOT NULL CHECK (tipo IN ('cobranca', 'negociacao', 'promessa', 'pagamento_parcial', 'contestacao')),
  titulo_referencia TEXT,
  valor_cobrado     NUMERIC(14,2),
  resultado         TEXT CHECK (resultado IN ('contato_feito', 'sem_resposta', 'promessa_pagamento', 'recusa', 'pagamento_efetuado', 'renegociado')),
  data_promessa     DATE,
  observacoes       TEXT,
  atendente_id      UUID REFERENCES profiles(id),
  
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cch_customer ON customer_collection_history(customer_id, created_at DESC);
ALTER TABLE customer_collection_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY cch_select ON customer_collection_history FOR SELECT USING (org_id = get_org_id());
CREATE POLICY cch_insert ON customer_collection_history FOR INSERT WITH CHECK (org_id = get_org_id());

-- Regras de bloqueio automatico
CREATE TABLE customer_block_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  nome              TEXT NOT NULL,
  dias_atraso_minimo INTEGER NOT NULL DEFAULT 30,
  valor_minimo_aberto NUMERIC(14,2) DEFAULT 0,
  segmentos_afetados TEXT[] DEFAULT '{"A","B","C","D"}',
  acao              TEXT DEFAULT 'bloquear' CHECK (acao IN ('bloquear', 'alertar', 'restringir_credito')),
  is_active         BOOLEAN DEFAULT true,
  auto_desbloqueio  BOOLEAN DEFAULT true, -- desbloqueia quando regulariza
  notificar_vendedor BOOLEAN DEFAULT true,
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customer_block_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY cbr_select ON customer_block_rules FOR SELECT USING (org_id = get_org_id());
CREATE POLICY cbr_insert ON customer_block_rules FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY cbr_update ON customer_block_rules FOR UPDATE USING (org_id = get_org_id());
```

**Total de tabelas para Clientes: 4** (`customers`, `customer_collection_history`, `customer_block_rules`, + 1 materialized view `mv_customer_aging`)

---

## 4. SCHEMA POSTGRESQL -- CADASTRO DE BANCOS/GATEWAYS

O PRD existente ja tem `bank_accounts` com campos basicos. A estrategia aqui e **estender** essa tabela com colunas adicionais e criar tabelas auxiliares, sem quebrar a compatibilidade existente.

### 4.1 Extensao da tabela `bank_accounts`

```sql
-- ALTER TABLE para adicionar campos extras ao bank_accounts existente
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS sub_type TEXT DEFAULT 'banco' 
    CHECK (sub_type IN ('banco', 'gateway', 'fintech', 'carteira_digital', 'caixa')),
  ADD COLUMN IF NOT EXISTS banco_codigo TEXT,
  ADD COLUMN IF NOT EXISTS agencia TEXT,
  ADD COLUMN IF NOT EXISTS conta_numero TEXT,
  ADD COLUMN IF NOT EXISTS conta_digito TEXT,
  ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_atual NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'BRL',
  
  -- Custos por transacao
  ADD COLUMN IF NOT EXISTS custo_ted NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_pix NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_boleto_emissao NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_boleto_liquidacao NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_cartao_debito NUMERIC(5,2) DEFAULT 0, -- %
  ADD COLUMN IF NOT EXISTS taxa_cartao_credito NUMERIC(5,2) DEFAULT 0, -- %
  ADD COLUMN IF NOT EXISTS taxa_antecipacao NUMERIC(5,2) DEFAULT 0, -- %
  
  -- Horarios de corte
  ADD COLUMN IF NOT EXISTS horario_corte_ted TIME,
  ADD COLUMN IF NOT EXISTS horario_corte_boleto TIME,
  ADD COLUMN IF NOT EXISTS pix_24h BOOLEAN DEFAULT true,
  
  -- Limites
  ADD COLUMN IF NOT EXISTS limite_diario_ted NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS limite_diario_pix NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS limite_noturno_pix NUMERIC(14,2),
  
  -- Credenciais (AES-256-GCM encrypted, padrao do PRD)
  ADD COLUMN IF NOT EXISTS api_credentials_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS api_credentials_iv BYTEA,
  ADD COLUMN IF NOT EXISTS oauth_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS oauth_expires_at TIMESTAMPTZ,
  
  -- Status de conexao
  ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'disconnected' 
    CHECK (connection_status IN ('connected', 'degraded', 'disconnected', 'error')),
  ADD COLUMN IF NOT EXISTS connection_last_check TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connection_error_message TEXT,
  ADD COLUMN IF NOT EXISTS connection_error_count INTEGER DEFAULT 0,
  
  -- Extrato automatico
  ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_sync_interval_hours INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS last_statement_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_statement_balance NUMERIC(14,2),
  
  -- Open Finance / OFX
  ADD COLUMN IF NOT EXISTS open_finance_consent_id TEXT,
  ADD COLUMN IF NOT EXISTS open_finance_status TEXT,
  ADD COLUMN IF NOT EXISTS ofx_folder_path TEXT,
  
  -- Metadata extra
  ADD COLUMN IF NOT EXISTS cor TEXT DEFAULT '#3ab4f2',
  ADD COLUMN IF NOT EXISTS icone TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indices novos
CREATE INDEX IF NOT EXISTS idx_ba_connection ON bank_accounts(org_id, connection_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ba_sub_type ON bank_accounts(org_id, sub_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ba_auto_sync ON bank_accounts(auto_sync_enabled, auto_sync_interval_hours) 
  WHERE auto_sync_enabled = true AND deleted_at IS NULL;
```

### 4.2 Tabelas auxiliares de Bancos/Gateways

```sql
-- Regras de roteamento de pagamento
CREATE TABLE payment_routing_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id   UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  
  nome              TEXT NOT NULL,
  prioridade        INTEGER NOT NULL DEFAULT 10,
  tipo_pagamento    TEXT NOT NULL CHECK (tipo_pagamento IN ('ted', 'pix', 'boleto', 'cartao', 'debito_automatico')),
  valor_minimo      NUMERIC(14,2),
  valor_maximo      NUMERIC(14,2),
  categoria         TEXT, -- categoria Tiny
  fornecedor_pattern TEXT, -- regex para nome do fornecedor
  dia_semana        INTEGER[], -- 0=dom, 1=seg...6=sab
  horario_inicio    TIME,
  horario_fim       TIME,
  is_active         BOOLEAN DEFAULT true,
  razao             TEXT, -- por que esta regra existe
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prr_org ON payment_routing_rules(org_id, prioridade) WHERE is_active = true;
ALTER TABLE payment_routing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY prr_select ON payment_routing_rules FOR SELECT USING (org_id = get_org_id());
CREATE POLICY prr_insert ON payment_routing_rules FOR INSERT WITH CHECK (org_id = get_org_id());
CREATE POLICY prr_update ON payment_routing_rules FOR UPDATE USING (org_id = get_org_id());

-- Historico de saldos (para graficos de evolucao)
CREATE TABLE bank_balance_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id   UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  
  data_referencia   DATE NOT NULL,
  saldo_abertura    NUMERIC(14,2),
  saldo_fechamento  NUMERIC(14,2),
  total_entradas    NUMERIC(14,2) DEFAULT 0,
  total_saidas      NUMERIC(14,2) DEFAULT 0,
  qtd_transacoes    INTEGER DEFAULT 0,
  fonte             TEXT DEFAULT 'calculated', -- calculated, ofx, api, manual
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(bank_account_id, data_referencia)
);

CREATE INDEX idx_bbh_account ON bank_balance_history(bank_account_id, data_referencia DESC);
ALTER TABLE bank_balance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY bbh_select ON bank_balance_history FOR SELECT USING (org_id = get_org_id());
CREATE POLICY bbh_insert ON bank_balance_history FOR INSERT WITH CHECK (org_id = get_org_id());

-- Health check log (para status de conexao)
CREATE TABLE bank_connection_health (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id   UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  
  check_type        TEXT NOT NULL CHECK (check_type IN ('ping', 'auth', 'balance', 'statement', 'full')),
  status            TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
  latency_ms        INTEGER,
  error_code        TEXT,
  error_message     TEXT,
  details           JSONB,
  
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Particionar por mes se volume alto
CREATE INDEX idx_bch_account ON bank_connection_health(bank_account_id, created_at DESC);
ALTER TABLE bank_connection_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY bch_select ON bank_connection_health FOR SELECT USING (org_id = get_org_id());
CREATE POLICY bch_insert ON bank_connection_health FOR INSERT WITH CHECK (org_id = get_org_id());
```

**Total de tabelas para Bancos/Gateways: 3 novas** (`payment_routing_rules`, `bank_balance_history`, `bank_connection_health`) + extensao do `bank_accounts` existente

---

## 5. ENDPOINTS NestJS -- MODULO FORNECEDORES (`SupplierModule`)

### 5.1 Controller: `SupplierController`

| # | Method | Path | Descricao | Request | Response |
|---|--------|------|-----------|---------|----------|
| 1 | GET | `/api/suppliers` | Listagem paginada com filtros | Query: `?search=&situacao=ativo&segmento=&score_min=&score_max=&company_id=&tags=&page=1&limit=50&sort=nome&order=asc` | `{ data: Supplier[], total: number, page: number, pages: number }` |
| 2 | GET | `/api/suppliers/:id` | Detalhe completo com relacionamentos | Params: id | `{ supplier: Supplier, terms: CommercialTerm[], documents: Document[], sla_summary: SLASummary, recent_transactions: Transaction[], dependency_map: DependencyData }` |
| 3 | POST | `/api/suppliers` | Criar fornecedor | Body: `CreateSupplierDto` (nome, cpf_cnpj obrigatorios) | `{ supplier: Supplier }` |
| 4 | PATCH | `/api/suppliers/:id` | Atualizar fornecedor | Body: `UpdateSupplierDto` (partial) | `{ supplier: Supplier }` |
| 5 | DELETE | `/api/suppliers/:id` | Soft delete | Params: id | `{ success: true }` |
| 6 | POST | `/api/suppliers/bulk` | Operacoes em lote | Body: `{ ids: UUID[], action: 'activate'\|'deactivate'\|'delete'\|'tag', tag?: string }` | `{ affected: number, errors: Error[] }` |
| 7 | GET | `/api/suppliers/:id/transactions` | Historico de CPs e pagamentos | Query: `?period=&situacao=&page=1&limit=50` | `{ contas_pagar: CP[], pagamentos: Payment[], total_cp: number, total_pago: number }` |
| 8 | GET | `/api/suppliers/:id/price-history` | Historico de precos | Query: `?produto=&date_from=&date_to=` | `{ prices: PriceHistory[], chart_data: ChartPoint[] }` |
| 9 | POST | `/api/suppliers/:id/price-history` | Registrar preco | Body: `{ produto_servico, preco_novo, data_vigencia }` | `{ price: PriceHistory }` |
| 10 | GET | `/api/suppliers/:id/sla` | SLA tracking | Query: `?period=` | `{ records: SLARecord[], summary: { total, within_sla, avg_delay, score } }` |
| 11 | POST | `/api/suppliers/:id/sla` | Registrar entrega | Body: `{ pedido_ref, prazo_combinado, data_entrega_real, nota_qualidade }` | `{ record: SLARecord }` |
| 12 | POST | `/api/suppliers/:id/documents` | Upload documento | Multipart: file + `{ tipo, data_validade?, observacoes? }` | `{ document: Document }` |
| 13 | DELETE | `/api/suppliers/:id/documents/:docId` | Remover documento | Params | `{ success: true }` |
| 14 | GET | `/api/suppliers/:id/terms` | Condicoes comerciais | - | `{ terms: CommercialTerm[] }` |
| 15 | POST | `/api/suppliers/:id/terms` | Criar condicao comercial | Body: `CreateCommercialTermDto` | `{ term: CommercialTerm }` |
| 16 | PATCH | `/api/suppliers/:id/terms/:termId` | Atualizar condicao | Body: partial | `{ term: CommercialTerm }` |
| 17 | POST | `/api/suppliers/cnpj-lookup` | Consulta CNPJ Receita Federal | Body: `{ cnpj: string }` | `{ data: CNPJData, found: boolean }` |
| 18 | GET | `/api/suppliers/dependency-map` | Mapa de concentracao | Query: `?company_id=&period=` | `{ suppliers: { id, nome, percentual, valor }[], total: number }` |
| 19 | POST | `/api/suppliers/:id/recalculate-score` | Recalcular score | - | `{ score: SupplierScore }` |
| 20 | GET | `/api/suppliers/:id/portal` | Dados do portal do fornecedor | Params: id | `{ portal_url: string, token: string }` |
| 21 | POST | `/api/suppliers/sync-tiny` | Sync com Tiny ERP | Body: `{ company_id, direction: 'pull'\|'push'\|'bidirectional' }` | `{ synced: number, created: number, updated: number, errors: Error[] }` |
| 22 | GET | `/api/suppliers/export` | Export CSV/XLSX | Query: `?format=xlsx&filters=...` | Binary file stream |
| 23 | POST | `/api/suppliers/import` | Import CSV | Multipart: file CSV | `{ imported: number, skipped: number, errors: Error[] }` |
| 24 | GET | `/api/suppliers/alerts` | Alertas de reajuste e documentos vencidos | Query: `?type=reajuste\|documento_vencido\|sla` | `{ alerts: Alert[] }` |

### 5.2 Services

- **SupplierService**: CRUD + busca + bulk operations
- **SupplierScoreService**: Calculo do score (job BullMQ `supplier-score-calc`, roda diariamente)
  - Pontualidade (40% peso): baseado em `supplier_sla_records.within_sla` dos ultimos 12 meses
  - Qualidade (25% peso): media das `nota_qualidade` dos SLA records
  - Preco (20% peso): quanto o fornecedor subiu preco vs IPCA
  - Relacionamento (15% peso): tempo desde `primeiro_pedido_at` + frequencia de pedidos
- **SupplierPriceAlertService**: Compara variacao de preco vs IPCA acumulado, gera alerta se acima
- **SupplierDependencyService**: Calcula % de cada fornecedor sobre total de CPs do periodo
- **SupplierPortalService**: Gera URL com token para portal externo read-only
- **CNPJLookupService**: Integra com API ReceitaWS ou BrasilAPI para consulta CNPJ

---

## 6. ENDPOINTS NestJS -- MODULO CLIENTES (`CustomerModule`)

| # | Method | Path | Descricao |
|---|--------|------|-----------|
| 1 | GET | `/api/customers` | Listagem paginada (mesmos filtros + segmento + is_blocked) |
| 2 | GET | `/api/customers/:id` | Detalhe com aging, score, historico, previsao |
| 3 | POST | `/api/customers` | Criar cliente |
| 4 | PATCH | `/api/customers/:id` | Atualizar |
| 5 | DELETE | `/api/customers/:id` | Soft delete |
| 6 | POST | `/api/customers/bulk` | Operacoes em lote |
| 7 | GET | `/api/customers/:id/transactions` | CRs, recebimentos, devoluces |
| 8 | GET | `/api/customers/:id/aging` | Aging detalhado por faixa |
| 9 | GET | `/api/customers/:id/timeline` | Timeline visual de compras |
| 10 | GET | `/api/customers/:id/prediction` | Previsao de proxima compra |
| 11 | POST | `/api/customers/:id/collection` | Registrar interacao de cobranca |
| 12 | GET | `/api/customers/:id/collection-history` | Historico de cobranca |
| 13 | POST | `/api/customers/:id/block` | Bloquear cliente manualmente |
| 14 | POST | `/api/customers/:id/unblock` | Desbloquear |
| 15 | POST | `/api/customers/:id/recalculate-score` | Recalcular score |
| 16 | POST | `/api/customers/:id/recalculate-credit` | Recalcular limite de credito |
| 17 | GET | `/api/customers/segmentation` | Distribuicao A/B/C/D |
| 18 | GET | `/api/customers/concentration-alert` | Clientes com concentracao > threshold |
| 19 | POST | `/api/customers/cnpj-lookup` | Consulta CNPJ |
| 20 | GET | `/api/customers/:id/portal` | Dados do portal |
| 21 | POST | `/api/customers/sync-tiny` | Sync com Tiny |
| 22 | GET | `/api/customers/export` | Export |
| 23 | POST | `/api/customers/import` | Import CSV |
| 24 | GET | `/api/customers/block-rules` | Regras de bloqueio ativas |
| 25 | POST | `/api/customers/block-rules` | Criar regra de bloqueio |
| 26 | PATCH | `/api/customers/block-rules/:ruleId` | Atualizar regra |
| 27 | POST | `/api/customers/run-block-rules` | Executar regras de bloqueio (BullMQ job) |

### 6.1 Services especificos

- **CustomerScoreService**: Score de pagamento calculado via BullMQ job diario
  - Pontualidade (35%): `COUNT(pagamentos no prazo) / COUNT(total pagamentos)` dos ultimos 12 meses cruzando `tiny_contas_receber` com `data_vencimento` vs `data_pagamento`
  - Volume (25%): percentil do valor total comprado vs base de clientes
  - Frequencia (20%): quantidade de pedidos / meses de relacionamento
  - Ticket medio (20%): comparado com media geral
- **CustomerCreditService**: `limite_credito = score_total * fator_empresa * historico_12m / 12`
  - Se `limite_credito_auto = true`, recalcula automaticamente quando score muda
- **CustomerSegmentationService**: Roda diariamente
  - A: score >= 80 E total_compras_periodo >= percentil 75
  - B: score >= 60 E total_compras_periodo >= percentil 50
  - C: score >= 40 OU total_compras_periodo >= percentil 25
  - D: restante
- **CustomerBlockService**: Roda a cada 6h via BullMQ, aplica regras de `customer_block_rules`
- **CustomerPredictionService**: Regressao simples sobre intervalos entre compras

---

## 7. ENDPOINTS NestJS -- MODULO BANCOS/GATEWAYS (`BankAccountModule`)

| # | Method | Path | Descricao |
|---|--------|------|-----------|
| 1 | GET | `/api/bank-accounts` | Listagem com saldo atual e status conexao |
| 2 | GET | `/api/bank-accounts/:id` | Detalhe com dashboard (saldo, entradas, saidas, projecao) |
| 3 | POST | `/api/bank-accounts` | Criar conta |
| 4 | PATCH | `/api/bank-accounts/:id` | Atualizar |
| 5 | DELETE | `/api/bank-accounts/:id` | Soft delete |
| 6 | GET | `/api/bank-accounts/:id/balance-history` | Historico de saldos |
| 7 | POST | `/api/bank-accounts/:id/check-connection` | Health check manual |
| 8 | GET | `/api/bank-accounts/:id/health-log` | Log de health checks |
| 9 | POST | `/api/bank-accounts/:id/sync-balance` | Sync saldo via API/OFX |
| 10 | POST | `/api/bank-accounts/:id/sync-statement` | Pull extrato |
| 11 | GET | `/api/bank-accounts/:id/dashboard` | KPIs: saldo, entradas, saidas, projecao 30d |
| 12 | GET | `/api/bank-accounts/routing-rules` | Regras de roteamento |
| 13 | POST | `/api/bank-accounts/routing-rules` | Criar regra |
| 14 | PATCH | `/api/bank-accounts/routing-rules/:ruleId` | Atualizar regra |
| 15 | DELETE | `/api/bank-accounts/routing-rules/:ruleId` | Remover regra |
| 16 | POST | `/api/bank-accounts/recommend-route` | Recomenda banco para um pagamento | 
| 17 | GET | `/api/bank-accounts/consolidated` | Saldo consolidado todas as contas |
| 18 | POST | `/api/bank-accounts/:id/credentials` | Salvar credenciais (AES-256-GCM) |
| 19 | POST | `/api/bank-accounts/sync-tiny` | Sync com Tiny |
| 20 | GET | `/api/bank-accounts/cost-comparison` | Comparativo de custos por tipo transacao |

---

## 8. TELAS E UX -- ESPECIFICACAO COMPLETA

### 8.1 Design System (extensao do existente no PRD)

Cores adicionais para cadastros:
```
--supplier-primary:   hsl(27, 87%, 55%)   // laranja (fornecedor)
--customer-primary:   hsl(210, 90%, 55%)  // azul (cliente)  
--bank-primary:       hsl(142, 71%, 45%)  // verde (banco/dinheiro)

--score-excellent:    hsl(142, 71%, 45%)  // 80-100
--score-good:         hsl(198, 80%, 50%)  // 60-79
--score-average:      hsl(45, 93%, 55%)   // 40-59
--score-poor:         hsl(0, 84%, 60%)    // 0-39
```

### 8.2 TELA: Listagem de Fornecedores (`/suppliers`)

**Layout:**
- Header 48px: Titulo "Fornecedores" + badge com contagem total + botao "[+ Novo Fornecedor]" primario + botao "[Import CSV]" outlined + botao "[Export]" ghost
- Filter bar 52px colapsavel: Search input (debounce 300ms, trigram) + Select situacao (Todos/Ativo/Inativo/Bloqueado) + Select company + Score range slider (0-100) + Tags multi-select + botao "Limpar filtros"
- DataTable: Checkbox | Nome (com avatar initials) | CPF/CNPJ (mono, masked) | Cidade/UF | Score (badge colorido com barra radial mini) | Dependencia % (barra horizontal mini) | Situacao (badge) | Ultimo pedido (tempo relativo) | Acoes (dropdown: Editar, Ver, Docs, Portal, Desativar)
- Bulk actions bar (aparece quando seleciona items): "X selecionados" + [Ativar] [Desativar] [Adicionar Tag] [Exportar Selecionados]
- Paginacao: "1-50 de 234" + page size selector 25/50/100 + navegacao

**Micro-interacoes:**
- Hover na row: bg eleva sutil (bg-hover), coluna Acoes aparece
- Score badge: tooltip com breakdown (Pontualidade: 85, Qualidade: 72, Preco: 90, Relacionamento: 65)
- Click no score: mini chart radial expande inline com 4 eixos
- Search com debounce 300ms, highlight do termo encontrado no nome

### 8.3 TELA: Cadastro/Edicao de Fornecedor (`/suppliers/new`, `/suppliers/:id/edit`)

**Layout: Formulario com abas (Tabs)**

**Aba 1: Dados Gerais**
- Campo CNPJ/CPF com mascara, validacao em tempo real (algoritmo CPF/CNPJ no frontend), icone de loading durante consulta, auto-fill dos campos abaixo quando encontrado na Receita
- Toggle Pessoa Fisica / Juridica (muda campos visiveis)
- Campos: Nome/Razao Social*, Fantasia, IE, IM, RG (so PF), Contribuinte ICMS (radio 3 opcoes)
- Alert inline se CNPJ ja cadastrado: "Fornecedor 'ABC Ltda' ja existe com este CNPJ. [Ver cadastro]"
- Dados da Receita Federal: card colapsado mostrando situacao cadastral, natureza juridica, porte, atividade principal, socios. Badge verde "ATIVA" ou vermelho "BAIXADA/INAPTA"

**Aba 2: Endereco**
- Campo CEP com mascara, auto-fill via ViaCEP (debounce 500ms apos 8 digitos)
- Campos: Logradouro*, Numero*, Complemento, Bairro*, Cidade* (auto-fill), UF* (auto-fill), Pais
- Mini mapa (embed Google Maps ou OpenStreetMap) mostrando a localizacao

**Aba 3: Contato**
- Telefone com mascara (XX) XXXX-XXXX ou (XX) XXXXX-XXXX (detecta automaticamente)
- Celular, Email (validacao formato), Fax, Website
- Nome do contato principal, Cargo

**Aba 4: Dados Bancarios**
- Lista de contas bancarias do fornecedor (card por conta)
- Botao [+ Adicionar conta]
- Cada card: Banco, Agencia, Conta, Tipo, PIX tipo + chave, Titular
- Toggle "Conta principal" (so uma por vez)

**Aba 5: Condicoes Comerciais**
- Lista de condicoes com card por condicao
- Botao [+ Nova condicao]
- Campos: Descricao, Prazo pagamento (dias), Forma de pagamento (select), Desconto %, Desconto antecipacao (dias), Frete (CIF/FOB/Gratis), Valor frete, Pedido minimo, Vigencia inicio/fim
- Badge "Vigente" ou "Expirada"

**Aba 6: Observacoes e Tags**
- Textarea observacoes (synca com Tiny)
- Tag input com autocomplete de tags existentes + criar nova
- Custom fields dinamicos (chave/valor)

**Validacoes inline (todas com mensagem abaixo do campo, borda vermelha):**
- CPF: algoritmo dos digitos verificadores
- CNPJ: algoritmo dos digitos verificadores
- CEP: formato XXXXX-XXX, 8 digitos
- Email: regex padrao
- Telefone: formato brasileiro
- IE: validacao por UF (cada estado tem regra diferente)
- CNPJ duplicado: query ao backend em debounce 500ms

**Animacoes Framer Motion:**
- Transicao entre abas: fade 150ms + slide horizontal 8px
- Aparecimento de campos auto-fill CNPJ: stagger 50ms por campo, slide-down 200ms
- Validacao com erro: shake 200ms no campo
- Salvamento: botao loading -> checkmark -> redirect

### 8.4 TELA: Detalhe do Fornecedor (`/suppliers/:id`)

**Layout: Dashboard do fornecedor**

**Header:** Nome + Fantasia + Badge situacao + Badge score (grande, circular, animado) + Acoes: [Editar] [Portal] [Sync Tiny] [Desativar]

**Row 1 - KPIs (4 cards):**
- Score total (gauge circular animado, Framer Motion)
- Total compras 12 meses (valor + tendencia)
- Dependencia % (barra com alerta se > 30%)
- SLA compliance % (verde/amarelo/vermelho)

**Row 2 - Graficos (2 colunas):**
- Esquerda: Grafico de linha "Evolucao de Precos" por produto (Recharts, multi-serie)
- Direita: Grafico de barras "Compras por Mes" ultimos 12 meses

**Row 3 - Score breakdown:**
- 4 barras horizontais animadas (Pontualidade, Qualidade, Preco, Relacionamento)
- Cada uma com valor numerico + cor baseada no score

**Row 4 - Tabs:**
- Tab "Transacoes": DataTable de CPs + pagamentos (ultimos 12m)
- Tab "SLA": DataTable de entregas (prazo combinado vs real, badge verde/vermelho)
- Tab "Precos": Timeline de reajustes com alertas de inflacao
- Tab "Documentos": Grid de docs com badge de validade, upload drag&drop
- Tab "Condicoes": Cards de condicoes vigentes
- Tab "Portal": Link do portal + QR code + preview da view do fornecedor

**Micro-interacoes do Score:**
- Gauge circular: animacao de 0 ate o valor final em 1.2s com easing cubic-bezier(0.34, 1.56, 0.64, 1)
- Mudanca de score: numero antigo faz fade-out, novo faz count-up animado
- Barras de breakdown: fill animado staggered 100ms entre barras

### 8.5 TELA: Listagem de Clientes (`/customers`)

Mesmo padrao da listagem de fornecedores com colunas adicionais:
- Segmento (badge A/B/C/D com cor: A=verde, B=azul, C=amarelo, D=cinza)
- Limite credito (valor + % usado, barra)
- Em aberto (valor total, vermelho se > 0)
- Bloqueado (icone cadeado vermelho se true)

Filtros extras: Segmento multi-select, Bloqueado toggle, Em aberto > valor, Limite credito

### 8.6 TELA: Detalhe do Cliente (`/customers/:id`)

Similar ao fornecedor com diferenciais:

**Row 1 - KPIs:**
- Score pagamento (gauge)
- Limite credito (barra com usado vs disponivel)
- Total em aberto (vermelho se vencido)
- Segmento (badge grande com descricao)

**Row especial - Aging:**
- Barras horizontais empilhadas por faixa: A vencer | 1-30 | 31-60 | 61-90 | 90+
- Cada faixa com cor gradiente (verde -> vermelho)
- Valor em cada faixa
- Animacao de entrada: barras crescem da esquerda staggered

**Row - Previsao IA:**
- Card "Proxima compra prevista: DD/MM/YYYY" com confianca %
- Frequencia media: "A cada X dias"
- Grafico de pontos mostrando datas de compras anteriores + previsao futura (ponto tracejado)

**Tab extra "Cobranca":**
- Canal preferido (icone WhatsApp/Email/Tel)
- Melhor horario
- Timeline de interacoes de cobranca
- Botao [+ Registrar contato]

**Tab extra "Bloqueio":**
- Status atual (badge)
- Regra que causou bloqueio (se automatico)
- Historico de bloqueios/desbloqueios
- Botao manual [Bloquear] / [Desbloquear]
- Config: threshold de dias para bloqueio automatico

### 8.7 TELA: Listagem de Bancos/Gateways (`/bank-accounts`)

**Layout diferente: Grid de cards (nao DataTable)**

Cada card representa uma conta:
- Cor do banco (faixa lateral esquerda)
- Icone do banco/gateway (logo se disponivel)
- Nome da conta + tipo (badge: CC, Poupanca, Gateway, Fintech)
- Saldo atual (valor grande, mono, verde se positivo)
- Status conexao (dot verde/amarelo/vermelho + texto)
- Ultimo sync (tempo relativo)
- Mini sparkline de saldo ultimos 30 dias
- Acoes: [Sync Agora] [Dashboard] [Editar]

**Card consolidado no topo:**
- "Saldo Total: R$ XXX.XXX,XX" (soma de todas as contas)
- Breakdown por tipo (Bancos: R$X, Gateways: R$Y, Fintechs: R$Z)

### 8.8 TELA: Dashboard de Conta Bancaria (`/bank-accounts/:id`)

**Header:** Nome da conta + Banco + Tipo + Status conexao (dot animado) + Saldo atual (grande)

**Row 1 - KPIs:**
- Saldo atual
- Entradas hoje
- Saidas hoje
- Projecao 30 dias (baseada em CPs a vencer + CRs previstas)

**Row 2:**
- Grafico de area "Evolucao do Saldo" (30/60/90 dias) com linha de projecao tracejada
- Grafico de barras "Entradas vs Saidas" por dia/semana

**Row 3:**
- Custos: tabela com custo TED, PIX, Boleto + total gasto em taxas no periodo
- Horarios de corte: visual tipo timeline do dia com marcadores

**Row 4 - Regras de Roteamento:**
- Lista de regras ativas com drag para reordenar prioridade
- Preview: "Para pagamentos de Ted > R$5000 no horario comercial, usar esta conta"

---

## 9. VALIDACOES -- DETALHAMENTO COMPLETO

### 9.1 Validacoes no Frontend (React, executadas em real-time)

**CPF (11 digitos):**
```
1. Remove nao-numericos
2. Rejeita se todos digitos iguais (11111111111)
3. Calcula 1o digito verificador: soma dos 9 primeiros * pesos (10,9,8...2), mod 11
4. Calcula 2o digito verificador: soma dos 10 primeiros * pesos (11,10,9...2), mod 11
5. Compara com digitos 10 e 11
```

**CNPJ (14 digitos):**
```
1. Remove nao-numericos
2. Calcula 1o DV: soma 12 primeiros * pesos (5,4,3,2,9,8,7,6,5,4,3,2), mod 11
3. Calcula 2o DV: soma 13 primeiros * pesos (6,5,4,3,2,9,8,7,6,5,4,3,2), mod 11
4. Compara
```

**CEP:** Mascara XXXXX-XXX, apos 8 digitos chama ViaCEP API `GET https://viacep.com.br/ws/{cep}/json/`. Se retornar `erro: true`, mostra "CEP nao encontrado". Auto-fill: logradouro, bairro, cidade, uf, ibge.

**Email:** Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` + validacao de dominio (MX lookup no backend para cadastros novos).

**Telefone:** Detecta fixo (10 digitos) vs celular (11 digitos, 9o digito = 9). Mascara: (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX.

**IE por estado:** Cada UF tem formato e calculo de DV diferentes. Implementar como modulo separado `ie-validator.ts` com switch por UF. Exemplos:
- SP: 12 digitos, DV na posicao 9 e 12
- RJ: 8 digitos, DV na posicao 8
- MG: 13 digitos, DV na posicao 13

**Duplicata CPF/CNPJ:** No `onBlur` do campo, query ao backend `GET /api/suppliers/check-duplicate?cpf_cnpj=XXX`. Retorna `{ exists: boolean, existing_id?: string, existing_name?: string }`. Se existe, mostra inline alert amarelo com link para o cadastro existente.

### 9.2 Validacoes no Backend (NestJS, class-validator)

```typescript
// CreateSupplierDto
class CreateSupplierDto {
  @IsNotEmpty() @IsString() nome: string;
  @IsNotEmpty() @Matches(/^\d{11}$|^\d{14}$/) cpf_cnpj: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Matches(/^\d{8}$/) cep?: string;
  @IsOptional() @IsIn(['F', 'J']) tipo_pessoa?: string;
  @IsOptional() @IsIn(['sim', 'nao', 'isento']) contribuinte_icms?: string;
  @IsOptional() @Length(2, 2) uf?: string;
  // ... demais campos
}
```

Alem do class-validator, validacoes de negocio no service:
- `validateCpfCnpj()`: algoritmo completo dos DVs
- `checkDuplicate()`: query com `org_id` + `cpf_cnpj`
- `validateIE()`: se contribuinte_icms = 'sim', IE obrigatoria e validada por UF

---

## 10. INTEGRACOES

### 10.1 Receita Federal (Consulta CNPJ)

**Provider:** BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`) como primario + ReceitaWS (`https://receitaws.com.br/v1/cnpj/{cnpj}`) como fallback. Ambos gratuitos com rate limiting.

**Fluxo:**
1. Usuario digita CNPJ no frontend
2. Apos validacao de formato, frontend chama `POST /api/suppliers/cnpj-lookup`
3. Backend tenta BrasilAPI (timeout 5s)
4. Se falha, tenta ReceitaWS (timeout 5s)
5. Se sucesso, retorna dados normalizados
6. Frontend auto-preenche: nome, fantasia, logradouro, numero, complemento, bairro, cidade, uf, cep, telefone, email, situacao_rf, natureza_juridica, porte, atividade_principal
7. Backend salva `cnpj_data` JSONB completo para auditoria

**Cache Redis:** 24h por CNPJ para evitar chamadas repetidas. Key: `cnpj:{cnpj}`.

**Rate limiting:** Max 3 consultas por minuto por usuario. BrasilAPI permite ~5 req/min.

### 10.2 ViaCEP

Chamada direta do frontend: `fetch('https://viacep.com.br/ws/${cep}/json/')`. Sem necessidade de proxy backend. Cache local no sessionStorage por 1h.

### 10.3 Tiny ERP (Sync bidirecional de contatos)

**Pull (Tiny -> Plataforma):**
- Tiny V2: `GET https://api.tiny.com.br/api2/contatos.pesquisa.php?token=X&pagina=1`
- Retorna 100 contatos por pagina com: id, nome, fantasia, cpf_cnpj, tipo_pessoa, situacao, email, fone, endereco
- Para detalhes: `GET /api2/contato.obter.php?token=X&id={tiny_id}`
- UPSERT na tabela local: `INSERT ... ON CONFLICT (company_id, tiny_id) DO UPDATE SET ...`

**Push (Plataforma -> Tiny):**
- Tiny V3: `POST https://erp.tiny.com.br/public-api/v3/contatos` para criar
- Tiny V3: `PUT https://erp.tiny.com.br/public-api/v3/contatos/{id}` para atualizar
- Campos mapeados: nome, fantasia, tipo_pessoa, cpf_cnpj, ie, contribuinte, endereco, contato, tipo

**Conflito de sync:** Se `updated_at` local > `last_synced_at` E Tiny mudou tambem, a plataforma vence (fonte de verdade enriquecida). Flag `sync_conflict: true` para revisao manual.

**BullMQ Job:** `contact-sync` roda a cada 4h (mesmo padrao do PRD para tiny-sync).

### 10.4 Serasa/SPC (futuro)

Interface preparada com `CustomerCreditCheckService` abstrato. Endpoints:
- `POST /api/customers/:id/credit-check` (retorna score Serasa + restricoes)
- Integracao via API Serasa Experian quando contrato assinado
- Resultado salvo em `cnpj_data.serasa` JSONB

### 10.5 Contas bancarias -- Sync Tiny

As contas bancarias do Tiny sao simples: nome, banco, agencia, conta, tipo, saldo_inicial, situacao.
- Pull: `GET /api2/contas.pesquisa.php` (V2) retorna lista de contas
- Push: criacao manual no Tiny nao e suportada via API
- O campo `tiny_conta_origem` em `bank_accounts` ja existe no PRD e mapeia o nome exato da conta no Tiny para operacoes de baixa

---

## 11. SPRINT BREAKDOWN

### Sprint C1: Infraestrutura de Cadastros + Schema (21 SP) -- 2 semanas

**US-C001: Schema de Fornecedores (5 SP)**
- Given o banco de dados Supabase com as 17 tabelas existentes
- When eu executo a migration de fornecedores
- Then as 6 tabelas sao criadas com todos os constraints, indices e RLS policies
- And as tabelas passam nos testes de RLS (usuario A nao ve dados de org B)

**US-C002: Schema de Clientes (5 SP)**
- Given o schema de fornecedores ja criado
- When eu executo a migration de clientes
- Then a tabela customers e auxiliares sao criadas
- And a materialized view mv_customer_aging funciona com dados mock
- And as regras de bloqueio sao configuradas

**US-C003: Extensao de bank_accounts + tabelas auxiliares (3 SP)**
- Given a tabela bank_accounts existente
- When eu executo o ALTER TABLE + CREATE TABLE
- Then os novos campos existem sem quebrar funcionalidades existentes
- And as tabelas de routing_rules e balance_history funcionam

**US-C004: NestJS Module scaffolding (5 SP)**
- Given o projeto NestJS existente
- When eu crio SupplierModule, CustomerModule, BankAccountModule
- Then cada modulo tem Controller, Service, DTOs, Entity
- And os modulos estao registrados no AppModule
- And Swagger documenta todos os endpoints

**US-C005: Validadores compartilhados (3 SP)**
- Given a necessidade de validar CPF, CNPJ, CEP, IE, Email, Telefone
- When eu crio o modulo @common/validators
- Then todos os validadores passam em suite de testes com edge cases
- And o validador de IE cobre ao menos SP, RJ, MG, PR, SC, RS, BA

### Sprint C2: CRUD Fornecedores + Consulta CNPJ (26 SP) -- 2 semanas

**US-C006: CRUD Fornecedor backend (8 SP)**
- Given o SupplierModule scaffolded
- When eu implemento os endpoints 1-6 (listagem, detalhe, criar, atualizar, delete, bulk)
- Then CRUD funciona com validacoes, soft delete, paginacao, busca trigram
- And audit_log registra todas as operacoes

**US-C007: Consulta CNPJ / CEP (5 SP)**
- Given o endpoint cnpj-lookup e a integracao ViaCEP
- When usuario digita CNPJ valido
- Then dados da Receita Federal sao retornados em < 3s
- And resultado e cacheado no Redis por 24h
- And se BrasilAPI falha, ReceitaWS e usado como fallback
- When usuario digita CEP valido
- Then endereco completo e retornado via ViaCEP

**US-C008: Tela de listagem frontend (8 SP)**
- Given os endpoints CRUD funcionando
- When usuario navega para /suppliers
- Then ve DataTable paginada com filtros, busca, bulk actions
- And score aparece como badge colorido com tooltip de breakdown
- And acoes em lote funcionam (ativar, desativar, tag, export)

**US-C009: Tela de cadastro/edicao frontend (5 SP)**
- Given o formulario com 6 abas
- When usuario preenche CNPJ
- Then dados da Receita sao auto-preenchidos com animacao
- When usuario preenche CEP
- Then endereco e auto-preenchido
- When CNPJ ja existe
- Then alerta inline aparece com link para cadastro existente
- When usuario salva
- Then todas as validacoes rodam e erros sao mostrados inline

### Sprint C3: Features extras Fornecedor + CRUD Cliente (26 SP) -- 2 semanas

**US-C010: Score de fornecedor (5 SP)**
- Given os SLA records e price history existem
- When o job BullMQ supplier-score-calc roda
- Then scores sao calculados para todos os fornecedores ativos
- And o gauge animado mostra o score na tela de detalhe

**US-C011: Historico de precos + Alertas de reajuste (5 SP)**
- Given o fornecedor tem historico de precos registrado
- When um preco novo e registrado acima do IPCA acumulado
- Then um alerta de reajuste e gerado
- And o grafico de evolucao de precos mostra a tendencia

**US-C012: SLA tracking + Documentos (5 SP)**
- Given o fornecedor tem entregas registradas
- When eu vejo a aba SLA
- Then vejo tabela de entregas com badge verde/vermelho por prazo
- And o score de pontualidade reflete os dados
- When eu faco upload de documento
- Then arquivo vai para Supabase Storage
- And documentos com validade mostram badge "Vencido" quando expiram

**US-C013: CRUD Cliente backend (8 SP)**
- Given o CustomerModule scaffolded
- When eu implemento todos os endpoints de CRUD
- Then funciona identico ao fornecedor + campos extras (segmento, bloqueio, credito)

**US-C014: Tela de listagem + cadastro de clientes (3 SP)**
- Given endpoints prontos
- When usuario navega para /customers
- Then ve listagem com colunas extras (segmento, bloqueio, em aberto)
- And formulario de cadastro funciona com todas as validacoes

### Sprint C4: Features extras Cliente + Bancos (28 SP) -- 2 semanas

**US-C015: Score de pagamento + Segmentacao automatica (5 SP)**
- Given dados de CRs do Tiny sincronizados
- When o job customer-score-calc roda
- Then scores sao calculados e segmentos A/B/C/D atribuidos
- And limites de credito automaticos sao recalculados

**US-C016: Aging + Bloqueio inteligente (5 SP)**
- Given a materialized view mv_customer_aging atualizada
- When usuario ve detalhe do cliente
- Then aging por faixa aparece com barras coloridas
- When regra de bloqueio e ativada E cliente tem titulo > X dias
- Then cliente e bloqueado automaticamente
- And vendedor recebe notificacao

**US-C017: Previsao de proxima compra (5 SP)**
- Given cliente tem historico de compras com 3+ pedidos
- When sistema calcula previsao
- Then data estimada e confianca sao mostradas
- And grafico de timeline mostra pedidos passados + previsao

**US-C018: Tela detalhe cliente completa (5 SP)**
- Given todos os dados calculados
- When usuario abre /customers/:id
- Then ve dashboard com score, aging, limite credito, previsao, timeline, cobranca

**US-C019: CRUD Bancos/Gateways backend + frontend (8 SP)**
- Given o BankAccountModule com campos estendidos
- When usuario cria conta tipo Gateway (Conta Simples, Pagar.me)
- Then campos especificos aparecem (credenciais, taxas, horarios)
- And credenciais sao salvas com AES-256-GCM
- And status de conexao e testado via health check

### Sprint C5: Integracoes + Portal + Polish (24 SP) -- 2 semanas

**US-C020: Sync bidirecional com Tiny (8 SP)**
- Given configuracao Tiny V2/V3 na empresa
- When usuario clica "Sync Tiny" ou job automatico roda
- Then contatos do Tiny sao importados/atualizados (UPSERT)
- And contatos criados na plataforma sao enviados ao Tiny
- And conflitos sao sinalizados para revisao manual

**US-C021: Regras de roteamento de pagamento (5 SP)**
- Given multiplas contas bancarias cadastradas com custos
- When usuario configura regras de roteamento
- Then sistema recomenda melhor banco para cada pagamento
- And comparativo de custos e exibido

**US-C022: Portal do fornecedor/cliente (5 SP)**
- Given fornecedor/cliente com portal habilitado
- When acessa URL com token
- Then ve status de pagamentos/recebimentos em tela read-only
- And nao precisa de login (token-based)

**US-C023: Dashboard de conta bancaria (3 SP)**
- Given conta com transacoes e saldo
- When usuario abre dashboard da conta
- Then ve KPIs, grafico de saldo, custos, regras

**US-C024: Mapa de dependencia + Concentracao (3 SP)**
- Given fornecedores/clientes com transacoes
- When usuario abre mapa de dependencia
- Then ve treemap ou barras mostrando % de cada um
- And alertas de concentracao (> 30% receita ou compras)

---

## 12. RESUMO QUANTITATIVO

| Item | Fornecedores | Clientes | Bancos/Gateways | Total |
|------|-------------|----------|-----------------|-------|
| Tabelas novas | 6 | 3 + 1 MV | 3 + ALTER | 13 |
| Endpoints | 24 | 27 | 20 | 71 |
| Telas frontend | 3 (lista, form, detalhe) | 3 | 2 (grid, dashboard) | 8 |
| Validadores | 7 compartilhados | - | - | 7 |
| BullMQ jobs | 2 (score, price-alert) | 3 (score, segmentation, block) | 2 (health-check, balance-sync) | 7 |
| Integracoes | BrasilAPI, ViaCEP, Tiny | Tiny, Serasa(futuro) | Tiny, APIs bancarias | 6 |
| Sprints | 5 sprints de 2 semanas = 10 semanas total | | | 125 SP |

---

## 13. DECISOES ARQUITETURAIS CRITICAS

**Por que tabelas separadas `suppliers` e `customers` ao inves de uma unica `contacts`?**
O Tiny ERP usa uma tabela unica "contatos" com campo tipo. Porem, as features extras sao radicalmente diferentes (score de fornecedor vs score de pagamento, SLA vs aging, precos vs segmentacao). Uma tabela unica ficaria com 80+ colunas e queries complexas com CASE WHEN. A separacao permite indices otimizados, DTOs claros, e evolucao independente. O campo `cpf_cnpj` permite cross-reference quando necessario (ex: empresa que e simultaneamente cliente e fornecedor).

**Por que estender `bank_accounts` ao inves de criar tabela nova?**
A tabela `bank_accounts` ja e referenciada por `bank_transactions` (FK), `reconciliations`, e todo o modulo de import OFX. Criar tabela nova quebraria essas FKs. O ALTER TABLE preserva compatibilidade total e permite uso incremental dos novos campos.

**Por que materialized view para aging ao inves de calculo on-the-fly?**
O aging cruza `customers` com `tiny_contas_receber` que pode ter dezenas de milhares de registros. Uma query ao vivo por cliente demoraria 200-500ms. A materialized view, atualizada a cada 15min via pg_cron, permite leitura em < 5ms. O tradeoff e dados com ate 15min de atraso, aceitavel para aging report.

**Por que BullMQ para scores e nao triggers PostgreSQL?**
Triggers seriam invocados a cada INSERT/UPDATE em CPs/CRs, causando recomputo excessivo. O score precisa de dados agregados (ultimos 12 meses), entao faz mais sentido rodar batch diario. BullMQ ja esta no stack e permite retry, monitoring e controle de concorrencia.

---

### Critical Files for Implementation

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md` -- PRD existente que define a arquitetura base, 17 tabelas, 80 endpoints, design system, e padrao multi-tenant que os cadastros devem seguir
- `C:/CLAUDECODE/darksales-lovable/supabase/migrations/001_full_schema.sql` -- Schema de referencia com padrao de organizations, profiles, org_members, get_org_id(), RLS policies, pg_trgm que sera replicado nos cadastros
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` -- Regras de negocio do Tiny ERP (limitacoes V2/V3, formatos de API, campos obrigatorios) que impactam o sync bidirecional de contatos
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/criar_contas_pagar.js` -- Script existente que mostra o padrao de integracao Tiny V3 (headers, auth, formato de request) e o mapeamento de fornecedores/categorias que sera migrado para o SupplierService
- `C:/CLAUDECODE/BusinessAnalytics/src/App.tsx` -- Frontend React existente com padrao de routing, layout, hooks e integracao Supabase que os modulos de cadastro seguirao


---

# PARTE III — BACKBONE OPERACIONAL BPO

> Fechamento Mensal, Workflow Real de BPO, e Portal do Cliente — a fábrica que opera a Ferrari.

---


---

# PROJETO OPERACIONAL BPO FINANCEIRO -- 3 MODULOS CRITICOS

## Premissa de quem ja operou BPO

O PRD existente (343KB, 2109 linhas) e extraordinariamente completo em conciliacao, IA, integracao com Tiny/bancos, e analytics. Mas tem um buraco fatal: trata a operacao como se fosse um software para UM CFO operar SUAS empresas. BPO financeiro e outra coisa. E uma fabrica onde 5, 10, 20 analistas processam 50, 100, 200 empresas simultaneamente, com SLA, deadline, revisao, e um cliente na ponta que nao sabe nada de contabilidade e quer saber "como estou?" sem ligar no WhatsApp.

O PRD atual tem 17 tabelas core + 35 tabelas de features. Os 3 modulos abaixo adicionam 28 tabelas novas que sao a espinha dorsal da operacao BPO.

---

## MODULO 1: FECHAMENTO MENSAL

### 1.1 Justificativa de Negocio

O fechamento mensal e o momento da verdade do BPO. E quando o escritorio entrega valor ou entrega vergonha. Sem um sistema de fechamento estruturado, acontece o seguinte (e quem operou sabe):

- Analista "fecha" o mes mas esqueceu 3 contas sem categoria. Contador descobre no SPED.
- Supervisor aprova fechamento visual ("parece OK") sem checar saldo bancario vs Tiny.
- Cliente liga dia 15 perguntando pelo relatorio de marco. Ninguem sabe se marco ja fechou.
- Alguem edita um lancamento de janeiro em abril. DRE retroativo muda sem ninguem perceber.
- Dois analistas trabalham na mesma empresa sem saber. Um desfaz o que o outro fez.

O fechamento mensal estruturado resolve tudo isso. E o que separa BPO amador de BPO profissional. E a unica feature que faz o escritorio contabil pagar pelo software sem reclamar, porque e a unica que evita retrabalho com o fisco.

### 1.2 Schema PostgreSQL Completo

```sql
-- =============================================================
-- ENUM TYPES
-- =============================================================

CREATE TYPE closing_status AS ENUM (
  'not_started',    -- mes ainda nao iniciou fechamento
  'in_progress',    -- checklist sendo executado
  'pending_review', -- analista finalizou, aguardando supervisor
  'approved',       -- supervisor aprovou, mes travado
  'reopened'        -- reaberto com motivo (auditoria)
);

CREATE TYPE checklist_item_status AS ENUM (
  'ok',             -- verificado e OK
  'pending',        -- pendente de resolucao
  'blocking',       -- impede o fechamento
  'not_applicable', -- nao se aplica a esta empresa
  'skipped'         -- pulado com justificativa
);

CREATE TYPE checklist_item_source AS ENUM (
  'system',  -- verificado automaticamente pelo sistema
  'manual'   -- precisa de verificacao humana
);

CREATE TYPE blocking_issue_type AS ENUM (
  'uncategorized_transaction',  -- lancamento sem categoria
  'missing_document',           -- sem documento/comprovante
  'value_divergence',           -- valor diverge banco vs Tiny
  'balance_mismatch',           -- saldo nao bate
  'unreconciled_account',       -- conta nao conciliada
  'missing_bank_statement',     -- extrato nao importado
  'tax_not_verified',           -- imposto nao conferido
  'payroll_not_validated',      -- folha nao validada
  'other'
);

CREATE TYPE issue_assignee_type AS ENUM (
  'analyst',    -- analista do BPO resolve
  'client',     -- cliente precisa enviar algo
  'accountant', -- contador precisa validar
  'supervisor'  -- supervisor decide
);

-- =============================================================
-- TABELA: monthly_closings
-- Registro principal de fechamento por empresa/mes
-- =============================================================

CREATE TABLE monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  reference_year INTEGER NOT NULL CHECK (reference_year >= 2020 AND reference_year <= 2100),
  reference_month INTEGER NOT NULL CHECK (reference_month >= 1 AND reference_month <= 12),
  
  status closing_status NOT NULL DEFAULT 'not_started',
  progress_percent NUMERIC(5,2) DEFAULT 0.00,
  
  -- Contadores de checklist
  total_items INTEGER DEFAULT 0,
  ok_items INTEGER DEFAULT 0,
  pending_items INTEGER DEFAULT 0,
  blocking_items INTEGER DEFAULT 0,
  
  -- Responsaveis
  assigned_analyst_id UUID REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  
  -- Lock mensal
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES profiles(id),
  
  -- Reabertura
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES profiles(id),
  reopen_reason TEXT,
  reopen_count INTEGER DEFAULT 0,
  
  -- Saldos snapshot no momento do fechamento
  closing_snapshot JSONB, -- {bank_balances: [{account, balance}], tiny_totals: {cp, cr}, reconciliation_rate, ...}
  
  -- Comparativo
  previous_closing_id UUID REFERENCES monthly_closings(id),
  
  -- Relatorio
  report_url TEXT, -- URL do PDF no Supabase Storage
  report_generated_at TIMESTAMPTZ,
  
  -- Notas do analista
  analyst_notes TEXT,
  supervisor_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(company_id, reference_year, reference_month)
);

-- Indices
CREATE INDEX idx_monthly_closings_org ON monthly_closings(org_id);
CREATE INDEX idx_monthly_closings_company_period ON monthly_closings(company_id, reference_year, reference_month);
CREATE INDEX idx_monthly_closings_status ON monthly_closings(status);
CREATE INDEX idx_monthly_closings_analyst ON monthly_closings(assigned_analyst_id);

-- =============================================================
-- TABELA: closing_checklist_templates
-- Templates de checklist reutilizaveis por tipo de empresa
-- =============================================================

CREATE TABLE closing_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  
  items JSONB NOT NULL DEFAULT '[]',
  -- Formato: [{
  --   key: 'reconciliation_complete',
  --   label: 'Conciliacao bancaria completa',
  --   source: 'system',
  --   category: 'conciliacao',
  --   check_function: 'check_reconciliation_rate', -- nome da funcao de verificacao
  --   blocking: true,
  --   order: 1
  -- }]
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_checklist_templates_org ON closing_checklist_templates(org_id);

-- =============================================================
-- TABELA: closing_checklist_items
-- Items do checklist de um fechamento especifico
-- =============================================================

CREATE TABLE closing_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES monthly_closings(id) ON DELETE CASCADE,
  
  template_item_key VARCHAR(100) NOT NULL,
  label VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'conciliacao', 'impostos', 'folha', 'documentos', 'saldos'
  source checklist_item_source NOT NULL,
  is_blocking BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  status checklist_item_status NOT NULL DEFAULT 'pending',
  
  -- Para items automaticos
  check_function VARCHAR(200), -- nome da funcao que verifica
  last_checked_at TIMESTAMPTZ,
  check_result JSONB, -- detalhes da verificacao {passed: bool, details: '...', count: N}
  
  -- Para items manuais
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  
  -- Evidencia
  evidence_urls TEXT[], -- links para documentos/screenshots
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_closing ON closing_checklist_items(closing_id);
CREATE INDEX idx_checklist_items_status ON closing_checklist_items(status);
CREATE INDEX idx_checklist_items_blocking ON closing_checklist_items(closing_id, is_blocking) WHERE status = 'blocking';

-- =============================================================
-- TABELA: closing_blocking_issues
-- Pendencias que impedem o fechamento
-- =============================================================

CREATE TABLE closing_blocking_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES monthly_closings(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES closing_checklist_items(id),
  
  issue_type blocking_issue_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Entidade afetada
  entity_type VARCHAR(50), -- 'bank_transaction', 'tiny_cp', 'tiny_cr', 'bank_account'
  entity_id UUID,
  entity_reference VARCHAR(200), -- ex: 'Pedido #12345', 'Sicoob - Conta 12345'
  
  -- Valor envolvido
  amount NUMERIC(14,2),
  
  -- Atribuicao
  assignee_type issue_assignee_type NOT NULL,
  assignee_id UUID REFERENCES profiles(id),
  assignee_name VARCHAR(200),
  
  -- Prazo
  deadline TIMESTAMPTZ,
  
  -- Resolucao
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'waived')),
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  waived_reason TEXT, -- se pulou a pendencia com justificativa
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocking_issues_closing ON closing_blocking_issues(closing_id);
CREATE INDEX idx_blocking_issues_status ON closing_blocking_issues(status);
CREATE INDEX idx_blocking_issues_assignee ON closing_blocking_issues(assignee_id, status);
CREATE INDEX idx_blocking_issues_deadline ON closing_blocking_issues(deadline) WHERE status IN ('open', 'in_progress');

-- =============================================================
-- TABELA: closing_history
-- Historico imutavel de acoes no fechamento (auditoria)
-- =============================================================

CREATE TABLE closing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES monthly_closings(id),
  
  action VARCHAR(50) NOT NULL, -- 'started', 'item_checked', 'item_failed', 'submitted_review', 'approved', 'rejected', 'reopened', 'locked', 'report_generated'
  actor_id UUID REFERENCES profiles(id),
  actor_type VARCHAR(20) DEFAULT 'user', -- 'user', 'system', 'cron'
  
  details JSONB, -- {item_key, old_status, new_status, reason, ...}
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Particionada por mes para performance
CREATE INDEX idx_closing_history_closing ON closing_history(closing_id, created_at DESC);
CREATE INDEX idx_closing_history_actor ON closing_history(actor_id);

-- =============================================================
-- TABELA: closing_reports
-- Relatorios de fechamento gerados
-- =============================================================

CREATE TABLE closing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID NOT NULL REFERENCES monthly_closings(id),
  
  report_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- 'standard', 'executive', 'detailed', 'comparison'
  
  -- Dados do relatorio (snapshot imutavel)
  report_data JSONB NOT NULL, -- DRE, saldos, metricas, alertas, comparativos
  
  -- PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Compartilhamento
  shared_with_client BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMPTZ,
  shared_by UUID REFERENCES profiles(id),
  
  -- Claude AI narrativa
  ai_executive_summary TEXT,
  ai_highlights TEXT[],
  ai_alerts TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_closing_reports_closing ON closing_reports(closing_id);

-- =============================================================
-- RLS POLICIES
-- =============================================================

ALTER TABLE monthly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_blocking_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_checklist_templates ENABLE ROW LEVEL SECURITY;

-- Todas as tabelas: org_id = get_org_id()
CREATE POLICY "closing_org_isolation" ON monthly_closings
  FOR ALL USING (org_id = get_org_id());

CREATE POLICY "checklist_items_via_closing" ON closing_checklist_items
  FOR ALL USING (
    closing_id IN (SELECT id FROM monthly_closings WHERE org_id = get_org_id())
  );

CREATE POLICY "blocking_issues_via_closing" ON closing_blocking_issues
  FOR ALL USING (
    closing_id IN (SELECT id FROM monthly_closings WHERE org_id = get_org_id())
  );

CREATE POLICY "closing_history_read_only" ON closing_history
  FOR SELECT USING (
    closing_id IN (SELECT id FROM monthly_closings WHERE org_id = get_org_id())
  );
-- INSERT apenas via service_role (backend)

CREATE POLICY "closing_reports_via_closing" ON closing_reports
  FOR ALL USING (
    closing_id IN (SELECT id FROM monthly_closings WHERE org_id = get_org_id())
  );

CREATE POLICY "templates_org_isolation" ON closing_checklist_templates
  FOR ALL USING (org_id = get_org_id());

-- =============================================================
-- FUNCAO: Lock mensal (impede edicao de lancamentos)
-- =============================================================

CREATE OR REPLACE FUNCTION check_month_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_closing_locked BOOLEAN;
BEGIN
  -- Verifica se o mes esta travado para a empresa
  SELECT is_locked INTO v_closing_locked
  FROM monthly_closings
  WHERE company_id = NEW.company_id
    AND reference_year = EXTRACT(YEAR FROM NEW.transaction_date)
    AND reference_month = EXTRACT(MONTH FROM NEW.transaction_date)
    AND is_locked = TRUE;
  
  IF v_closing_locked THEN
    RAISE EXCEPTION 'Mes %/% esta fechado e travado para edicao. Solicite reabertura.',
      EXTRACT(MONTH FROM NEW.transaction_date),
      EXTRACT(YEAR FROM NEW.transaction_date);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger nas tabelas financeiras
CREATE TRIGGER trg_bank_transactions_month_lock
  BEFORE INSERT OR UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION check_month_lock();

CREATE TRIGGER trg_tiny_cp_month_lock
  BEFORE INSERT OR UPDATE ON tiny_contas_pagar
  FOR EACH ROW EXECUTE FUNCTION check_month_lock();

CREATE TRIGGER trg_tiny_cr_month_lock
  BEFORE INSERT OR UPDATE ON tiny_contas_receber
  FOR EACH ROW EXECUTE FUNCTION check_month_lock();
```

### 1.3 State Machine do Fechamento

```
                         ┌──────────────────┐
                         │   not_started    │
                         └────────┬─────────┘
                                  │ analista inicia (POST /closings)
                                  ▼
                         ┌──────────────────┐
            ┌───────────>│   in_progress    │<──────────────┐
            │            └────────┬─────────┘               │
            │                     │ analista submete         │
            │                     │ (0 blocking issues)      │
            │                     ▼                          │
            │            ┌──────────────────┐               │
            │            │ pending_review   │               │
            │            └────────┬─────────┘               │
            │                     │                          │
            │          ┌──────────┼──────────┐              │
            │          │                     │              │
            │    supervisor              supervisor         │
            │    aprova                  rejeita             │
            │          │                     │              │
            │          ▼                     └──────────────┘
            │  ┌──────────────────┐         (volta para in_progress
            │  │    approved      │          com comentarios)
            │  │  (mes TRAVADO)   │
            │  └────────┬─────────┘
            │           │ reabertura com motivo
            │           ▼
            │  ┌──────────────────┐
            └──│    reopened      │
               │ (reopen_count++) │
               └──────────────────┘
```

### 1.4 Endpoints NestJS

```
Modulo: ClosingModule

# Fechamento CRUD
POST   /api/v1/closings                          -- Iniciar fechamento {company_id, year, month}
GET    /api/v1/closings                           -- Listar fechamentos {company_id?, status?, year?}
GET    /api/v1/closings/:id                       -- Detalhe do fechamento
PATCH  /api/v1/closings/:id                       -- Atualizar notas/analista
DELETE /api/v1/closings/:id                       -- Cancelar fechamento (soft delete, so se not_started)

# Checklist
GET    /api/v1/closings/:id/checklist             -- Listar items do checklist
POST   /api/v1/closings/:id/checklist/run         -- Executar verificacoes automaticas (system items)
PATCH  /api/v1/closings/:id/checklist/:itemId     -- Atualizar item manual {status, notes, evidence_urls}
POST   /api/v1/closings/:id/checklist/bulk-verify -- Verificar multiplos items {item_ids[], status}

# Pendencias bloqueantes
GET    /api/v1/closings/:id/issues                -- Listar pendencias {status?, assignee_type?}
POST   /api/v1/closings/:id/issues                -- Criar pendencia manual
PATCH  /api/v1/closings/:id/issues/:issueId       -- Resolver/atualizar pendencia
POST   /api/v1/closings/:id/issues/detect         -- Detectar pendencias automaticamente

# Workflow
POST   /api/v1/closings/:id/submit-review         -- Analista submete para revisao
POST   /api/v1/closings/:id/approve               -- Supervisor aprova (trava o mes)
POST   /api/v1/closings/:id/reject                -- Supervisor rejeita {reason, notes}
POST   /api/v1/closings/:id/reopen                -- Reabrir mes fechado {reason} -- requer role admin/owner
POST   /api/v1/closings/:id/lock                  -- Travar manualmente (sem workflow completo)

# Relatorio
POST   /api/v1/closings/:id/report/generate       -- Gerar relatorio {type: standard|executive|detailed}
GET    /api/v1/closings/:id/report                 -- Obter relatorio mais recente
GET    /api/v1/closings/:id/report/pdf             -- Download PDF
POST   /api/v1/closings/:id/report/share           -- Compartilhar com cliente

# Templates
GET    /api/v1/closing-templates                   -- Listar templates
POST   /api/v1/closing-templates                   -- Criar template
PATCH  /api/v1/closing-templates/:id               -- Editar template

# Historico
GET    /api/v1/closings/:id/history                -- Timeline de acoes
GET    /api/v1/closings/compare                    -- Comparar dois meses {closing_id_a, closing_id_b}

Total: 22 endpoints
```

**Request/Response exemplos criticos:**

```
POST /api/v1/closings
Request: {
  company_id: "uuid",
  reference_year: 2026,
  reference_month: 4,
  template_id: "uuid" // opcional, usa default se nao informar
}
Response 201: {
  id: "uuid",
  status: "in_progress",
  checklist: [
    {key: "reconciliation_complete", label: "Conciliacao bancaria completa", source: "system", status: "pending", is_blocking: true},
    {key: "all_categorized", label: "Todos lancamentos categorizados", source: "system", status: "pending", is_blocking: true},
    {key: "bank_balance_match", label: "Saldo bancario confere", source: "system", status: "pending", is_blocking: true},
    {key: "tax_verified", label: "Impostos conferidos", source: "manual", status: "pending", is_blocking: false},
    {key: "payroll_validated", label: "Folha de pagamento validada", source: "manual", status: "pending", is_blocking: false},
    {key: "pro_labore_ok", label: "Pro-labore lancado", source: "manual", status: "pending", is_blocking: true},
    // ...
  ],
  progress_percent: 0,
  blocking_items: 3,
  total_items: 12
}

POST /api/v1/closings/:id/checklist/run
Response 200: {
  results: [
    {key: "reconciliation_complete", status: "ok", details: {rate: 98.5, total: 200, reconciled: 197, pending: 3}},
    {key: "all_categorized", status: "blocking", details: {uncategorized_count: 7, transactions: [{id, desc, amount}]}},
    {key: "bank_balance_match", status: "ok", details: {bank_balance: 45230.50, tiny_balance: 45230.50, diff: 0}},
    {key: "no_missing_documents", status: "pending", details: {missing_count: 2, transactions: [{id, desc, amount}]}}
  ],
  progress_percent: 58.3,
  auto_created_issues: 2 // pendencias criadas automaticamente
}

POST /api/v1/closings/:id/approve
Request: { supervisor_notes: "Revisado e aprovado. Diferenca de R$0.03 no Sicoob e arredondamento aceitavel." }
Response 200: {
  status: "approved",
  is_locked: true,
  locked_at: "2026-04-13T15:30:00Z",
  report_generation_queued: true // dispara geracao de relatorio em background
}
```

### 1.5 Funcoes de Verificacao Automatica (Check Functions)

```typescript
// src/closing/checks/closing-checks.service.ts

interface CheckResult {
  passed: boolean;
  status: ChecklistItemStatus;
  details: Record<string, any>;
  issues?: CreateBlockingIssueDto[];
}

// Verificacoes automaticas que o sistema roda
const SYSTEM_CHECKS = {
  
  // 1. Taxa de conciliacao >= 98%
  check_reconciliation_rate: async (companyId, year, month): CheckResult => {
    const stats = await getReconciliationStats(companyId, year, month);
    const rate = stats.reconciled / stats.total;
    return {
      passed: rate >= 0.98,
      status: rate >= 0.98 ? 'ok' : rate >= 0.90 ? 'pending' : 'blocking',
      details: { rate: rate * 100, total: stats.total, reconciled: stats.reconciled, pending: stats.pending }
    };
  },

  // 2. Zero lancamentos sem categoria
  check_all_categorized: async (companyId, year, month): CheckResult => {
    const uncategorized = await findUncategorized(companyId, year, month);
    return {
      passed: uncategorized.length === 0,
      status: uncategorized.length === 0 ? 'ok' : 'blocking',
      details: { uncategorized_count: uncategorized.length, transactions: uncategorized.slice(0, 10) },
      issues: uncategorized.map(t => ({
        issue_type: 'uncategorized_transaction',
        title: `Lancamento sem categoria: ${t.description} - R$ ${t.amount}`,
        entity_type: 'bank_transaction',
        entity_id: t.id,
        amount: t.amount,
        assignee_type: 'analyst'
      }))
    };
  },

  // 3. Saldo bancario confere (extrato vs Tiny)
  check_bank_balance_match: async (companyId, year, month): CheckResult => {
    const accounts = await getBankAccounts(companyId);
    const mismatches = [];
    for (const acct of accounts) {
      const bankBalance = await getLastBankBalance(acct.id, year, month);
      const tinyBalance = await getTinyAccountBalance(acct.tiny_conta_origem, year, month);
      if (Math.abs(bankBalance - tinyBalance) > 0.05) {
        mismatches.push({ account: acct.name, bankBalance, tinyBalance, diff: bankBalance - tinyBalance });
      }
    }
    return {
      passed: mismatches.length === 0,
      status: mismatches.length === 0 ? 'ok' : 'blocking',
      details: { accounts_checked: accounts.length, mismatches }
    };
  },

  // 4. Todos os extratos do mes importados
  check_all_statements_imported: async (companyId, year, month): CheckResult => {
    const accounts = await getBankAccounts(companyId);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const missing = [];
    for (const acct of accounts) {
      const lastTxDate = await getLastTransactionDate(acct.id, year, month);
      if (!lastTxDate || lastTxDate.getDate() < lastDayOfMonth - 2) {
        missing.push({ account: acct.name, lastDate: lastTxDate, expected: `${year}-${month}-${lastDayOfMonth}` });
      }
    }
    return {
      passed: missing.length === 0,
      status: missing.length === 0 ? 'ok' : 'blocking',
      details: { missing_statements: missing }
    };
  },

  // 5. Sem lancamentos sem documento/comprovante
  check_no_missing_documents: async (companyId, year, month): CheckResult => {
    const threshold = 500; // acima de R$500 precisa de comprovante
    const missing = await findTransactionsWithoutDocument(companyId, year, month, threshold);
    return {
      passed: missing.length === 0,
      status: missing.length === 0 ? 'ok' : 'pending', // nao bloqueia, mas avisa
      details: { missing_count: missing.length, threshold, transactions: missing.slice(0, 10) }
    };
  },

  // 6. Contas a pagar vencidas nao baixadas
  check_overdue_cp: async (companyId, year, month): CheckResult => {
    const overdue = await findOverdueCPNotPaid(companyId, year, month);
    return {
      passed: overdue.length === 0,
      status: overdue.length === 0 ? 'ok' : 'pending',
      details: { overdue_count: overdue.length, total_amount: overdue.reduce((s, c) => s + c.valor, 0) }
    };
  },

  // 7. Pro-labore lancado
  check_pro_labore: async (companyId, year, month): CheckResult => {
    const proLabore = await findProLaboreTransaction(companyId, year, month);
    return {
      passed: !!proLabore,
      status: proLabore ? 'ok' : 'blocking',
      details: { found: !!proLabore, transaction: proLabore }
    };
  },

  // 8. Sync do Tiny esta atualizado (ultima sync < 24h)
  check_tiny_sync_fresh: async (companyId): CheckResult => {
    const lastSync = await getLastSyncJob(companyId);
    const hoursSinceSync = lastSync ? (Date.now() - lastSync.completed_at.getTime()) / 3600000 : Infinity;
    return {
      passed: hoursSinceSync < 24,
      status: hoursSinceSync < 24 ? 'ok' : hoursSinceSync < 72 ? 'pending' : 'blocking',
      details: { last_sync: lastSync?.completed_at, hours_since: Math.round(hoursSinceSync) }
    };
  }
};
```

### 1.6 UX/Telas

**Tela: Painel de Fechamento (`/closing`)**

Layout: Sidebar esquerda com lista de empresas + status. Area central com o fechamento selecionado.

```
┌─────────────────────────────────────────────────────────────────────┐
│  FECHAMENTO MENSAL                          [Abril 2026 ▼] [◀ ▶]  │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│  EMPRESAS    │  ┌─────────────────────────────────────────────────┐ │
│              │  │  BlueLight Ltda — Abril 2026                    │ │
│  🟢 BlueLight│  │  Status: Em Andamento                          │ │
│  87%         │  │  ████████████░░░░ 87% (10/12 items)            │ │
│              │  │  ⚠️ 1 pendente  🔴 1 bloqueante                │ │
│  🟡 Ind.Neon │  └─────────────────────────────────────────────────┘ │
│  64%         │                                                      │
│              │  CHECKLIST                                           │
│  🔴 Atac.Neon│  ┌──────────────────────────────────────────────┐   │
│  23%         │  │ CONCILIACAO                                   │   │
│              │  │ ✅ Conciliacao bancaria completa (98.5%)      │   │
│  ⚪ Engagge  │  │ ✅ Extratos do mes importados                 │   │
│  Nao iniciado│  │ ✅ Sync Tiny atualizado (2h atras)           │   │
│              │  │ 🔴 7 lancamentos sem categoria — BLOQUEANTE   │   │
│              │  │    [Ver lancamentos] [Atribuir]                │   │
│              │  │                                                │   │
│              │  │ SALDOS                                         │   │
│              │  │ ✅ Saldo Sicoob confere (R$ 45.230,50)       │   │
│              │  │ ✅ Saldo Olist Digital confere                │   │
│              │  │                                                │   │
│              │  │ IMPOSTOS & FOLHA                               │
│              │  │ ⚠️ Impostos — pendente verificacao manual     │   │
│              │  │    [Marcar como verificado] [Nao aplicavel]    │   │
│              │  │ ✅ Folha de pagamento validada                │   │
│              │  │ ✅ Pro-labore lancado                         │   │
│              │  │                                                │   │
│              │  │ DOCUMENTOS                                     │   │
│              │  │ ⚠️ 2 lancamentos >R$500 sem comprovante      │   │
│              │  │    [Solicitar ao cliente]                      │   │
│              │  └──────────────────────────────────────────────┘   │
│              │                                                      │
│              │  ┌────────────────────────────────────────────┐     │
│              │  │ [🔄 Rodar Verificacoes]  [📝 Notas]        │     │
│              │  │ [📤 Submeter para Revisao]                  │     │
│              │  └────────────────────────────────────────────┘     │
│              │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

**Tela: Revisao do Supervisor (`/closing/:id/review`)**

- Dashboard split: esquerda = checklist com drill-down, direita = mini-DRE + saldos + comparativo
- Botoes: [Aprovar e Travar] (verde, com Dialog de confirmacao) / [Rejeitar] (vermelho, com campo de motivo obrigatorio)
- Ao aprovar: animacao de lock (icone de cadeado fecha), toast "Mes travado com sucesso"
- Ao rejeitar: items rejeitados ficam highlighted em vermelho para o analista

**Micro-interacoes:**
- Item de checklist: hover mostra tooltip com detalhes da verificacao
- Click em item automatico: expande com detalhes (ex: lista dos 7 lancamentos sem categoria)
- Click em "Rodar Verificacoes": progress bar animada com cada check sendo executado em sequencia
- Status badge pulsa quando muda (scale 1.1 por 300ms)
- Progresso geral: barra animada com transicao suave (ease-out 400ms)

### 1.7 Sprint Breakdown

**Sprint C1: Schema + CRUD + Checklist Engine (21 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-C01 | Schema de fechamento mensal (6 tabelas + RLS + triggers) | 5 | Given schema migrado, When inserir monthly_closing, Then RLS isola por org_id. Given mes travado, When tentar editar bank_transaction do mes, Then trigger rejeita com erro. |
| US-C02 | CRUD de fechamento (POST/GET/PATCH/DELETE) | 3 | Given empresa sem fechamento de abril, When POST /closings {company_id, year: 2026, month: 4}, Then cria registro com status 'in_progress' e checklist populado do template. Given fechamento ja existe, When POST duplicado, Then retorna 409 Conflict. |
| US-C03 | Templates de checklist (CRUD + items default) | 3 | Given template default criado, When iniciar fechamento sem template_id, Then usa template default. Given template custom, When POST /closings {template_id}, Then popula checklist do template especificado. |
| US-C04 | Check functions automaticas (8 verificacoes) | 8 | Given empresa com 7 lancamentos sem categoria, When POST /closings/:id/checklist/run, Then item 'all_categorized' retorna status 'blocking' com details.uncategorized_count = 7. Given saldo bancario diverge R$500, When rodar check, Then item 'bank_balance_match' retorna 'blocking' com diff. |
| US-C05 | Verificacao manual de items + upload de evidencia | 2 | Given item manual 'tax_verified', When PATCH com status 'ok' e verification_notes, Then item atualiza e progress_percent recalcula. Given upload de evidencia, When PATCH com evidence_urls, Then URLs salvas e acessiveis. |

**Sprint C2: Pendencias + Workflow de Aprovacao (18 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-C06 | CRUD de pendencias bloqueantes | 3 | Given pendencia criada com assignee_type 'client', When GET /issues?assignee_type=client, Then retorna apenas pendencias do cliente. |
| US-C07 | Deteccao automatica de pendencias | 5 | Given 7 lancamentos sem categoria, When POST /closings/:id/issues/detect, Then cria 7 issues tipo 'uncategorized_transaction' atribuidas ao analista. |
| US-C08 | Submit para revisao (validacao: 0 blocking) | 3 | Given 1 blocking issue aberta, When POST /submit-review, Then retorna 422 com lista de blocking issues. Given 0 blocking issues, When POST /submit-review, Then status muda para 'pending_review'. |
| US-C09 | Aprovar/Rejeitar + Lock mensal | 5 | Given status pending_review, When POST /approve, Then status = approved, is_locked = true, locked_at = now. Given status approved, When tentar editar lancamento do mes, Then trigger Postgres bloqueia com erro. |
| US-C10 | Reabrir mes fechado (com auditoria) | 2 | Given mes aprovado e travado, When POST /reopen {reason}, Then is_locked = false, status = reopened, reopen_count++, closing_history registra acao com motivo. |

**Sprint C3: Relatorio + Comparativo + Frontend (23 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-C11 | Geracao de relatorio de fechamento | 8 | Given mes aprovado, When POST /report/generate, Then gera JSON com DRE, saldos, metricas, comparativo com mes anterior. Claude API gera executive_summary e highlights. |
| US-C12 | Export PDF do relatorio | 5 | Given relatorio gerado, When GET /report/pdf, Then retorna PDF com header da empresa, DRE, graficos de evolucao, alertas do analista. |
| US-C13 | Comparativo entre meses | 3 | Given fechamento de marco e abril, When GET /compare?a=marco&b=abril, Then retorna diferencas em receita, despesa, resultado, com % de variacao. |
| US-C14 | Frontend: Painel de fechamento completo | 5 | Given 4 empresas com fechamentos em estados diferentes, When abrir /closing, Then sidebar mostra empresas com badges de status e %, area central mostra checklist interativo. |
| US-C15 | Frontend: Tela de revisao do supervisor | 2 | Given fechamento em pending_review, When supervisor abre /closing/:id/review, Then ve checklist + mini-DRE + botoes aprovar/rejeitar. |

### 1.8 Regras de Negocio Invisiveis

1. **Ordem das verificacoes importa.** Sempre rodar sync do Tiny ANTES de verificar saldo. Se o sync nao esta fresco, o saldo pode estar errado. A verificacao `check_tiny_sync_fresh` deve ser a primeira.

2. **Pro-labore e bloqueante por lei.** O contador precisa do pro-labore lancado para emitir a DARF do INSS. Se nao esta lancado, o mes NAO pode fechar. Parece detalhe, mas e o item que mais atrasa fechamento em BPO.

3. **Mes anterior precisa estar fechado.** Nao permitir fechar abril se marco nao esta aprovado. Sequencia quebrada cria cascata de problemas no DRE acumulado.

4. **Lock precisa ter escape valve.** Sempre vai ter situacao onde alguem precisa editar um lancamento de mes fechado (erro descoberto depois, NF-e atrasada). O reopen deve existir, mas com auditoria completa, motivo obrigatorio, e notificacao para todos os envolvidos.

5. **Checklist deve tolerar "nao aplicavel".** Nem toda empresa tem folha de pagamento (MEI, por exemplo). O item deve poder ser marcado como N/A sem travar o fechamento.

6. **Snapshot imutavel no aprovacao.** Quando o supervisor aprova, gravar um snapshot JSONB com todos os saldos, totais, e metricas. Se alguem reabrir e alterar, o historico mostra o que foi aprovado vs o que mudou.

7. **Tolerancia de centavos no saldo.** Diferenca de ate R$0.05 entre banco e Tiny deve ser aceita automaticamente como arredondamento. Diferenca de R$0.06 a R$5.00 deve ser "pendente" (nao bloqueante). Acima de R$5.00 e bloqueante.

8. **O relatorio do cliente nao mostra tudo.** DRE simplificada, sem detalhes de lancamentos individuais, sem notas internas do analista. O relatorio interno do supervisor mostra tudo.

---

## MODULO 2: WORKFLOW REAL DE BPO

### 2.1 Justificativa de Negocio

O PRD atual trata a plataforma como se UM usuario operasse SUAS empresas. Mas BPO e uma fabrica. E o seguinte cenario real:

- Ana cuida de 15 empresas. Joao cuida de 12. Maria saiu de ferias e ninguem sabe quem pegou as empresas dela.
- O cliente "Padaria do Ze" ligou reclamando que o fechamento de marco nao chegou. O supervisor pergunta: "Quem cuida da Padaria?" Ninguem sabe de cabeca.
- O analista processou 200 lancamentos hoje. Outro processou 40. Qual e produtivo e qual esta com problema? Sem dados, sem resposta.
- O SLA contratual diz "fechamento ate dia 10". Estamos dia 8 e ninguem sabe se vai dar tempo.
- O supervisor quer revisar antes de enviar ao cliente, mas nao tem ferramenta. Entra na conta do analista e olha "se parece OK".

Este modulo transforma o software de "ferramenta de conciliacao" em "sistema de gestao operacional de BPO". Sem ele, nao escala alem de 20 empresas. Com ele, opera 200.

### 2.2 Schema PostgreSQL Completo

```sql
-- =============================================================
-- ENUM TYPES
-- =============================================================

CREATE TYPE analyst_status AS ENUM (
  'active',    -- trabalhando normalmente
  'vacation',  -- ferias
  'sick',      -- afastado
  'inactive'   -- desligado
);

CREATE TYPE task_status AS ENUM (
  'backlog',       -- na fila, nao iniciado
  'in_progress',   -- analista trabalhando
  'in_review',     -- supervisor revisando
  'needs_info',    -- aguardando informacao (cliente/banco/outro)
  'completed',     -- concluido
  'cancelled'      -- cancelado
);

CREATE TYPE task_priority AS ENUM (
  'critical',  -- vencimento iminente ou SLA estourado
  'high',      -- valor alto ou perto do SLA
  'medium',    -- trabalho normal
  'low'        -- sem urgencia
);

CREATE TYPE company_operation_status AS ENUM (
  'awaiting_document',     -- aguardando documento do cliente
  'awaiting_bank',         -- extrato nao chegou
  'awaiting_client',       -- cliente precisa aprovar/responder
  'in_progress',           -- analista trabalhando
  'in_review',             -- supervisor revisando
  'ready_to_close',        -- pronto para fechar
  'closed'                 -- mes fechado
);

CREATE TYPE sla_metric_type AS ENUM (
  'closing_deadline',      -- fechamento ate dia X
  'reconciliation_daily',  -- conciliacao deve ser diaria
  'reconciliation_weekly', -- conciliacao semanal
  'collection_weekly',     -- cobranca semanal
  'report_monthly',        -- relatorio mensal
  'response_time'          -- tempo de resposta a solicitacao do cliente
);

-- =============================================================
-- TABELA: analyst_portfolios
-- Carteira de clientes por analista
-- =============================================================

CREATE TABLE analyst_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  
  analyst_id UUID NOT NULL REFERENCES profiles(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Papel do analista nesta empresa
  role VARCHAR(50) DEFAULT 'primary', -- 'primary', 'backup', 'temporary'
  
  -- Datas
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  
  -- Cobertura de ferias
  covering_for UUID REFERENCES profiles(id), -- se esta cobrindo ferias de alguem
  coverage_start TIMESTAMPTZ,
  coverage_end TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(analyst_id, company_id) -- um analista nao pode ser atribuido 2x a mesma empresa
);

CREATE INDEX idx_portfolio_org ON analyst_portfolios(org_id);
CREATE INDEX idx_portfolio_analyst ON analyst_portfolios(analyst_id) WHERE is_active = TRUE;
CREATE INDEX idx_portfolio_company ON analyst_portfolios(company_id) WHERE is_active = TRUE;

-- =============================================================
-- TABELA: analyst_profiles_extended
-- Dados operacionais do analista (extends profiles)
-- =============================================================

CREATE TABLE analyst_profiles_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  
  status analyst_status DEFAULT 'active',
  max_companies INTEGER DEFAULT 20, -- capacidade maxima
  
  -- Metricas rolling
  current_company_count INTEGER DEFAULT 0,
  current_pending_tasks INTEGER DEFAULT 0,
  avg_transactions_per_day NUMERIC(8,2) DEFAULT 0,
  avg_time_per_transaction_seconds INTEGER DEFAULT 0,
  rework_rate NUMERIC(5,2) DEFAULT 0, -- % de lancamentos corrigidos pelo supervisor
  
  -- Ferias
  vacation_start TIMESTAMPTZ,
  vacation_end TIMESTAMPTZ,
  vacation_cover_analyst_id UUID REFERENCES profiles(id),
  
  -- Skills/especializacao
  specializations TEXT[], -- ['e-commerce', 'servicos', 'industria', 'MEI']
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyst_ext_org ON analyst_profiles_extended(org_id);
CREATE INDEX idx_analyst_ext_status ON analyst_profiles_extended(status);

-- =============================================================
-- TABELA: bpo_tasks
-- Fila de trabalho do BPO (tarefas)
-- =============================================================

CREATE TABLE bpo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Tipo de tarefa
  task_type VARCHAR(100) NOT NULL, 
  -- Valores: 'import_statement', 'reconcile_transactions', 'categorize_transactions',
  -- 'review_closing', 'collect_overdue', 'respond_client', 'generate_report',
  -- 'sync_tiny', 'resolve_divergence', 'process_documents', 'custom'
  
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Status e prioridade
  status task_status NOT NULL DEFAULT 'backlog',
  priority task_priority NOT NULL DEFAULT 'medium',
  
  -- Prioridade calculada (para ordenacao automatica)
  priority_score INTEGER DEFAULT 0,
  -- Calculo: vencimento_urgencia * 100 + valor_peso * 10 + sla_risco * 50 + tempo_parado * 5
  
  -- Atribuicao
  assigned_to UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ,
  
  -- Timing
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- SLA
  sla_config_id UUID REFERENCES sla_configs(id),
  sla_deadline TIMESTAMPTZ,
  sla_status VARCHAR(20) DEFAULT 'on_track', -- 'on_track', 'at_risk', 'breached'
  
  -- Contexto
  reference_entity_type VARCHAR(50), -- 'monthly_closing', 'bank_transaction', 'client_request'
  reference_entity_id UUID,
  
  -- Dados da tarefa
  task_data JSONB, -- dados especificos por tipo {transaction_count, amount, etc}
  
  -- Revisao
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_status VARCHAR(20), -- 'approved', 'rejected', 'needs_rework'
  review_notes TEXT,
  
  -- Contadores
  rework_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_org ON bpo_tasks(org_id);
CREATE INDEX idx_tasks_assigned ON bpo_tasks(assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_company ON bpo_tasks(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_priority ON bpo_tasks(priority_score DESC, due_date ASC) WHERE status IN ('backlog', 'in_progress');
CREATE INDEX idx_tasks_sla ON bpo_tasks(sla_deadline) WHERE sla_status IN ('at_risk', 'breached');
CREATE INDEX idx_tasks_status ON bpo_tasks(status, updated_at DESC) WHERE deleted_at IS NULL;

-- =============================================================
-- TABELA: sla_configs
-- Configuracao de SLA por empresa/cliente
-- =============================================================

CREATE TABLE sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  metric_type sla_metric_type NOT NULL,
  
  -- Configuracao
  target_value INTEGER NOT NULL, -- dia do mes (para closing_deadline) ou horas (para response_time)
  warning_threshold INTEGER, -- dias antes do deadline para alertar
  
  -- Ex: closing_deadline = 10, warning = 3 -> alerta no dia 7
  -- Ex: response_time = 24 (horas), warning = 4 -> alerta com 4h restantes
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, metric_type)
);

CREATE INDEX idx_sla_configs_org ON sla_configs(org_id);
CREATE INDEX idx_sla_configs_company ON sla_configs(company_id);

-- =============================================================
-- TABELA: sla_tracking
-- Historico de cumprimento de SLA
-- =============================================================

CREATE TABLE sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  sla_config_id UUID NOT NULL REFERENCES sla_configs(id),
  
  reference_period VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  
  -- Resultado
  target_date TIMESTAMPTZ,
  actual_date TIMESTAMPTZ,
  met BOOLEAN, -- cumpriu ou nao
  days_late INTEGER DEFAULT 0, -- quantos dias atrasou (0 se cumpriu)
  
  -- Responsavel
  analyst_id UUID REFERENCES profiles(id),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sla_tracking_company ON sla_tracking(company_id, reference_period);
CREATE INDEX idx_sla_tracking_analyst ON sla_tracking(analyst_id, met);

-- =============================================================
-- TABELA: company_operation_tracking
-- Status operacional por empresa/mes
-- =============================================================

CREATE TABLE company_operation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  reference_period VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  
  status company_operation_status NOT NULL DEFAULT 'awaiting_document',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  status_changed_by UUID REFERENCES profiles(id),
  status_notes TEXT,
  
  -- Metricas do periodo
  total_transactions INTEGER DEFAULT 0,
  processed_transactions INTEGER DEFAULT 0,
  pending_transactions INTEGER DEFAULT 0,
  reconciliation_rate NUMERIC(5,2) DEFAULT 0,
  
  -- Pendencias
  pending_from_client INTEGER DEFAULT 0, -- itens aguardando cliente
  pending_from_bank INTEGER DEFAULT 0,   -- extratos faltando
  pending_from_analyst INTEGER DEFAULT 0, -- tarefas do analista
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, reference_period)
);

CREATE INDEX idx_op_tracking_org ON company_operation_tracking(org_id);
CREATE INDEX idx_op_tracking_status ON company_operation_tracking(status);

-- =============================================================
-- TABELA: task_comments
-- Comentarios em tarefas (analista/supervisor)
-- =============================================================

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES bpo_tasks(id) ON DELETE CASCADE,
  
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  
  -- Referencia inline a lancamento especifico
  reference_entity_type VARCHAR(50), -- 'bank_transaction', 'tiny_cp', 'tiny_cr'
  reference_entity_id UUID,
  
  -- Tipo de comentario
  comment_type VARCHAR(20) DEFAULT 'note', -- 'note', 'review_feedback', 'question', 'resolution'
  
  is_internal BOOLEAN DEFAULT TRUE, -- true = so equipe BPO ve, false = cliente tambem ve
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at);

-- =============================================================
-- TABELA: productivity_metrics
-- Metricas de produtividade por analista (agregado diario)
-- =============================================================

CREATE TABLE productivity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  analyst_id UUID NOT NULL REFERENCES profiles(id),
  
  metric_date DATE NOT NULL,
  
  -- Volume
  transactions_processed INTEGER DEFAULT 0,
  reconciliations_created INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  
  -- Tempo
  total_work_minutes INTEGER DEFAULT 0, -- tempo logado/ativo
  avg_time_per_transaction_seconds INTEGER DEFAULT 0,
  
  -- Qualidade
  items_corrected_by_supervisor INTEGER DEFAULT 0,
  rework_count INTEGER DEFAULT 0,
  
  -- Valor processado
  total_amount_processed NUMERIC(14,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(analyst_id, metric_date)
);

CREATE INDEX idx_productivity_org ON productivity_metrics(org_id);
CREATE INDEX idx_productivity_analyst_date ON productivity_metrics(analyst_id, metric_date DESC);

-- =============================================================
-- TABELA: transaction_review_comments
-- Comentarios inline em lancamentos (para revisao)
-- =============================================================

CREATE TABLE transaction_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Lancamento comentado
  entity_type VARCHAR(50) NOT NULL, -- 'bank_transaction', 'tiny_cp', 'tiny_cr', 'reconciliation'
  entity_id UUID NOT NULL,
  
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  
  -- Status do comentario
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_comments_entity ON transaction_review_comments(entity_type, entity_id);
CREATE INDEX idx_review_comments_unresolved ON transaction_review_comments(org_id, is_resolved) WHERE is_resolved = FALSE;

-- =============================================================
-- RLS POLICIES
-- =============================================================

ALTER TABLE analyst_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_profiles_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE bpo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_operation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_review_comments ENABLE ROW LEVEL SECURITY;

-- Todas as tabelas: org_id = get_org_id()
CREATE POLICY "portfolio_org" ON analyst_portfolios FOR ALL USING (org_id = get_org_id());
CREATE POLICY "analyst_ext_org" ON analyst_profiles_extended FOR ALL USING (org_id = get_org_id());
CREATE POLICY "tasks_org" ON bpo_tasks FOR ALL USING (org_id = get_org_id());
CREATE POLICY "sla_org" ON sla_configs FOR ALL USING (org_id = get_org_id());
CREATE POLICY "sla_tracking_org" ON sla_tracking FOR ALL USING (org_id = get_org_id());
CREATE POLICY "op_tracking_org" ON company_operation_tracking FOR ALL USING (org_id = get_org_id());
CREATE POLICY "task_comments_via_task" ON task_comments FOR ALL USING (
  task_id IN (SELECT id FROM bpo_tasks WHERE org_id = get_org_id())
);
CREATE POLICY "productivity_org" ON productivity_metrics FOR ALL USING (org_id = get_org_id());

-- Produtividade: analista ve apenas proprios dados, supervisor/admin ve todos
CREATE POLICY "productivity_own_or_supervisor" ON productivity_metrics
  FOR SELECT USING (
    org_id = get_org_id() AND (
      analyst_id = auth.uid() OR
      EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND org_id = get_org_id() AND role IN ('owner', 'admin'))
    )
  );

CREATE POLICY "review_comments_org" ON transaction_review_comments FOR ALL USING (org_id = get_org_id());
```

### 2.3 State Machine da Tarefa

```
                    ┌───────────┐
                    │  backlog  │
                    └─────┬─────┘
                          │ analista pega (drag to in_progress)
                          ▼
                    ┌───────────────┐
           ┌───────│ in_progress   │◄──────────────┐
           │       └───────┬───────┘               │
           │               │                        │
     aguardando       analista                 supervisor
     informacao       submete                  rejeita
           │               │                   (rework)
           ▼               ▼                        │
    ┌─────────────┐ ┌────────────┐                 │
    │ needs_info  │ │ in_review  │─────────────────┘
    └──────┬──────┘ └─────┬──────┘
           │              │
     info chegou     supervisor
     (volta)         aprova
           │              │
           ▼              ▼
    ┌─────────────┐ ┌────────────┐
    │ in_progress │ │ completed  │
    └─────────────┘ └────────────┘
```

### 2.4 Endpoints NestJS

```
Modulo: WorkflowModule

# Carteira de clientes
GET    /api/v1/portfolios                          -- Listar carteiras {analyst_id?, company_id?}
POST   /api/v1/portfolios                          -- Atribuir empresa a analista
PATCH  /api/v1/portfolios/:id                      -- Atualizar (role, cobertura ferias)
DELETE /api/v1/portfolios/:id                      -- Remover atribuicao
POST   /api/v1/portfolios/redistribute             -- Redistribuir carga {from_analyst_id, reason}
GET    /api/v1/portfolios/workload                  -- Visao de carga de trabalho por analista

# Analistas
GET    /api/v1/analysts                            -- Listar analistas com metricas
GET    /api/v1/analysts/:id                        -- Perfil do analista com stats detalhadas
PATCH  /api/v1/analysts/:id                        -- Atualizar status/ferias
GET    /api/v1/analysts/:id/productivity            -- Metricas de produtividade {period}

# Tarefas (fila de trabalho)
GET    /api/v1/tasks                               -- Listar tarefas {assigned_to?, company_id?, status?, priority?}
POST   /api/v1/tasks                               -- Criar tarefa
GET    /api/v1/tasks/:id                           -- Detalhe da tarefa
PATCH  /api/v1/tasks/:id                           -- Atualizar tarefa (status, priority, assigned_to)
DELETE /api/v1/tasks/:id                           -- Cancelar tarefa
POST   /api/v1/tasks/:id/assign                    -- Atribuir tarefa {analyst_id}
POST   /api/v1/tasks/:id/start                     -- Iniciar tarefa
POST   /api/v1/tasks/:id/submit-review             -- Submeter para revisao
POST   /api/v1/tasks/:id/complete                  -- Concluir tarefa
POST   /api/v1/tasks/auto-generate                 -- Gerar tarefas automaticas para o periodo
POST   /api/v1/tasks/bulk-assign                   -- Atribuir tarefas em lote
GET    /api/v1/tasks/my-inbox                      -- Inbox do analista logado (ordenado por priority_score)

# Comentarios em tarefas
GET    /api/v1/tasks/:id/comments                  -- Listar comentarios
POST   /api/v1/tasks/:id/comments                  -- Adicionar comentario

# Comentarios inline em lancamentos
GET    /api/v1/review-comments                     -- Listar comentarios abertos {entity_type?, entity_id?}
POST   /api/v1/review-comments                     -- Criar comentario em lancamento
PATCH  /api/v1/review-comments/:id/resolve         -- Resolver comentario

# SLA
GET    /api/v1/sla-configs                         -- Listar SLAs {company_id?}
POST   /api/v1/sla-configs                         -- Criar SLA
PATCH  /api/v1/sla-configs/:id                     -- Atualizar SLA
GET    /api/v1/sla/status                          -- Status atual de todos os SLAs {at_risk?, breached?}
GET    /api/v1/sla/history                          -- Historico de cumprimento {company_id?, analyst_id?, period?}

# Status operacional
GET    /api/v1/operations/status                   -- Status de todas as empresas no periodo
PATCH  /api/v1/operations/:company_id/status       -- Atualizar status operacional
GET    /api/v1/operations/dashboard                -- Dashboard do supervisor (consolidado)

# Produtividade
GET    /api/v1/productivity/summary                -- Resumo geral {period}
GET    /api/v1/productivity/comparison              -- Comparativo entre analistas (so admin/owner)
POST   /api/v1/productivity/snapshot               -- Gravar snapshot diario (cron)

# Revisao do supervisor
GET    /api/v1/review/pending                      -- Itens aguardando revisao
POST   /api/v1/review/batch-approve                -- Aprovar em lote {task_ids[]}
POST   /api/v1/review/batch-reject                 -- Rejeitar em lote {task_ids[], reason}

Total: 38 endpoints
```

### 2.5 Algoritmo de Priorizacao Automatica

```typescript
// src/workflow/services/priority-calculator.service.ts

calculatePriorityScore(task: BpoTask): number {
  let score = 0;
  const now = new Date();
  
  // 1. Urgencia de vencimento (peso 100)
  if (task.due_date) {
    const daysUntilDue = differenceInDays(task.due_date, now);
    if (daysUntilDue < 0) score += 500;       // vencido: maximo
    else if (daysUntilDue === 0) score += 400; // vence hoje
    else if (daysUntilDue <= 2) score += 300;  // vence em 2 dias
    else if (daysUntilDue <= 5) score += 200;  // vence em 5 dias
    else if (daysUntilDue <= 10) score += 100; // vence em 10 dias
  }
  
  // 2. Valor envolvido (peso 50)
  const amount = task.task_data?.total_amount || 0;
  if (amount > 100000) score += 50;
  else if (amount > 50000) score += 40;
  else if (amount > 10000) score += 30;
  else if (amount > 5000) score += 20;
  else if (amount > 1000) score += 10;
  
  // 3. SLA em risco (peso 150)
  if (task.sla_status === 'breached') score += 150;
  else if (task.sla_status === 'at_risk') score += 100;
  
  // 4. Tempo parado (peso 5 por dia)
  const daysSinceUpdate = differenceInDays(now, task.updated_at);
  score += Math.min(daysSinceUpdate * 5, 75); // cap 15 dias
  
  // 5. Tipo de tarefa (peso fixo)
  const typeWeights = {
    'respond_client': 30,     // cliente esperando = prioridade
    'resolve_divergence': 25, // bloqueia fechamento
    'collect_overdue': 20,    // dinheiro parado
    'reconcile_transactions': 15,
    'import_statement': 10,
    'generate_report': 5,
  };
  score += typeWeights[task.task_type] || 0;
  
  // 6. Retrabalho (penalidade: prioriza para resolver logo)
  score += task.rework_count * 20;
  
  return score;
}
```

### 2.6 UX/Telas

**Tela: Dashboard do Supervisor (`/workflow/dashboard`)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  OPERACAO BPO — Abril 2026                    [Periodo ▼] [⚙️]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 47       │ │ 12       │ │ 3        │ │ 92%      │ │ 2        │ │
│  │ Empresas │ │ Fechadas │ │ SLA Risk │ │ SLA Met  │ │ Analistas│ │
│  │ ativas   │ │ no mes   │ │ 🔴       │ │ ✅       │ │ on duty  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                      │
│  CARGA POR ANALISTA                                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Ana Silva      15 empresas  █████████████░░ 78% capacidade  │   │
│  │                42 tarefas   SLA: 100% ✅   Prod: 85 tx/dia │   │
│  │                                                              │   │
│  │ Joao Santos    12 empresas  ██████████░░░░░ 60% capacidade  │   │
│  │                28 tarefas   SLA: 92% ⚠️    Prod: 62 tx/dia │   │
│  │                                                              │   │
│  │ Maria (FERIAS) → Cobrindo: Ana (8 emp) + Joao (4 emp)      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  STATUS DAS EMPRESAS                              [Filtro ▼]        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🔴 Padaria do Ze     | aguardando documento | Ana   | 3d   │   │
│  │ 🟡 Loja ABC          | em andamento         | Joao  | SLA⚠️│   │
│  │ 🟢 Tech Solutions    | pronto para fechar   | Ana   |      │   │
│  │ 🟢 Industria XYZ     | fechado              | Ana   | ✅   │   │
│  │ ⚪ Comercio 123      | aguardando banco     | Joao  |      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

**Tela: Inbox do Analista (`/workflow/inbox`)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  MEU TRABALHO — Ana Silva                  Hoje: 42 tx processadas  │
├─────────────────┬────────────────────────────────────────────────────┤
│                 │                                                     │
│  KANBAN         │  TAREFA SELECIONADA                                │
│                 │                                                     │
│  BACKLOG (8)    │  ┌──────────────────────────────────────────────┐  │
│  ┌───────────┐  │  │ Conciliar transacoes — Padaria do Ze        │  │
│  │ Importar  │  │  │ Prioridade: 🔴 CRITICA (score: 520)        │  │
│  │ extrato   │  │  │ SLA: Vence em 2 dias                        │  │
│  │ Padaria   │  │  │ 34 transacoes pendentes | R$ 12.450,00      │  │
│  └───────────┘  │  │                                              │  │
│  ┌───────────┐  │  │ [Iniciar Trabalho] [Aguardando Info]        │  │
│  │ Categoriz.│  │  │                                              │  │
│  │ Loja ABC  │  │  │ COMENTARIOS DO SUPERVISOR                   │  │
│  └───────────┘  │  │ 💬 "Verificar lancamento de R$3.200 -       │  │
│                 │  │     parece duplicado" — Carlos, 2h atras     │  │
│  EM ANDAMENTO(3)│  │                                              │  │
│  ┌───────────┐  │  │ HISTORICO                                    │  │
│  │ 🔴 Concil.│  │  │ • Tarefa criada automaticamente             │  │
│  │ Padaria   │  │  │ • Extrato importado por Ana                  │  │
│  │ score:520 │  │  │ • 12 reconciliacoes automaticas              │  │
│  └───────────┘  │  │ • 22 transacoes pendentes                    │  │
│                 │  └──────────────────────────────────────────────┘  │
│  EM REVISAO (2) │                                                     │
│  CONCLUIDO (12) │                                                     │
│                 │                                                     │
└─────────────────┴────────────────────────────────────────────────────┘
```

**Tela: Produtividade (so para supervisor/admin) (`/workflow/productivity`)**

- Graficos por analista: transactions/dia (bar chart), tempo medio por transacao (line chart)
- Taxa de retrabalho por analista (donut chart)
- Ranking por produtividade (tabela, sem posicao explicita -- mostra metricas lado a lado)
- Filtro por periodo (semana, mes, trimestre)
- Comparativo MoM por analista

### 2.7 Sprint Breakdown

**Sprint W1: Carteira + Analistas + Tarefas (24 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-W01 | Schema de workflow (9 tabelas + RLS + indexes) | 5 | Given schema migrado, When inserir portfolio, Then RLS isola por org_id. Given analista com role viewer, When consultar productivity, Then so ve proprios dados. |
| US-W02 | CRUD de carteira (portfolios) + redistribuicao | 5 | Given Ana com 15 empresas e Joao com 12, When Ana entra de ferias e POST /redistribute {from: Ana}, Then empresas redistribuidas para Joao e novos temporarios, coverage_for preenchido. |
| US-W03 | CRUD de tarefas + priorizacao automatica | 8 | Given tarefa com due_date amanha e SLA at_risk, When GET /tasks/my-inbox, Then tarefa aparece no topo com priority_score > 400. Given tarefa vencida, Then priority = critical e score > 500. |
| US-W04 | Geracao automatica de tarefas (cron) | 3 | Given inicio do mes, When POST /tasks/auto-generate, Then cria tarefas para cada empresa: import_statement, reconcile_transactions, generate_report. |
| US-W05 | Comentarios em tarefas + inline em lancamentos | 3 | Given supervisor, When POST /review-comments {entity_type: bank_transaction, entity_id, content: "verificar valor"}, Then comentario aparece na transacao. Given analista resolve, When PATCH /resolve, Then is_resolved = true. |

**Sprint W2: SLA + Status Operacional + Revisao (21 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-W06 | CRUD de SLA + tracking | 5 | Given SLA closing_deadline = dia 10, When dia 7 (warning_threshold = 3), Then sla_status = 'at_risk'. Given fechamento dia 12, When gravar tracking, Then met = false, days_late = 2. |
| US-W07 | Status operacional por empresa | 3 | Given empresa com 3 pendencias do cliente, When GET /operations/status, Then status = 'awaiting_client' com pending_from_client = 3. |
| US-W08 | Dashboard do supervisor (API) | 5 | Given 47 empresas e 3 analistas, When GET /operations/dashboard, Then retorna carga por analista, SLA summary, empresas por status, alertas. |
| US-W09 | Fluxo de revisao (submit/approve/reject) | 5 | Given tarefa in_progress, When POST /submit-review, Then status = in_review. Given supervisor rejeita, When POST /reject {reason}, Then status = in_progress, rework_count++. |
| US-W10 | Cron de verificacao de SLA (a cada hora) | 3 | Given SLA at_risk, When cron roda, Then notificacao enviada ao analista e supervisor. Given SLA breached, Then notificacao de alta prioridade ao supervisor. |

**Sprint W3: Produtividade + Frontend (21 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-W11 | Metricas de produtividade (snapshot diario) | 5 | Given analista processou 85 transacoes hoje, When cron de snapshot roda, Then productivity_metrics grava transactions_processed = 85, avg_time calculado. |
| US-W12 | Comparativo de produtividade (so admin) | 3 | Given role owner, When GET /productivity/comparison, Then retorna metricas de todos os analistas. Given role analyst, When GET, Then 403. |
| US-W13 | Frontend: Dashboard supervisor | 5 | Given supervisor logado, When abre /workflow/dashboard, Then ve carga por analista, status empresas, alertas SLA. |
| US-W14 | Frontend: Inbox do analista (kanban) | 5 | Given analista com 25 tarefas, When abre /workflow/inbox, Then ve kanban com colunas backlog/andamento/revisao/concluido, drag-and-drop funcional. |
| US-W15 | Frontend: Tela de produtividade | 3 | Given admin, When abre /workflow/productivity, Then ve graficos por analista, sem ranking publico. |

### 2.8 Regras de Negocio Invisiveis

1. **Nao mostrar ranking publico de produtividade.** Analista ve apenas suas proprias metricas. Supervisor ve de todos, mas sem "posicao 1o, 2o, 3o". Ranking publico mata moral do time e nao melhora produtividade.

2. **Redistribuicao de ferias precisa ser proporcional.** Se Ana tem 15 empresas e sai de ferias, nao joga tudo para Joao. Distribui proporcionalmente a capacidade disponivel de cada analista. Se ninguem tem capacidade, o sistema alerta o supervisor ANTES das ferias.

3. **Tarefa gerada automaticamente != tarefa manual.** Tarefas auto-geradas (cron de inicio de mes) tem flag `auto_generated = true`. Se o analista completa a tarefa antes do cron criar, o cron detecta e nao duplica.

4. **SLA "breached" nao e fim do mundo -- e dado.** O sistema registra SLA breached mas nao pune. O dado serve para negociacao com cliente ("estamos com 92% de SLA, vamos ajustar deadline?") e para gestao interna ("Joao tem 80% de SLA, precisa de treinamento ou reducao de carga?").

5. **Status "aguardando cliente" para o relogio do SLA.** Quando o status da empresa muda para "awaiting_client" ou "awaiting_bank", o contador de SLA PAUSA. Nao e justo contar prazo do analista quando o gargalo e o cliente.

6. **Comentario inline do supervisor e o substituto do "chama no Slack".** Em BPO, o supervisor precisa dizer "verifica esse lancamento" sem precisar sair do sistema. Comentario inline na transacao com notificacao ao analista substitui 90% da comunicacao ad-hoc.

7. **Inbox ordenado por priority_score, nao por data.** O analista nao deve decidir o que fazer. O sistema decide. O item de maior priority_score esta no topo. O analista pega de cima para baixo. Isso garante que SLA nao estoura.

8. **Produtividade mede "transacoes corretas", nao "transacoes processadas".** Se o analista processou 100 mas o supervisor corrigiu 30, a produtividade efetiva e 70. A taxa de retrabalho e a metrica mais importante de qualidade.

---

## MODULO 3: PORTAL DO CLIENTE

### 3.1 Justificativa de Negocio

O motivo numero um pelo qual BPO financeiro perde cliente: o empresario nao sente valor. Ele paga R$2.000/mes e nao sabe o que esta recebendo. Ai liga no WhatsApp: "Qual meu saldo?", "Quando fecha o mes?", "Tem conta pra pagar amanha?". O analista para o que esta fazendo, abre 3 sistemas, e responde.

O portal do cliente resolve tres problemas simultaneamente:
1. **O empresario sente valor** -- abre o portal e ve dashboard, saldo, contas, relatorios
2. **O analista nao e interrompido** -- 80% das perguntas sao auto-servico
3. **Pendencias fluem mais rapido** -- ao inves de mandar WhatsApp pedindo comprovante, o sistema mostra pendencia no portal e notifica o cliente

BPO sem portal do cliente e invisivel. BPO com portal e indispensavel.

### 3.2 Schema PostgreSQL Completo

```sql
-- =============================================================
-- ENUM TYPES
-- =============================================================

CREATE TYPE client_user_role AS ENUM (
  'owner',      -- dono da empresa, ve tudo, aprova pagamentos
  'manager',    -- gerente, ve tudo, aprova ate alcada
  'viewer'      -- so visualiza
);

CREATE TYPE client_task_status AS ENUM (
  'pending',    -- pendente de acao do cliente
  'in_review',  -- cliente respondeu, BPO revisando
  'resolved',   -- resolvido
  'expired',    -- expirou sem resposta
  'cancelled'   -- cancelado pelo BPO
);

CREATE TYPE client_task_type AS ENUM (
  'send_document',      -- enviar comprovante/documento
  'approve_payment',    -- aprovar pagamento
  'classify_transaction', -- classificar lancamento nao identificado
  'answer_question',    -- responder pergunta do analista
  'sign_report',        -- assinar relatorio de fechamento
  'provide_information' -- fornecer informacao generica
);

CREATE TYPE message_channel AS ENUM (
  'portal',    -- mensagem dentro da plataforma
  'email',     -- email enviado
  'whatsapp'   -- whatsapp enviado
);

-- =============================================================
-- TABELA: client_users
-- Usuarios do portal do cliente (auth separada de users internos)
-- =============================================================

CREATE TABLE client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Auth (usa Supabase Auth, mas com metadata separada)
  auth_user_id UUID REFERENCES auth.users(id),
  
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  phone VARCHAR(20), -- para notificacoes WhatsApp
  
  role client_user_role NOT NULL DEFAULT 'viewer',
  
  -- Alcada de aprovacao
  approval_limit NUMERIC(14,2) DEFAULT 0, -- valor maximo que pode aprovar (0 = sem alcada)
  
  -- Notificacoes
  notify_email BOOLEAN DEFAULT TRUE,
  notify_whatsapp BOOLEAN DEFAULT FALSE,
  notify_portal BOOLEAN DEFAULT TRUE,
  
  -- Branding
  -- (herda da branding_configs da org, nao duplica)
  
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(company_id, email)
);

CREATE INDEX idx_client_users_org ON client_users(org_id);
CREATE INDEX idx_client_users_company ON client_users(company_id);
CREATE INDEX idx_client_users_auth ON client_users(auth_user_id);

-- =============================================================
-- TABELA: client_sessions
-- Sessoes do portal (para analytics de uso)
-- =============================================================

CREATE TABLE client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES client_users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  pages_visited TEXT[], -- ['/dashboard', '/pendencias', '/relatorios']
  actions_taken JSONB, -- {approved_payments: 2, uploaded_docs: 1}
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_sessions_user ON client_sessions(client_user_id, started_at DESC);

-- =============================================================
-- TABELA: client_tasks
-- Pendencias que o BPO precisa do cliente
-- =============================================================

CREATE TABLE client_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  task_type client_task_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  status client_task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'medium',
  
  -- Referencia ao lancamento/entidade
  reference_entity_type VARCHAR(50),
  reference_entity_id UUID,
  reference_description VARCHAR(500), -- "Transferencia de R$15.000 em 15/04 - Sicoob"
  
  -- Valor envolvido (para aprovacoes)
  amount NUMERIC(14,2),
  
  -- Prazo
  due_date TIMESTAMPTZ,
  
  -- Quem criou (analista do BPO)
  created_by UUID NOT NULL REFERENCES profiles(id),
  
  -- Resposta do cliente
  response_text TEXT,
  response_files TEXT[], -- URLs de arquivos enviados
  responded_by UUID REFERENCES client_users(id),
  responded_at TIMESTAMPTZ,
  
  -- Aprovacao (para approve_payment)
  approved_by UUID REFERENCES client_users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES client_users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Notificacoes enviadas
  notifications_sent JSONB DEFAULT '[]',
  -- [{channel: 'email', sent_at: '...', delivered: true}, ...]
  
  -- Resolucao pelo BPO
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_tasks_org ON client_tasks(org_id);
CREATE INDEX idx_client_tasks_company ON client_tasks(company_id, status);
CREATE INDEX idx_client_tasks_pending ON client_tasks(company_id, status, due_date) WHERE status = 'pending';
CREATE INDEX idx_client_tasks_type ON client_tasks(task_type, status);

-- =============================================================
-- TABELA: client_messages
-- Chat estruturado entre cliente e analista
-- =============================================================

CREATE TABLE client_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Thread (agrupamento)
  thread_id UUID, -- se nulo, e inicio de thread
  thread_subject VARCHAR(500),
  
  -- Remetente
  sender_type VARCHAR(20) NOT NULL, -- 'client', 'analyst', 'system'
  sender_client_id UUID REFERENCES client_users(id),
  sender_analyst_id UUID REFERENCES profiles(id),
  
  content TEXT NOT NULL,
  
  -- Anexos
  attachments JSONB DEFAULT '[]',
  -- [{name: 'comprovante.pdf', url: '...', size: 1234, type: 'application/pdf'}]
  
  -- Referencia contextual
  reference_entity_type VARCHAR(50), -- 'bank_transaction', 'tiny_cp', 'monthly_closing'
  reference_entity_id UUID,
  reference_period VARCHAR(7), -- 'YYYY-MM'
  
  -- Status de leitura
  read_by_client BOOLEAN DEFAULT FALSE,
  read_by_client_at TIMESTAMPTZ,
  read_by_analyst BOOLEAN DEFAULT FALSE,
  read_by_analyst_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_org ON client_messages(org_id);
CREATE INDEX idx_messages_company ON client_messages(company_id, created_at DESC);
CREATE INDEX idx_messages_thread ON client_messages(thread_id, created_at);
CREATE INDEX idx_messages_unread_client ON client_messages(company_id, read_by_client) WHERE read_by_client = FALSE AND sender_type = 'analyst';
CREATE INDEX idx_messages_unread_analyst ON client_messages(company_id, read_by_analyst) WHERE read_by_analyst = FALSE AND sender_type = 'client';

-- =============================================================
-- TABELA: client_notifications
-- Notificacoes enviadas ao cliente (multicanal)
-- =============================================================

CREATE TABLE client_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  client_user_id UUID NOT NULL REFERENCES client_users(id),
  
  channel message_channel NOT NULL,
  
  notification_type VARCHAR(50) NOT NULL,
  -- 'new_task', 'task_reminder', 'report_ready', 'message_received',
  -- 'payment_due', 'closing_complete', 'document_request'
  
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  
  -- Referencia
  reference_entity_type VARCHAR(50),
  reference_entity_id UUID,
  link_url TEXT, -- deep link no portal
  
  -- Status de entrega
  status VARCHAR(20) DEFAULT 'queued', -- 'queued', 'sent', 'delivered', 'read', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- External IDs
  external_id VARCHAR(200), -- ID do email/whatsapp para tracking
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_notif_user ON client_notifications(client_user_id, created_at DESC);
CREATE INDEX idx_client_notif_company ON client_notifications(company_id, notification_type);

-- =============================================================
-- TABELA: client_report_access
-- Controle de acesso a relatorios pelo cliente
-- =============================================================

CREATE TABLE client_report_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  closing_report_id UUID REFERENCES closing_reports(id),
  
  report_type VARCHAR(50) NOT NULL, -- 'monthly_closing', 'dre', 'cash_flow', 'custom'
  report_title VARCHAR(500) NOT NULL,
  report_period VARCHAR(7), -- 'YYYY-MM'
  
  pdf_url TEXT,
  
  -- Assinatura do cliente
  signed_by UUID REFERENCES client_users(id),
  signed_at TIMESTAMPTZ,
  signature_notes TEXT,
  
  -- Acesso
  accessed_by_client BOOLEAN DEFAULT FALSE,
  first_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  shared_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_access_company ON client_report_access(company_id, report_period);

-- =============================================================
-- TABELA: client_dashboard_snapshots
-- Dados pre-computados para o dashboard do cliente
-- Evita queries pesadas em tempo real
-- =============================================================

CREATE TABLE client_dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  
  snapshot_date DATE NOT NULL,
  
  -- Saldos
  bank_balances JSONB NOT NULL, -- [{account_name, balance, last_updated}]
  total_balance NUMERIC(14,2),
  
  -- Fluxo de caixa projetado
  cash_flow_7d JSONB, -- {inflow, outflow, net}
  cash_flow_15d JSONB,
  cash_flow_30d JSONB,
  
  -- Contas a pagar proximas
  upcoming_payables JSONB, -- [{title, amount, due_date, supplier}]
  total_payables_week NUMERIC(14,2),
  
  -- Contas a receber atrasadas
  overdue_receivables JSONB, -- [{title, amount, due_date, customer, days_overdue}]
  total_overdue NUMERIC(14,2),
  
  -- Resumo do mes
  month_summary JSONB, -- {revenue, expenses, result, previous_month_result, variation_pct}
  
  -- Pendencias
  pending_tasks_count INTEGER DEFAULT 0,
  
  -- Status do fechamento
  closing_status VARCHAR(50),
  closing_progress NUMERIC(5,2),
  
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, snapshot_date)
);

CREATE INDEX idx_dashboard_snap_company ON client_dashboard_snapshots(company_id, snapshot_date DESC);

-- =============================================================
-- RLS POLICIES (Portal)
-- =============================================================

ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_report_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_dashboard_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS para equipe BPO (veem tudo da org)
CREATE POLICY "client_users_bpo" ON client_users
  FOR ALL USING (org_id = get_org_id());

-- RLS para usuarios do portal (veem apenas propria empresa)
CREATE POLICY "client_tasks_client_view" ON client_tasks
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM client_users 
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "client_tasks_client_update" ON client_tasks
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM client_users 
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "client_messages_client_view" ON client_messages
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM client_users 
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "client_messages_client_insert" ON client_messages
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM client_users 
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    ) AND sender_type = 'client'
  );

CREATE POLICY "client_notifications_own" ON client_notifications
  FOR SELECT USING (
    client_user_id IN (
      SELECT id FROM client_users 
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "client_reports_own" ON client_report_access
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM client_users 
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "client_dashboard_own" ON client_dashboard_snapshots
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM client_users 
      WHERE auth_user_id = auth.uid() AND is_active = TRUE
    )
  );

-- BPO policies (equipe interna ve tudo)
CREATE POLICY "client_tasks_bpo" ON client_tasks FOR ALL USING (org_id = get_org_id());
CREATE POLICY "client_messages_bpo" ON client_messages FOR ALL USING (org_id = get_org_id());
CREATE POLICY "client_notif_bpo" ON client_notifications FOR ALL USING (org_id = get_org_id());
CREATE POLICY "client_reports_bpo" ON client_report_access FOR ALL USING (org_id = get_org_id());
CREATE POLICY "dashboard_snap_bpo" ON client_dashboard_snapshots FOR ALL USING (org_id = get_org_id());
```

### 3.3 Endpoints NestJS

```
Modulo: ClientPortalModule (auth separada -- JWT com claim client_user_id)

# Auth do portal (separada da auth interna)
POST   /api/v1/portal/auth/login                   -- Login do cliente {email, password}
POST   /api/v1/portal/auth/magic-link               -- Magic link por email
POST   /api/v1/portal/auth/verify-phone             -- Verificar WhatsApp {phone, code}
GET    /api/v1/portal/auth/me                       -- Dados do usuario logado

# Dashboard do cliente
GET    /api/v1/portal/dashboard                     -- Dashboard completo (snapshot pre-computado)
GET    /api/v1/portal/dashboard/bank-balances        -- Saldos por conta
GET    /api/v1/portal/dashboard/cash-flow            -- Fluxo de caixa projetado {horizon: 7|15|30}
GET    /api/v1/portal/dashboard/payables             -- Contas a pagar da semana
GET    /api/v1/portal/dashboard/overdue-receivables   -- CRs atrasadas
GET    /api/v1/portal/dashboard/month-summary         -- Resumo do mes (receita, despesa, resultado)

# Pendencias do cliente
GET    /api/v1/portal/tasks                         -- Listar pendencias {status?}
GET    /api/v1/portal/tasks/:id                     -- Detalhe da pendencia
POST   /api/v1/portal/tasks/:id/respond              -- Responder pendencia {text, files[]}
POST   /api/v1/portal/tasks/:id/approve              -- Aprovar pagamento (verifica alcada)
POST   /api/v1/portal/tasks/:id/reject               -- Rejeitar pagamento {reason}
POST   /api/v1/portal/tasks/:id/upload               -- Upload de documento

# Relatorios
GET    /api/v1/portal/reports                       -- Listar relatorios disponiveis
GET    /api/v1/portal/reports/:id                   -- Detalhe do relatorio
GET    /api/v1/portal/reports/:id/pdf                -- Download PDF
POST   /api/v1/portal/reports/:id/sign               -- Assinar relatorio {notes?}

# Mensagens
GET    /api/v1/portal/messages                      -- Listar threads {unread_only?}
GET    /api/v1/portal/messages/thread/:threadId      -- Mensagens de uma thread
POST   /api/v1/portal/messages                      -- Enviar mensagem {thread_id?, subject?, content, attachments[]}
PATCH  /api/v1/portal/messages/:id/read              -- Marcar como lida
GET    /api/v1/portal/messages/unread-count           -- Contagem de nao lidas

# Notificacoes do portal
GET    /api/v1/portal/notifications                  -- Listar notificacoes
PATCH  /api/v1/portal/notifications/:id/read          -- Marcar como lida
PATCH  /api/v1/portal/notifications/read-all          -- Marcar todas como lidas

--- ENDPOINTS INTERNOS (para equipe BPO) ---

# Gestao de usuarios do portal
GET    /api/v1/client-users                         -- Listar usuarios de portal {company_id?}
POST   /api/v1/client-users                         -- Criar usuario de portal (envia convite)
PATCH  /api/v1/client-users/:id                     -- Atualizar (role, alcada, notificacoes)
DELETE /api/v1/client-users/:id                     -- Desativar usuario

# Gestao de pendencias (criadas pelo BPO)
POST   /api/v1/client-tasks                         -- Criar pendencia para o cliente
POST   /api/v1/client-tasks/bulk                    -- Criar pendencias em lote
PATCH  /api/v1/client-tasks/:id/resolve              -- Resolver pendencia (apos resposta do cliente)
GET    /api/v1/client-tasks/summary                  -- Resumo de pendencias por empresa

# Dashboard snapshot (cron)
POST   /api/v1/client-dashboard/refresh              -- Atualizar snapshots de todas as empresas

Total: 35 endpoints
```

### 3.4 UX/Telas

**Tela: Dashboard do Empresario (`/portal/dashboard`)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  🏢 PADARIA DO ZE                     Abril 2026       [👤 Jose]   │
│  BPO Financeiro por: [Logo Escritorio]                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ SALDO TOTAL  │ │ RESULTADO    │ │ PENDENCIAS   │                │
│  │ R$ 45.230    │ │ R$ +12.800   │ │ 3 itens      │                │
│  │ 2 contas     │ │ Abril (parc.)│ │ ⚠️ acao sua  │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│                                                                      │
│  CAIXA PROJETADO                                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  [7 dias] [15 dias] [30 dias]                               │   │
│  │  ████████████████████████████████████████████                │   │
│  │  Area chart com faixas otimista/realista/pessimista          │   │
│  │  Marcos: 🔴 Folha dia 5  🟡 Fornecedor X dia 12            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  CONTAS A PAGAR ESTA SEMANA                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 14/04  Fornecedor Farinha SA    R$ 3.200,00    [Aprovar ✅] │   │
│  │ 15/04  Aluguel                  R$ 4.500,00    Aprovado ✅  │   │
│  │ 16/04  DAS Simples Nacional     R$ 1.890,00    Auto        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  CONTAS A RECEBER ATRASADAS                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🔴 Cliente ABC    R$ 2.100,00    8 dias atrasado           │   │
│  │ 🟡 Cliente DEF    R$ 850,00      3 dias atrasado           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  RESUMO DO MES                                                      │
│  ┌───────────┬───────────┬───────────┐                              │
│  │ Receita   │ Despesa   │ Resultado │                              │
│  │ R$ 42.800 │ R$ 30.000 │ R$+12.800 │                              │
│  │ ↑ 8%      │ ↓ 3%      │ ↑ 15%     │   vs mes anterior           │
│  └───────────┴───────────┴───────────┘                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ FECHAMENTO: Março 2026 ✅ Aprovado em 08/04                 │   │
│  │ [📄 Ver Relatorio]  [✍️ Assinar]                            │   │
│  │                                                              │   │
│  │ FECHAMENTO: Abril 2026 ⏳ 64% concluido                    │   │
│  │ █████████████░░░░░░░░ 64%                                   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Tela: Pendencias do Cliente (`/portal/tasks`)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  SUAS PENDENCIAS                              3 pendentes           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔴 URGENTE — Vence amanha                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 📎 Enviar comprovante da transferencia de 15/04              │   │
│  │    Transferencia de R$ 15.000,00 — Sicoob → Conta Simples    │   │
│  │    Criada por: Ana Silva (sua analista)                       │   │
│  │    Prazo: 14/04/2026                                         │   │
│  │                                                              │   │
│  │    [📤 Enviar Documento]  [💬 Enviar Mensagem]               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ⚠️ ATENCAO                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ✅ Aprovar pagamento de R$ 12.000 ao Fornecedor X            │   │
│  │    Vencimento: 18/04/2026                                    │   │
│  │    Sua alcada: ate R$ 50.000                                 │   │
│  │                                                              │   │
│  │    [Aprovar ✅]  [Rejeitar ❌]  [Ver Detalhes]               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ❓ Classificar lancamento — R$ 350,00 nao identificado       │   │
│  │    Debito em 10/04: "PIX JOSE SILVA"                         │   │
│  │    Opcoes: [Fornecedor] [Despesa Pessoal] [Outro: ____]     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ── RESOLVIDOS ──                                                   │
│  ✅ Comprovante do pagamento de folha — Resolvido em 10/04         │
│  ✅ Aprovar pagamento fornecedor Y — Aprovado em 08/04             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Tela: Chat (`/portal/messages`)**

- Layout tipo WhatsApp Web: lista de threads a esquerda, conversa a direita
- Threads agrupadas por mes/contexto
- Mencoes a lancamentos especificos (click abre detalhes)
- Upload de arquivos inline (drag & drop)
- Indicador de "lida" (checkmarks duplo)
- Badge de mensagens nao lidas na sidebar

**Tela: Relatorios (`/portal/reports`)**

- Grid de cards por periodo (marco, fevereiro, janeiro...)
- Cada card: periodo, status (gerado/assinado), data de geracao
- Preview inline do PDF (embed)
- Botao [Assinar] que registra assinatura digital
- Botao [Baixar PDF]
- Botao [Solicitar Relatorio Especial] (abre mensagem para analista)

### 3.5 Auth do Portal (separada)

O portal usa a mesma instancia Supabase Auth, mas com metadados distintos:

```typescript
// Middleware de auth do portal
@Injectable()
export class PortalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extractToken(request);
    
    // Valida JWT com Supabase
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return false;
    
    // Verifica se e usuario de portal (nao usuario interno)
    const clientUser = await this.clientUsersRepo.findOne({
      where: { auth_user_id: user.id, is_active: true }
    });
    
    if (!clientUser) return false;
    
    request.clientUser = clientUser;
    request.companyId = clientUser.company_id;
    return true;
  }
}

// Decorator
@UseGuards(PortalAuthGuard)
@Controller('portal')
export class PortalDashboardController {
  @Get('dashboard')
  async getDashboard(@PortalUser() user: ClientUser) {
    // Snapshot pre-computado -- nao faz queries pesadas em tempo real
    return this.dashboardService.getLatestSnapshot(user.company_id);
  }
}
```

Rotas do portal: `/api/v1/portal/*` -- todas com `PortalAuthGuard`
Rotas internas: `/api/v1/*` -- todas com `JwtAuthGuard` (equipe BPO)

### 3.6 Sprint Breakdown

**Sprint P1: Schema + Auth Portal + Dashboard (24 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-P01 | Schema do portal (7 tabelas + RLS) | 5 | Given schema migrado, When usuario de portal consulta client_tasks, Then RLS retorna apenas tarefas da propria empresa. Given usuario de portal tenta acessar outra empresa, Then query retorna vazio. |
| US-P02 | Auth separada do portal (login, magic link, guards) | 5 | Given client_user cadastrado, When POST /portal/auth/login {email, password}, Then retorna JWT com client_user_id no claim. Given JWT interno (analista), When acessa rota /portal/*, Then retorna 403. |
| US-P03 | CRUD de usuarios de portal (endpoints internos) | 3 | Given analista cria usuario de portal, When POST /client-users {company_id, email, role, approval_limit}, Then envia email de convite. Given approval_limit = 50000, When cliente tenta aprovar R$60000, Then retorna 403 "Acima da alcada". |
| US-P04 | Dashboard snapshot (computacao + API) | 8 | Given empresa com dados, When cron POST /client-dashboard/refresh, Then grava snapshot com bank_balances, cash_flow, payables, receivables, month_summary. Given cliente acessa /portal/dashboard, Then retorna ultimo snapshot em < 200ms. |
| US-P05 | Frontend: Dashboard do empresario (read-only) | 3 | Given snapshot disponivel, When cliente abre /portal/dashboard, Then ve saldos, caixa projetado, contas da semana, resumo do mes, status do fechamento. |

**Sprint P2: Pendencias + Aprovacoes + Upload (21 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-P06 | CRUD de pendencias (create pelo BPO, respond pelo cliente) | 5 | Given analista cria pendencia "enviar comprovante", When cliente abre /portal/tasks, Then ve pendencia com detalhes e botao de upload. Given cliente envia arquivo, When POST /tasks/:id/respond, Then status = in_review e analista notificado. |
| US-P07 | Fluxo de aprovacao de pagamento (com alcada) | 5 | Given pendencia approve_payment R$12.000, When cliente owner com alcada R$50.000 aprova, Then approved_at = now, BPO notificado. Given cliente viewer sem alcada, When tenta aprovar, Then retorna 403. |
| US-P08 | Upload de documentos (OCR) | 5 | Given pendencia send_document, When cliente faz upload de comprovante, Then arquivo salvo no Supabase Storage, preview disponivel, OCR extrai dados basicos (valor, data). |
| US-P09 | Notificacoes multicanal (email + portal) | 3 | Given nova pendencia criada, When notify_email = true, Then email enviado ao cliente. Given notify_portal = true, Then notificacao aparece no portal. |
| US-P10 | Frontend: Tela de pendencias do cliente | 3 | Given 3 pendencias pendentes, When cliente abre /portal/tasks, Then ve lista ordenada por urgencia com acoes contextuais (upload, aprovar, classificar). |

**Sprint P3: Chat + Relatorios + Notificacoes (21 SP) — 2 semanas**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|-----|
| US-P11 | Chat estruturado (threads, mencoes, anexos) | 8 | Given analista envia mensagem com referencia a lancamento, When cliente abre thread, Then ve mensagem com link para detalhes do lancamento. Given cliente responde, When analista abre /portal messages, Then ve resposta com badge unread. |
| US-P12 | Acesso a relatorios + assinatura | 3 | Given relatorio de fechamento compartilhado, When cliente abre /portal/reports, Then ve PDF e botao assinar. When assina, Then signed_at e signed_by gravados. |
| US-P13 | Relatorio mensal automatico (PDF) | 5 | Given fechamento aprovado, When POST /report/generate {type: client}, Then gera PDF simplificado com DRE, graficos, destaques. Sem dados internos do BPO (notas do analista, comentarios de revisao). |
| US-P14 | Frontend: Chat do cliente | 3 | Given threads existentes, When cliente abre /portal/messages, Then ve interface tipo WhatsApp com lista de threads + conversa. |
| US-P15 | Frontend: Relatorios do cliente | 2 | Given 3 relatorios disponiveis, When cliente abre /portal/reports, Then ve cards por periodo com download PDF e botao assinar. |

### 3.7 Regras de Negocio Invisiveis

1. **Dashboard do cliente e snapshot, nao real-time.** O empresario nao precisa de dado em tempo real. Atualizar a cada 6 horas e suficiente. Isso evita queries pesadas e mantem o portal rapido. O cron de snapshot roda 4x por dia.

2. **Alcada de aprovacao e sagrada.** Se o contrato diz que o dono aprova acima de R$10.000, o sistema NAO pode permitir que o gerente aprove R$15.000. Isso e controle interno. Violar alcada e risco juridico.

3. **Relatorio do cliente != relatorio interno.** O PDF do cliente mostra DRE simplificada, sem categorias detalhadas, sem notas do analista, sem comentarios de revisao. O empresario quer saber "ganhei ou perdi dinheiro", nao detalhes de conciliacao.

4. **Notificacao WhatsApp tem custo.** Cada mensagem via Gupshup custa. O sistema deve ter um controle de frequencia: no maximo 1 notificacao por dia por cliente via WhatsApp, consolidando todas as pendencias numa unica mensagem. Email pode ser ilimitado.

5. **Pendencia expirada nao desaparece.** Se o cliente nao respondeu em 15 dias, o status muda para "expired" mas a pendencia continua visivel. O analista decide se fecha o mes sem o documento ou cobra novamente.

6. **Chat substitui WhatsApp, mas nao proibe.** O chat do portal existe para ter historico rastreavel vinculado a empresa/mes. Mas o analista pode continuar usando WhatsApp se preferir -- o importante e que decisoes de negocio (aprovacoes, classificacoes) passem pelo portal.

7. **Upload com OCR e validacao basica.** Quando o cliente envia um comprovante, o OCR extrai valor e data. Se o valor do comprovante nao bate com o valor da pendencia (diferenca > 5%), alerta o analista: "Comprovante de R$3.200 para pendencia de R$3.500 -- verificar."

8. **Branding e do escritorio, nao da plataforma.** Todo o portal -- login, dashboard, emails, PDFs -- usa logo e cores do escritorio de BPO (ja previsto em `branding_configs` do PRD). O cliente nem sabe que existe uma plataforma por tras. Isso e critical para stickiness.

9. **Primeiro acesso do cliente.** Na primeira vez que o cliente acessa o portal, mostrar um onboarding de 3 telas: "Aqui voce ve seus saldos", "Aqui voce responde pendencias", "Aqui voce conversa com seu analista". Depois nao mostra mais.

10. **Sessao do portal para analytics.** Registrar quanto tempo o cliente passa no portal, quais paginas visita, quantas acoes realiza. Isso e ouro para o BPO: "Cliente X nunca acessa o portal" = risco de churn. "Cliente Y acessa todo dia" = engajado.

---

## RESUMO DE ENTREGAVEIS

### Tabelas novas: 28

| Modulo | Tabelas | Total |
|--------|---------|-------|
| Fechamento Mensal | monthly_closings, closing_checklist_templates, closing_checklist_items, closing_blocking_issues, closing_history, closing_reports | 6 |
| Workflow BPO | analyst_portfolios, analyst_profiles_extended, bpo_tasks, sla_configs, sla_tracking, company_operation_tracking, task_comments, productivity_metrics, transaction_review_comments | 9 |
| Portal do Cliente | client_users, client_sessions, client_tasks, client_messages, client_notifications, client_report_access, client_dashboard_snapshots | 7 |
| **Total de tabelas novas** | | **22** |

(Nota: `sla_configs` ja existe no PRD mas com schema diferente. A versao acima e mais completa. 6 tabelas do PRD original serao estendidas/complementadas.)

### Endpoints novos: 95

| Modulo | Endpoints |
|--------|-----------|
| Fechamento Mensal | 22 |
| Workflow BPO | 38 |
| Portal do Cliente | 35 |
| **Total** | **95** |

### Sprints: 9 sprints de 2 semanas

| Sprint | Modulo | SP |
|--------|--------|-----|
| C1 | Fechamento: Schema + CRUD + Checks | 21 |
| C2 | Fechamento: Pendencias + Workflow | 18 |
| C3 | Fechamento: Relatorio + Frontend | 23 |
| W1 | Workflow: Carteira + Tarefas | 24 |
| W2 | Workflow: SLA + Status + Revisao | 21 |
| W3 | Workflow: Produtividade + Frontend | 21 |
| P1 | Portal: Auth + Dashboard | 24 |
| P2 | Portal: Pendencias + Aprovacoes | 21 |
| P3 | Portal: Chat + Relatorios | 21 |
| **Total** | | **194 SP** |

### Sequencia recomendada

1. **W1 e W2 primeiro** (Workflow) -- sem saber quem cuida de quem, nada funciona
2. **C1 e C2 depois** (Fechamento) -- depende do workflow para atribuicao de analista
3. **W3 e C3 em paralelo** (Frontend de ambos)
4. **P1, P2, P3 por ultimo** (Portal) -- depende do fechamento para relatorios e do workflow para pendencias

Total estimado: 18 semanas (4.5 meses) com 1 backend + 1 frontend. Com 2 backends e 1 frontend, reduz para 12 semanas.

---

### Critical Files for Implementation

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md` -- PRD base que define as 17 tabelas core (organizations, companies, profiles, bank_transactions, tiny_contas_pagar, tiny_contas_receber, reconciliations, etc) sobre as quais os 3 modulos se integram. Todas as foreign keys dos novos schemas referenciam tabelas definidas aqui.
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` -- Regras de negocio do Tiny ERP (limitacoes da API V2/V3, regras de baixa, categorias, marcadores) que impactam diretamente as check functions do fechamento mensal e a geracao de relatorios.
- `C:/CLAUDECODE/BusinessAnalytics/src/integrations/supabase/types.ts` -- Tipos TypeScript do Supabase que precisam ser estendidos com as 22 novas tabelas. Define a interface entre frontend e banco.
- `C:/CLAUDECODE/.claude/projects/C--/memory/user_stack_tecnico.md` -- Stack tecnico padrao (NestJS, Supabase, React, shadcn/ui) e regras tecnicas fixas (RLS, UUID, snake_case, soft delete) que governam todas as decisoes de schema e API dos 3 modulos.
- `C:/CLAUDECODE/.claude.json` -- Configuracao do projeto que define contexto organizacional e regras de seguranca (service_role nunca no frontend, RLS 100%, AES-256 para credenciais) que impactam o design da auth separada do portal do cliente.

---

# PARTE IV — BACKBONE FISCAL E CONTÁBIL

> Gestão de Documentos, Plano de Contas e Centros de Custo, e Integração Contábil — o lastro do dinheiro.

---


---

# PLANO DE ARQUITETURA: 3 MODULOS FISCAIS/CONTABEIS PARA BPO FINANCEIRO

## DIAGNOSTICO DO ESTADO ATUAL

Apos analisar todo o codebase, a situacao e a seguinte:

- **Frontend (BusinessAnalytics)**: React + Vite + shadcn/ui + TanStack Query + Supabase. Tabelas existentes no Supabase: `fato_financeiro` (com campos `tipo_movimento`, `categoria`, `subcategoria`, `valor`, `data`, `origem`, `unidade_negocio_id`), `fato_vendas`, `unidades_negocio`, `user_profiles`. DRE ja existe mas calcula tudo em memoria no frontend a partir de categorias flat da `fato_financeiro`.
- **Backend planejado (PRD)**: NestJS com 17 tabelas, 11 modulos, 80 endpoints. Inclui `organizations`, `companies`, `bank_transactions`, `tiny_contas_pagar`, `tiny_contas_receber`, `reconciliations`, `audit_log`.
- **Integracao Tiny**: V2 + V3 com limitacoes documentadas (V3 nao salva categoria, V2 nao tem endpoint de alteracao, V3 tem bug de paginacao).
- **Mapa de categorias existente**: `PROCESSOS_FINANCEIRO.md` tem mapeamento Conta Simples -> Tiny (ex: "Trafego Pago Engagge" -> "Despesa de Marketing - EngaggePlacas").
- **Problema critico**: O DRE atual (`DRE.tsx` e `useFinanceiroData.ts`) e um calculo bruto que filtra por strings de categoria flat. Nao existe plano de contas hierarquico, nao existe centro de custo, nao existe vinculacao de documentos, nao existe exportacao contabil. O financeiro e **funcional mas inauditavel**.

---

# MODULO 1: GESTAO DE DOCUMENTOS FISCAIS

## 1.1 Justificativa de Negocio

Operei BPO contabil por anos. A bomba-relogio numero um e lançamento sem lastro documental. Quando o fiscal da Receita pede "cadê a nota desta despesa de R$14.800 de outubro?", o cliente tem 72h para apresentar. Se nao tem, a despesa e glosada, paga imposto em cima, mais multa de 75%. Para PME com faturamento de R$200k/mes, uma glosa de R$50k em despesas representa R$4.500 de IRPJ+CSLL que nao deveria pagar.

Alem disso, o contador recebe todo mes uma caixa de sapato com papeis soltos. O BPO que entrega documentos organizados por competencia, com indice CSV e nomeacao padronizada, cobra R$500-1.000 a mais por empresa/mes e o cliente paga feliz porque a alternativa e contratar um auxiliar administrativo por R$2.500.

No caso especifico do Grupo Lauxen (Atacado Neon, BlueLight, Industrias Neon, Engagge, RYU), sao 4+ empresas com centenas de lancamentos/mes cada. Sem gestao de documentos, o processo de fechamento mensal leva 5 dias uteis e depende de WhatsApp pedindo nota a fornecedor. Com o modulo, cai para 2 dias.

## 1.2 Schema PostgreSQL Completo

```sql
-- =============================================================
-- MODULO 1: GESTAO DE DOCUMENTOS FISCAIS
-- =============================================================

-- ENUM types
CREATE TYPE document_type AS ENUM (
  'nfe_xml',        -- NF-e XML
  'nfe_danfe',      -- DANFE PDF
  'nfse',           -- NFS-e (servico)
  'boleto',         -- Boleto bancario
  'comprovante',    -- Comprovante de pagamento (PIX, TED, deposito)
  'contrato',       -- Contrato de fornecimento/servico
  'recibo',         -- Recibo simples
  'guia_imposto',   -- DARF, DAS, guia ISS
  'outros'          -- Catch-all
);

CREATE TYPE document_status AS ENUM (
  'pendente',       -- Lancamento sem documento
  'recebido',       -- Upload feito, nao validado
  'validado',       -- Conferido pelo analista
  'rejeitado',      -- Documento errado, ilegível, valor divergente
  'arquivado'       -- Vinculado e fechado (mes encerrado)
);

-- Tabela principal de documentos
CREATE TABLE documents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  -- Tipo e status
  document_type   document_type NOT NULL,
  status          document_status NOT NULL DEFAULT 'recebido',
  
  -- Arquivo fisico
  storage_path    TEXT NOT NULL,             -- path no Supabase Storage
  original_name   TEXT NOT NULL,             -- nome original do arquivo
  mime_type       TEXT NOT NULL,             -- application/pdf, text/xml, image/jpeg
  file_size       INTEGER NOT NULL,          -- bytes
  file_hash       TEXT NOT NULL,             -- SHA256 anti-duplicata
  
  -- Competencia (CRITICO para organizacao)
  competencia_ano   INTEGER NOT NULL,        -- 2026
  competencia_mes   INTEGER NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12), -- 4
  
  -- Dados extraidos (OCR/XML parsing)
  extracted_data  JSONB DEFAULT '{}',
  -- Para NF-e XML: { chave_acesso, numero_nf, serie, cnpj_emitente, cnpj_destinatario, 
  --                  valor_total, valor_icms, valor_pis, valor_cofins, data_emissao, 
  --                  descricao_itens[], natureza_operacao }
  -- Para Boleto: { linha_digitavel, codigo_barras, valor, vencimento, 
  --               cnpj_beneficiario, nome_beneficiario }
  -- Para Comprovante: { valor, data, tipo_transacao (PIX/TED/DOC), 
  --                     cpf_cnpj_origem, cpf_cnpj_destino, banco_origem, banco_destino }
  
  -- OCR
  ocr_raw_text     TEXT,                     -- texto bruto do OCR
  ocr_confidence   NUMERIC(5,2),             -- 0-100 confianca do OCR
  ocr_processed_at TIMESTAMPTZ,
  
  -- Validacao
  validated_by     UUID REFERENCES profiles(id),
  validated_at     TIMESTAMPTZ,
  rejection_reason TEXT,                     -- motivo se status = rejeitado
  
  -- Versionamento
  version          INTEGER NOT NULL DEFAULT 1,
  parent_id        UUID REFERENCES documents(id), -- documento que este substitui
  is_current       BOOLEAN NOT NULL DEFAULT true, -- false para versoes anteriores
  
  -- Metadata
  notes            TEXT,
  tags             TEXT[] DEFAULT '{}',       -- tags livres para busca
  created_by       UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ                -- soft delete
);

-- Indice para busca por competencia (pasta virtual)
CREATE INDEX idx_documents_competencia 
  ON documents(org_id, company_id, competencia_ano, competencia_mes, document_type)
  WHERE deleted_at IS NULL;

-- Indice para dedup por hash
CREATE UNIQUE INDEX idx_documents_hash_unique 
  ON documents(org_id, file_hash) 
  WHERE deleted_at IS NULL AND is_current = true;

-- Indice para busca por dados extraidos (GIN em JSONB)
CREATE INDEX idx_documents_extracted_data 
  ON documents USING GIN (extracted_data jsonb_path_ops);

-- Indice trigram para busca textual no OCR
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_documents_ocr_text_trgm 
  ON documents USING GIN (ocr_raw_text gin_trgm_ops);

-- Indice para busca por status pendente (fila de trabalho)
CREATE INDEX idx_documents_status_pending
  ON documents(org_id, company_id, status)
  WHERE deleted_at IS NULL AND status IN ('pendente', 'recebido');

-- Tabela de vinculacao: documento <-> lancamento (M:N)
CREATE TABLE document_links (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  document_id     UUID NOT NULL REFERENCES documents(id),
  
  -- Entidade vinculada (polimorfica)
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'conta_pagar', 'conta_receber', 'bank_transaction', 
    'reconciliation', 'tax_entry', 'payroll_entry'
  )),
  entity_id       UUID NOT NULL,
  
  -- Metadata do vinculo
  link_type       TEXT NOT NULL DEFAULT 'comprovante' CHECK (link_type IN (
    'comprovante',    -- documento comprova o lancamento
    'nota_fiscal',    -- NF do lancamento
    'contrato',       -- contrato que originou
    'boleto',         -- boleto do pagamento
    'guia',           -- guia de imposto
    'suporte'         -- documento de apoio
  )),
  
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(document_id, entity_type, entity_id)
);

CREATE INDEX idx_document_links_entity 
  ON document_links(entity_type, entity_id);

CREATE INDEX idx_document_links_document 
  ON document_links(document_id);

-- Configuracao de obrigatoriedade de documentos por empresa
CREATE TABLE document_policies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  -- Regras
  min_value_requires_doc   NUMERIC(14,2) NOT NULL DEFAULT 100.00,  -- acima de R$X exige doc
  doc_required_for_types   TEXT[] DEFAULT ARRAY['conta_pagar', 'conta_receber'], 
  block_closing_without_doc BOOLEAN NOT NULL DEFAULT false,         -- bloqueia fechamento?
  auto_alert_days_before   INTEGER NOT NULL DEFAULT 5,              -- alertar X dias antes do fechamento
  
  -- Categorias isentas (ex: taxas bancarias nao precisam de NF)
  exempt_categories        TEXT[] DEFAULT '{}',
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, company_id)
);

-- Fila de pendencias documentais (materializada para performance)
CREATE TABLE document_pendencies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  entity_description TEXT,              -- "CP #1234 - Fornecedor X - R$ 5.600,00"
  entity_value    NUMERIC(14,2),
  entity_date     DATE,
  
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'resolvido', 'isento')),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES profiles(id),
  exempt_reason   TEXT,                 -- motivo se isento
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, entity_type, entity_id)
);

CREATE INDEX idx_doc_pendencies_open 
  ON document_pendencies(org_id, company_id, competencia_ano, competencia_mes, status)
  WHERE status = 'pendente';

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pendencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_org_isolation" ON documents
  FOR ALL USING (org_id = get_org_id());

CREATE POLICY "document_links_org_isolation" ON document_links
  FOR ALL USING (org_id = get_org_id());

CREATE POLICY "document_policies_org_isolation" ON document_policies
  FOR ALL USING (org_id = get_org_id());

CREATE POLICY "document_pendencies_org_isolation" ON document_pendencies
  FOR ALL USING (org_id = get_org_id());

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function para gerar pendencias automaticamente
-- (chamada via trigger ou cron quando CP/CR sao criadas/sincronizadas)
CREATE OR REPLACE FUNCTION generate_document_pendency(
  p_org_id UUID,
  p_company_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_description TEXT,
  p_value NUMERIC,
  p_date DATE,
  p_competencia_ano INTEGER,
  p_competencia_mes INTEGER
) RETURNS UUID AS $$
DECLARE
  v_policy document_policies;
  v_min_value NUMERIC;
  v_id UUID;
BEGIN
  -- Buscar politica da empresa
  SELECT * INTO v_policy 
  FROM document_policies 
  WHERE org_id = p_org_id AND company_id = p_company_id;
  
  -- Valor minimo (default 100 se nao tem politica)
  v_min_value := COALESCE(v_policy.min_value_requires_doc, 100.00);
  
  -- So gera pendencia se valor >= minimo e tipo exige doc
  IF p_value >= v_min_value 
     AND p_entity_type = ANY(COALESCE(v_policy.doc_required_for_types, 
                                       ARRAY['conta_pagar', 'conta_receber'])) THEN
    INSERT INTO document_pendencies (
      org_id, company_id, entity_type, entity_id, 
      entity_description, entity_value, entity_date,
      competencia_ano, competencia_mes
    ) VALUES (
      p_org_id, p_company_id, p_entity_type, p_entity_id,
      p_description, p_value, p_date,
      p_competencia_ano, p_competencia_mes
    )
    ON CONFLICT (org_id, entity_type, entity_id) DO NOTHING
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function para resolver pendencia quando documento e vinculado
CREATE OR REPLACE FUNCTION resolve_pendency_on_link()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE document_pendencies
  SET status = 'resolvido',
      resolved_at = now(),
      resolved_by = NEW.created_by
  WHERE org_id = NEW.org_id
    AND entity_type = NEW.entity_type
    AND entity_id = NEW.entity_id
    AND status = 'pendente';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_resolve_pendency
  AFTER INSERT ON document_links
  FOR EACH ROW EXECUTE FUNCTION resolve_pendency_on_link();
```

## 1.3 Endpoints NestJS

```
DocumentModule (16 endpoints)

# Upload e CRUD
POST   /api/documents/upload              -- Upload com multipart, aceita multiplos arquivos
POST   /api/documents/upload/camera       -- Upload via captura camera (base64)
GET    /api/documents                     -- Lista com filtros (company, competencia, type, status)
GET    /api/documents/:id                 -- Detalhe com links e versoes
PATCH  /api/documents/:id                 -- Atualizar metadata (notes, tags, competencia)
DELETE /api/documents/:id                 -- Soft delete
GET    /api/documents/:id/download        -- Signed URL para download (15min TTL)
GET    /api/documents/:id/versions        -- Historico de versoes
POST   /api/documents/:id/replace         -- Upload nova versao (parent_id = id anterior)

# Vinculacao
POST   /api/documents/link                -- Vincular documento a entidade
DELETE /api/documents/link/:id            -- Desvincular
GET    /api/documents/by-entity/:type/:id -- Documentos de uma entidade especifica

# Validacao
POST   /api/documents/:id/validate        -- Marcar como validado
POST   /api/documents/:id/reject          -- Marcar como rejeitado + motivo

# OCR
POST   /api/documents/:id/ocr             -- Processar OCR (async via BullMQ)
POST   /api/documents/ocr/batch           -- OCR em lote

# Pendencias
GET    /api/documents/pendencies          -- Listar pendencias por empresa/competencia
POST   /api/documents/pendencies/:id/exempt -- Isentar pendencia com motivo
GET    /api/documents/pendencies/summary   -- Resumo: X pendentes, Y resolvidos, Z isentos

# Politicas
GET    /api/documents/policies/:companyId  -- Buscar politica da empresa
PUT    /api/documents/policies/:companyId  -- Criar/atualizar politica

# Exportacao para contabilidade
POST   /api/documents/export              -- Gerar ZIP + indice CSV por competencia
GET    /api/documents/export/:id/download  -- Baixar ZIP gerado

# Busca avancada
POST   /api/documents/search              -- Busca por CNPJ, valor, numero NF, texto OCR
```

**Logica do Upload (POST /api/documents/upload):**

1. Recebe multipart/form-data com arquivo(s) + metadata (company_id, competencia, document_type)
2. Calcula SHA256 do arquivo. Se hash ja existe no org_id, retorna 409 Conflict com link para documento existente
3. Armazena no Supabase Storage: `documents/{org_id}/{company_id}/{ano}/{mes}/{type}/{uuid}.{ext}`
4. Se XML: parse imediato do NF-e, extrai chave_acesso, CNPJ, valores, itens. Preenche extracted_data
5. Se PDF/imagem: enfileira job OCR no BullMQ (nao bloqueia upload)
6. Cria registro na tabela documents
7. Se entity_type e entity_id foram informados, cria link automatico + resolve pendencia
8. Retorna documento criado com URL assinada para preview

**Logica do OCR (BullMQ job):**

1. Baixa arquivo do Supabase Storage
2. Se PDF: converte para imagem via pdf-lib/sharp
3. Envia para Google Cloud Vision ou Tesseract.js (on-premises para custo)
4. Aplica regex especializados para extrair dados:
   - Boleto: `/\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14}/` (linha digitavel)
   - NF DANFE: `/CHAVE DE ACESSO.*?(\d{44})/s` + valor total, CNPJ
   - Comprovante PIX: `/PIX.*?R\$\s*([\d.,]+)/s` + data, CPF/CNPJ
5. Atualiza extracted_data + ocr_confidence no documento
6. Se confidence > 85%, tenta auto-vincular: busca CP/CR com mesmo valor +/- R$0.05 e data +/- 5 dias

**Logica da Exportacao (POST /api/documents/export):**

1. Recebe company_id, competencia_ano, competencia_mes
2. Busca todos os documentos da competencia com status validado ou arquivado
3. Gera nome padronizado: `{TIPO}_{NUMERO}_{FORNECEDOR}_{COMPETENCIA}.{ext}` 
   - Ex: `NF_123456_FornecedorXYZ_2026-04.pdf`
   - Ex: `BOLETO_789_BancoABC_2026-04.pdf`
   - Ex: `COMPROVANTE_PIX_ClienteJoao_2026-04-05.pdf`
4. Gera indice CSV:
   ```
   arquivo,tipo,numero,cnpj,valor,data,competencia,conta_contabil,centro_custo,entidade_vinculada
   NF_123456_FornecedorXYZ_2026-04.pdf,nfe_xml,123456,12.345.678/0001-90,5600.00,2026-04-10,2026-04,3.1.01.01,Marketing,CP #4567
   ```
5. Compacta tudo em ZIP, armazena no Storage com TTL de 7 dias
6. Retorna URL para download

## 1.4 UX/Telas

**Tela 1: Documentos (`/documents`)**

- Header: Company selector + competencia (mes/ano picker) + filtros (tipo, status) + botao [Upload]
- Visualizacao em pasta virtual: arvore lateral `Empresa > 2026 > Abril > NF / Boleto / Comprovante / Contrato`
- Grid de documentos: thumbnail + nome + tipo badge + status badge + valor + CNPJ + data + acoes
- Drag & drop zone global (arrasta arquivo em qualquer lugar da tela)
- Preview inline: clicar abre viewer PDF/imagem no painel direito (split 60/40)
- Badge de contagem no sidebar: "12 pendentes" em vermelho

**Tela 2: Upload Modal**

- Drag & drop area grande (200px) com texto "Arraste arquivos ou clique para selecionar"
- Deteccao automatica do tipo pelo conteudo: XML = NF-e, PDF com "DANFE" no OCR = DANFE, PDF com linha digitavel = Boleto
- Preview de dados extraidos em tempo real (para XML: mostra dados da NF imediatamente)
- Campos: empresa (pre-selecionada), competencia (default: mes atual), tipo (auto-detectado, editavel), vinculacao opcional (select de CP/CR pendentes)
- Botao camera para mobile: abre camera, tira foto, crop automatico, upload

**Tela 3: Fila de Pendencias (`/documents/pendencies`)**

- Tabela com filtros: empresa, competencia, valor minimo
- Colunas: Tipo | Descricao | Valor | Data | Competencia | Status | Acao
- Botao [Upload] inline em cada pendencia (abre upload ja vinculado)
- Botao [Isentar] com motivo obrigatorio (select: "Taxa bancaria", "Compensacao interna", "Outro" + texto livre)
- KPIs no topo: Total pendentes | Valor total sem documento | % cobertura documental

**Tela 4: Painel no Lancamento (CP/CR/Extrato)**

- Aba "Documentos" em todo detalhe de lancamento
- Lista de documentos vinculados com thumbnail + preview
- Botao [+ Anexar] abre file picker ou drag & drop
- Indicador visual na lista de lancamentos: icone clip verde (tem doc) / vermelho pulsante (sem doc, acima do minimo)

## 1.5 Sprint Breakdown

**Sprint D1 (2 semanas): Foundation + Upload + Storage**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| DOC-001 | Schema documents + document_links + RLS | 5 | Tabelas criadas, RLS testado, migration aplicada |
| DOC-002 | Upload endpoint com hash dedup e Storage | 8 | Upload PDF/XML/IMG, SHA256 dedup, signed URLs |
| DOC-003 | CRUD documentos (list, detail, update, delete) | 5 | Filtros por empresa/competencia/tipo/status |
| DOC-004 | Vinculacao documento a CP/CR/extrato | 3 | Link/unlink, busca por entidade |
| DOC-005 | Upload UI com drag & drop | 5 | Drop zone, preview, progress bar, multiple files |

**Sprint D2 (2 semanas): OCR + Validacao + Pendencias**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| DOC-006 | Parser XML NF-e (chave acesso, CNPJ, valores) | 5 | Parse real de XML NF-e, extracted_data preenchido |
| DOC-007 | OCR para PDF/imagem via BullMQ | 8 | Job async, extrai texto, regex boleto/comprovante |
| DOC-008 | Validacao/rejeicao por analista | 3 | Fluxo validar/rejeitar com motivo, audit log |
| DOC-009 | Politicas e pendencias automaticas | 5 | Config por empresa, gera pendencias em CP/CR sync |
| DOC-010 | Tela de pendencias com KPIs | 5 | Lista, isentar, upload inline, metricas |

**Sprint D3 (2 semanas): Export + Versionamento + Polish**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| DOC-011 | Exportacao ZIP + indice CSV | 5 | Nomeacao padronizada, CSV completo, download |
| DOC-012 | Versionamento (substituir doc mantendo historico) | 3 | Upload nova versao, parent_id, is_current toggle |
| DOC-013 | Busca avancada (CNPJ, valor, texto OCR, num NF) | 5 | Trigram + GIN JSONB, resultados relevantes |
| DOC-014 | Painel de documentos na tela de conciliacao | 3 | Aba documentos em CP/CR, indicador visual |
| DOC-015 | Captura por camera mobile | 3 | Camera API, crop, upload base64 |

## 1.6 Regras de Negocio Invisiveis

1. **Competencia nao e data do documento**: Uma NF emitida em 30/03 pode ter competencia 04 se o servico foi prestado em abril. O sistema deve permitir o usuario definir competencia independente da data do documento. NUNCA inferir competencia automaticamente sem permitir override.

2. **XML e verdade, DANFE e copia**: Se o usuario sobe um XML de NF-e, os dados extraidos sao 100% confiaveis (assinatura digital). Se sobe um DANFE (PDF), e uma representacao visual e pode ter sido adulterada. O sistema deve marcar: XML = confianca 100%, DANFE = confianca 90% (OCR), Foto = confianca 70%.

3. **Boleto pago != comprovante de pagamento**: Ter o boleto nao prova que pagou. Precisa do comprovante bancario. O sistema deve alertar quando um lancamento de CP tem boleto mas nao tem comprovante.

4. **Documento de fornecedor com CNPJ diferente**: Acontece o tempo todo. Fornecedor muda CNPJ (filial vs matriz), ou nota e emitida por empresa do grupo. O sistema nao deve bloquear, mas deve alertar: "CNPJ do documento (X) difere do fornecedor cadastrado (Y)".

5. **Nota de entrada vs nota de saida**: Para atacado/industria, a NF do fornecedor e nota de ENTRADA. A NF que a empresa emite e nota de SAIDA. Os dois tipos precisam ser armazenados. O `document_type` deve distinguir mas na pratica o campo `entity_type` (conta_pagar = entrada, conta_receber = saida) resolve.

6. **Documento compartilhado entre empresas**: No grupo Lauxen, um aluguel pode ser rateado entre Neon + Engagge + RYU. Um unico contrato/boleto se vincula a lancamentos de empresas diferentes. A tabela `document_links` permite isso (o documento tem company_id = empresa do contrato, mas os links apontam para CPs de empresas diferentes).

7. **Retencao legal**: Documentos fiscais precisam ser mantidos por 5 anos (IRPJ/CSLL) ou 10 anos (trabalhistas). O soft delete NUNCA deve expirar automaticamente. O storage precisa de lifecycle policy que nao apague nada com menos de 5 anos.

---

# MODULO 2: PLANO DE CONTAS E CENTROS DE CUSTO

## 2.1 Justificativa de Negocio

O DRE atual do BusinessAnalytics (`DRE.tsx`) calcula receitas e despesas filtrando strings flat como `categoria === "custo_produto"` e `categoria === "marketing"`. Isso tem tres problemas fatais:

**Problema 1 - Granularidade**: "Despesa administrativa" agrupa aluguel (R$8k/mes fixo) com material de escritorio (R$200 eventual). Quando o Everton pergunta "por que a despesa administrativa subiu 40%?", ninguem sabe responder sem abrir cada lancamento.

**Problema 2 - Multi-empresa sem rateio**: O aluguel do escritorio e R$12k/mes para tres empresas. Hoje cai todo em uma empresa. O DRE da Neon esta inflado, o da Engagge esta deflacionado. A decisao gerencial sobre qual empresa e lucrativa esta baseada em dados errados.

**Problema 3 - Comunicacao com contador**: O contador trabalha com plano de contas estruturado (1.1.01 = Caixa, 3.1.01 = Receita Vendas). O BPO exporta categorias flat que o contador precisa re-mapear manualmente todo mes. Isso custa 2-4h do contador e gera erros de classificacao.

Para o Grupo Lauxen especificamente: com 4 empresas + rateio de custos compartilhados (escritorio, tecnologia, administrativo), o plano de contas hierarquico + centros de custo economiza R$3-5k/mes em horas de contador + elimina erros de classificacao que distorcem o DRE em ate 15%.

## 2.2 Schema PostgreSQL Completo

```sql
-- =============================================================
-- MODULO 2: PLANO DE CONTAS E CENTROS DE CUSTO
-- =============================================================

-- Plano de contas gerencial (hierarquico)
CREATE TABLE chart_of_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID REFERENCES companies(id),  -- NULL = plano padrao do org
  
  -- Hierarquia
  parent_id       UUID REFERENCES chart_of_accounts(id),
  code            TEXT NOT NULL,                   -- "3.1.01.01" 
  name            TEXT NOT NULL,                   -- "Receita de Vendas - Produtos"
  level           INTEGER NOT NULL DEFAULT 1,      -- 1=grupo, 2=subgrupo, 3=conta, 4=subconta
  path            TEXT NOT NULL,                   -- "3.1.01.01" (materializado para queries)
  full_path_names TEXT NOT NULL,                   -- "Receita > Receita Operacional > Vendas > Produtos"
  
  -- Classificacao
  nature          TEXT NOT NULL CHECK (nature IN ('debit', 'credit')),
  account_group   TEXT NOT NULL CHECK (account_group IN (
    'ativo', 'passivo', 'patrimonio_liquido',      -- patrimoniais
    'receita', 'deducao_receita',                   -- resultado
    'custo', 'despesa_operacional', 'despesa_financeira',
    'outras_receitas', 'outras_despesas'
  )),
  
  -- Mapeamento contabil
  accounting_code  TEXT,                           -- codigo no sistema contabil (ex: "3.1.01.01")
  accounting_name  TEXT,                           -- nome no sistema contabil
  
  -- Mapeamento Tiny (para categorias existentes)
  tiny_category_name TEXT,                         -- nome da categoria no Tiny ERP
  
  -- Comportamento
  is_synthetic     BOOLEAN NOT NULL DEFAULT false, -- true = conta pai (nao recebe lancamento)
  is_active        BOOLEAN NOT NULL DEFAULT true,
  allows_direct_posting BOOLEAN NOT NULL DEFAULT true,
  
  -- Ordem e display
  sort_order       INTEGER NOT NULL DEFAULT 0,
  color            TEXT,                           -- cor opcional para graficos
  icon             TEXT,                           -- icone lucide opcional
  
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  
  -- Unicidade: mesmo codigo nao repete no mesmo org+company
  UNIQUE(org_id, company_id, code)
);

CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_coa_path ON chart_of_accounts(org_id, path) WHERE deleted_at IS NULL;
CREATE INDEX idx_coa_tiny ON chart_of_accounts(org_id, tiny_category_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_coa_group ON chart_of_accounts(org_id, account_group) WHERE deleted_at IS NULL;

-- Centro de custo (hierarquico)
CREATE TABLE cost_centers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  
  -- Hierarquia
  parent_id       UUID REFERENCES cost_centers(id),
  code            TEXT NOT NULL,                   -- "01.02.03"
  name            TEXT NOT NULL,                   -- "Marketing Digital"
  level           INTEGER NOT NULL DEFAULT 1,      -- 1=empresa, 2=unidade, 3=departamento, 4=projeto
  path            TEXT NOT NULL,                   -- caminho materializado
  full_path_names TEXT NOT NULL,                   -- "Atacado Neon > Comercial > Marketing Digital"
  
  -- Vinculacao empresa (opcional - CC pode ser cross-company)
  company_id      UUID REFERENCES companies(id),   -- NULL = centro de custo corporativo
  
  -- Comportamento
  is_active        BOOLEAN NOT NULL DEFAULT true,
  allows_direct_posting BOOLEAN NOT NULL DEFAULT true,
  
  -- Budget
  monthly_budget   NUMERIC(14,2),                  -- orcamento mensal
  
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  
  UNIQUE(org_id, code)
);

CREATE INDEX idx_cc_parent ON cost_centers(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cc_company ON cost_centers(org_id, company_id) WHERE deleted_at IS NULL;

-- Templates de rateio reutilizaveis
CREATE TABLE apportionment_templates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  
  name            TEXT NOT NULL,                   -- "Rateio Aluguel Escritorio"
  description     TEXT,
  
  -- Criterio
  criteria        TEXT NOT NULL CHECK (criteria IN (
    'fixed_percentage',   -- percentual fixo
    'revenue',            -- proporcional a receita
    'headcount',          -- proporcional a headcount
    'area',               -- proporcional a area ocupada
    'volume',             -- proporcional a volume
    'custom'              -- criterio personalizado
  )),
  
  -- Distribuicao (para fixed_percentage)
  distribution    JSONB NOT NULL DEFAULT '[]',
  -- Ex: [
  --   { "company_id": "uuid-neon", "cost_center_id": "uuid-cc", "percentage": 40.00 },
  --   { "company_id": "uuid-engagge", "cost_center_id": "uuid-cc2", "percentage": 35.00 },
  --   { "company_id": "uuid-ryu", "cost_center_id": "uuid-cc3", "percentage": 25.00 }
  -- ]
  
  -- Para criterios dinamicos
  criteria_config  JSONB DEFAULT '{}',
  -- Ex revenue: { "period_months": 3, "revenue_account_group": "receita" }
  -- Ex headcount: { "source": "manual", "values": { "uuid-neon": 15, "uuid-engagge": 8, "uuid-ryu": 5 } }
  
  -- Categorias que usam este template
  applicable_categories TEXT[] DEFAULT '{}',       -- categorias Tiny que ativam auto-rateio
  applicable_account_ids UUID[] DEFAULT '{}',      -- contas do plano que ativam auto-rateio
  
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rateios realizados (historico)
CREATE TABLE apportionments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  
  -- Origem
  template_id     UUID REFERENCES apportionment_templates(id),
  source_entity_type TEXT NOT NULL,                -- 'conta_pagar', 'bank_transaction'
  source_entity_id   UUID NOT NULL,
  source_value    NUMERIC(14,2) NOT NULL,
  
  -- Competencia
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  
  -- Resultado do rateio
  distribution    JSONB NOT NULL,
  -- Ex: [
  --   { "company_id": "uuid", "cost_center_id": "uuid", "account_id": "uuid", 
  --     "percentage": 40.00, "value": 4800.00 }
  -- ]
  
  -- Validacao: soma dos percentuais = 100 e soma dos valores = source_value
  total_percentage NUMERIC(7,4) NOT NULL CHECK (total_percentage BETWEEN 99.99 AND 100.01),
  total_value     NUMERIC(14,2) NOT NULL,
  
  -- Metadata
  method          TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('manual', 'auto_template', 'auto_rule')),
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at     TIMESTAMPTZ,
  reversed_by     UUID REFERENCES profiles(id)
);

CREATE INDEX idx_apportionments_source 
  ON apportionments(source_entity_type, source_entity_id);
CREATE INDEX idx_apportionments_competencia 
  ON apportionments(org_id, competencia_ano, competencia_mes);

-- Regras de categorizacao automatica (motor de regras)
CREATE TABLE categorization_rules (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID REFERENCES companies(id),  -- NULL = regra para todas as empresas
  
  -- Condicoes (AND entre todas)
  conditions      JSONB NOT NULL,
  -- Ex: {
  --   "cnpj": "12.345.678/0001-90",
  --   "description_contains": "ALUGUEL",
  --   "value_min": 1000.00,
  --   "value_max": 15000.00,
  --   "transaction_type": "debit"
  -- }
  
  -- Acoes
  account_id       UUID REFERENCES chart_of_accounts(id),
  cost_center_id   UUID REFERENCES cost_centers(id),
  template_id      UUID REFERENCES apportionment_templates(id), -- auto-ratear
  
  -- Metadata
  name            TEXT NOT NULL,                   -- "Aluguel Escritorio - Ratear"
  priority        INTEGER NOT NULL DEFAULT 100,    -- menor = maior prioridade
  confidence      NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'learned', 'imported')),
  
  -- Stats
  times_applied   INTEGER NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  times_overridden INTEGER NOT NULL DEFAULT 0,
  
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cat_rules_active 
  ON categorization_rules(org_id, company_id, priority)
  WHERE is_active = true;

-- Classificacao dos lancamentos (vincula lancamento a conta + CC)
CREATE TABLE entry_classifications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  -- Entidade classificada
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'conta_pagar', 'conta_receber', 'bank_transaction'
  )),
  entity_id       UUID NOT NULL,
  
  -- Classificacao
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id),
  cost_center_id  UUID REFERENCES cost_centers(id),
  
  -- Competencia (pode diferir da data do lancamento)
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  
  -- Origem da classificacao
  classification_method TEXT NOT NULL DEFAULT 'manual' CHECK (classification_method IN (
    'manual',           -- usuario classificou
    'auto_rule',        -- regra automatica
    'auto_learned',     -- sugestao aceita do historico
    'auto_tiny_map',    -- mapeamento categoria Tiny -> conta
    'imported'          -- importado do contador
  )),
  rule_id         UUID REFERENCES categorization_rules(id),
  confidence      NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  
  -- Rateio (se este lancamento foi rateado, aponta para o registro)
  apportionment_id UUID REFERENCES apportionments(id),
  apportionment_percentage NUMERIC(7,4),           -- percentual deste pedaco
  
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Um lancamento so pode ter uma classificacao ativa (ou multiplas se rateado)
  -- Se rateado: multiplas linhas com mesmo entity_type+entity_id, cada com apportionment_percentage
  UNIQUE(org_id, entity_type, entity_id, apportionment_id)
);

CREATE INDEX idx_entry_class_entity 
  ON entry_classifications(entity_type, entity_id);
CREATE INDEX idx_entry_class_account 
  ON entry_classifications(org_id, account_id, competencia_ano, competencia_mes);
CREATE INDEX idx_entry_class_cc 
  ON entry_classifications(org_id, cost_center_id, competencia_ano, competencia_mes);

-- Budget (orcamento por conta + centro de custo)
CREATE TABLE budgets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id),
  cost_center_id  UUID REFERENCES cost_centers(id),
  
  ano             INTEGER NOT NULL,
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  
  budget_value    NUMERIC(14,2) NOT NULL,
  notes           TEXT,
  
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, company_id, account_id, cost_center_id, ano, mes)
);

-- RLS
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE apportionment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE apportionments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_org" ON chart_of_accounts FOR ALL USING (org_id = get_org_id());
CREATE POLICY "cc_org" ON cost_centers FOR ALL USING (org_id = get_org_id());
CREATE POLICY "at_org" ON apportionment_templates FOR ALL USING (org_id = get_org_id());
CREATE POLICY "ap_org" ON apportionments FOR ALL USING (org_id = get_org_id());
CREATE POLICY "cr_org" ON categorization_rules FOR ALL USING (org_id = get_org_id());
CREATE POLICY "ec_org" ON entry_classifications FOR ALL USING (org_id = get_org_id());
CREATE POLICY "bg_org" ON budgets FOR ALL USING (org_id = get_org_id());

-- Function: DRE gerencial automatizado
CREATE OR REPLACE FUNCTION generate_dre(
  p_org_id UUID,
  p_company_id UUID,     -- NULL = consolidado
  p_cost_center_id UUID, -- NULL = todos
  p_ano INTEGER,
  p_mes INTEGER
) RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_group TEXT,
  level INTEGER,
  is_synthetic BOOLEAN,
  realized NUMERIC,
  budget NUMERIC,
  variance NUMERIC,
  variance_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH account_tree AS (
    SELECT c.id, c.code, c.name, c.account_group, c.level, c.is_synthetic, c.sort_order, c.path
    FROM chart_of_accounts c
    WHERE c.org_id = p_org_id
      AND c.deleted_at IS NULL
      AND c.is_active = true
      AND (c.company_id = p_company_id OR c.company_id IS NULL)
      AND c.account_group IN ('receita', 'deducao_receita', 'custo', 
                               'despesa_operacional', 'despesa_financeira',
                               'outras_receitas', 'outras_despesas')
    ORDER BY c.path
  ),
  realized_values AS (
    SELECT ec.account_id, SUM(
      CASE 
        WHEN ec.apportionment_percentage IS NOT NULL 
        THEN ec.apportionment_percentage / 100.0 * (
          CASE ec.entity_type
            WHEN 'conta_pagar' THEN (SELECT valor FROM tiny_contas_pagar WHERE id = ec.entity_id)
            WHEN 'conta_receber' THEN (SELECT valor FROM tiny_contas_receber WHERE id = ec.entity_id)
            WHEN 'bank_transaction' THEN (SELECT ABS(amount) FROM bank_transactions WHERE id = ec.entity_id)
          END
        )
        ELSE (
          CASE ec.entity_type
            WHEN 'conta_pagar' THEN (SELECT valor FROM tiny_contas_pagar WHERE id = ec.entity_id)
            WHEN 'conta_receber' THEN (SELECT valor FROM tiny_contas_receber WHERE id = ec.entity_id)
            WHEN 'bank_transaction' THEN (SELECT ABS(amount) FROM bank_transactions WHERE id = ec.entity_id)
          END
        )
      END
    ) AS total
    FROM entry_classifications ec
    WHERE ec.org_id = p_org_id
      AND ec.competencia_ano = p_ano
      AND ec.competencia_mes = p_mes
      AND (p_company_id IS NULL OR ec.company_id = p_company_id)
      AND (p_cost_center_id IS NULL OR ec.cost_center_id = p_cost_center_id)
    GROUP BY ec.account_id
  ),
  budget_values AS (
    SELECT b.account_id, SUM(b.budget_value) AS total
    FROM budgets b
    WHERE b.org_id = p_org_id
      AND b.ano = p_ano AND b.mes = p_mes
      AND (p_company_id IS NULL OR b.company_id = p_company_id)
    GROUP BY b.account_id
  )
  SELECT 
    at.code,
    at.name,
    at.account_group,
    at.level,
    at.is_synthetic,
    COALESCE(rv.total, 0) AS realized,
    COALESCE(bv.total, 0) AS budget,
    COALESCE(rv.total, 0) - COALESCE(bv.total, 0) AS variance,
    CASE WHEN COALESCE(bv.total, 0) != 0 
         THEN ((COALESCE(rv.total, 0) - COALESCE(bv.total, 0)) / bv.total * 100)
         ELSE 0 
    END AS variance_pct
  FROM account_tree at
  LEFT JOIN realized_values rv ON rv.account_id = at.id
  LEFT JOIN budget_values bv ON bv.account_id = at.id
  ORDER BY at.path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed: Plano de contas padrao PME
-- (inserido via migration, nao via funcao, para ser idempotente)
-- Estrutura: 
-- 3. RESULTADO
--   3.1 Receita Operacional
--     3.1.01 Receita de Vendas
--       3.1.01.01 Vendas de Produtos
--       3.1.01.02 Vendas de Servicos
--       3.1.01.03 Receita de Frete Cobrado
--     3.1.02 Outras Receitas Operacionais
--   3.2 Deducoes da Receita
--     3.2.01 Impostos sobre Vendas
--       3.2.01.01 ICMS sobre Vendas
--       3.2.01.02 PIS sobre Faturamento
--       3.2.01.03 COFINS sobre Faturamento
--       3.2.01.04 ISS sobre Servicos
--       3.2.01.05 Simples Nacional
--     3.2.02 Devolucoes e Abatimentos
--   4. CUSTOS
--     4.1 Custo dos Produtos Vendidos (CPV)
--       4.1.01 Materia Prima
--       4.1.02 Embalagem
--       4.1.03 Frete sobre Compras
--       4.1.04 Comissoes sobre Vendas
--   5. DESPESAS
--     5.1 Despesas Operacionais
--       5.1.01 Pessoal
--         5.1.01.01 Salarios e Ordenados
--         5.1.01.02 Encargos Sociais (INSS, FGTS)
--         5.1.01.03 Beneficios (VT, VR, Plano Saude)
--         5.1.01.04 Pro-labore
--         5.1.01.05 Provisao 13o e Ferias
--       5.1.02 Marketing e Publicidade
--         5.1.02.01 Trafego Pago (Meta, Google)
--         5.1.02.02 Producao de Conteudo
--         5.1.02.03 Ferramentas Marketing
--       5.1.03 Administrativas
--         5.1.03.01 Aluguel e Condominio
--         5.1.03.02 Energia e Agua
--         5.1.03.03 Telefone e Internet
--         5.1.03.04 Material de Escritorio
--         5.1.03.05 Contabilidade
--         5.1.03.06 Juridico
--         5.1.03.07 Seguros
--       5.1.04 Tecnologia
--         5.1.04.01 Software e SaaS
--         5.1.04.02 Infraestrutura Cloud
--         5.1.04.03 Desenvolvimento
--       5.1.05 Logistica
--         5.1.05.01 Frete sobre Vendas
--         5.1.05.02 Armazenagem
--     5.2 Despesas Financeiras
--       5.2.01 Juros sobre Emprestimos
--       5.2.02 Taxas Bancarias
--       5.2.03 IOF
--       5.2.04 Taxas de Cartao/Gateway
--     5.3 Outras Despesas
--       5.3.01 Distribuicao de Lucros
--       5.3.02 Investimentos
```

## 2.3 Endpoints NestJS

```
ChartOfAccountsModule (12 endpoints)

GET    /api/accounts                      -- Arvore completa (flat com parent_id ou nested)
GET    /api/accounts/:id                  -- Detalhe da conta
POST   /api/accounts                      -- Criar conta (valida unicidade de code, parent existe)
PATCH  /api/accounts/:id                  -- Atualizar (nao permite mudar nature/group se tem lancamentos)
DELETE /api/accounts/:id                  -- Soft delete (bloqueia se tem lancamentos)
POST   /api/accounts/seed                 -- Gerar plano padrao PME para empresa
GET    /api/accounts/tree                 -- Arvore hierarquica renderizada (com totais por competencia)
POST   /api/accounts/import              -- Importar plano de contas (CSV)
GET    /api/accounts/tiny-mapping         -- Mapa categoria_tiny -> conta
POST   /api/accounts/tiny-mapping         -- Criar/atualizar mapeamento
POST   /api/accounts/reorder             -- Reordenar (sort_order batch update)
GET    /api/accounts/search              -- Busca por nome/codigo

CostCenterModule (8 endpoints)

GET    /api/cost-centers                  -- Arvore completa
GET    /api/cost-centers/:id              -- Detalhe
POST   /api/cost-centers                  -- Criar
PATCH  /api/cost-centers/:id              -- Atualizar
DELETE /api/cost-centers/:id              -- Soft delete
POST   /api/cost-centers/seed             -- Gerar centros padrao por empresa
GET    /api/cost-centers/tree             -- Arvore hierarquica
POST   /api/cost-centers/reorder          -- Reordenar

ApportionmentModule (10 endpoints)

GET    /api/apportionments/templates       -- Listar templates
POST   /api/apportionments/templates       -- Criar template
PATCH  /api/apportionments/templates/:id   -- Atualizar template
DELETE /api/apportionments/templates/:id   -- Excluir template
POST   /api/apportionments/execute         -- Executar rateio (source + template ou manual)
POST   /api/apportionments/preview         -- Preview: mostra distribuicao sem persistir
GET    /api/apportionments                 -- Historico de rateios
GET    /api/apportionments/:id             -- Detalhe do rateio
POST   /api/apportionments/:id/reverse     -- Estornar rateio
GET    /api/apportionments/by-competencia   -- Todos os rateios de uma competencia

CategorizationModule (10 endpoints)

GET    /api/categorization/rules           -- Listar regras
POST   /api/categorization/rules           -- Criar regra
PATCH  /api/categorization/rules/:id       -- Atualizar
DELETE /api/categorization/rules/:id       -- Excluir
POST   /api/categorization/classify        -- Classificar lancamento (manual)
POST   /api/categorization/auto-classify   -- Auto-classificar batch (aplica regras)
GET    /api/categorization/suggestions/:entityType/:entityId -- Sugestoes para um lancamento
POST   /api/categorization/learn           -- Registrar decisao para aprendizado
GET    /api/categorization/stats           -- Stats: quantos classificados, pendentes, por metodo
POST   /api/categorization/bulk-classify   -- Classificar em lote (selecao + conta + CC)

DREModule (6 endpoints)

GET    /api/dre                           -- DRE gerencial (company, competencia, CC, comparativo)
GET    /api/dre/drill-down/:accountId      -- Detalhamento de uma conta (lancamentos individuais)
GET    /api/dre/comparison                 -- Comparativo mensal/trimestral/anual
GET    /api/dre/budget-vs-actual           -- Budget vs Realizado
POST   /api/dre/export/excel              -- Export Excel com formatacao DRE
POST   /api/dre/export/pdf                -- Export PDF
```

**Logica do Auto-Classify (POST /api/categorization/auto-classify):**

1. Recebe lista de entity_ids ou filtro (competencia, empresa, status "nao classificado")
2. Para cada lancamento:
   a. Busca regras ativas ordenadas por prioridade
   b. Avalia condicoes de cada regra (CNPJ match, description contains, value range)
   c. Se regra match com confidence >= 90%: aplica automaticamente
   d. Se regra match com confidence 70-89%: marca como sugestao
   e. Se nenhuma regra: busca historico (mesmo CNPJ + mesmo valor range -> qual conta foi usada?)
   f. Historico com 3+ ocorrencias iguais: sugere com confidence = min(90, count * 15)
3. Se template de rateio vinculado a conta: executa rateio automatico
4. Retorna: { classified: 45, suggested: 12, no_match: 8, errors: 0 }

**Logica do DRE (GET /api/dre):**

1. Chama a function PL/pgSQL `generate_dre()` com parametros
2. Agrega contas sinteticas (soma dos filhos)
3. Calcula margens: Receita Liquida, Margem Bruta, EBITDA, Resultado Liquido
4. Se comparativo: executa para cada periodo, retorna array de colunas
5. Formata output com hierarquia visual (indentacao por level)

## 2.4 UX/Telas

**Tela 1: Plano de Contas (`/settings/chart-of-accounts`)**

- Arvore colapsavel tipo VS Code file explorer
- Cada no: codigo (mono) + nome + nature badge (D/C) + grupo badge + acoes (editar, adicionar filho, excluir)
- Drag & drop para reordenar (dentro do mesmo pai)
- Botao [+ Conta] abre form inline (codigo auto-sugerido baseado no pai)
- Botao [Gerar Padrao PME] para empresas novas (confirma antes de criar)
- Coluna lateral: mapeamento Tiny (dropdown de categorias Tiny para cada conta analitica)
- Search bar no topo filtra arvore em tempo real

**Tela 2: Centros de Custo (`/settings/cost-centers`)**

- Arvore similar ao plano de contas
- Cada no: codigo + nome + empresa badge (com cor) + budget mensal
- Botao [+ Centro] com wizard: nome, empresa (ou corporativo), pai, budget

**Tela 3: Rateio (`/apportionments`)**

- Lista de templates de rateio (cards com nome, criterio, distribuicao visual em barra empilhada colorida)
- Criar template: nome + criterio (select) + distribuicao (tabela editavel: empresa | CC | % com slider ou input, total = 100% validado em tempo real)
- Executar rateio: seleciona lancamento(s) + template + preview antes de confirmar
- Historico de rateios por competencia: tabela com source, template, distribuicao expandivel

**Tela 4: Classificacao (`/classify`)**

- Split view: esquerda = lancamentos nao classificados (filtro empresa/competencia/tipo), direita = formulario de classificacao
- Cada lancamento mostra: fornecedor/cliente, valor, data, descricao, historico Tiny
- Sugestao automática: badge com conta sugerida + confidence % + fonte (regra/historico)
- Classificar: select hierarquico de conta (searchable combobox) + select CC + competencia
- Bulk mode: checkbox multiplo + classificar todos com mesma conta/CC
- Stats no topo: "67 classificados de 120 (56%)" com progress bar

**Tela 5: DRE Gerencial (`/dre`)**

- Substitui o DRE.tsx atual com dados do plano de contas hierarquico
- Filtros: empresa (ou consolidado), competencia, centro de custo, comparativo (mes/trimestre/ano)
- Tabela tipo planilha: Codigo | Conta | Realizado | Budget | Var R$ | Var % 
- Linhas sinteticas em negrito com background sutil
- Clicar em conta analitica: drill-down com lancamentos individuais
- Comparativo: colunas lado a lado (Jan | Fev | Mar | Q1 Total)
- Budget vs Realizado: barra horizontal por conta (verde = abaixo do budget, vermelho = acima)
- Export: Excel com formatacao profissional (hierarquia por indentacao, totais em negrito, variacao colorida)

## 2.5 Sprint Breakdown

**Sprint C1 (2 semanas): Plano de Contas + Centros de Custo**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| COA-001 | Schema chart_of_accounts + cost_centers + RLS | 5 | Tabelas, indexes, RLS, migration |
| COA-002 | CRUD plano de contas com hierarquia | 8 | Criar/editar/excluir, validacao de path, reordenar |
| COA-003 | Seed plano padrao PME (40+ contas) | 3 | Plano completo gerado para nova empresa |
| COA-004 | CRUD centros de custo | 5 | Hierarquia empresa>unidade>depto>projeto |
| COA-005 | UI arvore plano de contas | 5 | Tree view, drag, search, editar inline |
| COA-006 | UI arvore centros de custo | 3 | Tree view com budget |

**Sprint C2 (2 semanas): Classificacao + Regras**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| COA-007 | Schema entry_classifications + categorization_rules | 5 | Tabelas, indexes |
| COA-008 | Motor de regras de categorizacao | 8 | Avalia condicoes, aplica regras por prioridade |
| COA-009 | Auto-classificacao batch | 5 | Processa N lancamentos, aplica regras, sugere por historico |
| COA-010 | Mapeamento Tiny categories -> contas | 3 | UI mapping, auto-map em sync |
| COA-011 | Tela de classificacao (split view) | 8 | Sugestoes, bulk classify, progress |

**Sprint C3 (2 semanas): Rateio + DRE + Budget**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| COA-012 | Schema apportionments + budgets | 3 | Tabelas, templates, historico |
| COA-013 | Engine de rateio (templates + execucao + estorno) | 8 | Fixed %, preview, validacao 100% |
| COA-014 | DRE gerencial via PL/pgSQL function | 8 | Budget vs Realizado, drill-down |
| COA-015 | Tela DRE gerencial com comparativo | 5 | Substitui DRE.tsx atual, comparativo, export |
| COA-016 | Budget: CRUD + import planilha | 5 | Orcamento por conta/CC/mes, import Excel |

## 2.6 Regras de Negocio Invisiveis

1. **Conta sintetica nunca recebe lancamento direto**: Se "5.1 Despesas Operacionais" e pai de "5.1.01 Pessoal", ninguem pode classificar um lancamento em 5.1 diretamente. So nas folhas. Se o usuario tentar, o sistema redireciona: "Selecione uma subconta de Despesas Operacionais".

2. **Competencia no DRE != data do pagamento**: O aluguel de abril pago em 05/maio entra no DRE de ABRIL, nao de maio. O campo `competencia_mes` na `entry_classifications` e o que alimenta o DRE, nunca a data_pagamento da CP. Isso e regime de competencia vs regime de caixa. O sistema deve permitir ambas as visoes.

3. **Rateio precisa somar exatamente 100%**: Parece obvio, mas a divisao de 100/3 da 33.33+33.33+33.34. O sistema deve distribuir o centavo residual para a maior parcela automaticamente. Se o usuario coloca 40+35+25=100, ok. Se coloca 40+35+20=95, alerta vermelho.

4. **Centro de custo "Corporativo"**: Custos compartilhados que nao pertencem a nenhuma empresa especifica (ex: sistema contabil, advogado do grupo) precisam de um CC "Corporativo" ou "Holding" que depois e rateado. O seed deve criar esse CC automaticamente.

5. **Categoria Tiny muda de nome**: O Tiny permite renomear categorias. Se o mapeamento e por nome ("Despesa de Marketing - AtacadoNeon"), e o usuario renomeia no Tiny, o mapeamento quebra. A `tiny_category_name` deve ser atualizada no sync. Melhor: mapear por ID da categoria quando disponivel via API.

6. **DRE consolidado com rateio**: Quando consolida 4 empresas, os lancamentos rateados nao podem ser contados duas vezes. Se o aluguel de R$12k foi rateado em R$4.8k Neon + R$4.2k Engagge + R$3k RYU, o consolidado mostra R$12k (nao R$12k + R$12k por empresa). A function `generate_dre` com `company_id = NULL` precisa usar a `entry_classifications` que ja tem as parcelas corretas.

7. **Historico de classificacao como treinamento**: Quando o usuario classifica "CNPJ 12.345.678/0001-90" como "5.1.02.01 Trafego Pago" pela terceira vez, o sistema deve perguntar: "Deseja criar uma regra automatica para este CNPJ?" com pre-preenchimento. Isso transforma decisoes manuais em automacao progressiva.

8. **Contas do grupo 1/2 (Ativo/Passivo) nao entram no DRE**: O plano de contas inclui contas patrimoniais para mapeamento contabil, mas o DRE so mostra grupos 3-5 (Receita, Custo, Despesa). A function filtra por `account_group`.

---

# MODULO 3: INTEGRACAO CONTABIL

## 3.1 Justificativa de Negocio

O BPO financeiro que nao entrega pacote contabil e um servico pela metade. O contador do cliente recebe os lancamentos classificados e precisa redigitar tudo no sistema contabil (Dominio, Alterdata, Fortes). Isso custa 6-12h/mes por empresa. Para o Grupo Lauxen com 4 empresas, sao 24-48h/mes do escritorio contabil, que cobra R$800-1.500/empresa/mes.

Se o BPO entrega arquivo pronto para importacao no sistema contabil, com lote de lancamentos no formato que o contador entende, o escritorio economiza 70% do tempo. Isso justifica o preco premium do BPO (R$500-1.000 a mais por empresa) e reduz a chance de erros de classificacao que geram retificacao de SPED.

Alem disso, sem conciliacao fiscal (faturamento contabil vs financeiro), divergencias se acumulam e explodem na DEFIS (Simples), ECF (Lucro Real/Presumido) ou ECD. Um sistema que mostra "faturado R$180k mas recebido R$165k, com R$15k em aberto" previne problemas antes do fechamento.

Para a questao de impostos: PME no Simples Nacional paga DAS mensal baseado no faturamento. Se o faturamento esta errado (notas emitidas vs real), o DAS esta errado. O sistema que provisiona impostos automaticamente e alerta sobre vencimentos evita multas de 20%+ juros Selic.

## 3.2 Schema PostgreSQL Completo

```sql
-- =============================================================
-- MODULO 3: INTEGRACAO CONTABIL
-- =============================================================

-- Periodos contabeis (controla fechamento)
CREATE TABLE accounting_periods (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  ano             INTEGER NOT NULL,
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',             -- aceitando lancamentos
    'reviewing',        -- em revisao (lancamentos bloqueados, ajustes permitidos)
    'closed',           -- fechado (nenhuma alteracao)
    'exported',         -- exportado para contabilidade
    'reopened'          -- reaberto (excepcional, com motivo)
  )),
  
  -- Checklist de fechamento
  checklist       JSONB DEFAULT '{}',
  -- Ex: {
  --   "all_reconciled": { "status": true, "checked_at": "2026-04-30T..." },
  --   "all_classified": { "status": false, "pending_count": 12 },
  --   "all_documented": { "status": true },
  --   "taxes_provisioned": { "status": true },
  --   "dre_reviewed": { "status": false },
  --   "payroll_imported": { "status": false }
  -- }
  
  closed_by       UUID REFERENCES profiles(id),
  closed_at       TIMESTAMPTZ,
  reopen_reason   TEXT,
  reopened_by     UUID REFERENCES profiles(id),
  reopened_at     TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, company_id, ano, mes)
);

-- Exportacoes contabeis
CREATE TABLE accounting_exports (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  -- Periodo
  ano             INTEGER NOT NULL,
  mes             INTEGER NOT NULL,
  
  -- Formato
  format          TEXT NOT NULL CHECK (format IN (
    'csv_generic',      -- CSV generico
    'excel',            -- Excel formatado
    'dominio_txt',      -- Dominio Sistemas (layout fixo TXT)
    'alterdata',        -- Alterdata
    'fortes',           -- Fortes Contabil
    'prosoft',          -- Prosoft
    'omie_api',         -- Omie via API
    'contaazul_api'     -- Conta Azul via API
  )),
  
  -- Arquivo gerado
  storage_path    TEXT,                            -- path no Supabase Storage
  file_name       TEXT,
  
  -- Conteudo
  entry_count     INTEGER NOT NULL DEFAULT 0,
  total_debits    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_credits   NUMERIC(14,2) NOT NULL DEFAULT 0,
  
  -- Status
  status          TEXT NOT NULL DEFAULT 'generating' CHECK (status IN (
    'generating', 'ready', 'downloaded', 'imported_by_accountant', 'error'
  )),
  error_message   TEXT,
  
  -- Reconciliacao de importacao
  accountant_confirmed_at TIMESTAMPTZ,
  accountant_notes TEXT,
  
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lançamentos contabeis (debito/credito)
CREATE TABLE accounting_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  export_id       UUID REFERENCES accounting_exports(id),
  
  -- Partida dobrada
  entry_date      DATE NOT NULL,
  debit_account_id  UUID NOT NULL REFERENCES chart_of_accounts(id),
  credit_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  value           NUMERIC(14,2) NOT NULL CHECK (value > 0),
  
  -- Historico padronizado
  history         TEXT NOT NULL,
  -- Ex: "PG NF 123456 - FORNECEDOR XYZ LTDA - REF ABR/2026"
  -- Ex: "REC VENDA PED 7890 - CLIENTE ABC - PIX"
  
  -- Competencia
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  
  -- Origem
  source_entity_type TEXT,
  source_entity_id   UUID,
  
  -- Centro de custo
  cost_center_id  UUID REFERENCES cost_centers(id),
  
  -- Documento vinculado
  document_id     UUID REFERENCES documents(id),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ae_export ON accounting_entries(export_id);
CREATE INDEX idx_ae_period ON accounting_entries(org_id, company_id, competencia_ano, competencia_mes);
CREATE INDEX idx_ae_accounts ON accounting_entries(debit_account_id, credit_account_id);

-- Impostos
CREATE TABLE tax_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  -- Tipo de imposto
  tax_type        TEXT NOT NULL CHECK (tax_type IN (
    'simples_nacional',   -- DAS
    'irpj',               -- IRPJ (Lucro Presumido/Real)
    'csll',               -- CSLL
    'pis',                -- PIS
    'cofins',             -- COFINS
    'iss',                -- ISS
    'icms',               -- ICMS
    'ipi',                -- IPI
    'inss_patronal',      -- INSS empresa
    'fgts',               -- FGTS
    'irrf',               -- IR Retido na Fonte
    'outros'
  )),
  
  -- Competencia e vencimento
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  due_date        DATE NOT NULL,                   -- vencimento da guia
  
  -- Regime tributario
  tax_regime      TEXT NOT NULL CHECK (tax_regime IN (
    'simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'
  )),
  
  -- Valores
  base_value      NUMERIC(14,2) NOT NULL,          -- base de calculo
  tax_rate        NUMERIC(7,4),                    -- aliquota
  tax_value       NUMERIC(14,2) NOT NULL,          -- valor do imposto
  
  -- Pagamento
  payment_status  TEXT NOT NULL DEFAULT 'provisioned' CHECK (payment_status IN (
    'provisioned',      -- calculado, guia nao emitida
    'guide_generated',  -- guia gerada (DAS, DARF)
    'paid',             -- pago
    'overdue',          -- vencido e nao pago
    'exempt'            -- isento neste periodo
  )),
  paid_value      NUMERIC(14,2),
  paid_date       DATE,
  guide_number    TEXT,                            -- numero da guia/DARF
  
  -- Vinculacao
  document_id     UUID REFERENCES documents(id),   -- guia/comprovante anexo
  conta_pagar_id  UUID,                            -- CP criada para pagamento
  
  -- Calculo
  calculation_details JSONB DEFAULT '{}',
  -- Simples: { "faturamento_12m": 1800000, "faixa": 3, "aliquota_efetiva": 11.20, 
  --            "parcela_dedutir": 9360, "rbt12": 1800000 }
  -- Presumido: { "receita_bruta": 200000, "presuncao_ir": 0.08, "base_ir": 16000, 
  --              "aliquota_ir": 0.15, "adicional_ir": 0 }
  
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_competencia 
  ON tax_entries(org_id, company_id, competencia_ano, competencia_mes);
CREATE INDEX idx_tax_due_date 
  ON tax_entries(org_id, due_date, payment_status)
  WHERE payment_status IN ('provisioned', 'guide_generated', 'overdue');

-- Calendario fiscal (vencimentos por regime)
CREATE TABLE tax_calendar (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  tax_type        TEXT NOT NULL,
  tax_regime      TEXT NOT NULL,
  
  -- Vencimento padrao (dia do mes seguinte)
  default_due_day INTEGER NOT NULL,               -- ex: 20 para DAS
  
  -- Excecoes (feriados, postergacoes)
  -- Gerenciado por cron job que ajusta due_date em tax_entries
  
  description     TEXT,
  guide_url       TEXT                             -- link para emissao da guia
);

-- Folha de pagamento (importacao)
CREATE TABLE payroll_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  -- Periodo
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  
  -- Tipo
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
    'salarios',           -- salarios liquidos
    'inss_funcionario',   -- INSS descontado do funcionario
    'inss_patronal',      -- INSS empresa
    'fgts',               -- FGTS 8%
    'irrf',               -- IR retido na fonte
    'vale_transporte',    -- VT
    'vale_refeicao',      -- VR
    'plano_saude',        -- Plano de saude
    'pro_labore',         -- Pro-labore socios
    'distribuicao_lucros',-- Distribuicao de lucros
    'provisao_13',        -- Provisao 13o (1/12 avos)
    'provisao_ferias',    -- Provisao ferias (1/12 + 1/3)
    'provisao_rescisao',  -- Provisao rescisao
    'outros_beneficios'   -- Outros
  )),
  
  -- Valores
  headcount       INTEGER,                         -- qtd funcionarios
  gross_value     NUMERIC(14,2) NOT NULL,          -- valor bruto
  net_value       NUMERIC(14,2),                   -- valor liquido (apos descontos)
  
  -- Classificacao
  account_id      UUID REFERENCES chart_of_accounts(id),
  cost_center_id  UUID REFERENCES cost_centers(id),
  
  -- Origem
  import_source   TEXT DEFAULT 'manual',           -- 'manual', 'excel', 'dominio', 'api'
  
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_period 
  ON payroll_entries(org_id, company_id, competencia_ano, competencia_mes);

-- Conciliacao fiscal (faturamento vs financeiro)
CREATE TABLE fiscal_reconciliation (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL,
  
  -- Valores apurados
  invoiced_revenue  NUMERIC(14,2),                 -- faturamento NF (notas emitidas)
  financial_revenue NUMERIC(14,2),                 -- receita financeira (recebimentos)
  accounting_revenue NUMERIC(14,2),                -- receita contabil (classificacoes)
  
  invoiced_expenses NUMERIC(14,2),                 -- NF de entrada (compras)
  financial_expenses NUMERIC(14,2),                -- pagamentos realizados
  accounting_expenses NUMERIC(14,2),               -- despesas contabeis
  
  -- Divergencias
  revenue_divergence NUMERIC(14,2),                -- invoiced - financial
  expense_divergence NUMERIC(14,2),
  
  -- Detalhamento
  divergence_details JSONB DEFAULT '[]',
  -- Ex: [
  --   { "type": "nf_sem_recebimento", "nf_numero": "123", "valor": 5000, "status": "pending" },
  --   { "type": "recebimento_sem_nf", "bank_tx_id": "uuid", "valor": 3200, "status": "resolved" }
  -- ]
  
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewed', 'resolved', 'flagged'
  )),
  
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  notes           TEXT,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(org_id, company_id, competencia_ano, competencia_mes)
);

-- RLS
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ap_org" ON accounting_periods FOR ALL USING (org_id = get_org_id());
CREATE POLICY "aex_org" ON accounting_exports FOR ALL USING (org_id = get_org_id());
CREATE POLICY "aen_org" ON accounting_entries FOR ALL USING (org_id = get_org_id());
CREATE POLICY "te_org" ON tax_entries FOR ALL USING (org_id = get_org_id());
CREATE POLICY "pe_org" ON payroll_entries FOR ALL USING (org_id = get_org_id());
CREATE POLICY "fr_org" ON fiscal_reconciliation FOR ALL USING (org_id = get_org_id());

-- Function: Gerar lancamentos contabeis a partir de classificacoes
CREATE OR REPLACE FUNCTION generate_accounting_entries(
  p_org_id UUID,
  p_company_id UUID,
  p_ano INTEGER,
  p_mes INTEGER,
  p_export_id UUID,
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  -- Para cada classificacao do periodo
  FOR v_rec IN 
    SELECT 
      ec.id, ec.entity_type, ec.entity_id, ec.account_id, ec.cost_center_id,
      ec.apportionment_percentage,
      coa.code AS account_code, coa.name AS account_name, coa.nature,
      CASE ec.entity_type
        WHEN 'conta_pagar' THEN (SELECT valor FROM tiny_contas_pagar WHERE id = ec.entity_id)
        WHEN 'conta_receber' THEN (SELECT valor FROM tiny_contas_receber WHERE id = ec.entity_id)
        WHEN 'bank_transaction' THEN (SELECT ABS(amount) FROM bank_transactions WHERE id = ec.entity_id)
      END AS base_value,
      CASE ec.entity_type
        WHEN 'conta_pagar' THEN (
          SELECT CONCAT('PG ', COALESCE(fornecedor_nome, 'S/N'), ' - ', COALESCE(historico, ''), ' - REF ', 
                         UPPER(TO_CHAR(TO_DATE(p_mes::text, 'MM'), 'MON')), '/', p_ano)
          FROM tiny_contas_pagar WHERE id = ec.entity_id
        )
        WHEN 'conta_receber' THEN (
          SELECT CONCAT('REC ', COALESCE(cliente_nome, 'S/N'), ' - PED ', COALESCE(pedido_numero, ''), ' - REF ',
                         UPPER(TO_CHAR(TO_DATE(p_mes::text, 'MM'), 'MON')), '/', p_ano)
          FROM tiny_contas_receber WHERE id = ec.entity_id
        )
        WHEN 'bank_transaction' THEN (
          SELECT CONCAT('MOV BANCARIA - ', COALESCE(description, ''), ' - ', transaction_date::text)
          FROM bank_transactions WHERE id = ec.entity_id
        )
      END AS history,
      CASE ec.entity_type
        WHEN 'conta_pagar' THEN (SELECT data_pagamento FROM tiny_contas_pagar WHERE id = ec.entity_id)
        WHEN 'conta_receber' THEN (SELECT data_pagamento FROM tiny_contas_receber WHERE id = ec.entity_id)
        WHEN 'bank_transaction' THEN (SELECT transaction_date FROM bank_transactions WHERE id = ec.entity_id)
      END AS entry_date
    FROM entry_classifications ec
    JOIN chart_of_accounts coa ON coa.id = ec.account_id
    WHERE ec.org_id = p_org_id
      AND ec.company_id = p_company_id
      AND ec.competencia_ano = p_ano
      AND ec.competencia_mes = p_mes
  LOOP
    -- Calcula valor (com rateio se aplicavel)
    DECLARE
      v_value NUMERIC(14,2);
      v_debit_account UUID;
      v_credit_account UUID;
    BEGIN
      v_value := v_rec.base_value;
      IF v_rec.apportionment_percentage IS NOT NULL THEN
        v_value := v_value * v_rec.apportionment_percentage / 100.0;
      END IF;
      
      -- Partida dobrada:
      -- Despesa/Custo (nature=debit): D-Despesa C-Caixa/Banco/Fornecedor
      -- Receita (nature=credit): D-Caixa/Banco/Cliente C-Receita
      IF v_rec.nature = 'debit' THEN
        v_debit_account := v_rec.account_id;
        -- Conta credito = Caixa (busca conta 1.1.01 do plano)
        SELECT id INTO v_credit_account 
        FROM chart_of_accounts 
        WHERE org_id = p_org_id AND code = '1.1.01' AND deleted_at IS NULL
        LIMIT 1;
      ELSE
        v_credit_account := v_rec.account_id;
        SELECT id INTO v_debit_account 
        FROM chart_of_accounts 
        WHERE org_id = p_org_id AND code = '1.1.01' AND deleted_at IS NULL
        LIMIT 1;
      END IF;
      
      INSERT INTO accounting_entries (
        org_id, company_id, export_id, entry_date,
        debit_account_id, credit_account_id, value, history,
        competencia_ano, competencia_mes, source_entity_type, source_entity_id,
        cost_center_id
      ) VALUES (
        p_org_id, p_company_id, p_export_id, COALESCE(v_rec.entry_date, CURRENT_DATE),
        v_debit_account, v_credit_account, v_value, v_rec.history,
        p_ano, p_mes, v_rec.entity_type, v_rec.entity_id,
        v_rec.cost_center_id
      );
      
      v_count := v_count + 1;
    END;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Provisao de impostos Simples Nacional
CREATE OR REPLACE FUNCTION calculate_simples_nacional(
  p_org_id UUID,
  p_company_id UUID,
  p_ano INTEGER,
  p_mes INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_rbt12 NUMERIC;      -- Receita Bruta Total 12 meses
  v_receita_mes NUMERIC; -- Receita do mes
  v_aliquota NUMERIC;
  v_parcela_deduzir NUMERIC;
  v_aliquota_efetiva NUMERIC;
  v_imposto NUMERIC;
BEGIN
  -- RBT12: soma receita dos ultimos 12 meses
  SELECT COALESCE(SUM(
    CASE ec.entity_type
      WHEN 'conta_receber' THEN (SELECT valor FROM tiny_contas_receber WHERE id = ec.entity_id)
      ELSE 0
    END
  ), 0) INTO v_rbt12
  FROM entry_classifications ec
  JOIN chart_of_accounts coa ON coa.id = ec.account_id
  WHERE ec.org_id = p_org_id
    AND ec.company_id = p_company_id
    AND coa.account_group = 'receita'
    AND (ec.competencia_ano * 12 + ec.competencia_mes) 
        BETWEEN (p_ano * 12 + p_mes - 12) AND (p_ano * 12 + p_mes - 1);
  
  -- Receita do mes atual
  SELECT COALESCE(SUM(
    CASE ec.entity_type
      WHEN 'conta_receber' THEN (SELECT valor FROM tiny_contas_receber WHERE id = ec.entity_id)
      ELSE 0
    END
  ), 0) INTO v_receita_mes
  FROM entry_classifications ec
  JOIN chart_of_accounts coa ON coa.id = ec.account_id
  WHERE ec.org_id = p_org_id
    AND ec.company_id = p_company_id
    AND coa.account_group = 'receita'
    AND ec.competencia_ano = p_ano AND ec.competencia_mes = p_mes;
  
  -- Tabela Simples Nacional Anexo I (Comercio) - simplificado
  -- Faixas atualizadas LC 123/2006
  IF v_rbt12 <= 180000 THEN
    v_aliquota := 4.00; v_parcela_deduzir := 0;
  ELSIF v_rbt12 <= 360000 THEN
    v_aliquota := 7.30; v_parcela_deduzir := 5940;
  ELSIF v_rbt12 <= 720000 THEN
    v_aliquota := 9.50; v_parcela_deduzir := 13860;
  ELSIF v_rbt12 <= 1800000 THEN
    v_aliquota := 10.70; v_parcela_deduzir := 22500;
  ELSIF v_rbt12 <= 3600000 THEN
    v_aliquota := 14.30; v_parcela_deduzir := 87300;
  ELSIF v_rbt12 <= 4800000 THEN
    v_aliquota := 19.00; v_parcela_deduzir := 378000;
  ELSE
    v_aliquota := 30.00; v_parcela_deduzir := 0; -- sublimite excedido
  END IF;
  
  -- Aliquota efetiva
  IF v_rbt12 > 0 THEN
    v_aliquota_efetiva := (v_rbt12 * v_aliquota / 100 - v_parcela_deduzir) / v_rbt12 * 100;
  ELSE
    v_aliquota_efetiva := 0;
  END IF;
  
  -- Imposto do mes
  v_imposto := v_receita_mes * v_aliquota_efetiva / 100;
  
  -- Inserir/atualizar tax_entry
  INSERT INTO tax_entries (
    org_id, company_id, tax_type, tax_regime,
    competencia_ano, competencia_mes,
    due_date, base_value, tax_rate, tax_value,
    calculation_details, created_by
  ) VALUES (
    p_org_id, p_company_id, 'simples_nacional', 'simples_nacional',
    p_ano, p_mes,
    -- DAS vence dia 20 do mes seguinte
    (DATE_TRUNC('month', MAKE_DATE(p_ano, p_mes, 1)) + INTERVAL '1 month' + INTERVAL '19 days')::DATE,
    v_receita_mes, v_aliquota_efetiva, v_imposto,
    jsonb_build_object(
      'rbt12', v_rbt12,
      'receita_mes', v_receita_mes,
      'faixa_aliquota', v_aliquota,
      'parcela_deduzir', v_parcela_deduzir,
      'aliquota_efetiva', v_aliquota_efetiva
    ),
    '00000000-0000-0000-0000-000000000000' -- system
  )
  ON CONFLICT (org_id, company_id, competencia_ano, competencia_mes) 
  WHERE tax_type = 'simples_nacional'
  DO UPDATE SET 
    base_value = EXCLUDED.base_value,
    tax_rate = EXCLUDED.tax_rate,
    tax_value = EXCLUDED.tax_value,
    calculation_details = EXCLUDED.calculation_details,
    updated_at = now();
  
  RETURN v_imposto;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 3.3 Endpoints NestJS

```
AccountingPeriodModule (6 endpoints)

GET    /api/accounting/periods              -- Listar periodos por empresa
PATCH  /api/accounting/periods/:id/status   -- Alterar status (open->reviewing->closed)
GET    /api/accounting/periods/:id/checklist -- Checklist de fechamento
POST   /api/accounting/periods/:id/close     -- Fechar periodo (valida checklist)
POST   /api/accounting/periods/:id/reopen    -- Reabrir com motivo obrigatorio
GET    /api/accounting/periods/current       -- Periodo atual aberto

AccountingExportModule (8 endpoints)

POST   /api/accounting/export               -- Gerar exportacao (company, periodo, formato)
GET    /api/accounting/export/:id            -- Detalhe da exportacao
GET    /api/accounting/export/:id/download   -- Download do arquivo
GET    /api/accounting/exports               -- Historico de exportacoes
POST   /api/accounting/export/:id/confirm    -- Contador confirma importacao
GET    /api/accounting/export/formats        -- Formatos disponiveis
GET    /api/accounting/export/preview        -- Preview dos lancamentos contabeis
POST   /api/accounting/entries/generate      -- Gerar lancamentos contabeis a partir de classificacoes

TaxModule (10 endpoints)

GET    /api/taxes                            -- Listar impostos por empresa/periodo
GET    /api/taxes/:id                        -- Detalhe com calculo
POST   /api/taxes/provision                  -- Provisionar impostos do periodo
POST   /api/taxes/:id/mark-paid              -- Marcar como pago
GET    /api/taxes/calendar                   -- Calendario fiscal (vencimentos proximos)
GET    /api/taxes/overdue                    -- Impostos vencidos nao pagos
GET    /api/taxes/summary                    -- Resumo: provisionado, pago, vencido por tipo
POST   /api/taxes/:id/attach-guide           -- Anexar guia (DARF, DAS)
GET    /api/taxes/simples/simulate           -- Simular Simples Nacional com faturamento hipotetico
POST   /api/taxes/reconcile                  -- Conciliar: guias geradas vs pagas vs CP

PayrollModule (6 endpoints)

POST   /api/payroll/import                   -- Importar folha (Excel ou manual)
GET    /api/payroll                          -- Listar entries por periodo
GET    /api/payroll/summary                  -- Resumo por tipo (salarios, encargos, beneficios)
PATCH  /api/payroll/:id                      -- Editar entry
DELETE /api/payroll/:id                      -- Excluir entry
POST   /api/payroll/provision-13-ferias      -- Calcular provisoes 13o e ferias

FiscalReconciliationModule (6 endpoints)

POST   /api/fiscal/reconcile                 -- Executar conciliacao fiscal do periodo
GET    /api/fiscal/reconciliation             -- Resultado da conciliacao
GET    /api/fiscal/divergences               -- Divergencias pendentes
PATCH  /api/fiscal/divergences/:id/resolve    -- Resolver divergencia com justificativa
GET    /api/fiscal/comparison                 -- Comparativo: NF emitidas vs recebimentos vs contabil
GET    /api/fiscal/summary                    -- Resumo por empresa: tudo batendo? alertas?
```

**Logica da Exportacao Dominio TXT (POST /api/accounting/export com format='dominio_txt'):**

Layout fixo do Dominio Sistemas (mais usado por contadores de PME no Brasil):

```
Posicao 01-02: Tipo de registro (01 = lancamento)
Posicao 03-08: Data (DDMMAA)
Posicao 09-18: Conta debito (completar com zeros a esquerda)
Posicao 19-28: Conta credito
Posicao 29-42: Valor (14 posicoes, 2 decimais, sem ponto/virgula)
Posicao 43-92: Historico (50 caracteres, truncar se necessario)
Posicao 93-102: Centro de custo (10 posicoes)
```

O sistema gera cada linha nesse formato a partir dos `accounting_entries`, trunca historico para 50 chars, preenche com zeros, e gera arquivo .TXT com encoding Latin-1 (que o Dominio exige).

**Logica da Conciliacao Fiscal (POST /api/fiscal/reconcile):**

1. Busca todas as NFs do periodo (via Tiny API ou `extracted_data` dos documentos XML)
2. Busca todos os recebimentos bancarios classificados como receita
3. Busca todas as classificacoes de CR do periodo
4. Compara:
   - NFs emitidas sem recebimento correspondente = "Faturou mas nao recebeu"
   - Recebimentos sem NF = "Recebeu mas nao emitiu nota" (risco fiscal altissimo)
   - Valor NF != Valor recebido = "Divergencia de valor"
   - NFs de entrada sem pagamento = "Comprou mas nao pagou"
5. Gera registro em `fiscal_reconciliation` com detalhamento por divergencia
6. Alerta se divergencia de receita > 5% (risco de malha fina)

## 3.4 UX/Telas

**Tela 1: Fechamento Contabil (`/accounting/close`)**

- Timeline horizontal: meses com status (aberto=azul, revisando=amarelo, fechado=verde, exportado=roxo)
- Mes selecionado: card com checklist de fechamento
  - [ ] Todas as transacoes conciliadas (auto-check: busca pendentes)
  - [ ] Todos os lancamentos classificados (auto-check: busca sem conta)
  - [ ] Documentos completos (auto-check: busca pendencias)
  - [ ] Impostos provisionados (auto-check: tax_entries existem)
  - [ ] DRE revisado (manual check)
  - [ ] Folha importada (auto-check: payroll_entries existem)
- Botao [Fechar Periodo] so habilita com checklist 100%
- Botao [Exportar para Contabilidade] abre modal de formato

**Tela 2: Exportacao Contabil (`/accounting/export`)**

- Select empresa + periodo + formato (Dominio/Alterdata/Fortes/CSV/Excel)
- Preview: tabela de lancamentos contabeis (Debito | Credito | Valor | Historico | CC)
- Totalizadores: Total Debitos = Total Creditos (se nao bate, erro)
- Botao [Gerar Arquivo] com download imediato
- Historico de exportacoes: tabela com data, formato, qtd lancamentos, status, download

**Tela 3: Impostos (`/taxes`)**

- Calendario visual (tipo Google Calendar) com vencimentos por tipo de imposto
- Cards por imposto: tipo, competencia, base, aliquota, valor, status (badge), vencimento
- Alerta vermelho para vencidos, amarelo para proximos 5 dias
- Aba "Simples Nacional": simulador com faturamento 12 meses e calculo de faixa/aliquota
- Aba "Conciliacao": guias geradas vs pagas, com vinculacao a CP e comprovante

**Tela 4: Folha (`/payroll`)**

- Importacao via Excel (template disponivel para download)
- Tabela por tipo: Salarios, INSS, FGTS, IRRF, Beneficios, Pro-labore
- Totalizadores: Custo total folha, por tipo
- Provisoes: cards com provisao 13o (1/12 do salario base) e ferias (1/12 + 1/3)

**Tela 5: Conciliacao Fiscal (`/fiscal`)**

- Dashboard com metricas: Faturamento NF vs Recebido vs Contabil, Divergencia total
- Lista de divergencias: tipo, descricao, valor, status
- Botao [Resolver] com justificativa
- Grafico: barras comparativas por mes (NF vs Financeiro vs Contabil)

## 3.5 Sprint Breakdown

**Sprint A1 (2 semanas): Periodos + Exportacao Basica**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| ACC-001 | Schema accounting_periods + exports + entries | 5 | Tabelas, indexes, RLS |
| ACC-002 | CRUD periodos com status workflow | 5 | open->reviewing->closed->exported, reopen com motivo |
| ACC-003 | Geracao de lancamentos contabeis a partir de classificacoes | 8 | PL/pgSQL function, partida dobrada, historico padronizado |
| ACC-004 | Exportacao CSV/Excel generico | 5 | Download com formatacao profissional |
| ACC-005 | Tela de fechamento com checklist | 5 | Auto-check items, fechar/reabrir |

**Sprint A2 (2 semanas): Formatos Especificos + Impostos**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| ACC-006 | Exportacao formato Dominio TXT | 5 | Layout fixo, Latin-1, historico truncado |
| ACC-007 | Schema tax_entries + tax_calendar | 3 | Tabelas, seed calendario |
| ACC-008 | Provisao Simples Nacional automatica | 8 | Calculo por faixa, RBT12, aliquota efetiva |
| ACC-009 | Calendario fiscal + alertas vencimento | 5 | Proximos vencimentos, overdue highlight |
| ACC-010 | Tela de impostos com calendario visual | 5 | Calendar view, cards, simulador Simples |

**Sprint A3 (2 semanas): Folha + Conciliacao Fiscal + Polish**

| US | Titulo | SP | Acceptance Criteria |
|----|--------|----|---------------------|
| ACC-011 | Importacao folha (Excel + manual) | 5 | Template Excel, parse, validacao |
| ACC-012 | Provisao 13o e ferias automatica | 3 | Calculo 1/12 + 1/3 ferias |
| ACC-013 | Conciliacao fiscal: NF vs financeiro vs contabil | 8 | Divergencias identificadas, drill-down |
| ACC-014 | Exportacao para Omie/Conta Azul via API | 5 | OAuth + POST lancamentos + reconciliacao |
| ACC-015 | Dashboard fiscal consolidado | 5 | Metricas, alertas, saude fiscal |

## 3.6 Regras de Negocio Invisiveis

1. **Partida dobrada SEMPRE**: Todo lancamento contabil tem debito = credito. Se o sistema gera lancamento com D-Despesa Marketing R$5.000 sem o C-Banco R$5.000 correspondente, o contador vai rejeitar. A funcao `generate_accounting_entries` precisa SEMPRE criar os dois lados. A conta de contrapartida depende do tipo: pagamento = credita Caixa/Banco, recebimento = debita Caixa/Banco, provisao = debita Despesa e credita Provisao a Pagar.

2. **Historico padronizado e lei**: O historico do lancamento contabil precisa identificar a operacao. "PG NF 123456 FORNECEDOR XYZ REF ABR/26" e o padrao. Historico "Pagamento" sem detalhes e glosado em auditoria. O sistema deve gerar historico automaticamente a partir dos dados do lancamento, NUNCA deixar em branco.

3. **Regime de competencia vs caixa no mesmo periodo**: O contador precisa dos dois. Um pagamento feito em maio referente a abril gera: (a) no regime de competencia, despesa em abril; (b) no regime de caixa, saida em maio. O sistema precisa suportar ambos e a exportacao precisa indicar qual regime esta usando.

4. **DAS do Simples Nacional nao e so imposto sobre receita**: O DAS inclui IRPJ, CSLL, PIS, COFINS, CPP, ICMS e ISS unificados. Quando o sistema provisiona Simples, precisa desmembrar a aliquota efetiva nas sub-aliquotas de cada tributo (informacao na tabela do Anexo). O contador precisa disso para preenchimento da DEFIS.

5. **Provisao de 13o e ferias e MENSAL**: Nao e so em novembro/dezembro. Todo mes, a empresa acumula 1/12 do salario em provisao de 13o e 1/12 + 1/3 em provisao de ferias. Se o BPO nao faz isso mensalmente, o DRE de novembro/dezembro explode de despesa e os outros 10 meses ficam artificialmente lucrativos. Isso engana o empresario.

6. **CNPJ raiz para consolidacao fiscal**: Na conciliacao fiscal, uma empresa pode ter filiais com CNPJs diferentes (mesma raiz, sufixo diferente). O sistema deve agrupar por CNPJ raiz (8 primeiros digitos) quando faz reconciliacao de NF emitidas vs recebidas.

7. **Encoding Latin-1 para Dominio**: O Dominio Sistemas (sistema contabil mais usado no Brasil por contadores de PME) nao aceita UTF-8. O arquivo TXT precisa ser gerado em Latin-1/ISO-8859-1. Caracteres acentuados que nao existem em Latin-1 precisam ser transliterados (ex: nome proprio com til). Isso parece trivial mas quebra importacoes se nao tratado.

8. **Exportacao nao pode ter lancamento com valor zero**: Acontece quando um rateio gera centavo residual que arredonda para zero. O sistema precisa filtrar lancamentos com valor < R$0.01 antes de gerar a exportacao. Da mesma forma, lancamentos de transferencia entre contas do mesmo banco nao devem entrar na exportacao contabil (ja estao no razao bancario).

9. **Fechamento retroativo com alerta de impacto**: Se o usuario reabre abril em julho, e classifica um novo lancamento, isso impacta o DRE de abril, a provisao de impostos de abril, e potencialmente o DAS ja pago. O sistema deve calcular o impacto: "Reabrir abril altera DRE em -R$3.200. DAS ja pago pode ter diferenca de R$180. Deseja continuar?"

10. **Folha do domestico**: Algumas PMEs tem empregada domestica no nome da empresa (irregular, mas existe). A folha dessas admissoes entra como "outros" e precisa ser tratada separadamente na provisao de encargos (aliquota diferente).

---

# SEQUENCIAMENTO TOTAL E DEPENDENCIAS

A ordem correta de implementacao e:

1. **Modulo 2 primeiro** (Plano de Contas + CC): Porque sem classificacao hierarquica, os outros dois modulos nao tem como vincular dados. O DRE gerencial substitui o DRE flat atual e ja entrega valor imediato.

2. **Modulo 1 segundo** (Documentos): Depende do Modulo 2 para vincular documentos a contas do plano. Pode comecar em paralelo (Sprint D1 e D2 enquanto Sprint C3 roda), mas a vinculacao completa requer contas e classificacoes existentes.

3. **Modulo 3 terceiro** (Integracao Contabil): Depende fortemente dos dois anteriores. A exportacao contabil precisa de lancamentos classificados (Modulo 2) com documentos (Modulo 1). Impostos dependem de receita classificada. Conciliacao fiscal depende de documentos (NFs).

**Timeline total estimada: 9 sprints de 2 semanas = 18 semanas (4.5 meses)**

- Sprints C1-C3 (semanas 1-6): Plano de Contas + CC + Classificacao + DRE
- Sprints D1-D3 (semanas 5-10, overlap a partir de C3): Documentos
- Sprints A1-A3 (semanas 9-14, overlap a partir de D3): Integracao Contabil
- Semanas 15-18: Integracao entre modulos, testes E2E, polish

**Novas tabelas totais: 16**
- Modulo 1: documents, document_links, document_policies, document_pendencies (4)
- Modulo 2: chart_of_accounts, cost_centers, apportionment_templates, apportionments, categorization_rules, entry_classifications, budgets (7)
- Modulo 3: accounting_periods, accounting_exports, accounting_entries, tax_entries, tax_calendar, payroll_entries, fiscal_reconciliation (7, tax_calendar e referencia)

**Novos endpoints totais: ~82**

Somados aos 80 endpoints do PRD existente, a plataforma tera ~162 endpoints no backend NestJS.

---

### Critical Files for Implementation

- /c/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md
- /c/CLAUDECODE/BusinessAnalytics/src/hooks/useFinanceiroData.ts
- /c/CLAUDECODE/BusinessAnalytics/src/pages/DRE.tsx
- /c/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md
- /c/CLAUDECODE/BusinessAnalytics/src/integrations/supabase/types.ts

---

# PARTE V — SANEAMENTO, IMPLANTAÇÃO E APROVAÇÃO

> Saneamento Cadastral Inteligente, Implantação e Migração, e Fluxo de Aprovação de Pagamentos — a fundação invisível.

---


---

# PLANO DE ARQUITETURA: 3 MODULOS CRITICOS PARA BPO FINANCEIRO

## Premissa de quem ja implantou: por que estes 3 modulos matam ou salvam a operacao

Depois de implantar sistemas financeiros em dezenas de PMEs brasileiras, posso afirmar com convicao: nenhum motor de conciliacao, nenhuma IA de matching, nenhum dashboard bonito salva uma operacao de BPO se a base de dados esta poluida, se a implantacao foi feita "na correria", e se pagamentos saem sem aprovacao. Estes tres modulos sao a fundacao invisivel que separa BPO financeiro amador de operacao profissional.

A plataforma atual (PRD de 10 sprints, 17 tabelas, 80 endpoints) ja resolve conciliacao, CP/CR, sync Tiny, import OFX, IA matching. Mas presume que os dados que entram estao limpos, que a empresa foi configurada corretamente, e que pagamentos podem sair sem controle. Na pratica, isso nunca acontece.

---

# MODULO 1: SANEAMENTO CADASTRAL INTELIGENTE

## 1.1 Justificativa de Negocio

Sem saneamento, toda a inteligencia da plataforma opera sobre lixo. Os scripts existentes em `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/identificar_duplicidades.js` ja revelam o problema: o Grupo Lauxen tem centenas de CRs duplicadas que poluem relatorios, inflam saldo a receber, e tornam conciliacao um pesadelo. O script atual faz deteccao bruta por "mesmo cliente + mesmo valor" -- funciona para o obvio, mas perde duplicatas com nomes ligeiramente diferentes ("JOAO SILVA" vs "JOAO DA SILVA LTDA"), CNPJs com formatacao diferente, e categorias sinonimas.

Sem este modulo:
- Conciliacao automatica tem 30%+ de falsos positivos (matcha com cadastro errado)
- DRE fica distorcido (mesma despesa em duas categorias diferentes)
- Fluxo de caixa mostra valores inflados (CRs duplicadas contam como receita esperada)
- Cobranca envia duplicatas para o mesmo cliente (destrui relacionamento comercial)
- Auditor rejeita demonstracoes por inconsistencia cadastral

**ROI direto**: cada hora de saneamento feito na implantacao economiza 10 horas de retrabalho nos primeiros 6 meses.

## 1.2 Schema PostgreSQL Completo

```sql
-- ==========================================================
-- MODULO: SANEAMENTO CADASTRAL INTELIGENTE
-- Extensao necessaria: pg_trgm (ja habilitada no darksales)
-- ==========================================================

-- 1. Deteccao de duplicatas
CREATE TABLE duplicate_detection_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('supplier', 'customer', 'category')),
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_entities  INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,
  auto_merged     INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  started_by      UUID REFERENCES profiles(id),
  error_message   TEXT
);

CREATE TABLE duplicate_groups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id          UUID NOT NULL REFERENCES duplicate_detection_runs(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('supplier', 'customer', 'category')),
  similarity_score NUMERIC(5,2) NOT NULL CHECK (similarity_score BETWEEN 0 AND 100),
  match_reasons   JSONB NOT NULL DEFAULT '[]',
  -- Ex: [{"field":"cnpj","type":"exact"},{"field":"name","type":"fuzzy","score":87}]
  status          TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'reviewing', 'merged', 'dismissed', 'auto_merged')),
  primary_entity_id UUID,  -- o "vencedor" do merge
  merged_by       UUID REFERENCES profiles(id),
  merged_at       TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE duplicate_group_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  entity_id       UUID NOT NULL,
  entity_data     JSONB NOT NULL,  -- snapshot dos dados no momento da deteccao
  is_primary      BOOLEAN DEFAULT FALSE,
  linked_records  INTEGER DEFAULT 0,  -- quantos lancamentos usam este cadastro
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, entity_id)
);

-- 2. Merge log (auditoria do merge)
CREATE TABLE merge_operations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES duplicate_groups(id),
  entity_type     TEXT NOT NULL,
  primary_entity_id UUID NOT NULL,
  merged_entity_ids UUID[] NOT NULL,
  records_reclassified INTEGER DEFAULT 0,
  before_snapshot JSONB NOT NULL,  -- estado antes do merge
  after_snapshot  JSONB NOT NULL,   -- estado depois do merge
  merged_by       UUID NOT NULL REFERENCES profiles(id),
  merged_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Validacao de dados
CREATE TABLE data_validation_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_code       TEXT NOT NULL,  -- 'cpf_invalid', 'cnpj_invalid', 'email_invalid', etc.
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('supplier', 'customer', 'transaction', 'category')),
  severity        TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'blocking')),
  is_active       BOOLEAN DEFAULT TRUE,
  description     TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, rule_code)
);

CREATE TABLE data_validation_issues (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES data_validation_rules(id),
  rule_code       TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  field_name      TEXT NOT NULL,
  current_value   TEXT,
  expected_format TEXT,
  suggestion      TEXT,  -- valor corrigido sugerido
  severity        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'fixed', 'dismissed', 'auto_fixed')),
  fixed_by        UUID REFERENCES profiles(id),
  fixed_at        TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para performance em queries de dashboard
CREATE INDEX idx_validation_issues_status ON data_validation_issues(org_id, company_id, status);
CREATE INDEX idx_validation_issues_severity ON data_validation_issues(org_id, severity, status);

-- 4. Categorias
CREATE TABLE category_analysis (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_name   TEXT NOT NULL,
  category_source TEXT NOT NULL DEFAULT 'tiny',  -- tiny, manual, imported
  usage_count     INTEGER DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  similar_categories JSONB DEFAULT '[]',
  -- Ex: [{"name":"Mat. Escritorio","similarity":0.92},{"name":"Escritorio Material","similarity":0.87}]
  suggested_action TEXT CHECK (suggested_action IN ('keep', 'merge', 'remove', 'split', 'rename')),
  merged_into     TEXT,  -- nome da categoria destino apos merge
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'merged', 'removed', 'split')),
  analyzed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Completude de lancamentos
CREATE TABLE completeness_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = todas empresas
  field_name      TEXT NOT NULL,  -- 'category', 'cost_center', 'document', 'cnpj'
  is_required     BOOLEAN DEFAULT FALSE,  -- TRUE = bloqueio hard
  min_amount      NUMERIC(14,2),  -- obrigatorio apenas para lancamentos acima deste valor
  applies_to      TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'cp', 'cr')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, field_name, applies_to)
);

CREATE TABLE completeness_violations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES completeness_rules(id),
  entity_type     TEXT NOT NULL,  -- 'tiny_contas_pagar', 'tiny_contas_receber'
  entity_id       UUID NOT NULL,
  missing_field   TEXT NOT NULL,
  violation_type  TEXT NOT NULL DEFAULT 'warning' CHECK (violation_type IN ('warning', 'blocking')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'overridden')),
  resolved_at     TIMESTAMPTZ,
  overridden_by   UUID REFERENCES profiles(id),
  override_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Plano de contas padrao
CREATE TABLE chart_of_accounts_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,  -- 'PME Padrao', 'Industria', 'Comercio', 'Servicos'
  description     TEXT,
  accounts        JSONB NOT NULL,
  -- Ex: [{"code":"1","name":"Receita","type":"revenue","children":[...]},...]
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chart_of_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,  -- '1.1.01'
  name            TEXT NOT NULL,  -- 'Receita de Vendas Mercadorias'
  parent_id       UUID REFERENCES chart_of_accounts(id),
  account_type    TEXT NOT NULL CHECK (account_type IN (
    'revenue', 'cmv', 'operational_expense', 'financial_expense',
    'financial_revenue', 'tax', 'payroll', 'other'
  )),
  level           INTEGER NOT NULL DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE,
  tiny_categories TEXT[] DEFAULT '{}',  -- categorias do Tiny mapeadas para esta conta
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, code)
);

CREATE TABLE chart_of_accounts_mappings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL DEFAULT 'tiny' CHECK (source_type IN ('tiny', 'conta_simples', 'manual')),
  source_category TEXT NOT NULL,
  target_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  is_auto_mapped  BOOLEAN DEFAULT FALSE,
  confidence      NUMERIC(5,2),
  mapped_by       UUID REFERENCES profiles(id),
  mapped_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, source_type, source_category)
);

-- 7. Score de qualidade
CREATE TABLE quality_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  overall_score   NUMERIC(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  valid_registrations_pct  NUMERIC(5,2) DEFAULT 0,
  categorized_entries_pct  NUMERIC(5,2) DEFAULT 0,
  attached_documents_pct   NUMERIC(5,2) DEFAULT 0,
  resolved_duplicates_pct  NUMERIC(5,2) DEFAULT 0,
  complete_entries_pct     NUMERIC(5,2) DEFAULT 0,
  cost_center_coverage_pct NUMERIC(5,2) DEFAULT 0,
  target_score    NUMERIC(5,2) DEFAULT 95.00,
  details         JSONB DEFAULT '{}',
  calculated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Historico mensal para grafico de evolucao
CREATE TABLE quality_score_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year_month      TEXT NOT NULL,  -- '2026-04'
  overall_score   NUMERIC(5,2) NOT NULL,
  components      JSONB NOT NULL,
  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, year_month)
);

-- 8. Centro de custo
CREATE TABLE cost_centers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES cost_centers(id),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, code)
);

CREATE TABLE cost_center_suggestions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  suggested_cost_center_id UUID NOT NULL REFERENCES cost_centers(id),
  confidence      NUMERIC(5,2) NOT NULL,
  reason          TEXT,  -- 'Baseado em fornecedor: 95% dos lancamentos anteriores'
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- FUNCOES DE DETECCAO
-- =====================

-- Funcao de fuzzy match para nomes usando pg_trgm
CREATE OR REPLACE FUNCTION find_similar_names(
  p_org_id UUID,
  p_entity_type TEXT,
  p_threshold NUMERIC DEFAULT 0.3
)
RETURNS TABLE(
  entity_id_a UUID,
  name_a TEXT,
  entity_id_b UUID,
  name_b TEXT,
  similarity NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Exemplo para fornecedores: adaptar query conforme entity_type
  IF p_entity_type = 'supplier' THEN
    RETURN QUERY
    SELECT 
      a.id AS entity_id_a,
      a.nome AS name_a,
      b.id AS entity_id_b,
      b.nome AS name_b,
      ROUND(similarity(LOWER(a.nome), LOWER(b.nome))::NUMERIC * 100, 2) AS similarity
    FROM tiny_contas_pagar a
    CROSS JOIN tiny_contas_pagar b
    WHERE a.org_id = p_org_id
      AND b.org_id = p_org_id
      AND a.id < b.id
      AND similarity(LOWER(a.nome), LOWER(b.nome)) > p_threshold
    ORDER BY similarity DESC
    LIMIT 500;
  END IF;
END;
$$;

-- Funcao de validacao de CNPJ
CREATE OR REPLACE FUNCTION validate_cnpj(p_cnpj TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits TEXT;
  sum INTEGER;
  remainder INTEGER;
  d1 INTEGER;
  d2 INTEGER;
  weights1 INTEGER[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  weights2 INTEGER[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
BEGIN
  digits := regexp_replace(p_cnpj, '[^0-9]', '', 'g');
  IF length(digits) != 14 THEN RETURN FALSE; END IF;
  IF digits ~ '^(.)\1+$' THEN RETURN FALSE; END IF;  -- todos iguais
  
  sum := 0;
  FOR i IN 1..12 LOOP
    sum := sum + (substring(digits, i, 1)::INTEGER * weights1[i]);
  END LOOP;
  remainder := sum % 11;
  d1 := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;
  IF substring(digits, 13, 1)::INTEGER != d1 THEN RETURN FALSE; END IF;
  
  sum := 0;
  FOR i IN 1..13 LOOP
    sum := sum + (substring(digits, i, 1)::INTEGER * weights2[i]);
  END LOOP;
  remainder := sum % 11;
  d2 := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;
  IF substring(digits, 14, 1)::INTEGER != d2 THEN RETURN FALSE; END IF;
  
  RETURN TRUE;
END;
$$;

-- Funcao de validacao de CPF
CREATE OR REPLACE FUNCTION validate_cpf(p_cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits TEXT;
  sum INTEGER;
  remainder INTEGER;
BEGIN
  digits := regexp_replace(p_cpf, '[^0-9]', '', 'g');
  IF length(digits) != 11 THEN RETURN FALSE; END IF;
  IF digits ~ '^(.)\1+$' THEN RETURN FALSE; END IF;
  
  sum := 0;
  FOR i IN 1..9 LOOP
    sum := sum + (substring(digits, i, 1)::INTEGER * (11 - i));
  END LOOP;
  remainder := (sum * 10) % 11;
  IF remainder = 10 THEN remainder := 0; END IF;
  IF substring(digits, 10, 1)::INTEGER != remainder THEN RETURN FALSE; END IF;
  
  sum := 0;
  FOR i IN 1..10 LOOP
    sum := sum + (substring(digits, i, 1)::INTEGER * (12 - i));
  END LOOP;
  remainder := (sum * 10) % 11;
  IF remainder = 10 THEN remainder := 0; END IF;
  IF substring(digits, 11, 1)::INTEGER != remainder THEN RETURN FALSE; END IF;
  
  RETURN TRUE;
END;
$$;

-- RLS para todas as tabelas deste modulo
ALTER TABLE duplicate_detection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE merge_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_validation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE completeness_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE completeness_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_analysis ENABLE ROW LEVEL SECURITY;

-- Politica padrao: org_id = get_org_id()
-- (aplicar para cada tabela, exemplo para uma)
CREATE POLICY "org_isolation" ON duplicate_detection_runs
  FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON duplicate_groups
  FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON data_validation_issues
  FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON quality_scores
  FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON chart_of_accounts
  FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON cost_centers
  FOR ALL USING (org_id = get_org_id());
-- (repetir para demais tabelas)
```

## 1.3 Endpoints NestJS

```
Module: SanitizationModule (16 endpoints)

-- Deteccao de Duplicatas --
POST   /api/sanitization/duplicates/detect
  Body: { company_id, entity_type: 'supplier'|'customer', threshold?: number }
  Response: { run_id, status: 'started' }
  Job: BullMQ queue 'sanitization-detect', processa async

GET    /api/sanitization/duplicates/runs
  Query: company_id, status, page, limit
  Response: paginated list de runs

GET    /api/sanitization/duplicates/runs/:runId
  Response: run details com stats

GET    /api/sanitization/duplicates/groups
  Query: run_id?, company_id, status, min_score, page, limit
  Response: paginated list de grupos com membros embedded

GET    /api/sanitization/duplicates/groups/:groupId
  Response: grupo com todos os membros, dados completos, preview de merge

POST   /api/sanitization/duplicates/groups/:groupId/merge
  Body: { primary_entity_id }
  Response: merge_operation com contagem de reclassificados
  Transacao: SERIALIZABLE — merge cadastros + reclassifica lancamentos + audit_log

POST   /api/sanitization/duplicates/groups/:groupId/dismiss
  Body: { reason }
  Response: { status: 'dismissed' }

-- Validacao de Dados --
POST   /api/sanitization/validation/run
  Body: { company_id, rules?: string[] }
  Response: { total_checked, issues_found, by_severity: {...} }
  Checa: CPF/CNPJ (funcao PG), email (regex + MX), telefone (formato BR), CEP (API ViaCEP), IE (por UF)

GET    /api/sanitization/validation/issues
  Query: company_id, rule_code, severity, status, entity_type, page, limit
  Response: paginated issues

PATCH  /api/sanitization/validation/issues/:issueId
  Body: { status: 'fixed'|'dismissed', fixed_value?, dismissed_reason? }

POST   /api/sanitization/validation/issues/bulk-fix
  Body: { issue_ids: UUID[], action: 'apply_suggestions' }
  Response: { fixed: number, failed: number, errors: [...] }

-- Categorias --
POST   /api/sanitization/categories/analyze
  Body: { company_id }
  Response: { total, synonyms_found, unused, ambiguous }

POST   /api/sanitization/categories/merge
  Body: { company_id, source_categories: string[], target_category: string }
  Reclassifica todos os lancamentos das sources para target

-- Plano de Contas --
GET    /api/sanitization/chart-of-accounts/templates
POST   /api/sanitization/chart-of-accounts/apply-template
  Body: { company_id, template_id, mappings?: [...] }

-- Score de Qualidade --
GET    /api/sanitization/quality-score
  Query: company_id
  Response: score atual + componentes + historico

POST   /api/sanitization/quality-score/recalculate
  Body: { company_id }
  Recalcula: % cadastros validos, % categorizados, % documentos, % duplicatas resolvidas, % completos
```

## 1.4 State Machine: Grupo de Duplicatas

```
Estados: pending -> reviewing -> merged | dismissed
                              -> auto_merged (se score >= 98 E config permite)

Transicoes:
  pending -> reviewing:    usuario abre o grupo para revisao
  reviewing -> merged:     usuario confirma merge (seleciona primary)
  reviewing -> dismissed:  usuario descarta (com motivo obrigatorio)
  pending -> auto_merged:  job automatico (score >= 98 + CNPJ identico + config empresa permite auto-merge)

Regras:
  - Merge e irreversivel (audit_log grava before/after para rollback manual se necessario)
  - Dismiss requer motivo (auditoria)
  - Auto-merge so funciona com CNPJ identico (nunca com fuzzy name apenas)
  - Apos merge, todos os lancamentos (CP, CR, bank_transactions) que referenciam 
    entidades merged sao atualizados atomicamente
```

## 1.5 State Machine: Issue de Validacao

```
Estados: open -> fixed | dismissed | auto_fixed

Transicoes:
  open -> fixed:       usuario corrige o dado manualmente
  open -> dismissed:   usuario descarta (ex: CNPJ de MEI sem validacao na Receita)
  open -> auto_fixed:  bulk-fix aplica sugestao automaticamente

Regras:
  - Issues blocking impedem conciliacao do lancamento associado
  - Issues warning marcam mas nao bloqueiam
  - Dismiss requer motivo
  - Fix atualiza o dado na tabela original (supplier/customer)
```

## 1.6 UX/Telas

### Tela 1: Dashboard de Saneamento (`/sanitization`)

```
Layout: grid 3 colunas

ROW 1: KPIs
  [Score Geral: 72/100] gauge circular, cores verde/amarelo/vermelho
  [Cadastros com Problemas: 47] badge vermelho
  [Duplicatas Pendentes: 23] badge amarelo  
  [Categorias Inconsistentes: 8] badge laranja
  [Completude: 92%] barra de progresso

ROW 2: 
  COL 1-2: Grafico de evolucao do score (Recharts AreaChart, ultimos 6 meses)
  COL 3: Lista de acoes prioritarias (ordenada por impacto)
    - "23 fornecedores duplicados — Resolver"
    - "15 CNPJs invalidos — Corrigir"
    - "8 categorias sinonimas — Unificar"
    Cada item clicavel -> vai para a tela especifica

ROW 3:
  COL 1: Problemas por severidade (StackedBarChart)
  COL 2: Problemas por tipo (PieChart: CNPJ, email, telefone, CEP, IE)
  COL 3: Empresas do grupo rankeadas por score (BarChart horizontal)

Acoes rapidas (floating action button):
  - Executar deteccao de duplicatas
  - Executar validacao completa
  - Recalcular score
```

### Tela 2: Resolucao de Duplicatas (`/sanitization/duplicates`)

```
Layout: master-detail

ESQUERDA (lista, 400px):
  Filtros: empresa, tipo (fornecedor/cliente), score minimo, status
  Cards de grupos de duplicatas, cada card:
    - Score badge (0-100, cores)
    - Nome do grupo (ex: "JOAO SILVA - 3 registros")
    - Motivos de match (icons: CNPJ, nome fuzzy, email, telefone)
    - Lancamentos afetados: "47 CPs + 12 CRs"
    - Status badge
  Paginacao infinita (react-window)

DIREITA (detalhe, flex):
  Quando grupo selecionado:
  
  HEADER: "Grupo de Duplicatas — Score 87%" + botoes [Merge] [Descartar]
  
  COMPARATIVO (tabela lado-a-lado):
  | Campo        | Registro A (primary) | Registro B | Registro C |
  |-------------|---------------------|------------|------------|
  | Nome        | Joao Silva Ltda     | J. Silva   | JOAO SILVA |
  | CNPJ        | 12.345.678/0001-90  | —          | 12345678000190 |
  | Email       | joao@empresa.com    | j@emp.com  | —          |
  | Telefone    | (51) 3333-4444      | 33334444   | —          |
  | Lancamentos | 47                  | 12         | 3          |
  
  Radio button para selecionar primary (default: o com mais lancamentos)
  Preview do merge: "62 lancamentos serao reclassificados para Joao Silva Ltda"
  
  TIMELINE: historico de acoes neste grupo
  
  FOOTER: [Descartar com motivo...] [Confirmar Merge]
```

### Tela 3: Validacao de Dados (`/sanitization/validation`)

```
Layout: DataTable com filtros

Filtros colapsaveis: empresa, tipo de regra, severidade, status, campo
Export XLSX

Colunas: 
  Severidade (icon) | Tipo | Entidade | Campo | Valor Atual | Sugestao | Status | Acoes

Acoes inline:
  - Aplicar sugestao (check verde)
  - Corrigir manualmente (edit icon -> dialog)
  - Descartar (x vermelho -> motivo obrigatorio)

Bulk actions:
  - Selecionar multiplas issues
  - "Aplicar todas as sugestoes" (confirma com dialog)
  - "Descartar selecionadas"

Destaque visual: linhas blocking tem fundo vermelho sutil
```

### Tela 4: Unificacao de Categorias (`/sanitization/categories`)

```
Layout: 2 paineis verticais

PAINEL SUPERIOR: Categorias agrupadas por similaridade
  Cards de grupos sinonimos:
  [Material de Escritorio] ≈ [Mat. Escritorio] ≈ [Escritorio - Material]
  Score de similaridade, botao [Unificar]
  
  Cards de categorias sem uso:
  [Categoria X - 0 lancamentos] botao [Remover]
  
  Cards de categorias ambiguas:
  [Despesas Gerais - 234 lancamentos de 8 tipos diferentes] botao [Dividir]

PAINEL INFERIOR: Mapeamento categorias Tiny -> Plano de contas
  Interface drag-and-drop:
  ESQUERDA (Tiny): lista de categorias do Tiny
  DIREITA (Gerencial): arvore do plano de contas
  Arrastar categoria para conta gerencial cria mapping
  Mappings existentes: linhas conectando com X para remover
```

## 1.7 Sprint Breakdown

### Sprint S1: Deteccao de Duplicatas + Merge (2 semanas, 34 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-S01 | Schema de saneamento (8 tabelas + funcoes PG) | 5 | Migration roda sem erro, RLS ativo, funcoes validate_cpf/cnpj retornam correto para 10 casos de teste |
| US-S02 | Deteccao de duplicatas por CNPJ identico | 5 | Dado 100 fornecedores com 15 CNPJs duplicados, detecta os 15 grupos com score 100% |
| US-S03 | Deteccao fuzzy por nome (pg_trgm) | 8 | Dado "JOAO SILVA LTDA" e "J. SILVA", detecta com score >= 70%. Threshold configuravel |
| US-S04 | Deteccao por email/telefone identico | 3 | Mesmo email em 2 fornecedores diferentes = grupo detectado |
| US-S05 | Merge assistido com reclassificacao atomica | 8 | Merge de 3 fornecedores: mantém primary, reclassifica 50 lancamentos, audit_log grava before/after |
| US-S06 | UI: lista de grupos + comparativo lado-a-lado | 5 | Tela renderiza 200 grupos com scroll virtual, comparativo mostra todos os campos |

**Demo Sprint S1**: Executar deteccao no Grupo Lauxen, encontrar os 23 fornecedores duplicados que o script `identificar_duplicidades.js` ja revelou, fazer merge de 3, mostrar lancamentos reclassificados.

### Sprint S2: Validacao + Completude + Score (2 semanas, 31 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-S07 | Validacao CPF/CNPJ (funcao PG + endpoint) | 5 | Valida corretamente 20 CPFs/CNPJs de teste (10 validos, 10 invalidos). Gera issue para cada invalido |
| US-S08 | Validacao email (formato + MX check) | 3 | email@inexistente.xyz = issue criada. joao@gmail.com = OK |
| US-S09 | Validacao CEP + telefone + IE | 3 | CEP 99999-999 = issue. Telefone sem DDD = issue. IE invalida para RS = issue |
| US-S10 | Regras de completude configuraveis | 5 | Empresa configura: "categoria obrigatoria para CP > R$500". CP de R$600 sem categoria = violation blocking |
| US-S11 | Score de qualidade calculado e persistido | 5 | Score calculado com 6 componentes, valor entre 0-100, historico mensal salvo |
| US-S12 | Dashboard de saneamento (KPIs + graficos + acoes) | 5 | Tela mostra score, problemas, evolucao, acoes prioritarias |
| US-S13 | Tela de validacao com bulk-fix | 5 | Selecionar 10 issues + aplicar sugestoes = 10 registros atualizados atomicamente |

**Demo Sprint S2**: Dashboard mostra "Score 72/100 — 47 problemas". Drill-down: 15 CNPJs invalidos. Bulk-fix aplica sugestoes. Score sobe para 81/100.

### Sprint S3: Categorias + Plano de Contas + Centro de Custo (2 semanas, 26 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-S14 | Analise de categorias sinonimas (fuzzy) | 5 | "Mat. Escritorio" e "Material de Escritorio" detectadas como sinonimas (score > 0.85) |
| US-S15 | Merge de categorias com reclassificacao | 5 | Merge 3 categorias em 1: 200 lancamentos reclassificados, audit_log |
| US-S16 | Templates de plano de contas PME | 3 | Template "PME Padrao" com 30+ contas gerenciais pre-configuradas |
| US-S17 | Mapeamento assistido Tiny -> plano de contas | 8 | Interface drag-and-drop funcional, mappings salvos, usados na geracao de DRE |
| US-S18 | Centro de custo: CRUD + sugestao automatica | 5 | Sugestao baseada em historico: "95% dos lancamentos deste fornecedor usam CC Producao" |

**Demo Sprint S3**: Analise detecta 8 categorias sinonimas. Unifica 3. Aplica template PME. Mapeia 20 categorias Tiny. Score sobe para 89/100.

## 1.8 Regras de Negocio Invisiveis

1. **CNPJ de MEI**: MEIs tem CNPJ que comeca com o CPF do titular. Sistema deve detectar e nao marcar como "duplicata" quando CPF e CNPJ coexistem para mesma pessoa.

2. **Filiais com raiz CNPJ identica**: Matriz e filiais compartilham os 8 primeiros digitos do CNPJ. Sistema deve detectar como "mesma empresa, estabelecimentos diferentes" e NAO fazer merge automatico — pode ser intencional.

3. **Categorias do Tiny sao case-sensitive**: "Despesa de Marketing" e "despesa de marketing" sao categorias diferentes no Tiny. O merge de categorias deve considerar isso e normalizar no Tiny via API V3.

4. **Historico de lancamentos nao retroage**: Ao fazer merge de fornecedores, os lancamentos antigos mantem referencia ao fornecedor merged via `merge_operations.before_snapshot`. Se um relatorio historico for gerado, deve usar o snapshot, nao o estado atual.

5. **Lock durante merge**: Enquanto merge esta em andamento, nenhum lancamento novo pode ser criado referenciando as entidades sendo merged. Usar advisory lock do PostgreSQL.

6. **Score zero nao bloqueia operacao**: Empresa com score 0 pode operar normalmente. Score e informativo, nao blocking — exceto para regras de completude configuradas como `is_required = true`.

7. **Validacao de IE por estado**: Cada estado brasileiro tem regra diferente de validacao de Inscricao Estadual. O sistema precisa de 27 validadores distintos. Para MEIs, IE pode ser "ISENTO" — isso nao e erro.

8. **Categorias do Tiny nunca sao deletadas via API**: A API do Tiny nao permite deletar categorias. "Remover" no sistema significa apenas desativar localmente e parar de usar em novas classificacoes.

9. **Fuzzy match com nomes curtos**: Nomes com menos de 5 caracteres geram muitos falsos positivos em pg_trgm. Regra: para nomes < 5 chars, exigir match exato de CNPJ ou email como segundo criterio.

10. **Recalculo de score e pesado**: Em empresas com 10k+ lancamentos, recalcular score pode levar 30s+. Sempre rodar via BullMQ job, nunca síncrono no request.

---

# MODULO 2: IMPLANTACAO E MIGRACAO

## 2.1 Justificativa de Negocio

A implantacao e onde PMEs brasileiras perdem a fe no sistema. O padrao do mercado: vendedor promete, TI instala, financeiro abandona em 2 semanas porque "os dados nao batem". Isso acontece por quatro razoes que nenhum concorrente resolve:

1. **Saldo inicial errado**: A empresa comeca a operar com saldo de caixa divergente. Em 30 dias, nenhuma conciliacao fecha. O financeiro perde confianca e volta para a planilha.

2. **Historico nao importado**: Sem os ultimos 3-6 meses de dados, o sistema parece "vazio". Ninguem confia num dashboard que mostra apenas a ultima semana. Preditividade e pattern matching nao funcionam sem historico.

3. **Mapeamento de categorias mal feito**: O Tiny usa categorias diferentes do plano de contas gerencial. Se o mapeamento nao for feito na implantacao, o DRE fica inutil — e e a primeira coisa que o CEO pede.

4. **Sem checklist de go-live**: A empresa "comeca a usar" antes de estar pronta. Tres dias depois descobre que uma conta bancaria nao foi conectada, que o plano de contas esta incompleto, que o saldo inicial diverge R$15.000. Panico, retrabalho, abandono.

**ROI direto**: implantacao bem feita = churn < 5% em 12 meses. Implantacao ruim = churn > 40% nos primeiros 3 meses.

## 2.2 Schema PostgreSQL Completo

```sql
-- ==========================================================
-- MODULO: IMPLANTACAO E MIGRACAO
-- ==========================================================

-- 1. Onboarding: estado do wizard multi-step
CREATE TABLE onboarding_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  current_step    INTEGER NOT NULL DEFAULT 1,
  total_steps     INTEGER NOT NULL DEFAULT 10,
  status          TEXT NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'abandoned', 'paused')),
  step_data       JSONB NOT NULL DEFAULT '{}',
  -- Ex: {"1":{"completed":true,"data":{"cnpj":"..."}}, "2":{"completed":false}}
  started_by      UUID NOT NULL REFERENCES profiles(id),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  last_activity   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_step_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL,
  step_name       TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('entered', 'completed', 'skipped', 'failed', 'retried')),
  data            JSONB DEFAULT '{}',
  error_message   TEXT,
  duration_ms     INTEGER,  -- tempo gasto neste step
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Importacao de historico
CREATE TABLE history_import_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('tiny_cp', 'tiny_cr', 'tiny_pedidos', 'ofx', 'csv', 'manual')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
  total_records   INTEGER DEFAULT 0,
  imported_records INTEGER DEFAULT 0,
  skipped_records INTEGER DEFAULT 0,
  error_records   INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]',
  -- Rollback support
  backup_id       UUID,  -- referencia ao snapshot pre-import
  can_rollback    BOOLEAN DEFAULT TRUE,
  rolled_back_at  TIMESTAMPTZ,
  rolled_back_by  UUID REFERENCES profiles(id),
  -- Progress tracking
  progress_pct    NUMERIC(5,2) DEFAULT 0,
  current_page    INTEGER DEFAULT 0,
  total_pages     INTEGER,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  started_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Diagnostico inicial
CREATE TABLE company_diagnostics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Contagens
  supplier_count  INTEGER DEFAULT 0,
  customer_count  INTEGER DEFAULT 0,
  duplicate_suppliers INTEGER DEFAULT 0,
  duplicate_customers INTEGER DEFAULT 0,
  bank_account_count INTEGER DEFAULT 0,
  bank_accounts_without_statement INTEGER DEFAULT 0,
  category_count  INTEGER DEFAULT 0,
  categories_organized BOOLEAN DEFAULT FALSE,
  -- Qualidade
  entries_without_category_pct NUMERIC(5,2) DEFAULT 0,
  entries_without_cost_center_pct NUMERIC(5,2) DEFAULT 0,
  monthly_volume_estimate INTEGER DEFAULT 0,
  -- Score e recomendacao
  overall_score   NUMERIC(5,2) DEFAULT 0,
  estimated_cleanup_hours NUMERIC(5,1) DEFAULT 0,
  recommended_plan TEXT CHECK (recommended_plan IN ('basic', 'intermediate', 'advanced')),
  recommendations JSONB DEFAULT '[]',
  -- Ex: [{"type":"duplicates","message":"23 fornecedores duplicados","priority":"high"}]
  generated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Mapeamento assistido
CREATE TABLE import_mappings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mapping_type    TEXT NOT NULL CHECK (mapping_type IN (
    'category', 'bank_account', 'supplier', 'customer', 'cost_center'
  )),
  source_system   TEXT NOT NULL DEFAULT 'tiny',
  source_id       TEXT,  -- ID no sistema origem
  source_name     TEXT NOT NULL,  -- nome no sistema origem
  target_id       UUID,  -- ID na plataforma
  target_name     TEXT,  -- nome na plataforma
  status          TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'mapped', 'skipped', 'auto_mapped', 'new_created')),
  confidence      NUMERIC(5,2),  -- para auto-mappings
  mapped_by       UUID REFERENCES profiles(id),
  mapped_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, mapping_type, source_system, source_name)
);

-- 5. Saldo inicial
CREATE TABLE initial_balances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  informed_balance NUMERIC(14,2) NOT NULL,
  statement_balance NUMERIC(14,2),  -- extraido do ultimo extrato importado
  divergence      NUMERIC(14,2),  -- informed - statement
  reference_date  DATE NOT NULL,
  is_validated    BOOLEAN DEFAULT FALSE,
  validated_by    UUID REFERENCES profiles(id),
  validated_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, bank_account_id)
);

-- 6. Checklist de go-live
CREATE TABLE golive_checklists (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'ready', 'live', 'rolled_back')),
  items           JSONB NOT NULL DEFAULT '[]',
  -- Ex: [{"code":"company_data","label":"Empresa cadastrada","completed":true,"completed_at":"...","completed_by":"..."}]
  go_live_at      TIMESTAMPTZ,
  go_live_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id)
);

-- Items padrao do checklist (template)
CREATE TABLE golive_checklist_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL,  -- 'cadastro', 'integracao', 'financeiro', 'operacional'
  is_blocking     BOOLEAN DEFAULT TRUE,  -- true = impede go-live se nao completado
  sort_order      INTEGER NOT NULL,
  validation_query TEXT  -- query SQL que retorna true/false para auto-validar
);

-- Seed dos items de checklist
INSERT INTO golive_checklist_templates (code, label, description, category, is_blocking, sort_order, validation_query) VALUES
('company_data',       'Empresa cadastrada com dados completos',    'CNPJ, razao social, regime tributario', 'cadastro', true, 1,
  'SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1 AND cnpj IS NOT NULL AND name IS NOT NULL)'),
('tiny_connected',     'Tiny ERP conectado e sincronizando',        'Token V2 ou OAuth V3 configurado e testado', 'integracao', true, 2,
  NULL),
('bank_connected',     'Pelo menos 1 conta bancaria conectada',     'OFX, API ou manual', 'integracao', true, 3,
  'SELECT EXISTS(SELECT 1 FROM bank_accounts WHERE company_id = $1 AND is_active = true)'),
('balance_validated',  'Saldo inicial validado',                    'Divergencia < R$1,00', 'financeiro', true, 4,
  'SELECT EXISTS(SELECT 1 FROM initial_balances WHERE company_id = $1 AND is_validated = true)'),
('chart_configured',   'Plano de contas configurado',               'Template aplicado ou personalizado', 'financeiro', true, 5,
  'SELECT EXISTS(SELECT 1 FROM chart_of_accounts WHERE company_id = $1)'),
('categories_mapped',  'Categorias mapeadas',                       'Categorias Tiny vinculadas ao plano gerencial', 'financeiro', true, 6,
  'SELECT (SELECT COUNT(*) FROM chart_of_accounts_mappings WHERE company_id = $1) > 0'),
('suppliers_registered','Fornecedores principais cadastrados',       'Top 20 por volume', 'cadastro', false, 7, NULL),
('customers_registered','Clientes principais cadastrados',           'Top 20 por volume', 'cadastro', false, 8, NULL),
('sla_defined',        'SLA definido',                               'Prazos de conciliacao e fechamento', 'operacional', false, 9, NULL),
('analyst_assigned',   'Analista responsavel atribuido',             'Pelo menos 1 membro ativo', 'operacional', true, 10,
  'SELECT EXISTS(SELECT 1 FROM org_members WHERE org_id = (SELECT org_id FROM companies WHERE id = $1))'),
('test_closing',       'Primeiro fechamento-teste realizado',        'Ciclo completo: sync, import, conciliacao', 'operacional', false, 11, NULL);

-- 7. Backups de implantacao (para rollback)
CREATE TABLE implementation_backups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  backup_type     TEXT NOT NULL CHECK (backup_type IN ('pre_import', 'pre_mapping', 'pre_merge', 'pre_golive')),
  tables_backed   TEXT[] NOT NULL,  -- ['tiny_contas_pagar', 'bank_transactions', ...]
  record_counts   JSONB NOT NULL,   -- {"tiny_contas_pagar": 1234, "bank_transactions": 567}
  storage_path    TEXT NOT NULL,     -- caminho no Supabase Storage
  size_bytes      BIGINT,
  is_valid        BOOLEAN DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,       -- backups expiram apos 30 dias
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SLA e responsaveis
CREATE TABLE company_sla (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reconciliation_deadline_day INTEGER DEFAULT 5,  -- dia do mes para fechar conciliacao
  closing_deadline_day INTEGER DEFAULT 10,        -- dia do mes para fechamento contabil
  analyst_user_id UUID REFERENCES profiles(id),
  supervisor_user_id UUID REFERENCES profiles(id),
  notification_channels JSONB DEFAULT '["email"]',
  escalation_hours INTEGER DEFAULT 48,  -- horas ate escalar para supervisor
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id)
);

-- RLS
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_step_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE initial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE golive_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE implementation_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_sla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON onboarding_sessions FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON history_import_jobs FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON company_diagnostics FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON import_mappings FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON initial_balances FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON golive_checklists FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON implementation_backups FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON company_sla FOR ALL USING (org_id = get_org_id());
```

## 2.3 Endpoints NestJS

```
Module: OnboardingModule (22 endpoints)

-- Wizard de Onboarding --
POST   /api/onboarding/sessions
  Body: { company_id }
  Response: { session_id, current_step: 1, steps: [...] }
  Cria sessao + popula checklist + gera step_data inicial

GET    /api/onboarding/sessions/:sessionId
  Response: sessao completa com step_data, progresso, tempo gasto

PATCH  /api/onboarding/sessions/:sessionId/step/:stepNumber
  Body: { action: 'complete'|'skip'|'fail', data?: {...} }
  Response: sessao atualizada, proximo step
  Validacoes por step:
    Step 1: CNPJ valido (funcao PG), razao social preenchida
    Step 2: Token Tiny testado com GET /api/info
    Step 3: Pelo menos 1 arquivo OFX valido OU credenciais API
    Step 4: Credenciais de gateway testadas
    Step 8: Saldo informado (numerico > 0 OU = 0 com confirmacao)

POST   /api/onboarding/sessions/:sessionId/step/:stepNumber/test-connection
  Body varia por step:
    Step 2 (Tiny V2): { token }
    Step 2 (Tiny V3): { client_id, client_secret } -> inicia OAuth
    Step 3 (Conta Simples): { api_key, api_secret }
    Step 4 (Pagar.me): { secret_key }
  Response: { success, message, details? }

-- Importacao de Historico --
POST   /api/onboarding/import/history
  Body: { company_id, source: 'tiny_cp'|'tiny_cr'|'ofx', period_months: 3|6|12 }
  Response: { job_id, status: 'pending' }
  Job: BullMQ queue 'history-import'

GET    /api/onboarding/import/history/:jobId
  Response: job com progresso em tempo real

GET    /api/onboarding/import/history
  Query: company_id, status, source
  Response: lista de jobs de importacao

POST   /api/onboarding/import/history/:jobId/rollback
  Response: { status: 'rolled_back', records_removed: 1234 }
  Deleta todos os registros importados por este job

-- Diagnostico --
POST   /api/onboarding/diagnostics/run
  Body: { company_id }
  Response: company_diagnostic completo
  Analisa: duplicatas, categorias, completude, volume, score, recomendacoes

GET    /api/onboarding/diagnostics/:companyId
  Response: ultimo diagnostico da empresa

GET    /api/onboarding/diagnostics/:companyId/report
  Response: PDF do relatorio "Diagnostico Financeiro — Empresa X"

-- Mapeamento --
GET    /api/onboarding/mappings
  Query: company_id, mapping_type, status
  Response: lista de mappings pendentes/completos

POST   /api/onboarding/mappings/auto-detect
  Body: { company_id, mapping_type }
  Response: { auto_mapped: 15, pending: 8 }
  Usa fuzzy matching para sugerir mapeamentos automaticos

PATCH  /api/onboarding/mappings/:mappingId
  Body: { target_id, target_name }
  Response: mapping atualizado

POST   /api/onboarding/mappings/bulk
  Body: { mappings: [{ id, target_id, target_name }] }
  Response: { updated: 12, errors: [] }

-- Saldo Inicial --
POST   /api/onboarding/balances
  Body: { company_id, bank_account_id, informed_balance, reference_date }
  Response: { id, divergence, is_validated }
  Auto-valida se divergencia < R$1.00

PATCH  /api/onboarding/balances/:balanceId/validate
  Body: { notes? }
  Response: { is_validated: true }
  Regra: so valida se divergencia < R$1 OU usuario confirma com notes

-- Checklist de Go-Live --
GET    /api/onboarding/checklist/:companyId
  Response: checklist com items, status de cada, % completo
  Auto-valida items que tem validation_query

PATCH  /api/onboarding/checklist/:companyId/items/:itemCode
  Body: { completed: true|false }
  Response: item atualizado + checklist atualizado

POST   /api/onboarding/checklist/:companyId/go-live
  Response: { status: 'live' } ou { error: 'Items blocking incompletos', missing: [...] }
  Regra: so permite go-live se todos os items blocking estao completed

-- SLA --
POST   /api/onboarding/sla
  Body: { company_id, reconciliation_deadline_day, closing_deadline_day, analyst_user_id, ... }
  Response: company_sla criado

-- Rollback --
POST   /api/onboarding/rollback/:companyId
  Body: { scope: 'full'|'imports_only'|'mappings_only' }
  Response: { rolled_back: true, details: {...} }
  Restaura backup pre-implementacao
```

## 2.4 State Machine: Sessao de Onboarding

```
Estados: in_progress -> completed | abandoned | paused

Transicoes:
  in_progress -> completed:  todos os steps obrigatorios completados + go-live executado
  in_progress -> paused:     usuario fecha wizard sem completar (auto-save)
  in_progress -> abandoned:  30 dias sem atividade (job cleanup)
  paused -> in_progress:     usuario retoma wizard
  completed -> in_progress:  reabrir para ajustes (raro, requer admin)

Steps e obrigatoriedade:
  Step 1: Dados empresa     [OBRIGATORIO]
  Step 2: Conectar Tiny     [OBRIGATORIO]
  Step 3: Conectar bancos   [OBRIGATORIO]
  Step 4: Conectar gateways [OPCIONAL]
  Step 5: Importar base     [OPCIONAL]
  Step 6: Diagnostico       [AUTO - roda apos step 5]
  Step 7: Saneamento        [RECOMENDADO]
  Step 8: Saldo inicial     [OBRIGATORIO]
  Step 9: SLA e responsaveis [RECOMENDADO]
  Step 10: Go-live checklist [OBRIGATORIO]

Regras:
  - Steps podem ser revisitados (nao-linear, exceto step 6 que depende de 5)
  - Skip de step opcional registra log "skipped" (para follow-up posterior)
  - Tempo gasto em cada step e registrado (metrica de UX)
```

## 2.5 State Machine: Job de Importacao de Historico

```
Estados: pending -> running -> completed | failed
                              -> rolled_back

Transicoes:
  pending -> running:      BullMQ worker pega o job
  running -> completed:    import finalizado sem erros fatais (erros parciais OK)
  running -> failed:       erro fatal (ex: API Tiny offline, OFX corrompido)
  completed -> rolled_back: usuario solicita rollback (deleta registros importados)
  failed -> pending:       usuario solicita retry

Regras:
  - Backup automatico ANTES de iniciar import (implementation_backups)
  - Progress tracking via BullMQ job events (pct calculado: current_page / total_pages)
  - Rollback so e possivel se can_rollback = true (false se registros ja foram conciliados)
  - Importacao do Tiny respeita rate limit de 3 req/s (ja implementado no TinyV2Client)
  - Dedup: ON CONFLICT (company_id, tiny_id) DO UPDATE para evitar duplicatas
```

## 2.6 UX/Telas

### Tela 1: Wizard de Onboarding (`/onboarding`)

```
Layout: full-screen, card centralizado 720px max-width

HEADER FIXO:
  Logo + "Configuracao Inicial" + botao [Salvar e Sair]
  
PROGRESS BAR:
  10 dots conectados por linhas
  Completed = verde + checkmark
  Current = azul pulsando
  Skipped = amarelo + skip icon
  Future = cinza tracejado
  Label abaixo de cada dot: "Empresa", "Tiny", "Bancos", etc.

AREA DE CONTEUDO (altura variavel, scroll se necessario):

Step 1 — Dados da Empresa:
  - CNPJ com mascara (XX.XXX.XXX/XXXX-XX) + validacao em tempo real (borda verde/vermelha)
  - Razao Social (auto-preenchido via API ReceitaWS apos CNPJ valido)
  - Nome Fantasia
  - Regime Tributario: select (Simples Nacional, Lucro Presumido, Lucro Real, MEI)
  - Faturamento Estimado Mensal: input monetario com mascara R$
  - Cor da empresa: 8 swatches + input hex

Step 2 — Conectar Tiny ERP:
  Toggle: Token V2 | OAuth V3
  V2: input masked + botao [Testar Conexao]
    Sucesso: card verde "Conectado! Empresa: BlueLight - 1.342 pedidos encontrados"
    Erro: card vermelho "Token invalido. Verifique em Tiny > Configuracoes > Tokens"
  V3: botao [Autorizar via Tiny] -> abre popup OAuth -> callback -> card verde

Step 3 — Conectar Bancos:
  Tabela editavel de contas:
  [+ Adicionar Conta]
  | Banco | Tipo Conta | Fonte de Dados | Status |
  | Sicoob | Corrente | OFX Upload | Conectado |
  | Olist Digital | Pagamento | API | Pendente |
  
  Ao clicar na conta, expande:
  - OFX: drag-and-drop zone + preview das 5 primeiras transacoes
  - API: campos de credencial + [Testar]
  
Step 4 — Conectar Gateways:
  Cards: Pagar.me, AppMax, Cielo, Stone (futuro)
  Cada card: status, credenciais masked, [Testar], [Pular]

Step 5 — Importar Base Existente:
  Cards de importacao:
  [Importar Fornecedores do Tiny] -> progress bar
  [Importar Clientes do Tiny] -> progress bar
  [Importar Plano de Contas] -> progress bar
  [Importar Categorias] -> progress bar
  
  Toggle de periodo: 3 meses | 6 meses | 12 meses
  [Importar Historico CP/CR] -> progress bar com timeline animada
  [Importar Extratos OFX] -> multi-file upload

Step 6 — Diagnostico Automatico:
  Animacao de "analisando" (loading com steps)
  Resultado: card grande com:
  
  ┌──────────────────────────────────────────────┐
  │  DIAGNOSTICO FINANCEIRO — BlueLight Ltda      │
  │                                                │
  │  Score Geral: [===67===] 67/100               │
  │                                                │
  │  ⚠ 23 fornecedores duplicados                 │
  │  ⚠ 15% dos lancamentos sem categoria          │
  │  ✓ 3 contas bancarias, 1 sem extrato          │
  │  ✓ Volume mensal estimado: 1.364 transacoes   │
  │                                                │
  │  Esforco estimado para limpeza: ~4 horas      │
  │  Plano recomendado: INTERMEDIARIO             │
  │                                                │
  │  [Resolver Problemas Agora] [Resolver Depois]  │
  └──────────────────────────────────────────────┘

Step 7 — Saneamento Inicial:
  Integra com Modulo 1 (SanitizationModule)
  Lista de problemas detectados no diagnostico
  Resolucao inline (sem sair do wizard)
  Score atualiza em tempo real conforme problemas sao resolvidos

Step 8 — Saldo Inicial:
  Tabela por conta bancaria:
  | Conta | Ultimo Extrato | Saldo Extrato | Saldo Informado | Divergencia | Status |
  | Sicoob | 10/04/2026 | R$ 45.230,00 | [input] | R$ 0,00 | ✓ |
  
  Divergencia > R$1: alerta amarelo "Divergencia de R$15.230. Tem certeza?"
  Divergencia > R$1000: alerta vermelho "Divergencia significativa. Revisar extrato."
  Validado: input desabilitado + checkmark verde

Step 9 — SLA e Responsaveis:
  Dia de fechamento da conciliacao: select 1-28
  Dia de fechamento contabil: select 1-28
  Analista responsavel: select de membros da org
  Supervisor: select
  Canais de notificacao: checkboxes (email, WhatsApp, in-app)
  Horas para escalacao: input numerico

Step 10 — Checklist de Go-Live:
  Lista de items com checkmarks:
  ✓ Empresa cadastrada com dados completos
  ✓ Tiny ERP conectado e sincronizando
  ✓ Pelo menos 1 conta bancaria conectada
  ✓ Saldo inicial validado
  ✗ Plano de contas configurado ← FALTA
  ...
  
  Items blocking: fundo vermelho se incompleto
  Items opcionais: fundo cinza se incompleto
  
  Barra inferior:
  "8 de 11 items completos. 2 items obrigatorios faltando."
  [Voltar] [Go Live!]  ← desabilitado se items blocking faltam
  
  Ao clicar Go Live: confetti + redirect para dashboard principal
```

### Tela 2: Mapeamento Assistido (`/onboarding/mappings`)

```
Layout: split-screen horizontal

ESQUERDA — Sistema Origem (Tiny):
  Lista de categorias/fornecedores/contas do Tiny
  Cada item: nome + badge de status (mapeado/pendente/auto)
  Filtro: tipo (categoria/fornecedor/conta), status
  Drag-and-drop habilitado

DIREITA — Sistema Destino (Plataforma):
  Arvore hierarquica do plano de contas / lista de cadastros
  Drop zones destacadas quando item esta sendo arrastado
  Botao [+ Criar Novo] para criar cadastro na plataforma durante o mapeamento

CENTRO — Mappings ativos:
  Linhas SVG conectando itens mapeados
  Click na linha: popup com opcao de remover mapping

FOOTER:
  "15 de 23 categorias mapeadas (65%)"
  [Auto-mapear Restantes] — usa fuzzy matching para sugerir
  [Confirmar Mapeamento]
```

## 2.7 Sprint Breakdown

### Sprint I1: Wizard Core + Steps 1-4 (2 semanas, 34 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-I01 | Schema de implantacao (8 tabelas + seeds) | 5 | Migration OK, RLS ativo, 11 items de checklist inseridos |
| US-I02 | Wizard framework (multi-step com persistencia) | 8 | Wizard com 10 steps, progresso salvo em step_data JSONB, retomavel apos reload |
| US-I03 | Step 1: Dados empresa com auto-preenchimento CNPJ | 5 | CNPJ validado -> API ReceitaWS preenche razao social, regime. Invalido = borda vermelha |
| US-I04 | Step 2: Conectar Tiny V2/V3 com teste de conexao | 8 | Token V2 testado em < 3s. OAuth V3 funcional. Erro mostra mensagem actionable |
| US-I05 | Steps 3-4: Conectar bancos e gateways | 8 | OFX upload funcional + preview. Credenciais Conta Simples/Pagar.me testadas |

**Demo Sprint I1**: Criar empresa BlueLight, CNPJ auto-preenche. Conectar Tiny V2 (token do .env). Upload OFX Sicoob. Wizard em step 5 com steps 1-4 verdes.

### Sprint I2: Importacao + Diagnostico + Saneamento (2 semanas, 31 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-I06 | Step 5: Importacao de historico Tiny (CP/CR/pedidos) | 8 | Importar ultimos 3 meses da BlueLight: 400+ CPs, 1000+ CRs. Progress bar funcional. Dedup por tiny_id |
| US-I07 | Step 5: Importacao de extratos OFX historicos | 5 | Multi-file upload, dedup por FITID, contadores imported/skipped |
| US-I08 | Step 6: Diagnostico automatico | 8 | Analise roda em < 15s. Score calculado. Recomendacoes geradas. "23 duplicatas, 15% sem categoria" |
| US-I09 | Step 7: Saneamento inline no wizard | 5 | Resolve duplicatas e issues de validacao sem sair do wizard. Score atualiza live |
| US-I10 | Rollback de importacao | 5 | Rollback deleta todos os registros do job. Backup restaurado. Audit log |

**Demo Sprint I2**: Importar 6 meses do Tiny. Diagnostico: score 67. Resolver 10 duplicatas inline. Score sobe para 78. Rollback importacao de OFX (demonstrar safety net).

### Sprint I3: Mapeamento + Saldo + Go-Live (2 semanas, 29 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-I11 | Mapeamento assistido drag-and-drop | 8 | Interface funcional. Auto-mapear sugere 60%+ dos mappings. Mappings salvos e usados na geracao de DRE |
| US-I12 | Step 8: Saldo inicial com validacao vs extrato | 5 | Divergencia calculada automaticamente. Alerta se > R$1. Bloqueio de go-live se nao validado |
| US-I13 | Step 9: SLA e responsaveis | 3 | Config salva. Notificacoes configuradas por canal |
| US-I14 | Step 10: Checklist go-live com auto-validacao | 8 | Items blocking auto-validados via SQL. Go-live so funciona se 100% blocking completados |
| US-I15 | Relatorio PDF de diagnostico | 5 | PDF profissional com logo, score, problemas, recomendacoes. Exportavel e enviavel por email |

**Demo Sprint I3**: Mapear 20 categorias (15 auto + 5 manual). Informar saldo de 3 contas. Checklist: 10/11 items verdes. Go-live com confetti. Dashboard funcional.

## 2.8 Regras de Negocio Invisiveis

1. **API ReceitaWS tem rate limit**: Consulta por CNPJ e limitada a 3 req/min no plano free. Sistema deve cachear resultados por 30 dias e usar queue com backoff.

2. **Token Tiny V2 nao expira mas pode ser revogado**: O teste de conexao deve ser repetido a cada 24h nas primeiras 2 semanas de implantacao para detectar revogacao precoce.

3. **OFX de bancos diferentes tem encoding diferente**: Sicoob usa Latin-1, Olist usa UTF-8. O parser deve tentar ambos e detectar automaticamente (ja implementado em `ler_todos_ofx.js`).

4. **Importacao do Tiny pega dados do passado que podem ter sido alterados**: Uma CP de janeiro pode ter sido editada em marco. O sync deve usar `lastModifiedDate` do Tiny, nao `dataEmissao`, para capturar alteracoes retroativas.

5. **Saldo inicial deve ser do PRIMEIRO dia do periodo, nao do ultimo**: Se a empresa comeca a operar em 01/04, o saldo deve ser o de 31/03 (fechamento do dia anterior). Erro comum: informar saldo do dia 01/04 ja com movimentacoes.

6. **Contas bancarias no Tiny usam NOMES, nao IDs**: O campo `conta_origem` no Tiny e texto livre ("Conta Simples - BlueLight"). O mapeamento deve ser exato por texto, case-insensitive, com fallback para fuzzy match.

7. **Go-live parcial nao existe**: Ou a empresa esta 100% configurada ou nao esta. Permitir uso parcial cria expectativas erradas e gera tickets de suporte exponenciais.

8. **Backup pre-import tem validade de 30 dias**: Apos 30 dias, backup e automaticamente deletado do Storage. Rollback apos 30 dias nao e possivel — isso deve ser comunicado claramente no UI.

9. **Wizard deve ser retomavel apos crash do browser**: Todos os dados de cada step sao salvos em `step_data` JSONB a cada interacao significativa (onChange com debounce de 2s). Reload do browser retoma do ultimo estado salvo.

10. **Primeira sincronizacao pode demorar 30+ minutos**: Para empresas com 5000+ registros no Tiny (paginacao de 100 em 100 com rate limit de 3/s). O wizard deve mostrar progress e permitir que o usuario saia e volte depois.

11. **Diagnostico detecta dados do Tiny que o Tiny nao mostra**: O Tiny nao exibe duplicatas na UI. O diagnostico da plataforma revela problemas que o empresario nem sabia que tinha — isso e um momento "wow" na venda e precisa ser explorado comercialmente.

---

# MODULO 3: FLUXO DE APROVACAO DE PAGAMENTOS

## 3.1 Justificativa de Negocio

Conciliacao olha para tras: "o que JA aconteceu?". Aprovacao olha para frente: "DEVEMOS pagar isso?". Sem controle de aprovacao, uma empresa de BPO nao pode dizer ao cliente que tem controle sobre pagamentos — e controle e o motivo principal pelo qual PMEs contratam BPO.

Os problemas reais que vejo em implantacoes:

1. **Pagamento duplicado**: O financeiro paga a mesma NF duas vezes porque nao tem sistema verificando. Recuperar R$5.000 pago em duplicidade para um fornecedor pequeno leva 60+ dias e 10+ emails.

2. **Pagamento sem autorizacao**: Analista paga R$50.000 para fornecedor sem o empresario saber. Quando o empresario ve o extrato, ja foi. Em BPO, isso e risco de processo.

3. **Caixa insuficiente sem priorizacao**: 15 pagamentos aprovados para segunda-feira, mas so tem caixa para 10. Sem priorizacao, o financeiro paga na ordem que aparece — e pode pagar marketing antes de folha.

4. **Sem comprovante vinculado**: Pagou via PIX mas ninguem vinculou o comprovante. Auditor pede, financeiro gasta 2 horas procurando. Em BPO, multiplicar por 4 empresas = 8 horas perdidas.

**ROI direto**: previne 1-2 pagamentos duplicados por mes (R$2.000-R$10.000), elimina pagamentos nao autorizados, e organiza o caixa para evitar multas por atraso de impostos.

## 3.2 Schema PostgreSQL Completo

```sql
-- ==========================================================
-- MODULO: FLUXO DE APROVACAO DE PAGAMENTOS
-- ==========================================================

-- 1. Configuracao de alcada
CREATE TABLE approval_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = todas empresas
  name            TEXT NOT NULL,
  min_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_amount      NUMERIC(14,2),  -- NULL = sem limite superior
  approver_type   TEXT NOT NULL CHECK (approver_type IN ('user', 'role', 'any_of_group')),
  approver_ids    UUID[] NOT NULL,  -- user IDs ou role-based
  approval_mode   TEXT NOT NULL DEFAULT 'any' CHECK (approval_mode IN ('any', 'all', 'sequential')),
  -- any = qualquer um aprova, all = todos devem aprovar, sequential = em ordem
  sla_hours       INTEGER NOT NULL DEFAULT 24,
  escalation_tier_id UUID REFERENCES approval_tiers(id),  -- escala para este tier se SLA estourar
  auto_approve_categories TEXT[] DEFAULT '{}',  -- categorias que nao precisam de aprovacao neste tier
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Constraint: faixas nao podem sobrepor dentro da mesma empresa
  CONSTRAINT no_overlap CHECK (min_amount < COALESCE(max_amount, 999999999))
);

-- Indice para buscar tier correto por valor
CREATE INDEX idx_approval_tiers_amount ON approval_tiers(org_id, company_id, min_amount, max_amount) WHERE is_active = TRUE;

-- 2. Solicitacoes de aprovacao
CREATE TABLE approval_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Referencia ao CP
  conta_pagar_id  UUID NOT NULL,  -- FK para tiny_contas_pagar
  conta_tiny_id   BIGINT,  -- ID no Tiny para referencia
  -- Dados do pagamento
  supplier_name   TEXT NOT NULL,
  supplier_doc    TEXT,  -- CPF/CNPJ
  amount          NUMERIC(14,2) NOT NULL,
  due_date        DATE NOT NULL,
  description     TEXT,
  category        TEXT,
  -- Tier e aprovacao
  tier_id         UUID NOT NULL REFERENCES approval_tiers(id),
  current_step    INTEGER DEFAULT 1,  -- para approval_mode = 'sequential'
  total_steps     INTEGER DEFAULT 1,
  -- Status machine
  status          TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
    'pending_approval',  -- aguardando aprovacao
    'approved',          -- aprovado, pronto para agendamento
    'rejected',          -- rejeitado
    'scheduled',         -- agendado para pagamento
    'paid',              -- pago
    'reconciled',        -- conciliado (vinculado a transacao bancaria)
    'cancelled',         -- cancelado
    'expired'            -- SLA expirou sem decisao
  )),
  -- Deteccao de duplicata
  duplicate_risk_score NUMERIC(5,2) DEFAULT 0,
  duplicate_candidates JSONB DEFAULT '[]',
  -- [{"id":"...","supplier":"...","amount":3200,"date":"...","similarity":95}]
  -- Agendamento
  scheduled_payment_date DATE,
  actual_payment_date DATE,
  payment_method  TEXT,  -- 'pix', 'ted', 'boleto', 'debito_automatico'
  -- Comprovante
  receipt_url     TEXT,  -- URL no Supabase Storage
  receipt_uploaded_at TIMESTAMPTZ,
  receipt_uploaded_by UUID REFERENCES profiles(id),
  -- Reconciliacao
  reconciliation_id UUID,  -- FK para reconciliations
  bank_transaction_id UUID,  -- FK para bank_transactions
  -- Prioridade
  priority        INTEGER DEFAULT 50,  -- 1-100, maior = mais prioritario
  priority_category TEXT CHECK (priority_category IN (
    'payroll', 'tax', 'strategic_supplier', 'operational', 'other'
  )),
  -- Metadata
  requested_by    UUID NOT NULL REFERENCES profiles(id),
  notes           TEXT,
  attachments     JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para queries comuns
CREATE INDEX idx_approval_requests_status ON approval_requests(org_id, company_id, status);
CREATE INDEX idx_approval_requests_due ON approval_requests(org_id, due_date) WHERE status IN ('pending_approval', 'approved', 'scheduled');
CREATE INDEX idx_approval_requests_supplier ON approval_requests(org_id, supplier_doc, amount);

-- 3. Decisoes de aprovacao
CREATE TABLE approval_decisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL DEFAULT 1,
  approver_id     UUID NOT NULL REFERENCES profiles(id),
  decision        TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'revision_requested')),
  notes           TEXT,
  conditions      TEXT,  -- "Aprovado desde que pague ate dia 15"
  decided_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Deteccao de pagamento duplicado
CREATE TABLE duplicate_payment_detections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id      UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL,  -- approval_request ou tiny_contas_pagar
  candidate_type  TEXT NOT NULL CHECK (candidate_type IN ('approval_request', 'conta_pagar', 'bank_transaction')),
  similarity_score NUMERIC(5,2) NOT NULL,
  match_reasons   JSONB NOT NULL DEFAULT '[]',
  -- [{"field":"supplier_doc","match":"exact"},{"field":"amount","match":"exact"},{"field":"date","match":"within_7_days"}]
  status          TEXT NOT NULL DEFAULT 'flagged' 
    CHECK (status IN ('flagged', 'confirmed_duplicate', 'dismissed')),
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Agendamento de pagamentos
CREATE TABLE payment_schedule (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scheduled_date  DATE NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  -- Totais
  total_payments  INTEGER DEFAULT 0,
  total_amount    NUMERIC(14,2) DEFAULT 0,
  available_balance NUMERIC(14,2),  -- saldo disponivel na conta
  shortfall       NUMERIC(14,2),  -- deficit se total > available
  -- Status
  status          TEXT NOT NULL DEFAULT 'planning' 
    CHECK (status IN ('planning', 'confirmed', 'executing', 'completed')),
  confirmed_by    UUID REFERENCES profiles(id),
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, company_id, scheduled_date, bank_account_id)
);

CREATE TABLE payment_schedule_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id     UUID NOT NULL REFERENCES payment_schedule(id) ON DELETE CASCADE,
  request_id      UUID NOT NULL REFERENCES approval_requests(id),
  sort_order      INTEGER NOT NULL,  -- ordem de prioridade (drag-and-drop)
  included        BOOLEAN DEFAULT TRUE,  -- false = excluido do agendamento por falta de caixa
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Feriados (para alerta de agendamento)
CREATE TABLE holidays (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE NOT NULL,
  name            TEXT NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('national', 'state', 'municipal')),
  state_code      CHAR(2),
  city_code       TEXT,
  UNIQUE(date, scope, state_code)
);

-- 7. Notificacoes de aprovacao
CREATE TABLE approval_notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES profiles(id),
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'in_app', 'push')),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'approval_needed',     -- precisa aprovar
    'reminder',            -- lembrete (SLA perto de estourar)
    'approved',            -- aprovado (notifica analista)
    'rejected',            -- rejeitado
    'escalated',           -- escalado para nivel superior
    'payment_executed',    -- pagamento executado
    'receipt_missing',     -- comprovante pendente > 24h
    'duplicate_alert',     -- pagamento duplicado detectado
    'insufficient_funds'   -- caixa insuficiente
  )),
  message         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Configuracao de priorizacao
CREATE TABLE payment_priority_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  priority_category TEXT NOT NULL,
  priority_value  INTEGER NOT NULL,  -- 1-100
  description     TEXT,
  sort_order      INTEGER NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de prioridades padrao
INSERT INTO payment_priority_rules (org_id, company_id, priority_category, priority_value, description, sort_order) VALUES
-- (sera populado per-org na criacao da empresa)
-- Ordem padrao: folha(100) > impostos(90) > fornecedor estrategico(70) > operacional(50) > outros(30)
;

-- RLS
ALTER TABLE approval_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_payment_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_priority_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON approval_tiers FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON approval_requests FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON approval_decisions 
  FOR ALL USING (
    EXISTS(SELECT 1 FROM approval_requests ar WHERE ar.id = request_id AND ar.org_id = get_org_id())
  );
CREATE POLICY "org_isolation" ON duplicate_payment_detections FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON payment_schedule FOR ALL USING (org_id = get_org_id());
CREATE POLICY "org_isolation" ON approval_notifications
  FOR SELECT USING (recipient_id = auth.uid());
-- Notificacoes: usuario so ve as proprias

-- Funcao de deteccao de duplicata
CREATE OR REPLACE FUNCTION detect_duplicate_payments(
  p_org_id UUID,
  p_supplier_doc TEXT,
  p_amount NUMERIC,
  p_due_date DATE,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE(
  candidate_id UUID,
  candidate_type TEXT,
  similarity_score NUMERIC,
  match_reasons JSONB
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id AS candidate_id,
    'approval_request'::TEXT AS candidate_type,
    (
      CASE WHEN ar.supplier_doc = p_supplier_doc THEN 40 ELSE 0 END +
      CASE WHEN ABS(ar.amount - p_amount) < 0.01 THEN 40 ELSE 
           CASE WHEN ABS(ar.amount - p_amount) / GREATEST(ar.amount, 0.01) < 0.05 THEN 20 ELSE 0 END
      END +
      CASE WHEN ABS(ar.due_date - p_due_date) <= 7 THEN 20 ELSE
           CASE WHEN ABS(ar.due_date - p_due_date) <= 30 THEN 10 ELSE 0 END
      END
    )::NUMERIC AS similarity_score,
    jsonb_build_array(
      CASE WHEN ar.supplier_doc = p_supplier_doc 
        THEN jsonb_build_object('field', 'supplier_doc', 'match', 'exact')
        ELSE NULL END,
      CASE WHEN ABS(ar.amount - p_amount) < 0.01
        THEN jsonb_build_object('field', 'amount', 'match', 'exact')
        ELSE CASE WHEN ABS(ar.amount - p_amount) / GREATEST(ar.amount, 0.01) < 0.05
          THEN jsonb_build_object('field', 'amount', 'match', 'within_5pct')
          ELSE NULL END
        END,
      CASE WHEN ABS(ar.due_date - p_due_date) <= 7
        THEN jsonb_build_object('field', 'date', 'match', 'within_7_days')
        ELSE NULL END
    ) - 'null' AS match_reasons
  FROM approval_requests ar
  WHERE ar.org_id = p_org_id
    AND ar.status NOT IN ('cancelled', 'rejected')
    AND (p_exclude_id IS NULL OR ar.id != p_exclude_id)
    AND (
      (ar.supplier_doc = p_supplier_doc AND ABS(ar.amount - p_amount) / GREATEST(ar.amount, 0.01) < 0.10)
      OR (ABS(ar.amount - p_amount) < 0.01 AND ABS(ar.due_date - p_due_date) <= 7)
    )
  ORDER BY similarity_score DESC
  LIMIT 10;
END;
$$;

-- Funcao para verificar se data e dia util
CREATE OR REPLACE FUNCTION is_business_day(p_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  -- Fim de semana
  IF EXTRACT(DOW FROM p_date) IN (0, 6) THEN RETURN FALSE; END IF;
  -- Feriado nacional
  IF EXISTS(SELECT 1 FROM holidays WHERE date = p_date AND scope = 'national') THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

-- Funcao para proximo dia util
CREATE OR REPLACE FUNCTION next_business_day(p_date DATE)
RETURNS DATE
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result DATE := p_date;
BEGIN
  WHILE NOT is_business_day(result) LOOP
    result := result + INTERVAL '1 day';
  END LOOP;
  RETURN result;
END;
$$;
```

## 3.3 Endpoints NestJS

```
Module: ApprovalModule (24 endpoints)

-- Configuracao de Alcadas --
GET    /api/approvals/tiers
  Query: company_id
  Response: lista de tiers ordenada por min_amount

POST   /api/approvals/tiers
  Body: { company_id?, name, min_amount, max_amount?, approver_ids, approval_mode, sla_hours }
  Response: tier criado
  Validacao: faixas nao podem sobrepor

PUT    /api/approvals/tiers/:tierId
  Body: campos atualizaveis
  Response: tier atualizado

DELETE /api/approvals/tiers/:tierId
  Soft delete (is_active = false). Nao deleta se tem requests pendentes.

-- Solicitacoes de Aprovacao --
POST   /api/approvals/requests
  Body: { company_id, conta_pagar_id, amount, supplier_name, supplier_doc, due_date, ... }
  Response: { request criado, tier_id determinado automaticamente, duplicate_risk }
  Logica:
    1. Determina tier pelo valor (SELECT ... WHERE min_amount <= amount AND (max_amount IS NULL OR max_amount >= amount))
    2. Roda detect_duplicate_payments()
    3. Se duplicate_risk_score >= 70: status = 'pending_approval' com flag visual
    4. Notifica aprovadores do tier

POST   /api/approvals/requests/bulk
  Body: { company_id, conta_pagar_ids: UUID[] }
  Response: { created: 15, errors: [...] }
  Cria requests em lote para multiplas CPs

GET    /api/approvals/requests
  Query: company_id, status, priority_category, due_date_from, due_date_to, min_amount, max_amount, page, limit
  Response: paginated list com dados de CP + tier + decisoes

GET    /api/approvals/requests/:requestId
  Response: request completo com decisoes, duplicatas, historico, comprovante

-- Decisoes --
POST   /api/approvals/requests/:requestId/decide
  Body: { decision: 'approved'|'rejected'|'revision_requested', notes?, conditions? }
  Response: { request atualizado, next_step? }
  Guards: usuario deve ser aprovador do tier. Verifica SLA.
  Se approved + approval_mode=any: muda status para 'approved'
  Se approved + approval_mode=all: verifica se todos os approvers decidiram
  Se approved + approval_mode=sequential: avanca para proximo step

POST   /api/approvals/requests/bulk-decide
  Body: { request_ids: UUID[], decision: 'approved', notes? }
  Response: { approved: 15, errors: [...] }
  Mostra resumo antes de confirmar: "Aprovar 15 pagamentos totalizando R$47.800?"

-- Agendamento --
POST   /api/approvals/requests/:requestId/schedule
  Body: { payment_date, payment_method, bank_account_id }
  Response: { scheduled, is_business_day, next_business_day? }
  Alerta se data cai em feriado/fds. Sugere proximo dia util.

POST   /api/approvals/requests/:requestId/reschedule
  Body: { new_date, reason }
  Response: request atualizado, audit_log

-- Pagamento e Comprovante --
POST   /api/approvals/requests/:requestId/mark-paid
  Body: { actual_date, payment_method, receipt_file? (multipart) }
  Response: { status: 'paid', receipt_url }
  Upload do comprovante para Supabase Storage

POST   /api/approvals/requests/:requestId/upload-receipt
  Body: multipart file
  Response: { receipt_url }

POST   /api/approvals/requests/:requestId/reconcile
  Body: { bank_transaction_id }
  Response: { status: 'reconciled', reconciliation_id }
  Vincula com transacao bancaria e cria reconciliacao

-- Duplicatas --
GET    /api/approvals/requests/:requestId/duplicates
  Response: lista de candidatos a duplicata com score e motivos

POST   /api/approvals/duplicates/:detectionId/review
  Body: { status: 'confirmed_duplicate'|'dismissed' }

-- Agendamento do dia (plano de pagamento) --
GET    /api/approvals/schedule
  Query: company_id, date, bank_account_id
  Response: { payments: [...], total, available_balance, shortfall }

POST   /api/approvals/schedule/prioritize
  Body: { company_id, date, bank_account_id, item_order: UUID[] }
  Response: schedule atualizado com nova ordem

POST   /api/approvals/schedule/confirm
  Body: { schedule_id }
  Response: { status: 'confirmed', included_payments, excluded_payments }

-- Notificacoes --
GET    /api/approvals/notifications
  Query: status, notification_type
  Response: notificacoes do usuario logado

-- Dashboard --
GET    /api/approvals/dashboard
  Query: company_id
  Response: {
    pending_count, pending_amount,
    approved_today, approved_amount_today,
    overdue_sla, overdue_count,
    upcoming_payments_7d, upcoming_amount_7d,
    duplicate_alerts, missing_receipts
  }

-- Priorizacao --
GET    /api/approvals/priority-rules
  Query: company_id
POST   /api/approvals/priority-rules
  Body: { company_id, rules: [...] }
```

## 3.4 State Machine: Fluxo de Aprovacao de Pagamento

```
                            ┌─────────────────┐
                            │    CRIADA (CP)   │
                            └────────┬────────┘
                                     │ POST /requests
                                     ▼
                            ┌─────────────────┐
                       ┌────│ PENDING_APPROVAL │────┐
                       │    └────────┬────────┘    │
                       │             │              │
                  rejected     approved         expired
                       │             │          (SLA cron)
                       ▼             ▼              │
                 ┌──────────┐ ┌──────────┐          │
                 │ REJECTED │ │ APPROVED │          │
                 └──────────┘ └─────┬────┘          │
                                    │               │
                               schedule             │
                                    │               │
                                    ▼               ▼
                            ┌──────────────┐  ┌──────────┐
                            │  SCHEDULED   │  │ EXPIRED  │
                            └──────┬───────┘  └──────────┘
                                   │
                              mark-paid
                                   │
                                   ▼
                            ┌──────────────┐
                            │     PAID     │
                            └──────┬───────┘
                                   │
                              reconcile
                                   │
                                   ▼
                            ┌──────────────┐
                            │  RECONCILED  │
                            └──────────────┘

                        (qualquer estado) ──cancel──> CANCELLED

Transicoes:
  CRIADA -> PENDING_APPROVAL:    automatica ao criar request (ou manual para CPs existentes)
  PENDING_APPROVAL -> APPROVED:  aprovador decide 'approved' (respeitando mode: any/all/sequential)
  PENDING_APPROVAL -> REJECTED:  aprovador decide 'rejected' (com motivo obrigatorio)
  PENDING_APPROVAL -> EXPIRED:   cron job detecta SLA expirado sem decisao
  APPROVED -> SCHEDULED:         analista agenda data de pagamento
  SCHEDULED -> PAID:             analista marca como pago + upload comprovante
  PAID -> RECONCILED:            sistema vincula com transacao bancaria
  * -> CANCELLED:                admin cancela (com motivo)

Regras de Escalacao:
  - SLA 50% expirado: enviar reminder para aprovador
  - SLA 100% expirado: escalar para tier superior (escalation_tier_id)
  - SLA 200% expirado (2x o tempo): notificar admin + marcar como expired

Regras de Aprovacao por Modo:
  - any: primeira decisao 'approved' aprova o request
  - all: todas as decisoes devem ser 'approved'; uma 'rejected' rejeita tudo
  - sequential: step 1 deve aprovar antes de step 2 receber notificacao
```

## 3.5 State Machine: Deteccao de Duplicata

```
Estados: flagged -> confirmed_duplicate | dismissed

Transicoes:
  flagged -> confirmed_duplicate:  aprovador confirma que e duplicata. Request original e cancelado.
  flagged -> dismissed:           aprovador confirma que NAO e duplicata. Prossegue normalmente.

Regras:
  - Score >= 80: flag como "Alta probabilidade de duplicata" (badge vermelho)
  - Score 50-79: flag como "Possivel duplicata" (badge amarelo)
  - Score < 50: nao flaggear (nao criar detection)
  - Se confirmado duplicata: o request e automaticamente cancelado com motivo "Pagamento duplicado confirmado"
```

## 3.6 UX/Telas

### Tela 1: Dashboard de Aprovacoes (`/approvals`)

```
Layout: grid responsivo

ROW 1: KPIs (5 cards)
  [Pendentes: 12 | R$ 87.400] badge amarelo pulsando
  [Aprovados Hoje: 8 | R$ 34.200] badge verde
  [SLA Expirado: 2] badge vermelho
  [Pagamentos Proximos 7d: 15 | R$ 112.000] badge azul
  [Comprovantes Pendentes: 3] badge laranja

ROW 2: 
  COL 1-2: Lista de aprovacoes pendentes (ordenada por SLA restante)
    Cada card:
      [URGENTE] badge se SLA < 4h
      Fornecedor: Nome Ltda (CNPJ)
      Valor: R$ 5.200,00 | Vencimento: 15/04/2026
      Categoria: Materia Prima
      SLA: 18h restantes [========    ] progress bar
      [Aprovar] verde | [Rejeitar] vermelho | [Detalhes] ghost
      
      Se duplicata detectada: 
      ⚠ "Pagamento similar: R$ 5.200 para mesmo fornecedor em 08/04"
      [Ver Duplicata] link

  COL 3: Proximos pagamentos agendados
    Timeline vertical por dia:
    SEG 14/04: 5 pagamentos | R$ 23.400
    TER 15/04: 3 pagamentos | R$ 45.000 ⚠ FERIADO
    QUA 16/04: 7 pagamentos | R$ 12.800
```

### Tela 2: Aprovacao em Lote (`/approvals/batch`)

```
Layout: DataTable com selecao

Filtros: empresa, faixa de valor, vencimento, categoria, fornecedor, status
Ordenacao: valor, vencimento, SLA restante, prioridade

Tabela:
  ☐ | Prioridade | Fornecedor | Valor | Vencimento | Categoria | SLA | Duplicata? | Acoes
  ☐ | ★★★       | Fornecedor A | R$ 3.200 | 15/04 | Materia Prima | 12h | — | [Detalhes]
  ☐ | ★★         | Fornecedor B | R$ 1.500 | 16/04 | Marketing | 36h | ⚠ 85% | [Detalhes]

Selecao:
  - Checkbox individual
  - "Selecionar todos visíveis"
  - "Selecionar todos pendentes"

FOOTER STICKY:
  "Selecionados: 15 pagamentos | Total: R$ 47.800"
  [Aprovar Selecionados] verde grande | [Rejeitar Selecionados] vermelho outlined

Ao clicar [Aprovar Selecionados]:
  Dialog de confirmacao:
  ┌─────────────────────────────────────────────────────┐
  │  Confirmar Aprovacao em Lote                         │
  │                                                      │
  │  15 pagamentos selecionados                          │
  │  Total: R$ 47.800,00                                 │
  │                                                      │
  │  ⚠ 2 pagamentos com alerta de duplicata              │
  │  ⚠ 1 pagamento com vencimento em feriado             │
  │                                                      │
  │  Notas (opcional): [__________________]               │
  │                                                      │
  │  [Cancelar]  [Confirmar Aprovacao de R$ 47.800]      │
  └─────────────────────────────────────────────────────┘
```

### Tela 3: Plano de Pagamento do Dia (`/approvals/schedule/:date`)

```
Layout: 2 colunas

ESQUERDA — Pagamentos Aprovados para este dia:
  Header: "Segunda, 14 de Abril de 2026"
  Subtotals: "15 pagamentos | R$ 112.000"
  
  Lista draggavel (react-beautiful-dnd):
  1. ★★★ Folha de Pagamento | R$ 85.000 | ✓ PAGAR
  2. ★★★ DARF — IRRF | R$ 12.000 | ✓ PAGAR
  3. ★★  Fornecedor Estrategico | R$ 8.000 | ✓ PAGAR
  4. ★   Marketing Digital | R$ 4.500 | ⚠ RISCO
  5. ★   Material Escritorio | R$ 2.500 | ✗ SEM CAIXA

  Drag-and-drop para reordenar prioridade
  Linha divisoria vermelha onde o caixa acaba:
  ─── SALDO INSUFICIENTE ABAIXO DESTA LINHA ───

DIREITA — Resumo do Caixa:
  Conta: Sicoob - Industrias Neon
  Saldo Disponivel: R$ 105.000,00
  Total Agendado:   R$ 112.000,00
  Deficit:          R$ 7.000,00 (badge vermelho)
  
  Sugestoes:
  - "Adiar Material de Escritorio (R$2.500) para 21/04"
  - "Adiar Marketing Digital (R$4.500) para 18/04"
  
  Botoes:
  [Reagendar Itens Abaixo da Linha] → move para proxima data util
  [Confirmar Plano] → marca como confirmado, notifica analistas

BOTTOM BAR:
  "4 de 5 pagamentos cabem no caixa. Deficit: R$ 7.000"
  [Salvar Rascunho] | [Confirmar e Notificar]
```

### Tela 4: Detalhe de Aprovacao (`/approvals/requests/:id`)

```
Layout: card unico 800px max-width

HEADER:
  Status badge grande (PENDING_APPROVAL / APPROVED / PAID / etc)
  Fornecedor: Nome Completo Ltda
  CNPJ: 12.345.678/0001-90
  Valor: R$ 5.200,00 (font grande, mono)
  Vencimento: 15/04/2026
  Categoria: Materia Prima

SECAO: Deteccao de Duplicata (se houver)
  ⚠ ALERTA: Pagamento similar detectado (Score: 85%)
  Card comparativo:
  | | Este Pagamento | Pagamento Anterior |
  | Fornecedor | Fornecedor X | Fornecedor X |
  | Valor | R$ 5.200,00 | R$ 5.200,00 |
  | Data | 15/04/2026 | 08/04/2026 |
  | Status | Pendente | Pago |
  [E duplicata — Cancelar] | [Nao e duplicata — Prosseguir]

SECAO: Historico de Decisoes
  Timeline vertical:
  ● 13/04 14:30 — Criado por Ana (analista)
  ● 13/04 15:00 — Notificacao enviada para Carlos (supervisor)
  ○ Aguardando decisao de Carlos (SLA: 18h restantes)

SECAO: Dados Completos da CP
  Tabela key-value com todos os campos do Tiny

SECAO: Comprovante
  Se pago: preview do comprovante (imagem/PDF)
  Se nao pago: drag-and-drop zone para upload

FOOTER:
  [Aprovar] [Rejeitar] [Solicitar Revisao] [Cancelar]
  Cada acao abre dialog com campo de notas obrigatorio (para rejeitar) ou opcional (para aprovar)
```

### Tela 5: Configuracao de Alcadas (`/settings/approval-tiers`)

```
Layout: "escada" visual

Representacao visual de degraus:

     ┌──────────────────────────────────┐
     │ > R$ 5.000                       │ CEO (Everton)
     │ SLA: 48h | Mode: any            │ 
     ├──────────────────────────────────┤
     │ R$ 1.000 — R$ 5.000             │ Supervisor (Carlos)
     │ SLA: 24h | Mode: any            │
     ├──────────────────────────────────┤
     │ Ate R$ 1.000                     │ Analista (Ana)
     │ SLA: 8h | Mode: any             │
     └──────────────────────────────────┘

Cada degrau editavel inline
[+ Adicionar Nivel] no topo
Drag-and-drop para reordenar

Dialog de edicao por degrau:
  - Nome do nivel
  - Faixa de valor (min/max)
  - Aprovadores (multi-select de membros)
  - Modo (any/all/sequential)
  - SLA em horas
  - Escalacao (select de outro tier)
  - Categorias auto-aprovadas (multi-select)
```

## 3.7 Sprint Breakdown

### Sprint A1: Configuracao + Solicitacao + Decisao (2 semanas, 34 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-A01 | Schema de aprovacao (8 tabelas + funcoes PG) | 5 | Migration OK, RLS ativo, funcao detect_duplicate_payments funcional |
| US-A02 | CRUD de tiers de aprovacao | 5 | Criar 3 tiers (ate R$1k, R$1k-R$5k, acima R$5k). Faixas nao sobrepoem. |
| US-A03 | Criacao de approval_request com tier auto | 8 | CP de R$3.200 → tier "R$1k-R$5k" automaticamente. Duplicata detectada se existe pagamento similar |
| US-A04 | Fluxo de decisao (approve/reject/revision) | 8 | Aprovador vê request, aprova com nota. Status muda. Analista notificado. Mode sequential funciona |
| US-A05 | Aprovacao em lote | 5 | Selecionar 15 requests + aprovar = 15 aprovados atomicamente. Dialog mostra resumo |
| US-A06 | UI: Dashboard + lista + detalhe | 3 | Dashboard com KPIs. Lista filtravel. Detalhe com historico de decisoes |

**Demo Sprint A1**: Criar 10 CPs, submeter para aprovacao. 3 sobem para tier CEO (>R$5k), 7 para supervisor. Supervisor aprova 5 em lote. CEO aprova 2. Rejeita 1 com motivo. Duplicata detectada em 1.

### Sprint A2: Agendamento + Priorizacao + Comprovante (2 semanas, 31 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-A07 | Agendamento de pagamento com alerta feriado | 5 | Agendar para sabado → alerta "Sabado nao e dia util. Agendar para segunda?" |
| US-A08 | Priorizacao quando falta caixa | 8 | 15 pagamentos aprovados, saldo para 10. Folha e impostos acima da linha. Marketing abaixo. Drag-and-drop funcional |
| US-A09 | Upload e vinculacao de comprovante | 5 | Upload PIX/TED → vinculado ao request. Alerta se pagamento sem comprovante > 24h |
| US-A10 | Reconciliacao de pagamento aprovado | 8 | Request pago + transacao bancaria encontrada → reconciliacao criada automaticamente |
| US-A11 | UI: Plano de pagamento do dia + escada de alcadas | 5 | Tela de priorizacao drag-and-drop. Tela de config de tiers visual |

**Demo Sprint A2**: Agendar 15 pagamentos para segunda. Caixa insuficiente para 3. Reordenar prioridade. Confirmar plano. Marcar 5 como pagos com comprovante PIX. Conciliar com extrato.

### Sprint A3: Notificacoes + SLA + Deteccao Duplicata + Polish (2 semanas, 29 SP)

| US | Titulo | SP | Acceptance Criteria |
|----|--------|-----|---------------------|
| US-A12 | Notificacoes multi-canal (email + in-app) | 8 | Aprovacao pendente → email para aprovador. Reminder apos 50% SLA. In-app com badge |
| US-A13 | Escalacao automatica por SLA | 5 | SLA de 24h estoura → request escalado para tier superior. Notificacao enviada |
| US-A14 | Deteccao de duplicata refinada | 8 | Mesmo fornecedor + valor identico + data < 7 dias = score 100%. UI mostra comparativo lado-a-lado |
| US-A15 | Cron jobs: SLA check + receipt reminder | 5 | Job a cada 1h: verifica SLAs, envia reminders, detecta comprovantes pendentes > 24h |
| US-A16 | Portal do cliente (mobile-friendly) | 3 | Pagina publica com token: empresario aprova/rejeita pelo celular sem login na plataforma |

**Demo Sprint A3**: Fluxo completo: CP criada → request gerado → email para aprovador → aprovador aprova pelo celular → analista agenda → paga → comprovante → conciliado. Duplicata detectada e cancelada. SLA estourado escalado.

## 3.8 Regras de Negocio Invisiveis

1. **Aprovacao nao existe no Tiny**: O Tiny nao tem conceito de aprovacao. Todo o fluxo e gerenciado exclusivamente na plataforma. A baixa no Tiny so acontece DEPOIS da reconciliacao (status = 'reconciled'), nunca na aprovacao.

2. **CPs ja pagas no Tiny nao passam por aprovacao**: Na importacao do Tiny, CPs com situacao "paga" sao importadas com status 'paid' direto, pulando o fluxo de aprovacao. So CPs "em aberto" ou "parcialmente pagas" entram no fluxo.

3. **Feriados variam por municipio**: Uma empresa em Caxias do Sul tem feriados diferentes de Porto Alegre. A tabela `holidays` deve ser populada com feriados nacionais + estaduais + municipais, e o alerta de feriado deve considerar o municipio da empresa (campo a adicionar em `companies`).

4. **Boleto vence em dia nao util = proximo dia util**: Boletos bancarios que vencem em sabado/domingo/feriado sao automaticamente postergados para o proximo dia util PELO BANCO. O sistema deve considerar isso no calculo de atraso.

5. **Valor de CP pode mudar apos aprovacao**: Se o fornecedor envia boleto atualizado com juros, o valor muda. O sistema deve permitir atualizar o valor de um request ja aprovado (com nova rodada de aprovacao se o novo valor subir de tier).

6. **Aprovacao parcial nao existe**: Ou aprova o valor total ou rejeita. Se o aprovador quer pagar apenas metade, deve rejeitar e solicitar que o analista crie dois requests separados.

7. **Pagamento via PIX nao tem comprovante automatico**: Diferente de TED (que aparece no extrato bancario com dados do favorecido), PIX gera comprovante que precisa ser salvo manualmente. O alerta de "comprovante pendente" e especialmente importante para PIX.

8. **Priorizacao padrao segue CLT e legislacao fiscal**: Folha de pagamento tem prioridade absoluta (CLT art. 83). Impostos vem em segundo (multa de 20% + juros SELIC). A priorizacao padrao do sistema DEVE refletir isso e NAO pode ser alterada para colocar marketing acima de folha — apenas warning, mas permitir override com motivo registrado em audit_log.

9. **Aprovador nao pode aprovar o proprio request**: Guard no endpoint: `if (request.requested_by === currentUser.id) throw ForbiddenException`. Excecao: empresario que e unico aprovador do tier mais alto (flag `allow_self_approval` no tier).

10. **Aprovacao expirada pode ser reativada**: Se o SLA expirou mas o aprovador ainda quer aprovar, deve ser possivel — mudar status de 'expired' de volta para 'pending_approval' com reset do SLA. Isso acontece frequentemente quando o empresario viaja e volta 3 dias depois.

11. **Deteccao de duplicata deve considerar CPs historicas**: Nao apenas requests no sistema de aprovacao, mas tambem CPs ja pagas no Tiny nos ultimos 90 dias. A funcao `detect_duplicate_payments` deve ser estendida para consultar `tiny_contas_pagar` alem de `approval_requests`.

12. **Reagendamento precisa de motivo**: Todo reagendamento gera audit_log com motivo. Isso protege o BPO em caso de questionamento: "Por que este fornecedor nao recebeu na data combinada?"

---

# SEQUENCIAMENTO DOS 3 MODULOS

## Dependencias entre modulos

```
MODULO 1 (Saneamento) ──precede──> MODULO 2 (Implantacao)
         O Step 7 do wizard de implantacao USA o modulo de saneamento.
         O diagnostico (Step 6) DEPENDE das funcoes de deteccao de duplicatas.

MODULO 2 (Implantacao) ──precede──> MODULO 3 (Aprovacao)
         A empresa precisa estar implantada (go-live) para o fluxo de aprovacao funcionar.
         As alcadas sao configuradas DURANTE a implantacao (Step 9: SLA e responsaveis).

MODULO 1 (Saneamento) ──paralelo──> MODULO 3 (Aprovacao)
         A deteccao de pagamento duplicado no Modulo 3 reutiliza a logica de 
         fuzzy match do Modulo 1 (funcao find_similar_names + pg_trgm).
```

## Ordem recomendada de implementacao

```
Sprint S1 (Saneamento: Duplicatas)     ← Semana 1-2
Sprint S2 (Saneamento: Validacao)      ← Semana 3-4
Sprint I1 (Implantacao: Wizard 1-4)    ← Semana 5-6 (paralelo com S3)
Sprint S3 (Saneamento: Categorias)     ← Semana 5-6 (paralelo com I1)
Sprint I2 (Implantacao: Import+Diag)   ← Semana 7-8
Sprint I3 (Implantacao: Map+GoLive)    ← Semana 9-10
Sprint A1 (Aprovacao: Core)            ← Semana 11-12
Sprint A2 (Aprovacao: Agendamento)     ← Semana 13-14
Sprint A3 (Aprovacao: Notificacoes)    ← Semana 15-16
```

Total: 9 sprints de 2 semanas = 18 semanas (4.5 meses), com paralelismo em S3/I1.

## Tabelas novas: 24

| Modulo | Tabelas | Total |
|--------|---------|-------|
| Saneamento | 14 tabelas (duplicate_*, validation_*, category_*, completeness_*, chart_*, quality_*, cost_center_*) | 14 |
| Implantacao | 8 tabelas (onboarding_*, history_import_*, company_diagnostics, import_mappings, initial_balances, golive_*, implementation_backups, company_sla) | 8 |
| Aprovacao | 8 tabelas (approval_tiers, approval_requests, approval_decisions, duplicate_payment_*, payment_schedule*, holidays, approval_notifications, payment_priority_rules) | 8 |
| **Total** | | **30 tabelas** |

Somando ao schema existente de 17 tabelas: **47 tabelas** no total da plataforma.

## Endpoints novos: 62

| Modulo | Endpoints |
|--------|-----------|
| Saneamento | 16 |
| Implantacao | 22 |
| Aprovacao | 24 |
| **Total** | **62** |

Somando aos 80 existentes: **142 endpoints** totais.

---

### Critical Files for Implementation

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md` -- PRD existente com schema de 17 tabelas, 80 endpoints e 10 sprints que servem como base para os 3 novos modulos
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` -- regras de negocio do Tiny ERP (limitacoes de API V2/V3, campos texto-livre, rate limits) que impactam diretamente o design de saneamento e aprovacao
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/identificar_duplicidades.js` -- logica existente de deteccao de duplicatas por nome+valor que deve ser substituida pelo modulo de saneamento com pg_trgm e score
- `C:/CLAUDECODE/darksales-lovable/supabase/migrations/001_full_schema.sql` -- pattern de multi-tenant (organizations, org_members, get_org_id(), RLS policies) que todos os novos modulos devem seguir
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/.env` -- credenciais de todas as integracoes (Tiny V2/V3, Conta Simples, Pagar.me) que o wizard de onboarding deve validar


---

# PARTE VI — ARQUITETURA TÉCNICA ENTERPRISE

> Módulos NestJS (24), Middleware Pipeline, Security em 6 camadas, Queue Topology, Caching Strategy, Deployment Architecture, Observability, Database Deep Dive.

---


---

# ARQUITETURA TECNICA COMPLETA -- BPO FINANCEIRO SaaS MULTI-TENANT

## Documento de Referencia de Arquitetura v1.0

Apos analise extensiva do PRD existente (`C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md` -- 650KB, 2600+ linhas), dos scripts de conciliacao atuais, dos processos financeiros documentados, e das regras de negocio do Grupo Lauxen, apresento a arquitetura tecnica completa para escalar de 17 tabelas/80 endpoints para 112+ tabelas/350+ endpoints em modo BPO multi-tenant.

---

## 1. ARQUITETURA DE MODULOS NESTJS

### 1.1 Module Graph Completo

O PRD atual define 11 modulos. A arquitetura BPO multi-tenant completa requer 24 modulos, organizados em 4 camadas:

```
                    ┌─────────────────────────────────────────────────┐
                    │            APPLICATION MODULES (14)              │
                    │                                                  │
   ┌────────────────┼──────────────────────────────────────────────┐  │
   │  DOMAIN CORE   │                                              │  │
   │                │                                              │  │
   │  ┌───────────┐ │ ┌───────────┐ ┌────────────┐ ┌────────────┐ │  │
   │  │ Reconcil- │ │ │ Transac-  │ │ AI Match-  │ │ Collection │ │  │
   │  │  iation   │◄┼─┤  tion     │ │   ing      │ │  (Cobran.) │ │  │
   │  │  Module   │ │ │  Module   │ │  Module    │ │  Module    │ │  │
   │  └─────┬─────┘ │ └────┬──────┘ └─────┬──────┘ └─────┬──────┘ │  │
   │        │       │      │              │              │         │  │
   │  ┌─────▼─────┐ │ ┌────▼──────┐ ┌─────▼──────┐ ┌────▼───────┐ │  │
   │  │ Accounting│ │ │ Document  │ │ Workflow   │ │ Notifica-  │ │  │
   │  │  Module   │ │ │  Module   │ │  Module    │ │ tion Module│ │  │
   │  └───────────┘ │ └───────────┘ └────────────┘ └────────────┘ │  │
   └────────────────┼──────────────────────────────────────────────┘  │
                    │                                                  │
   ┌────────────────┼──────────────────────────────────────────────┐  │
   │  INTEGRATION   │                                              │  │
   │                │                                              │  │
   │  ┌───────────┐ │ ┌───────────┐ ┌────────────┐ ┌────────────┐ │  │
   │  │ TinySync  │ │ │ BankSync  │ │ Gateway    │ │ Webhook    │ │  │
   │  │  Module   │ │ │  Module   │ │  Module    │ │ Receiver   │ │  │
   │  └───────────┘ │ └───────────┘ └────────────┘ └────────────┘ │  │
   └────────────────┼──────────────────────────────────────────────┘  │
                    │                                                  │
   ┌────────────────┼──────────────────────────────────────────────┐  │
   │  PLATFORM      │                                              │  │
   │                │                                              │  │
   │  ┌───────────┐ │ ┌───────────┐ ┌────────────┐ ┌────────────┐ │  │
   │  │ Auth      │ │ │ Tenancy   │ │ Report     │ │ Portal     │ │  │
   │  │ Module    │ │ │ Module    │ │ Module     │ │ Module     │ │  │
   │  └───────────┘ │ └───────────┘ └────────────┘ └────────────┘ │  │
   │  ┌───────────┐ │ ┌───────────┐                                │  │
   │  │ Audit     │ │ │ Billing   │                                │  │
   │  │ Module    │ │ │ Module    │                                │  │
   │  └───────────┘ │ └───────────┘                                │  │
   └────────────────┼──────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────────┐
                    │           SHARED/INFRASTRUCTURE (10)             │
                    │                                                  │
                    │  DatabaseModule    CacheModule     QueueModule   │
                    │  CryptoModule      StorageModule   HttpModule    │
                    │  EventModule       HealthModule    ConfigModule  │
                    │  LoggerModule                                    │
                    └─────────────────────────────────────────────────┘
```

### 1.2 Dependencias Detalhadas Entre Modulos

```
AuthModule
  imports: [DatabaseModule, CacheModule, CryptoModule, ConfigModule]
  exports: [JwtAuthGuard, CurrentUser decorator, AuthService]
  justificativa: Isolado. So depende de infra. Nunca importa modulos de dominio.

TenancyModule
  imports: [DatabaseModule, CacheModule, CryptoModule, ConfigModule]
  exports: [TenantGuard, TenantInterceptor, TenancyService, OrgService, CompanyService]
  justificativa: Segundo modulo mais fundamental. Gerencia orgs, companies, members, invites.
    Todas as operacoes multi-tenant passam por aqui. Exporta TenantGuard
    que injeta org_id no request context.

ReconciliationModule
  imports: [DatabaseModule, TransactionModule, AuditModule, EventModule,
            QueueModule, WorkflowModule, NotificationModule]
  justificativa: Core do produto. Depende de TransactionModule para queries de
    bank_transactions e contas. Depende de AuditModule para trail imutavel.
    Depende de WorkflowModule para aprovacoes. Emite eventos via EventModule
    para atualizar dashboards e notificacoes em tempo real.

TransactionModule
  imports: [DatabaseModule, CacheModule]
  exports: [TransactionService, CandidateService]
  justificativa: Modulo de dados puro. Queries unificadas de bank_transactions,
    tiny_contas_pagar, tiny_contas_receber. Exporta services para
    ReconciliationModule e AIMatchingModule consumirem.

AIMatchingModule
  imports: [DatabaseModule, TransactionModule, HttpModule, QueueModule,
            CacheModule, ConfigModule, AuditModule]
  justificativa: Depende de TransactionModule para buscar candidatos.
    Usa HttpModule para chamar Claude API. QueueModule para throttling.
    ConfigModule para daily cost caps por tenant.

CollectionModule
  imports: [DatabaseModule, TransactionModule, QueueModule,
            NotificationModule, HttpModule, ConfigModule]
  justificativa: Cobranca multi-canal. Depende de TransactionModule para
    CRs vencidas. QueueModule para filas rate-limited de WhatsApp/email/SMS.
    HttpModule para Gupshup API (WhatsApp).

AccountingModule
  imports: [DatabaseModule, TransactionModule, CacheModule]
  exports: [DREService, CashFlowService, BudgetService, ScoringService]
  justificativa: Modulo de analytics financeiro. DRE em tempo real,
    predicao de fluxo de caixa, budget tracking, scoring de clientes.
    Consome dados do TransactionModule. Exporta services para ReportModule.

DocumentModule
  imports: [DatabaseModule, StorageModule, QueueModule, HttpModule]
  justificativa: OCR de PDFs (Claude Vision), NF-e XML parsing,
    CSV mapping universal. Storage para arquivos uploadados.

WorkflowModule
  imports: [DatabaseModule, NotificationModule, ConfigModule]
  exports: [ApprovalService, AutomationService]
  justificativa: Motor de aprovacoes e automacoes. Exporta para
    ReconciliationModule e AccountingModule usarem cadeia de aprovacao.

NotificationModule
  imports: [DatabaseModule, QueueModule, HttpModule, ConfigModule]
  exports: [NotificationService]
  justificativa: Hub central de notificacoes. Push, email, WhatsApp, webhook.
    Exportado para todos os modulos que precisam notificar usuarios.

TinySyncModule
  imports: [DatabaseModule, HttpModule, QueueModule, CryptoModule,
            CacheModule, AuditModule, EventModule]
  justificativa: Clientes V2+V3 do Tiny ERP. CryptoModule para decriptar
    tokens armazenados. Rate limiting interno (3 req/s Tiny).

BankSyncModule
  imports: [DatabaseModule, StorageModule, QueueModule, AuditModule, EventModule]
  justificativa: Import OFX, CSV, parser de extratos. StorageModule para
    upload de arquivos. Dedup por FITID.

GatewayModule
  imports: [DatabaseModule, HttpModule, QueueModule, CryptoModule,
            CacheModule, AuditModule]
  justificativa: Integracao Conta Simples, Pagar.me, AppMax.
    Cada gateway e um sub-provider com rate limiting proprio.

WebhookReceiverModule
  imports: [DatabaseModule, QueueModule, EventModule, CryptoModule]
  justificativa: Endpoints para receber webhooks do Tiny, Pagar.me, etc.
    Valida HMAC signatures. Enfileira processamento assincrono.

ReportModule
  imports: [DatabaseModule, AccountingModule, CacheModule, StorageModule,
            HttpModule, QueueModule]
  justificativa: Dashboard KPIs, export XLSX/PDF, executive summary via Claude.
    Depende de AccountingModule para dados financeiros calculados.

PortalModule
  imports: [DatabaseModule, AuthModule, TenancyModule, ReportModule]
  justificativa: Portal do cliente (read-only). Auth separada (OAuth2).
    Consome ReportModule para dashboards do portal.

AuditModule
  imports: [DatabaseModule]
  exports: [AuditService, AuditInterceptor]
  justificativa: Append-only audit trail. Exporta interceptor global
    que registra automaticamente todas as mutacoes.

BillingModule
  imports: [DatabaseModule, TenancyModule, QueueModule, HttpModule]
  justificativa: Metricas de uso por tenant, integracao Stripe/Asaas,
    cobranca automatica. So relevante em modo BPO.
```

### 1.3 Shared/Infrastructure Modules

```typescript
// DatabaseModule (Global)
@Global()
@Module({
  providers: [
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (config: ConfigService) => {
        return createClient(
          config.get('SUPABASE_URL'),
          config.get('SUPABASE_SERVICE_ROLE_KEY'),
          {
            auth: { persistSession: false },
            db: { schema: 'public' },
          }
        );
      },
      inject: [ConfigService],
    },
    {
      provide: 'SUPABASE_ADMIN',
      useFactory: (config: ConfigService) => {
        return createClient(
          config.get('SUPABASE_URL'),
          config.get('SUPABASE_SERVICE_ROLE_KEY'),
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: ['SUPABASE_CLIENT', 'SUPABASE_ADMIN'],
})
export class DatabaseModule {}
```

Justificativa para Supabase client direto ao inves de Repository pattern completo: O Supabase JS client ja provê query builder com tipagem, RLS automatico (quando usando user JWT), e connection pooling via PgBouncer. Adicionar uma camada Repository sobre ele seria overhead sem beneficio. O que fazemos ao inves disso e usar **Service classes com metodos de query tipados** que encapsulam a logica de negocio, mas chamam o Supabase client diretamente. Isso mantém o codigo conciso sem perder testabilidade (mock do Supabase client).

Excecao: operacoes de transacao que precisam de SERIALIZABLE isolation (create reconciliation, reverse) usam **Postgres Functions** chamadas via `supabase.rpc()`. Isso garante atomicidade sem gerenciar transacoes no nivel da aplicacao.

```typescript
// CacheModule (Global)
@Global()
@Module({
  imports: [ConfigModule],
  providers: [{
    provide: 'REDIS_CLIENT',
    useFactory: async (config: ConfigService) => {
      const redis = new Redis({
        host: config.get('REDIS_HOST'),
        port: config.get('REDIS_PORT'),
        password: config.get('REDIS_PASSWORD'),
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 5000),
        keyPrefix: 'bpo:',
      });
      return redis;
    },
    inject: [ConfigService],
  }],
  exports: ['REDIS_CLIENT', CacheService],
})
export class CacheModule {}

// QueueModule
@Module({
  providers: [{
    provide: 'QUEUE_CONNECTION',
    useFactory: (config: ConfigService) => ({
      connection: {
        host: config.get('REDIS_HOST'),
        port: config.get('REDIS_PORT'),
        password: config.get('REDIS_PASSWORD'),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      },
    }),
    inject: [ConfigService],
  }],
})
export class QueueModule {}

// CryptoModule
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
// CryptoService: AES-256-GCM encrypt/decrypt para tokens, API keys, credenciais bancarias.
// Chave derivada de MASTER_ENCRYPTION_KEY via HKDF com salt unico por campo.

// EventModule (Global)
@Global()
@Module({
  providers: [EventEmitter2],
  exports: [EventEmitter2],
})
export class EventModule {}
// Usa @nestjs/event-emitter. Eventos entre modulos sem acoplamento direto.
// Ex: ReconciliationModule emite 'reconciliation.created', NotificationModule escuta.
```

### 1.4 Dynamic Modules (Configuraveis por Tenant)

Certos modulos precisam comportamento diferente por tenant/plano:

```typescript
// FeatureModule - Dynamic
@Module({})
export class FeatureModule {
  static forTenant(tenantConfig: TenantConfig): DynamicModule {
    return {
      module: FeatureModule,
      providers: [
        {
          provide: 'FEATURE_FLAGS',
          useValue: {
            aiMatching: tenantConfig.plan !== 'free',
            collectionWhatsApp: tenantConfig.plan === 'enterprise',
            openFinance: tenantConfig.plan === 'enterprise',
            maxCompanies: tenantConfig.plan === 'free' ? 2 :
                          tenantConfig.plan === 'pro' ? 10 : 100,
            maxUsersPerOrg: tenantConfig.plan === 'free' ? 3 :
                            tenantConfig.plan === 'pro' ? 15 : 100,
            aiDailyCostCap: tenantConfig.plan === 'pro' ? 5.00 : 50.00,
            customAutomations: tenantConfig.plan !== 'free',
            whiteLabel: tenantConfig.plan === 'enterprise',
          },
        },
        FeatureService,
      ],
      exports: ['FEATURE_FLAGS', FeatureService],
    };
  }
}
```

Justificativa: Feature flags por tenant sao carregados do Redis (TTL 24h) no TenantGuard e injetados no request context. Isso permite que o FeatureGuard verifique permissoes sem hit no banco a cada request.

### 1.5 Middleware Pipeline

```
Incoming Request
     │
     ▼
┌─────────────────┐
│  Helmet         │  Headers de seguranca (X-Frame-Options, X-Content-Type,
│  (global)       │  Strict-Transport-Security, Content-Security-Policy)
└────────┬────────┘  Configurado uma vez em main.ts. Zero overhead por request.
         │
┌────────▼────────┐
│  CORS           │  Origem: ['https://app.bpofinanceiro.com',
│  (global)       │           'https://*.vercel.app' (staging)]
└────────┬────────┘  Credentials: true. Max-age: 86400.
         │
┌────────▼────────┐
│  Rate Limiter   │  @nestjs/throttler com Redis store.
│  (global +      │  Global: 100 req/min por IP.
│   per-route)    │  Per-route overrides via @Throttle() decorator.
└────────┬────────┘  Per-tenant: 1000 req/min (tracked por org_id no Redis).
         │           Key: `ratelimit:{ip}:{endpoint}` e `ratelimit:{org_id}:{endpoint}`
         │
┌────────▼────────┐
│  Request Logger │  Middleware que loga: method, url, IP, user-agent,
│  (global)       │  correlation_id (UUID v4 gerado aqui ou extraido de
└────────┬────────┘  header X-Correlation-ID). PII masking automatico.
         │           Tempo: registra start time para calcular latencia.
         │
┌────────▼────────┐
│  Body Parser    │  JSON: limit 10mb (para uploads de OFX grandes).
│  (global)       │  URL-encoded: limit 1mb.
└────────┬────────┘  Raw: habilitado para webhooks (HMAC validation precisa
         │           do body raw).
         │
     ┌───▼───┐
     │ ROUTE │
     └───┬───┘
         │
┌────────▼────────┐
│  Guards         │  Executam na ordem:
│  (per-route)    │  1. JwtAuthGuard → 2. TenantGuard → 3. RolesGuard
└────────┬────────┘     → 4. FeatureGuard
         │
┌────────▼────────┐
│  Interceptors   │  Executam na ordem:
│  (per-route)    │  1. TimeoutInterceptor → 2. CacheInterceptor
└────────┬────────┘     → 3. AuditInterceptor → 4. TransformInterceptor
         │
┌────────▼────────┐
│  Pipes          │  ValidationPipe global (class-validator + class-transformer).
│  (global +      │  whitelist: true (strip unknown properties).
│   per-param)    │  transform: true (auto type coercion).
└────────┬────────┘  forbidNonWhitelisted: true (400 se campo desconhecido).
         │
┌────────▼────────┐
│  Controller     │  Route handler. Delega para Service.
│                 │  Decorators: @ApiOperation, @ApiResponse (Swagger).
└────────┬────────┘
         │
┌────────▼────────┐
│  Service        │  Logica de negocio. Chama Supabase client.
│                 │  Emite eventos (@EventEmitter2).
└────────┬────────┘  Transacoes via supabase.rpc() para operacoes criticas.
         │
┌────────▼────────┐
│  Response       │  TransformInterceptor envelopa:
│  Envelope       │  { data: T, meta: { timestamp, requestId, pagination? } }
└─────────────────┘  Errors: { error: { code, message, details? } }
```

#### Error Handling

Cada camada tem sua estrategia de error handling:

```typescript
// Global Exception Filter (main.ts)
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = res.message || exception.message;
      code = res.code || `HTTP_${status}`;
      details = res.details;
    } else if (exception instanceof SupabaseError) {
      // Map Supabase errors to HTTP
      status = this.mapSupabaseError(exception);
      code = exception.code;
      message = this.sanitizeMessage(exception.message);
    } else if (exception instanceof BullMQError) {
      status = 503;
      code = 'QUEUE_ERROR';
      message = 'Processing service temporarily unavailable';
    }

    // Log com contexto completo (internamente)
    this.logger.error({
      correlationId: request.correlationId,
      orgId: request.orgId,
      userId: request.userId,
      method: request.method,
      url: request.url,
      status,
      code,
      // Stack trace completo nos logs, NUNCA na response
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Response limpa para o cliente (NUNCA stack trace)
    response.status(status).json({
      error: { code, message, details },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.correlationId,
      },
    });
  }
}
```

### 1.6 Guard Architecture

```typescript
// 1. JwtAuthGuard — Validacao Supabase JWT
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject('SUPABASE_ADMIN') private supabaseAdmin: SupabaseClient,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rotas publicas (health, webhooks) marcadas com @Public()
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing authorization token');

    // Verifica JWT com Supabase (valida signature RS256, expiry, issuer)
    const { data: { user }, error } = await this.supabaseAdmin.auth.getUser(token);
    if (error || !user) throw new UnauthorizedException('Invalid or expired token');

    // Injeta user no request
    request.user = user;
    request.userId = user.id;
    return true;
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}

// 2. TenantGuard — Extrai org_id e injeta no request
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject('SUPABASE_ADMIN') private supabaseAdmin: SupabaseClient,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request.user) return false; // JwtAuthGuard deve executar antes

    // Buscar org_id: primeiro do cache, depois do banco
    const cacheKey = `user:${request.userId}:org`;
    let orgId = await this.redis.get(cacheKey);

    if (!orgId) {
      const { data: member } = await this.supabaseAdmin
        .from('org_members')
        .select('org_id, role')
        .eq('user_id', request.userId)
        .eq('is_active', true)
        .single();

      if (!member) throw new ForbiddenException('User not associated with any organization');

      orgId = member.org_id;
      request.userRole = member.role;

      // Cache por 1h
      await this.redis.setex(cacheKey, 3600, orgId);
      await this.redis.setex(`user:${request.userId}:role`, 3600, member.role);
    } else {
      request.userRole = await this.redis.get(`user:${request.userId}:role`);
    }

    request.orgId = orgId;

    // Carregar feature flags do tenant (cache 24h)
    const flagsKey = `org:${orgId}:features`;
    let features = await this.redis.get(flagsKey);
    if (!features) {
      const { data: org } = await this.supabaseAdmin
        .from('organizations')
        .select('plan, settings')
        .eq('id', orgId)
        .single();
      features = JSON.stringify(this.buildFeatureFlags(org));
      await this.redis.setex(flagsKey, 86400, features);
    }
    request.features = JSON.parse(features);

    return true;
  }
}

// 3. RolesGuard — RBAC granular
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // Sem @Roles() = acesso liberado (apos auth)

    const request = context.switchToHttp().getRequest();
    return requiredRoles.includes(request.userRole);
  }
}
// Roles: owner > admin > supervisor > analyst > client
// Hierarquia: owner pode tudo; admin pode tudo exceto billing;
// supervisor pode aprovar; analyst pode operar; client = read-only.

// 4. FeatureGuard — Feature flags por plano
@Injectable()
export class FeatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.get<string>('feature', context.getHandler());
    if (!requiredFeature) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.features?.[requiredFeature]) {
      throw new ForbiddenException(
        `Feature '${requiredFeature}' not available on your current plan`
      );
    }
    return true;
  }
}

// Uso combinado:
@Post('suggest/batch')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
@Roles('admin', 'supervisor', 'analyst')
@Feature('aiMatching')
@Throttle(2, 600) // 2 requests por 10 minutos
async batchSuggest(@Req() req, @Body() dto: BatchSuggestDto) { ... }
```

### 1.7 Interceptor Pipeline

```typescript
// 1. TimeoutInterceptor
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Default 30s, rotas de sync/export podem ter override via @Timeout(120000)
    const timeout = this.reflector.get<number>('timeout', context.getHandler()) || 30000;
    return next.handle().pipe(
      timeoutWith(timeout, throwError(() =>
        new RequestTimeoutException('Request timed out')
      ))
    );
  }
}

// 2. CacheInterceptor (Redis-backed, per-route)
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') return next.handle(); // So cache GET

    const cacheConfig = this.reflector.get<CacheConfig>('cache', context.getHandler());
    if (!cacheConfig) return next.handle();

    // Cache key inclui org_id para isolamento multi-tenant
    const key = `cache:${request.orgId}:${request.url}`;
    const cached = await this.redis.get(key);
    if (cached) return of(JSON.parse(cached));

    return next.handle().pipe(
      tap(data => {
        this.redis.setex(key, cacheConfig.ttl, JSON.stringify(data));
      })
    );
  }
}
// Invalidacao: quando qualquer mutacao ocorre em uma entity,
// pub/sub Redis notifica para limpar caches relacionados.
// Pattern: `cache:${orgId}:*reconciliation*` para limpar todos os caches
// de reconciliacao quando uma nova e criada.

// 3. AuditInterceptor (log automatico de mutacoes)
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next.handle();

    const auditConfig = this.reflector.get<AuditConfig>('audit', context.getHandler());
    if (auditConfig?.skip) return next.handle();

    return next.handle().pipe(
      tap(async (responseData) => {
        await this.auditService.log({
          action: `${request.method}:${request.route.path}`,
          entity_type: auditConfig?.entityType || this.inferEntityType(request.route.path),
          entity_id: responseData?.data?.id || request.params.id,
          actor_id: request.userId,
          actor_type: 'user',
          org_id: request.orgId,
          changes: {
            before: auditConfig?.captureBefore ? request.__auditBefore : undefined,
            after: responseData?.data,
            input: this.sanitizeInput(request.body),
          },
          metadata: {
            ip: request.ip,
            user_agent: request.headers['user-agent'],
            correlation_id: request.correlationId,
          },
        });
      })
    );
  }
}

// 4. TransformInterceptor (response envelope)
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      map(data => ({
        data: data?.data ?? data,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.correlationId,
          latencyMs: Date.now() - start,
          ...(data?.pagination && { pagination: data.pagination }),
        },
      }))
    );
  }
}
```

### 1.8 Event-Driven Architecture

```
┌──────────────────┐    emit    ┌──────────────────┐
│ ReconciliationSvc│───────────▶│ EventEmitter2     │
│                  │            │                    │
│ .create()        │            │ 'reconciliation.   │
│ .reverse()       │            │  created'          │
│ .autoReconcile() │            │ 'reconciliation.   │
└──────────────────┘            │  reversed'         │
                                └─────────┬──────────┘
                                          │ fan-out
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
             ┌──────▼──────┐     ┌────────▼────────┐   ┌───────▼───────┐
             │ Notification│     │ Cache            │   │ Accounting    │
             │ Listener    │     │ Invalidation     │   │ Listener      │
             │             │     │ Listener         │   │               │
             │ Envia push  │     │ Limpa caches     │   │ Atualiza DRE  │
             │ e realtime  │     │ de dashboard     │   │ incremental   │
             └─────────────┘     └──────────────────┘   └───────────────┘
```

Justificativa para EventEmitter2 (in-process) ao inves de message broker externo: Com um unico processo NestJS no Render ($25/mes), a complexidade de um RabbitMQ/Kafka nao se justifica. EventEmitter2 e sincrono-local, zero latencia, e suficiente para fan-out de eventos entre modulos. Para processamento assincrono pesado, usamos BullMQ (Redis-backed) que ja temos.

Se escalar para multiplas instancias no futuro, migramos os eventos criticos para Redis Pub/Sub (mesma infra).

### 1.9 CQRS para Dashboards

```
WRITE PATH (mutations):
  Controller → Service → Supabase (tables) → EventEmitter
                                                    │
                                              ┌─────▼─────┐
                                              │ Refresh    │
                                              │ Materialized│
                                              │ Views      │
                                              └────────────┘

READ PATH (dashboards, reports):
  Controller → CacheInterceptor → Service → Supabase (materialized views)
                  │                                        │
                  │ cache hit                               │ cache miss
                  ▼                                        ▼
               Redis                              PostgreSQL MV
              (TTL 5min)                       (refresh on event + cron)
```

Justificativa: Nao e CQRS completo (sem event sourcing, sem read model separado). E CQRS "lite" onde dashboards leem de materialized views (pre-computadas) em vez de queries complexas com JOINs em tempo real. Isso resolve o problema de performance para dashboards com 50+ empresas e 100k+ transacoes.

---

## 2. SEGURANCA EM CAMADAS

### Layer 1: Network

```
Internet → Cloudflare (WAF + DDoS) → Render (NestJS) → Supabase (PgBouncer)
                                         ↓
                                    Redis (Upstash/Render)
```

**Rate Limiting (3 niveis):**

| Nivel | Implementacao | Limites |
|-------|-------------|---------|
| IP | @nestjs/throttler + Redis store | 100 req/min global, 20 req/min para auth |
| Tenant | Custom TenantThrottler middleware | 1000 req/min por org_id |
| Endpoint | @Throttle() decorator | Ver tabela do PRD (POST sync: 5/min, AI: 20/min) |

```typescript
// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind precisa
      imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.enableCors({
  origin: [
    'https://app.bpofinanceiro.com',
    /https:\/\/.*\.vercel\.app$/, // Preview deploys
  ],
  credentials: true,
  maxAge: 86400,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
});
```

### Layer 2: Authentication

```
┌────────────────────────────────────────────────────────┐
│                  SUPABASE AUTH                           │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Email/Pass  │  │ Magic Link   │  │ OAuth2 (Portal)│  │
│  │ + MFA TOTP  │  │              │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                  │           │
│         ▼                ▼                  ▼           │
│    ┌───────────────────────────────────────────┐        │
│    │           JWT RS256 (access_token)         │        │
│    │  Claims: sub, email, role,                 │        │
│    │          app_metadata.org_id,              │        │
│    │          app_metadata.role                 │        │
│    │  Expiry: 1h (access), 7d (refresh)        │        │
│    └───────────────────────────────────────────┘        │
│                                                         │
│  Refresh Token Rotation: cada refresh gera novo par     │
│  Max Concurrent Sessions: 5 por user (config)           │
│  MFA: obrigatorio para roles admin/owner                │
└────────────────────────────────────────────────────────┘

API Keys (M2M - integracao com sistemas externos):
  - Gerados via /api/auth/api-keys (admin only)
  - Formato: bpo_live_xxxxxxxxxxxxxxxxx (40 chars)
  - Hash bcrypt no banco, texto plano mostrado UMA vez
  - Rate limit proprio: 500 req/min
  - Scoped: permissions granulares por key
  - Rotacao: expiry configuravel (90 dias default)
```

### Layer 3: Authorization (RBAC + RLS)

```
                    ┌──────────────┐
                    │   OWNER      │  Tudo + billing + delete org
                    └──────┬───────┘
                    ┌──────▼───────┐
                    │   ADMIN      │  Tudo exceto billing
                    └──────┬───────┘
                    ┌──────▼───────┐
                    │  SUPERVISOR  │  Aprovar + todas operacoes
                    └──────┬───────┘
                    ┌──────▼───────┐
                    │   ANALYST    │  Operar (conciliar, importar, sync)
                    └──────┬───────┘
                    ┌──────▼───────┐
                    │   CLIENT     │  Read-only (portal)
                    └──────────────┘
```

**Permissoes Granulares:**

```typescript
const PERMISSIONS = {
  // Organization
  'org.read': ['owner', 'admin', 'supervisor', 'analyst', 'client'],
  'org.update': ['owner', 'admin'],
  'org.delete': ['owner'],
  'org.billing': ['owner'],

  // Companies
  'companies.read': ['owner', 'admin', 'supervisor', 'analyst'],
  'companies.create': ['owner', 'admin'],
  'companies.update': ['owner', 'admin'],
  'companies.delete': ['owner'],
  'companies.credentials': ['owner', 'admin'], // ver/editar tokens API

  // Reconciliation
  'reconciliation.read': ['owner', 'admin', 'supervisor', 'analyst', 'client'],
  'reconciliation.create': ['owner', 'admin', 'supervisor', 'analyst'],
  'reconciliation.reverse': ['owner', 'admin', 'supervisor'],
  'reconciliation.auto': ['owner', 'admin', 'supervisor'],
  'reconciliation.approve': ['owner', 'admin', 'supervisor'],

  // Financial Operations
  'payments.read': ['owner', 'admin', 'supervisor', 'analyst', 'client'],
  'payments.create': ['owner', 'admin', 'supervisor', 'analyst'],
  'payments.approve': ['owner', 'admin', 'supervisor'],
  'payments.baixa': ['owner', 'admin', 'supervisor'],

  // AI
  'ai.suggest': ['owner', 'admin', 'supervisor', 'analyst'],
  'ai.auto_apply': ['owner', 'admin'],

  // Collections
  'collections.read': ['owner', 'admin', 'supervisor', 'analyst'],
  'collections.send': ['owner', 'admin', 'supervisor'],
  'collections.configure': ['owner', 'admin'],

  // Audit
  'audit.read': ['owner', 'admin', 'supervisor'],
  'audit.export': ['owner', 'admin'],

  // Reports
  'reports.read': ['owner', 'admin', 'supervisor', 'analyst', 'client'],
  'reports.export': ['owner', 'admin', 'supervisor'],
  'reports.generate': ['owner', 'admin', 'supervisor'],
} as const;
```

**RLS no PostgreSQL:**

```sql
-- Funcao helper global
CREATE OR REPLACE FUNCTION get_org_id()
RETURNS uuid AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb
          ->> 'app_metadata')::jsonb ->> 'org_id';
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Aplicada em TODAS as tabelas com org_id (padrao)
CREATE POLICY "tenant_isolation" ON companies
  FOR ALL
  USING (org_id = get_org_id())
  WITH CHECK (org_id = get_org_id());

-- Audit log: SOMENTE leitura para usuarios
CREATE POLICY "audit_read_only" ON audit_log
  FOR SELECT
  USING (org_id = get_org_id());
-- INSERT via service_role (backend) apenas. Sem UPDATE/DELETE.

-- Bank transactions: isolamento extra por company
CREATE POLICY "company_isolation" ON bank_transactions
  FOR ALL
  USING (
    org_id = get_org_id()
    AND company_id IN (
      SELECT id FROM companies WHERE org_id = get_org_id()
    )
  );
```

### Layer 4: Data Protection

```typescript
// CryptoService — AES-256-GCM para campos sensiveis
@Injectable()
export class CryptoService {
  private readonly masterKey: Buffer;

  constructor(private config: ConfigService) {
    this.masterKey = Buffer.from(config.get('MASTER_ENCRYPTION_KEY'), 'hex');
    // 32 bytes = 256 bits. Gerado via: openssl rand -hex 32
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12); // 96 bits para GCM
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Formato: iv:tag:ciphertext (base64 cada)
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivB64, tagB64, encB64] = ciphertext.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}

// Campos encriptados no banco:
// companies: tiny_v2_token, tiny_v3_client_secret, tiny_v3_access_token,
//            tiny_v3_refresh_token, conta_simples_api_key,
//            conta_simples_api_secret, pagarme_secret_key
// bank_connections: access_token, refresh_token
// api_keys: key_hash (bcrypt, nao AES — one-way)
```

### Layer 5: Application Security

```typescript
// Input Validation — class-validator em TODOS os DTOs
export class CreateReconciliationDto {
  @IsUUID()
  company_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  bank_transaction_ids: string[];

  @IsEnum(['pagar', 'receber'])
  conta_type: 'pagar' | 'receber';

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  conta_ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  execute_baixa?: boolean;
}

// PII Masking em logs
const PII_PATTERNS = [
  { pattern: /\d{3}\.\d{3}\.\d{3}-\d{2}/g, replacement: '***.***.***-**' }, // CPF
  { pattern: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, replacement: '**.***.***\/****-**' }, // CNPJ
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '***@***.***' },
  { pattern: /"(token|key|secret|password|senha)"\s*:\s*"[^"]+"/gi,
    replacement: '"$1": "[REDACTED]"' },
];
```

### Layer 6: Audit Trail Imutavel

```sql
-- Tabela audit_log: append-only, particionada por mes
CREATE TABLE audit_log (
  id uuid DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  action text NOT NULL,           -- 'reconciliation.create', 'company.update', etc
  entity_type text NOT NULL,      -- 'reconciliation', 'bank_transaction', etc
  entity_id uuid,
  actor_id uuid,
  actor_type text DEFAULT 'user', -- 'user', 'system', 'ai', 'cron'
  changes jsonb,                  -- { before: {...}, after: {...}, input: {...} }
  metadata jsonb,                 -- { ip, user_agent, correlation_id }
  hash text NOT NULL,             -- SHA-256 chain: hash(prev_hash + data)
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Particoes automaticas (criar via cron ou migration)
CREATE TABLE audit_log_2026_01 PARTITION OF audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... uma por mes

-- ZERO UPDATE/DELETE — enforced via RLS + triggers
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is immutable. UPDATE and DELETE are not permitted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Hash chain para integridade
CREATE OR REPLACE FUNCTION compute_audit_hash()
RETURNS trigger AS $$
DECLARE
  prev_hash text;
BEGIN
  SELECT hash INTO prev_hash FROM audit_log
    WHERE org_id = NEW.org_id
    ORDER BY created_at DESC LIMIT 1;

  NEW.hash = encode(digest(
    COALESCE(prev_hash, 'genesis') || NEW.action || NEW.entity_type ||
    COALESCE(NEW.entity_id::text, '') || COALESCE(NEW.actor_id::text, '') ||
    COALESCE(NEW.changes::text, '') || NEW.created_at::text,
    'sha256'
  ), 'hex');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_hash_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION compute_audit_hash();
```

---

## 3. QUEUE TOPOLOGY (BullMQ + Redis)

### 3.1 Topologia Completa

```
                              ┌──────────────┐
                              │    Redis      │
                              │  (Upstash/    │
                              │   Render)     │
                              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────────┐
                    │                │                    │
              ┌─────▼─────┐  ┌──────▼──────┐  ┌─────────▼──────┐
              │   SYNC     │  │ PROCESSING  │  │  COMMUNICATION │
              │   QUEUES   │  │ QUEUES      │  │  QUEUES        │
              │            │  │             │  │                │
              │ sync:tiny  │  │ proc:ofx    │  │ coll:dispatch  │
              │ sync:bank  │  │ proc:ocr    │  │ coll:whatsapp  │
              │ sync:gate  │  │ proc:recon  │  │ coll:email     │
              │            │  │ proc:ai     │  │ coll:sms       │
              │            │  │ proc:report │  │ notif:push     │
              │            │  │             │  │ notif:email    │
              │            │  │             │  │ notif:webhook  │
              └────────────┘  └─────────────┘  └────────────────┘
                    │                │                    │
                    └────────────────┼────────────────────┘
                                     │
                              ┌──────▼───────┐
                              │  DLQ (Dead   │
                              │  Letter Q)   │
                              │              │
                              │ dlq:sync     │
                              │ dlq:process  │
                              │ dlq:comms    │
                              └──────────────┘
```

### 3.2 Filas de Sync

**`sync:tiny-erp`**

```typescript
// Configuracao
const TINY_SYNC_QUEUE: QueueConfig = {
  name: 'sync:tiny-erp',
  concurrency: 2,   // 2 jobs paralelos (cada empresa independente)
  limiter: {
    max: 3,          // Tiny rate limit: 3 req/s
    duration: 1000,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },  // 1m, 5m, 15m (custom multiplier)
    timeout: 300000,  // 5min max por job
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
  repeat: { cron: '*/15 * * * *' }, // Cada 15 minutos
};

// Job data schema
interface TinySyncJobData {
  orgId: string;
  companyId: string;
  syncType: 'contas_pagar' | 'contas_receber' | 'pedidos' | 'full';
  since?: Date;      // Incremental: desde last_synced_at
  triggeredBy: 'cron' | 'manual' | 'webhook';
  priority: number;  // 1 = highest (manual trigger), 10 = lowest (cron)
}

// Producer
@Injectable()
export class TinySyncProducer {
  constructor(@InjectQueue('sync:tiny-erp') private queue: Queue) {}

  async scheduleSyncForAllCompanies(orgId: string) {
    const companies = await this.companyService.findByOrg(orgId);
    for (const company of companies) {
      await this.queue.add('sync-company', {
        orgId,
        companyId: company.id,
        syncType: 'full',
        since: company.last_synced_at,
        triggeredBy: 'cron',
        priority: 10,
      }, {
        jobId: `tiny-sync-${company.id}-${Date.now()}`,
        priority: 10,
      });
    }
  }

  async triggerManualSync(orgId: string, companyId: string, syncType: string) {
    return this.queue.add('sync-company', {
      orgId, companyId, syncType,
      triggeredBy: 'manual',
      priority: 1,
    }, {
      priority: 1,
      // Remove jobs cron pendentes para mesma empresa (evita duplicata)
      jobId: `tiny-sync-${companyId}-manual`,
    });
  }
}

// Consumer
@Processor('sync:tiny-erp')
export class TinySyncConsumer {
  @Process('sync-company')
  async handleSync(job: Job<TinySyncJobData>) {
    const { orgId, companyId, syncType, since } = job.data;

    // 1. Decriptar credenciais
    const credentials = await this.companyService.getDecryptedCredentials(companyId);

    // 2. Criar sync_job record
    const syncJob = await this.syncJobService.create({
      org_id: orgId, company_id: companyId,
      provider: 'tiny', job_type: syncType,
      status: 'running', triggered_by: job.data.triggeredBy,
    });

    try {
      let fetched = 0, created = 0, updated = 0;

      if (['contas_pagar', 'full'].includes(syncType)) {
        const result = await this.tinyV2Client.syncContasPagar(credentials, since);
        fetched += result.fetched;
        created += result.created;
        updated += result.updated;
        await job.updateProgress(33);
      }

      if (['contas_receber', 'full'].includes(syncType)) {
        const result = await this.tinyV2Client.syncContasReceber(credentials, since);
        fetched += result.fetched;
        created += result.created;
        updated += result.updated;
        await job.updateProgress(66);
      }

      if (['pedidos', 'full'].includes(syncType)) {
        const result = await this.tinyV2Client.syncPedidos(credentials, since);
        fetched += result.fetched;
        created += result.created;
        updated += result.updated;
        await job.updateProgress(100);
      }

      // 3. Atualizar sync_job
      await this.syncJobService.complete(syncJob.id, { fetched, created, updated });

      // 4. Atualizar last_synced_at da empresa
      await this.companyService.updateLastSynced(companyId);

      // 5. Emitir evento
      this.eventEmitter.emit('sync.completed', { orgId, companyId, syncType, fetched, created, updated });

    } catch (error) {
      await this.syncJobService.fail(syncJob.id, error.message);
      this.eventEmitter.emit('sync.failed', { orgId, companyId, error: error.message });
      throw error; // BullMQ fara retry automatico
    }
  }
}
```

**`sync:bank-statements`**

```typescript
const BANK_SYNC_QUEUE: QueueConfig = {
  name: 'sync:bank-statements',
  concurrency: 2,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 120000 }, // 2m, 8m, 32m
    timeout: 600000, // 10min (OFX grandes)
  },
  repeat: { cron: '0 */1 * * *' }, // Cada 1 hora
};

interface BankSyncJobData {
  orgId: string;
  companyId: string;
  bankAccountId: string;
  sourceType: 'ofx_file' | 'conta_simples_api' | 'pagarme_api' | 'open_finance';
  fileUrl?: string; // Se OFX upload
}
```

**`sync:gateways`**

```typescript
const GATEWAY_SYNC_QUEUE: QueueConfig = {
  name: 'sync:gateways',
  concurrency: 3, // Cada gateway independente
  limiter: {
    max: 10,
    duration: 60000, // 10 req/min global
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    timeout: 180000,
  },
  repeat: { cron: '*/30 * * * *' }, // Cada 30 minutos
};

interface GatewaySyncJobData {
  orgId: string;
  companyId: string;
  gateway: 'conta_simples' | 'pagarme' | 'appmax';
  since?: Date;
}
```

### 3.3 Filas de Processamento

**`process:ofx-parse`**

```typescript
const OFX_PARSE_QUEUE: QueueConfig = {
  name: 'process:ofx-parse',
  concurrency: 3,  // Parse e CPU-bound mas rapido
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    timeout: 120000,
  },
};
// Job data: { orgId, companyId, bankAccountId, fileUrl, importBatchId }
// Consumer: download file, detect encoding (Latin-1/UTF-8), parse STMTTRN,
// bulk INSERT ON CONFLICT DO NOTHING, return stats (imported/skipped/errors)
```

**`process:reconciliation`**

```typescript
const RECONCILIATION_QUEUE: QueueConfig = {
  name: 'process:reconciliation',
  concurrency: 1,  // SERIALIZABLE per company — 1 de cada vez
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    timeout: 300000,
  },
};

interface ReconciliationJobData {
  orgId: string;
  companyId: string;
  mode: 'auto_rules' | 'auto_ai' | 'pipeline'; // pipeline = rules + AI sequencial
  dateRange?: { from: Date; to: Date };
  dryRun: boolean;
}
```

**`process:ai-matching`**

```typescript
const AI_MATCHING_QUEUE: QueueConfig = {
  name: 'process:ai-matching',
  concurrency: 1,  // Throttle para controlar custo
  limiter: {
    max: 20,        // 20 chamadas Claude por minuto
    duration: 60000,
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    timeout: 60000,  // Claude timeout 60s
  },
};

interface AIMatchingJobData {
  orgId: string;
  companyId: string;
  bankTransactionId: string;
  candidates: CandidateDto[];  // Max 20
  fewShotExamples: FewShotExample[]; // Max 5
  costCheck: { dailySpent: number; dailyCap: number };
}
```

### 3.4 Filas de Cobranca

```typescript
// Dispatcher — orquestra as filas de canal
const COLLECTION_DISPATCH_QUEUE: QueueConfig = {
  name: 'collection:dispatch',
  concurrency: 5,
  defaultJobOptions: { attempts: 1, timeout: 30000 },
  repeat: { cron: '0 9 * * 1-5' }, // 9h, dias uteis
};
// Consumer: avalia regras de escalonamento, cria jobs nas filas de canal

// WhatsApp — rate limited pela API do Gupshup
const WHATSAPP_QUEUE: QueueConfig = {
  name: 'collection:whatsapp',
  concurrency: 1,
  limiter: {
    max: 80,         // 80 mensagens por minuto (Gupshup limit)
    duration: 60000,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    timeout: 30000,
    priority: 2, // WhatsApp tem prioridade sobre email
  },
};

// Email — Resend/SES
const EMAIL_QUEUE: QueueConfig = {
  name: 'collection:email',
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    timeout: 15000,
  },
};

// SMS
const SMS_QUEUE: QueueConfig = {
  name: 'collection:sms',
  concurrency: 2,
  limiter: {
    max: 30,
    duration: 60000,
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
  },
};
```

### 3.5 Filas de Notificacao

```typescript
const NOTIFICATION_QUEUES = {
  'notification:push': {
    concurrency: 10,
    limiter: { max: 100, duration: 60000 },
    attempts: 2,
  },
  'notification:email': {
    concurrency: 5,
    limiter: { max: 50, duration: 60000 },
    attempts: 3,
  },
  'notification:webhook': {
    concurrency: 5,
    defaultJobOptions: {
      attempts: 5, // Webhooks precisam de mais retries
      backoff: { type: 'exponential', delay: 30000 }, // 30s, 2m, 8m, 32m, 2h
      timeout: 30000,
    },
  },
};
```

### 3.6 Dead Letter Queue Pattern

```typescript
// Todas as filas usam o mesmo pattern de DLQ
@OnQueueFailed()
async handleFailed(job: Job, error: Error) {
  if (job.attemptsMade >= job.opts.attempts) {
    // Move para DLQ
    const dlqName = `dlq:${job.queueName.split(':')[0]}`;
    await this.dlqQueue.add('failed-job', {
      originalQueue: job.queueName,
      originalJobId: job.id,
      jobData: job.data,
      error: error.message,
      stack: error.stack,
      failedAt: new Date().toISOString(),
      attempts: job.attemptsMade,
    });

    // Notificar admin
    this.eventEmitter.emit('job.dead_letter', {
      queue: job.queueName,
      jobId: job.id,
      error: error.message,
    });
  }
}
```

---

## 4. CACHING STRATEGY

### 4.1 Redis Cache Layers

```
┌────────────────────────────────────────────────────────────────┐
│                     REDIS CACHE TOPOLOGY                        │
│                                                                 │
│  Prefixo: bpo:{orgId}:                                         │
│                                                                 │
│  LAYER 1: Hot Data (alta frequencia, baixo TTL)                │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ dashboard:{companyId}       TTL: 5min                │      │
│  │ kpis:{companyId}:{period}   TTL: 5min                │      │
│  │ unread_count:{userId}       TTL: 30s                 │      │
│  │ pending_approvals:{userId}  TTL: 1min                │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  LAYER 2: Warm Data (media frequencia, medio TTL)              │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ user:{userId}:permissions   TTL: 1h                  │      │
│  │ user:{userId}:org           TTL: 1h                  │      │
│  │ user:{userId}:role          TTL: 1h                  │      │
│  │ candidates:{txId}           TTL: 15min               │      │
│  │ ai_suggestions:{companyId}  TTL: 30min               │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  LAYER 3: Cold Data (baixa frequencia, alto TTL)               │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ org:{orgId}:features        TTL: 24h (invalidate)    │      │
│  │ org:{orgId}:config          TTL: 24h (invalidate)    │      │
│  │ company:{companyId}:info    TTL: 12h (invalidate)    │      │
│  │ categories:{companyId}      TTL: 24h (invalidate)    │      │
│  │ patterns:{companyId}        TTL: 6h                  │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  LAYER 4: Rate Limiting & Counters                              │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ ratelimit:{ip}:{endpoint}   TTL: 60s                 │      │
│  │ ratelimit:{orgId}:global    TTL: 60s                 │      │
│  │ ai_cost:{orgId}:{date}      TTL: 86400s              │      │
│  │ sync_lock:{companyId}       TTL: 300s (distributed)  │      │
│  └──────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Cache Invalidation

```typescript
// Pattern: Event-driven invalidation via pub/sub
@OnEvent('reconciliation.created')
async invalidateReconciliationCaches(payload: ReconciliationCreatedEvent) {
  const { orgId, companyId } = payload;
  const patterns = [
    `bpo:${orgId}:dashboard:${companyId}`,
    `bpo:${orgId}:kpis:${companyId}:*`,
    `bpo:${orgId}:candidates:*`,
  ];

  for (const pattern of patterns) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

@OnEvent('company.updated')
async invalidateCompanyCaches(payload: CompanyUpdatedEvent) {
  await this.redis.del(
    `bpo:${payload.orgId}:company:${payload.companyId}:info`,
    `bpo:${payload.orgId}:org:${payload.orgId}:config`,
  );
}
```

### 4.3 Materialized Views (Query Cache)

```sql
-- Dashboard summary por empresa (refresh: event + cron 15min)
CREATE MATERIALIZED VIEW mv_dashboard_summary AS
SELECT
  bt.org_id,
  bt.company_id,
  COUNT(*) FILTER (WHERE bt.reconciliation_status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE bt.reconciliation_status = 'reconciled') AS reconciled_count,
  COUNT(*) FILTER (WHERE bt.reconciliation_status = 'suggested') AS suggested_count,
  SUM(bt.amount) FILTER (WHERE bt.reconciliation_status = 'pending') AS pending_amount,
  SUM(bt.amount) FILTER (WHERE bt.reconciliation_status = 'reconciled') AS reconciled_amount,
  ROUND(
    COUNT(*) FILTER (WHERE bt.reconciliation_status = 'reconciled')::numeric /
    NULLIF(COUNT(*)::numeric, 0) * 100, 2
  ) AS reconciliation_rate,
  MAX(bt.created_at) AS last_transaction_at
FROM bank_transactions bt
WHERE bt.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY bt.org_id, bt.company_id;

CREATE UNIQUE INDEX ON mv_dashboard_summary (org_id, company_id);

-- Aging analysis (refresh: cron diario 6h)
CREATE MATERIALIZED VIEW mv_aging_analysis AS
SELECT
  org_id,
  company_id,
  'receivable' AS entity_type,
  cliente_cpf_cnpj AS entity_doc,
  cliente_nome AS entity_name,
  CASE
    WHEN data_vencimento >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 1 AND 30 THEN '1_30'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 31 AND 60 THEN '31_60'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 61 AND 90 THEN '61_90'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 91 AND 120 THEN '91_120'
    ELSE '120_plus'
  END AS bucket,
  SUM(valor - COALESCE(valor_pago, 0)) AS total_amount,
  COUNT(*) AS count
FROM tiny_contas_receber
WHERE situacao IN ('aberto', 'parcial')
GROUP BY org_id, company_id, cliente_cpf_cnpj, cliente_nome,
  CASE
    WHEN data_vencimento >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 1 AND 30 THEN '1_30'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 31 AND 60 THEN '31_60'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 61 AND 90 THEN '61_90'
    WHEN CURRENT_DATE - data_vencimento BETWEEN 91 AND 120 THEN '91_120'
    ELSE '120_plus'
  END;

-- DRE mensal (refresh: event + cron diario)
CREATE MATERIALIZED VIEW mv_dre_monthly AS
SELECT
  org_id,
  company_id,
  DATE_TRUNC('month', transaction_date) AS month,
  category,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS revenue,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expense,
  SUM(amount) AS net
FROM bank_transactions
WHERE reconciliation_status = 'reconciled'
GROUP BY org_id, company_id, DATE_TRUNC('month', transaction_date), category;

-- Refresh Strategy
-- Chamado via NestJS cron + event listeners:
SELECT pg_try_advisory_lock(hashtext('refresh_mv_dashboard'));
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_summary;
SELECT pg_advisory_unlock(hashtext('refresh_mv_dashboard'));
-- CONCURRENTLY permite queries durante refresh (requer unique index)
```

---

## 5. DEPLOYMENT ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRODUCTION TOPOLOGY                        │
│                                                                   │
│  ┌───────────────┐                                               │
│  │   Cloudflare   │  WAF, DDoS protection, SSL termination       │
│  │   (Free/Pro)   │  DNS: bpofinanceiro.com                      │
│  └───────┬───────┘                                               │
│          │                                                        │
│          ├─────────────────────────────┐                          │
│          │                             │                          │
│  ┌───────▼───────┐          ┌──────────▼──────────┐              │
│  │    Vercel      │          │      Render          │              │
│  │   (Frontend)   │          │     (Backend)        │              │
│  │                │          │                      │              │
│  │ React SPA      │  API     │ ┌──────────────────┐ │              │
│  │ Edge Functions │─────────▶│ │  Web Service     │ │              │
│  │ Preview Deploy │          │ │  NestJS app      │ │              │
│  │ per PR         │          │ │  (Starter: $7)   │ │              │
│  │                │          │ │  Auto-scale      │ │              │
│  │ Env vars per   │          │ └──────────────────┘ │              │
│  │ branch         │          │                      │              │
│  └────────────────┘          │ ┌──────────────────┐ │              │
│                              │ │  Worker Service  │ │              │
│                              │ │  BullMQ workers  │ │              │
│                              │ │  (Starter: $7)   │ │              │
│                              │ │  Separate proc.  │ │              │
│                              │ └──────────────────┘ │              │
│                              │                      │              │
│                              │ ┌──────────────────┐ │              │
│                              │ │  Redis           │ │              │
│                              │ │  (Render addon   │ │              │
│                              │ │   or Upstash)    │ │              │
│                              │ │  25MB free tier  │ │              │
│                              │ └──────────────────┘ │              │
│                              └──────────┬───────────┘              │
│                                         │                          │
│                              ┌──────────▼───────────┐              │
│                              │     Supabase          │              │
│                              │    (Database)         │              │
│                              │                       │              │
│                              │ PostgreSQL 15+        │              │
│                              │ PgBouncer (pool)      │              │
│                              │ Auth (JWT)            │              │
│                              │ Realtime (WebSocket)  │              │
│                              │ Storage (files)       │              │
│                              │ Edge Functions        │              │
│                              │                       │              │
│                              │ Extensions:           │              │
│                              │  pg_trgm (fuzzy)      │              │
│                              │  pgcrypto (hash)      │              │
│                              │  uuid-ossp            │              │
│                              │  pg_cron              │              │
│                              └───────────────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 Render Configuration

```yaml
# render.yaml (Blueprint)
services:
  # Web Service — NestJS API
  - type: web
    name: bpo-api
    runtime: node
    plan: starter  # $7/mo (512MB RAM, 0.5 CPU)
    buildCommand: npm ci && npm run build
    startCommand: node dist/main.js
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: SUPABASE_URL
        sync: false  # Per-environment
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: REDIS_URL
        fromService:
          name: bpo-redis
          type: redis
          property: connectionString
      - key: MASTER_ENCRYPTION_KEY
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false

  # Worker Service — BullMQ Workers (processo separado)
  - type: worker
    name: bpo-worker
    runtime: node
    plan: starter  # $7/mo
    buildCommand: npm ci && npm run build
    startCommand: node dist/worker.js
    autoDeploy: true
    envVars:
      # Mesmas env vars do web service

  # Redis
  - type: redis
    name: bpo-redis
    plan: starter  # $10/mo (25MB)
    ipAllowList: []  # Render internal only
```

Justificativa para separar Web + Worker: No Render, um unico processo poderia rodar ambos, mas isso cria problemas: (1) BullMQ workers CPU-intensive (parsing OFX, AI) competem com request handling; (2) deploy de API reinicia workers, perdendo jobs em progresso; (3) scaling independente impossivel. Dois servicos $7 ($14 total) vs um $25 e mais barato e mais resiliente.

O `worker.js` e um entrypoint separado que importa so os modulos de queue:

```typescript
// src/worker.ts
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // WorkerModule importa: QueueModule, DatabaseModule, todos os *Consumer
  // NAO importa controllers, guards de HTTP, etc
  await app.init();
}
```

### 5.2 Supabase Configuration

```
Database: PostgreSQL 15
Plan: Pro ($25/mo)
Region: South America (Sao Paulo)

Connection Pooling:
  Mode: Transaction (via PgBouncer)
  Pool size: 15 (Pro plan default)
  Connection string: use pooler URL para app, direct para migrations

Extensions habilitadas:
  - uuid-ossp (UUIDs)
  - pgcrypto (hashing, gen_random_uuid)
  - pg_trgm (trigram fuzzy search)
  - pg_cron (scheduled jobs internos)
  - pgjwt (JWT functions para RLS)

Read Replicas: Nao disponivel no Pro. Se necessario, upgrade para Team ($599/mo).
  Alternativa: materialized views + Redis cache resolvem 95% dos problemas de read.

PITR: Habilitado no Pro (7 dias de recovery point).

Storage Buckets:
  - ofx-imports (OFX/CSV files, max 10MB per file)
  - documents (NF-e XMLs, comprovantes, max 25MB)
  - reports (PDFs gerados, max 50MB)
  - avatars (profile photos, max 2MB)
  Todos com RLS policy vinculada ao org_id.
```

### 5.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint          # ESLint + Prettier check
      - run: npm run type-check    # tsc --noEmit
      - run: npm run test          # Jest unit tests
      - run: npm run test:e2e      # Supertest integration tests
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          # Usa Supabase local via CLI ou projeto de test

  build:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  migrate:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: supabase/setup-cli@v1
      - run: supabase db push --db-url ${{ secrets.SUPABASE_DB_URL }}
      # Migrations em supabase/migrations/ sao idempotentes

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      # Render auto-deploy via Git push (configurado no Blueprint)
      - run: echo "Render deploys automatically from staging branch"

  deploy-production:
    needs: [build, migrate]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # Render auto-deploy via Git push
      # Smoke tests apos deploy
      - run: |
          sleep 60
          curl -f https://api.bpofinanceiro.com/api/health || exit 1
          curl -f https://api.bpofinanceiro.com/api/ready || exit 1
```

---

## 6. OBSERVABILITY

### 6.1 Structured Logging

```typescript
// LoggerModule — Pino com contexto de tenant
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

PinoLoggerModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.get('LOG_LEVEL', 'info'),
      transport: config.get('NODE_ENV') === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined, // JSON em producao

      // Adiciona contexto de tenant a cada log
      customProps: (req) => ({
        correlationId: req.correlationId,
        orgId: req.orgId,
        userId: req.userId,
        tenantPlan: req.features?.plan,
      }),

      // PII masking automatico
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.token',
          'req.body.secret',
          'req.body.api_key',
          '*.cpf',
          '*.cnpj',
          '*.email',
        ],
        censor: '[REDACTED]',
      },

      // Serializers customizados
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          query: req.query,
          // Body so em debug level
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  }),
  inject: [ConfigService],
});
```

### 6.2 Metrics

```typescript
// Metricas de negocio (exportadas para Prometheus/Datadog)
@Injectable()
export class MetricsService {
  private readonly counters = {
    reconciliationsCreated: new Counter({
      name: 'bpo_reconciliations_created_total',
      help: 'Total reconciliations created',
      labelNames: ['org_id', 'company_id', 'method', 'type'],
    }),
    syncJobsCompleted: new Counter({
      name: 'bpo_sync_jobs_completed_total',
      help: 'Total sync jobs completed',
      labelNames: ['provider', 'status'],
    }),
    aiSuggestionsGenerated: new Counter({
      name: 'bpo_ai_suggestions_total',
      help: 'Total AI suggestions generated',
      labelNames: ['status'], // accepted, rejected, expired
    }),
    collectionMessagesSent: new Counter({
      name: 'bpo_collection_messages_total',
      help: 'Collection messages sent',
      labelNames: ['channel'], // whatsapp, email, sms
    }),
  };

  private readonly histograms = {
    requestDuration: new Histogram({
      name: 'bpo_http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    reconciliationDuration: new Histogram({
      name: 'bpo_reconciliation_duration_seconds',
      help: 'Time to create a reconciliation',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    }),
    aiLatency: new Histogram({
      name: 'bpo_ai_matching_duration_seconds',
      help: 'Claude API call duration',
      buckets: [1, 2, 5, 10, 30, 60],
    }),
  };

  private readonly gauges = {
    queueDepth: new Gauge({
      name: 'bpo_queue_depth',
      help: 'Current queue depth',
      labelNames: ['queue_name'],
    }),
    cacheHitRatio: new Gauge({
      name: 'bpo_cache_hit_ratio',
      help: 'Redis cache hit ratio',
      labelNames: ['cache_layer'],
    }),
    activeConnections: new Gauge({
      name: 'bpo_db_active_connections',
      help: 'Active database connections',
    }),
  };
}
```

### 6.3 Alerting Rules

```
# Critical (PagerDuty/WhatsApp imediato)
- bpo_http_error_rate > 5% for 5m
  → "Error rate acima de 5% por 5 minutos"

- bpo_db_active_connections > 13 (pool max 15)
  → "Connection pool quase esgotado"

- bpo_queue_depth{queue="sync:tiny-erp"} > 100
  → "Fila de sync acumulando: 100+ jobs"

# Warning (Slack/Email)
- bpo_sync_jobs_completed{status="failed"} > 3 em 1h
  → "3+ falhas consecutivas de sync"

- bpo_ai_matching_duration_seconds{quantile="0.99"} > 30
  → "AI matching P99 > 30s"

- bpo_cache_hit_ratio < 0.7 for 30m
  → "Cache hit ratio abaixo de 70%"

# Info (Dashboard)
- bpo_reconciliations_created_total rate per hour
- bpo_collection_messages_total rate per day
```

### 6.4 Distributed Tracing

```typescript
// OpenTelemetry setup (main.ts)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'bpo-api',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_URL, // Jaeger/Honeycomb/Datadog
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis': { enabled: true },
    }),
  ],
  sampler: new TraceIdRatioBasedSampler(
    process.env.NODE_ENV === 'production' ? 0.1 : 1.0 // 10% in prod, 100% in dev
  ),
});
sdk.start();

// Trace completo:
// HTTP Request → NestJS Guard → Service → Supabase Query → Redis Cache
// → BullMQ Job → External API (Tiny/Claude) → Response
```

---

## 7. DATABASE DEEP DIVE

### 7.1 Schema Completo — 112 Tabelas

As 17 tabelas do PRD atual sao o nucleo. Para o BPO multi-tenant completo com 35+ features, a contagem expande para 112 tabelas organizadas em 12 schemas logicos:

```
CORE (6 tabelas — existentes no PRD):
  organizations, profiles, org_members, org_invites,
  companies, bank_accounts

FINANCIAL DATA (3 — existentes):
  bank_transactions, tiny_contas_pagar, tiny_contas_receber

RECONCILIATION (5 — 3 existentes + 2 novas):
  reconciliations, reconciliation_sessions, ai_suggestions,
  + reconciliation_patterns, pattern_match_log

OPERATIONS (5 — existentes):
  import_batches, sync_jobs, category_mappings,
  notifications, audit_log

PREDICTIONS & ANALYTICS (8 — todas novas):
  prediction_models, predicted_receivables,
  cashflow_projections, cashflow_milestones,
  entity_scores, anomaly_detections,
  company_health_scores, budgets

SPLITS & GROUPS (4 — todas novas):
  split_reconciliations, split_reconciliation_items,
  installment_groups, installment_group_items

INTERCOMPANY (2 — novas):
  intercompany_transfers, group_bank_accounts

AUTOMATION & WORKFLOW (6 — novas):
  tolerance_rules, tolerance_rule_log,
  automation_rules, automation_executions,
  approval_workflows, approval_requests, approval_decisions

COLLECTIONS (3 — novas):
  collection_campaigns, collection_messages,
  collection_message_templates

DOCUMENTS (4 — novas):
  notas_fiscais, pdf_imports, csv_templates,
  document_attachments

PORTAL & BPO (5 — novas):
  bpo_tenants, client_portal_access, branding_configs,
  portal_document_requests, portal_chat_messages

BILLING & USAGE (4 — novas):
  usage_metrics, billing_events, api_keys,
  subscription_plans

COLLABORATION (4 — novas):
  transaction_comments, reconciliation_locks,
  assignment_rules, reconciliation_assignments

ALERTS & REPORTS (5 — novas):
  alert_rules, alert_history,
  sla_configs, generated_reports, executive_summaries

INTEGRATIONS (5 — novas):
  bank_connections (Open Finance),
  webhook_events, webhook_configs,
  gateway_configs, oauth_tokens

CATEGORIZATION (2 — novas):
  categorization_rules, categorization_log

MISC (2):
  feature_flags, system_configs

VIEWS MATERIALIZADAS (8):
  mv_dashboard_summary, mv_aging_analysis,
  mv_dre_monthly, mv_analyst_productivity,
  mv_reconciliation_heatmap, mv_cashflow_daily,
  mv_sla_compliance, mv_collection_effectiveness
```

**Total: ~75 tabelas + 8 materialized views + ~29 tabelas auxiliares (logs, configs, etc) = 112 tabelas.**

### 7.2 Partitioning Strategy

```sql
-- bank_transactions: RANGE por created_at (mensal)
-- Justificativa: tabela com mais INSERT (OFX imports de 1000+ linhas).
-- Queries quase sempre filtram por date range.
CREATE TABLE bank_transactions (
  id uuid DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  transaction_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  description text,
  memo text,
  external_id text, -- FITID do OFX
  reconciliation_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Criar particoes para 2 anos
DO $$
BEGIN
  FOR y IN 2025..2027 LOOP
    FOR m IN 1..12 LOOP
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS bank_transactions_%s_%s
         PARTITION OF bank_transactions
         FOR VALUES FROM (%L) TO (%L)',
        y, lpad(m::text, 2, '0'),
        format('%s-%s-01', y, lpad(m::text, 2, '0')),
        format('%s-%s-01', y, lpad((m % 12 + 1)::text, 2, '0'))
          -- Ajuste para virada de ano handled no lpad
      );
    END LOOP;
  END LOOP;
END$$;

-- audit_log: ja definido acima, RANGE por created_at (mensal)

-- collection_messages: RANGE por sent_at (mensal)
-- Justificativa: volume alto de mensagens, queries filtram por periodo
```

### 7.3 Index Strategy

```sql
-- === COMPOSITE INDEXES (queries frequentes) ===

-- Bank transactions: filtro principal da tela de conciliacao
CREATE INDEX idx_bt_company_status_date ON bank_transactions
  (company_id, reconciliation_status, transaction_date DESC);

-- Bank transactions: dedup de FITID
CREATE UNIQUE INDEX idx_bt_bankaccount_externalid ON bank_transactions
  (bank_account_id, external_id)
  WHERE external_id IS NOT NULL;

-- Contas a pagar/receber: filtro por empresa e status
CREATE INDEX idx_cp_company_situacao ON tiny_contas_pagar
  (company_id, situacao, data_vencimento DESC);

CREATE INDEX idx_cr_company_situacao ON tiny_contas_receber
  (company_id, situacao, data_vencimento DESC);

-- Reconciliations: por empresa e status
CREATE INDEX idx_recon_company_status ON reconciliations
  (company_id, status, created_at DESC);

-- === PARTIAL INDEXES (queries filtradas) ===

-- Somente transacoes pendentes (mais consultadas)
CREATE INDEX idx_bt_pending ON bank_transactions
  (company_id, transaction_date DESC)
  WHERE reconciliation_status = 'pending';

-- Somente CRs abertas (para matching)
CREATE INDEX idx_cr_open ON tiny_contas_receber
  (company_id, valor, data_vencimento)
  WHERE situacao IN ('aberto', 'parcial');

-- Somente AI suggestions pendentes
CREATE INDEX idx_ai_pending ON ai_suggestions
  (company_id, confidence_score DESC)
  WHERE status = 'pending';

-- === GIN INDEXES (JSONB e full-text) ===

-- Raw data dos extratos (busca em metadados)
CREATE INDEX idx_bt_rawdata ON bank_transactions USING gin (raw_data);

-- Marcadores do Tiny (array dentro de JSONB)
CREATE INDEX idx_cp_marcadores ON tiny_contas_pagar USING gin (marcadores);
CREATE INDEX idx_cr_marcadores ON tiny_contas_receber USING gin (marcadores);

-- === TRIGRAM INDEXES (fuzzy search) ===

-- Busca por descricao do extrato (usuario digita parte do nome)
CREATE INDEX idx_bt_description_trgm ON bank_transactions
  USING gin (description gin_trgm_ops);

-- Busca por nome de fornecedor/cliente
CREATE INDEX idx_cp_fornecedor_trgm ON tiny_contas_pagar
  USING gin (fornecedor_nome gin_trgm_ops);

CREATE INDEX idx_cr_cliente_trgm ON tiny_contas_receber
  USING gin (cliente_nome gin_trgm_ops);

-- === COVERING INDEXES (index-only scans) ===

-- Dashboard summary: evita table access
CREATE INDEX idx_bt_dashboard ON bank_transactions
  (company_id, reconciliation_status)
  INCLUDE (amount, transaction_date);
```

### 7.4 PostgreSQL Functions

```sql
-- 1. Create Reconciliation (SERIALIZABLE, atomica)
CREATE OR REPLACE FUNCTION create_reconciliation(
  p_org_id uuid,
  p_company_id uuid,
  p_bank_transaction_ids uuid[],
  p_conta_type text,
  p_conta_ids uuid[],
  p_match_method text,
  p_confidence numeric,
  p_created_by uuid,
  p_notes text DEFAULT NULL,
  p_execute_baixa boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_reconciliation_id uuid;
  v_bank_total numeric;
  v_conta_total numeric;
  v_difference numeric;
  v_recon_type text;
  v_bt_count int;
  v_conta_count int;
BEGIN
  -- Lock transacoes para evitar conciliacao duplicada
  -- FOR UPDATE garante que ninguem mais toca essas rows
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_bt_count, v_bank_total
  FROM bank_transactions
  WHERE id = ANY(p_bank_transaction_ids)
    AND org_id = p_org_id
    AND reconciliation_status = 'pending'
  FOR UPDATE;

  IF v_bt_count != array_length(p_bank_transaction_ids, 1) THEN
    RAISE EXCEPTION 'One or more bank transactions are not pending or not found';
  END IF;

  -- Lock contas
  IF p_conta_type = 'pagar' THEN
    SELECT COUNT(*), COALESCE(SUM(valor), 0)
    INTO v_conta_count, v_conta_total
    FROM tiny_contas_pagar
    WHERE id = ANY(p_conta_ids)
      AND org_id = p_org_id
      AND reconciliation_status = 'pending'
    FOR UPDATE;
  ELSE
    SELECT COUNT(*), COALESCE(SUM(valor), 0)
    INTO v_conta_count, v_conta_total
    FROM tiny_contas_receber
    WHERE id = ANY(p_conta_ids)
      AND org_id = p_org_id
      AND reconciliation_status = 'pending'
    FOR UPDATE;
  END IF;

  IF v_conta_count != array_length(p_conta_ids, 1) THEN
    RAISE EXCEPTION 'One or more contas are not pending or not found';
  END IF;

  -- Determinar tipo
  v_recon_type := CASE
    WHEN v_bt_count = 1 AND v_conta_count = 1 THEN 'one_to_one'
    WHEN v_bt_count = 1 AND v_conta_count > 1 THEN 'one_to_many'
    WHEN v_bt_count > 1 AND v_conta_count = 1 THEN 'many_to_one'
    ELSE 'many_to_many'
  END;

  v_difference := ABS(v_bank_total) - v_conta_total;

  -- Criar reconciliation
  INSERT INTO reconciliations (
    org_id, company_id, reconciliation_type,
    bank_transaction_ids, bank_total,
    conta_type, conta_ids, conta_total,
    difference, match_method, confidence_score,
    status, created_by, notes
  ) VALUES (
    p_org_id, p_company_id, v_recon_type,
    p_bank_transaction_ids, ABS(v_bank_total),
    p_conta_type, p_conta_ids, v_conta_total,
    v_difference, p_match_method, p_confidence,
    'active', p_created_by, p_notes
  ) RETURNING id INTO v_reconciliation_id;

  -- Atualizar status das bank_transactions
  UPDATE bank_transactions
  SET reconciliation_status = 'reconciled',
      reconciliation_id = v_reconciliation_id,
      updated_at = now()
  WHERE id = ANY(p_bank_transaction_ids);

  -- Atualizar status das contas
  IF p_conta_type = 'pagar' THEN
    UPDATE tiny_contas_pagar
    SET reconciliation_status = 'reconciled',
        reconciliation_id = v_reconciliation_id,
        updated_at = now()
    WHERE id = ANY(p_conta_ids);
  ELSE
    UPDATE tiny_contas_receber
    SET reconciliation_status = 'reconciled',
        reconciliation_id = v_reconciliation_id,
        updated_at = now()
    WHERE id = ANY(p_conta_ids);
  END IF;

  -- Audit log
  INSERT INTO audit_log (org_id, action, entity_type, entity_id, actor_id, actor_type, changes)
  VALUES (p_org_id, 'reconciliation.create', 'reconciliation', v_reconciliation_id,
          p_created_by, 'user',
          jsonb_build_object(
            'bank_transaction_ids', p_bank_transaction_ids,
            'conta_ids', p_conta_ids,
            'bank_total', ABS(v_bank_total),
            'conta_total', v_conta_total,
            'difference', v_difference,
            'match_method', p_match_method
          ));

  RETURN jsonb_build_object(
    'id', v_reconciliation_id,
    'type', v_recon_type,
    'bank_total', ABS(v_bank_total),
    'conta_total', v_conta_total,
    'difference', v_difference
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Payment Behavior Score
CREATE OR REPLACE FUNCTION calculate_payment_score(
  p_company_id uuid,
  p_entity_doc text,
  p_entity_type text  -- 'customer' ou 'supplier'
)
RETURNS jsonb AS $$
DECLARE
  v_total_txns int;
  v_on_time_count int;
  v_avg_delay numeric;
  v_stddev_delay numeric;
  v_total_volume numeric;
  v_recent_trend numeric;
  v_punctuality numeric;
  v_volume_score numeric;
  v_consistency numeric;
  v_trend_score numeric;
  v_final_score numeric;
BEGIN
  IF p_entity_type = 'customer' THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE data_pagamento <= data_vencimento),
      COALESCE(AVG(EXTRACT(day FROM data_pagamento - data_vencimento)), 0),
      COALESCE(STDDEV(EXTRACT(day FROM data_pagamento - data_vencimento)), 0),
      COALESCE(SUM(valor_pago), 0)
    INTO v_total_txns, v_on_time_count, v_avg_delay, v_stddev_delay, v_total_volume
    FROM tiny_contas_receber
    WHERE company_id = p_company_id
      AND cliente_cpf_cnpj = p_entity_doc
      AND situacao = 'pago'
      AND data_pagamento IS NOT NULL
      AND data_pagamento >= CURRENT_DATE - INTERVAL '12 months';
  ELSE
    -- Similar para fornecedores via tiny_contas_pagar
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE data_pagamento <= data_vencimento),
      COALESCE(AVG(EXTRACT(day FROM data_pagamento - data_vencimento)), 0),
      COALESCE(STDDEV(EXTRACT(day FROM data_pagamento - data_vencimento)), 0),
      COALESCE(SUM(valor_pago), 0)
    INTO v_total_txns, v_on_time_count, v_avg_delay, v_stddev_delay, v_total_volume
    FROM tiny_contas_pagar
    WHERE company_id = p_company_id
      AND fornecedor_cpf_cnpj = p_entity_doc
      AND situacao = 'pago'
      AND data_pagamento IS NOT NULL
      AND data_pagamento >= CURRENT_DATE - INTERVAL '12 months';
  END IF;

  IF v_total_txns = 0 THEN
    RETURN jsonb_build_object('score', 500, 'risk_level', 'unknown', 'sample_count', 0);
  END IF;

  -- Pontualidade (40%): 0-1000
  v_punctuality := (v_on_time_count::numeric / v_total_txns) * 1000;

  -- Volume (20%): normalizado, cap em 1000
  v_volume_score := LEAST(v_total_volume / 100000 * 1000, 1000);

  -- Consistencia (20%): menor stddev = melhor
  v_consistency := GREATEST(1000 - (v_stddev_delay * 50), 0);

  -- Trend (20%): comparar ultimos 3 meses vs anteriores
  -- Simplificado: baseado no delay medio recente
  v_trend_score := CASE
    WHEN v_avg_delay <= 0 THEN 1000  -- Paga adiantado
    WHEN v_avg_delay <= 3 THEN 800
    WHEN v_avg_delay <= 7 THEN 600
    WHEN v_avg_delay <= 15 THEN 400
    WHEN v_avg_delay <= 30 THEN 200
    ELSE 0
  END;

  v_final_score := ROUND(
    v_punctuality * 0.4 +
    v_volume_score * 0.2 +
    v_consistency * 0.2 +
    v_trend_score * 0.2
  );

  RETURN jsonb_build_object(
    'score', v_final_score,
    'punctuality_score', ROUND(v_punctuality),
    'volume_score', ROUND(v_volume_score),
    'consistency_score', ROUND(v_consistency),
    'trend_score', ROUND(v_trend_score),
    'risk_level', CASE
      WHEN v_final_score >= 800 THEN 'low'
      WHEN v_final_score >= 500 THEN 'medium'
      WHEN v_final_score >= 300 THEN 'high'
      ELSE 'critical'
    END,
    'avg_delay_days', ROUND(v_avg_delay, 1),
    'total_transactions', v_total_txns,
    'sample_count', v_total_txns
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Detect Duplicates (fuzzy)
CREATE OR REPLACE FUNCTION detect_duplicates(
  p_company_id uuid,
  p_table text,       -- 'contas_pagar' ou 'contas_receber'
  p_threshold numeric DEFAULT 0.8  -- similarity threshold
)
RETURNS TABLE (
  id1 uuid, id2 uuid,
  similarity numeric,
  reason text
) AS $$
BEGIN
  IF p_table = 'contas_receber' THEN
    RETURN QUERY
    SELECT
      a.id, b.id,
      similarity(a.cliente_nome, b.cliente_nome) AS sim,
      'Same amount (' || a.valor || '), similar name, dates within 3 days'
    FROM tiny_contas_receber a
    JOIN tiny_contas_receber b ON a.id < b.id  -- evita duplicatas (a,b) e (b,a)
      AND a.company_id = b.company_id
      AND a.valor = b.valor
      AND ABS(a.data_vencimento - b.data_vencimento) <= 3
      AND similarity(a.cliente_nome, b.cliente_nome) >= p_threshold
    WHERE a.company_id = p_company_id
      AND a.situacao IN ('aberto', 'parcial')
      AND b.situacao IN ('aberto', 'parcial');
  ELSE
    RETURN QUERY
    SELECT
      a.id, b.id,
      similarity(a.fornecedor_nome, b.fornecedor_nome) AS sim,
      'Same amount (' || a.valor || '), similar name, dates within 3 days'
    FROM tiny_contas_pagar a
    JOIN tiny_contas_pagar b ON a.id < b.id
      AND a.company_id = b.company_id
      AND a.valor = b.valor
      AND ABS(a.data_vencimento - b.data_vencimento) <= 3
      AND similarity(a.fornecedor_nome, b.fornecedor_nome) >= p_threshold
    WHERE a.company_id = p_company_id
      AND a.situacao IN ('aberto', 'parcial')
      AND b.situacao IN ('aberto', 'parcial');
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 7.5 Migration Strategy

```
supabase/migrations/
├── 20260101000000_core_tables.sql           -- organizations, profiles, org_members, org_invites
├── 20260101000001_companies_bankaccounts.sql -- companies, bank_accounts
├── 20260101000002_financial_data.sql         -- bank_transactions (partitioned), tiny_contas_*
├── 20260101000003_reconciliation.sql         -- reconciliations, sessions, ai_suggestions
├── 20260101000004_operations.sql             -- import_batches, sync_jobs, category_mappings, notifications
├── 20260101000005_audit_log.sql              -- audit_log (partitioned), triggers, hash chain
├── 20260101000006_rls_policies.sql           -- ALL RLS policies
├── 20260101000007_functions.sql              -- create_reconciliation, calculate_payment_score, etc
├── 20260101000008_indexes.sql                -- ALL indexes
├── 20260101000009_materialized_views.sql     -- ALL MVs
├── 20260201000000_predictions.sql            -- prediction_models, predicted_receivables, etc
├── 20260201000001_splits_groups.sql          -- split_reconciliations, installment_groups
├── 20260201000002_intercompany.sql           -- intercompany_transfers
├── 20260201000003_automation_workflow.sql    -- tolerance_rules, automation_rules, approvals
├── 20260201000004_collections.sql            -- collection_campaigns, messages
├── 20260201000005_documents.sql              -- notas_fiscais, pdf_imports, csv_templates
├── 20260301000000_bpo_multi_tenant.sql       -- bpo_tenants, portal, branding
├── 20260301000001_billing.sql                -- usage_metrics, billing_events
├── 20260301000002_collaboration.sql          -- comments, locks, assignments
├── 20260301000003_alerts_reports.sql         -- alert_rules, sla_configs, generated_reports
├── 20260301000004_integrations.sql           -- bank_connections, webhook_events, oauth_tokens
└── 20260301000005_categorization.sql         -- categorization_rules, logs
```

Regras de migration:
1. Toda migration e idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
2. Toda migration tem rollback script correspondente em `supabase/migrations/rollback/`
3. Data migrations (seed data, backfills) ficam em `supabase/seed/` -- separadas de schema
4. Executadas via `supabase db push` no CI/CD pipeline
5. Nunca alterar uma migration ja aplicada em producao -- criar nova migration para ALTER

---

## 8. ENDPOINTS REST COMPLETOS (350+)

Expandindo os 80 endpoints do PRD para 350+ endpoints no sistema completo:

```
AUTH (8 endpoints):
  GET    /api/health
  GET    /api/ready
  GET    /api/auth/me
  POST   /api/auth/api-keys
  GET    /api/auth/api-keys
  DELETE /api/auth/api-keys/:id
  POST   /api/auth/mfa/enable
  POST   /api/auth/mfa/verify

ORGANIZATION (20 endpoints):
  POST   /api/organizations
  GET    /api/organizations/:id
  PATCH  /api/organizations/:id
  DELETE /api/organizations/:id
  GET    /api/organizations/:id/companies
  POST   /api/organizations/:id/companies
  GET    /api/companies/:id
  PATCH  /api/companies/:id
  DELETE /api/companies/:id
  GET    /api/companies/:id/credentials
  PUT    /api/companies/:id/credentials
  POST   /api/companies/:id/test-connection
  GET    /api/organizations/:id/members
  POST   /api/organizations/:id/members/invite
  PATCH  /api/members/:id
  DELETE /api/members/:id
  GET    /api/invites
  POST   /api/invites/:token/accept
  POST   /api/invites/:token/reject
  DELETE /api/invites/:id

TINY SYNC (15 endpoints):
  POST   /api/sync/tiny/:companyId/contas-pagar
  POST   /api/sync/tiny/:companyId/contas-receber
  POST   /api/sync/tiny/:companyId/pedidos
  POST   /api/sync/tiny/:companyId/full
  GET    /api/sync/tiny/:companyId/status
  POST   /api/sync/tiny/:companyId/oauth/callback
  POST   /api/sync/tiny/:companyId/baixa/contas-pagar
  POST   /api/sync/tiny/:companyId/baixa/contas-receber
  POST   /api/sync/tiny/:companyId/baixa/batch
  GET    /api/sync/tiny/:companyId/history
  POST   /api/sync/tiny/:companyId/marcadores
  GET    /api/contas-pagar
  GET    /api/contas-pagar/:id
  GET    /api/contas-receber
  GET    /api/contas-receber/:id

BANK SYNC (18 endpoints):
  POST   /api/import/ofx
  POST   /api/import/csv
  POST   /api/import/pdf
  GET    /api/import/batches
  GET    /api/import/batches/:id
  DELETE /api/import/batches/:id/rollback
  POST   /api/sync/bank/:companyId/conta-simples
  POST   /api/sync/bank/:companyId/pagarme
  POST   /api/sync/bank/:companyId/appmax
  GET    /api/bank-accounts
  POST   /api/bank-accounts
  PATCH  /api/bank-accounts/:id
  DELETE /api/bank-accounts/:id
  GET    /api/transactions
  GET    /api/transactions/:id
  PATCH  /api/transactions/:id
  POST   /api/transactions/bulk-action
  GET    /api/transactions/unmatched-summary

RECONCILIATION (18 endpoints):
  POST   /api/reconciliations
  POST   /api/reconciliations/batch
  GET    /api/reconciliations
  GET    /api/reconciliations/:id
  POST   /api/reconciliations/:id/reverse
  POST   /api/reconciliations/auto/preview
  POST   /api/reconciliations/auto/execute
  POST   /api/reconciliations/pipeline
  GET    /api/reconciliations/sessions
  POST   /api/reconciliations/sessions
  GET    /api/reconciliations/sessions/:id
  PATCH  /api/reconciliations/sessions/:id
  GET    /api/candidates
  GET    /api/candidates/:transactionId
  POST   /api/splits/detect
  POST   /api/splits/confirm
  GET    /api/cross-reference/pedidos
  GET    /api/cross-reference/nfe

AI MATCHING (12 endpoints):
  POST   /api/ai/suggest
  POST   /api/ai/suggest/batch
  GET    /api/ai/suggestions
  GET    /api/ai/suggestions/:id
  POST   /api/ai/suggestions/:id/accept
  POST   /api/ai/suggestions/:id/reject
  POST   /api/ai/suggestions/bulk-accept
  GET    /api/ai/stats
  GET    /api/ai/cost
  GET    /api/ai/patterns
  POST   /api/ai/patterns/:id/toggle
  GET    /api/ai/few-shot/:companyId

ACCOUNTING (30 endpoints):
  GET    /api/dre
  GET    /api/dre/impact-preview
  GET    /api/cashflow/projection
  POST   /api/cashflow/simulate
  GET    /api/cashflow/milestones
  POST   /api/cashflow/milestones
  GET    /api/budgets
  PUT    /api/budgets/:id
  POST   /api/budgets/copy-previous
  GET    /api/budgets/variance-report
  GET    /api/scores
  GET    /api/scores/:doc
  GET    /api/scores/:doc/history
  POST   /api/scores/recalculate
  GET    /api/anomalies
  GET    /api/anomalies/:id
  PATCH  /api/anomalies/:id
  GET    /api/health-scores
  GET    /api/health-scores/:companyId
  GET    /api/aging
  GET    /api/aging/drill-down
  GET    /api/heatmap
  GET    /api/heatmap/drill-down
  GET    /api/intercompany
  POST   /api/intercompany/detect-all
  PATCH  /api/intercompany/:id/confirm
  GET    /api/intercompany/sankey-data
  GET    /api/installments
  POST   /api/installments/detect-groups
  POST   /api/installments/:id/send-reminder

COLLECTIONS (20 endpoints):
  GET    /api/collections/campaigns
  POST   /api/collections/campaigns
  PATCH  /api/collections/campaigns/:id
  DELETE /api/collections/campaigns/:id
  GET    /api/collections/templates
  POST   /api/collections/templates
  PATCH  /api/collections/templates/:id
  DELETE /api/collections/templates/:id
  GET    /api/collections/messages
  GET    /api/collections/messages/:id
  POST   /api/collections/run-daily
  GET    /api/collections/dashboard
  GET    /api/collections/stats
  POST   /api/collections/preview
  POST   /api/collections/send-manual
  GET    /api/collections/opt-outs
  POST   /api/collections/opt-outs
  DELETE /api/collections/opt-outs/:id
  POST   /api/collections/webhooks/gupshup
  POST   /api/collections/webhooks/email

WORKFLOW & AUTOMATION (25 endpoints):
  GET    /api/automations
  POST   /api/automations
  PATCH  /api/automations/:id
  DELETE /api/automations/:id
  POST   /api/automations/:id/dry-run
  GET    /api/automations/:id/history
  POST   /api/automations/:id/toggle
  GET    /api/tolerance-rules
  POST   /api/tolerance-rules
  PATCH  /api/tolerance-rules/:id
  DELETE /api/tolerance-rules/:id
  POST   /api/tolerance-rules/:id/preview
  GET    /api/approval-workflows
  POST   /api/approval-workflows
  PATCH  /api/approval-workflows/:id
  GET    /api/approvals/pending
  GET    /api/approvals/:id
  POST   /api/approvals/:id/decide
  GET    /api/approvals/history
  GET    /api/categorization/rules
  POST   /api/categorization/suggest
  POST   /api/categorization/learn
  POST   /api/categorization/bulk-apply
  GET    /api/scheduled-reconciliations
  POST   /api/scheduled-reconciliations

DOCUMENTS (15 endpoints):
  POST   /api/nfe/import
  GET    /api/nfe
  GET    /api/nfe/:id
  GET    /api/nfe/unmatched
  POST   /api/nfe/:id/create-conta
  POST   /api/csv/analyze
  POST   /api/csv/import
  GET    /api/csv/templates
  POST   /api/csv/templates
  PATCH  /api/csv/templates/:id
  DELETE /api/csv/templates/:id
  POST   /api/pdf/extract
  GET    /api/pdf/imports
  GET    /api/pdf/imports/:id
  POST   /api/pdf/imports/:id/confirm

NOTIFICATIONS (10 endpoints):
  GET    /api/notifications
  PATCH  /api/notifications/:id/read
  POST   /api/notifications/mark-all-read
  GET    /api/notifications/unread-count
  GET    /api/notifications/preferences
  PATCH  /api/notifications/preferences
  GET    /api/alerts
  POST   /api/alerts
  PATCH  /api/alerts/:id
  DELETE /api/alerts/:id

REPORTS (15 endpoints):
  GET    /api/reports/dashboard-kpis
  GET    /api/reports/progress
  GET    /api/reports/company-comparison
  POST   /api/reports/export/reconciliations
  POST   /api/reports/export/unmatched
  POST   /api/reports/export/audit
  POST   /api/reports/generate-pdf
  GET    /api/reports/generated
  GET    /api/reports/generated/:id
  DELETE /api/reports/generated/:id
  POST   /api/reports/executive-summary
  GET    /api/reports/sla
  GET    /api/reports/analyst-productivity
  GET    /api/reports/collection-effectiveness
  GET    /api/predictions/receivables

AUDIT (5 endpoints):
  GET    /api/audit
  GET    /api/audit/:entityType/:entityId
  POST   /api/audit/export
  GET    /api/audit/verify-integrity
  GET    /api/audit/stats

PORTAL (20 endpoints):
  GET    /api/portal/dashboard
  GET    /api/portal/reports
  GET    /api/portal/reports/:id/download
  GET    /api/portal/pending-documents
  POST   /api/portal/documents/upload
  GET    /api/portal/chat
  POST   /api/portal/chat
  GET    /api/portal/status
  GET    /api/portal/branding
  POST   /api/portal/users
  (+ endpoints de admin para gerenciar portal)

BILLING (15 endpoints):
  GET    /api/billing/usage
  GET    /api/billing/usage/:tenantId
  GET    /api/billing/invoices
  GET    /api/billing/invoices/:id
  POST   /api/billing/subscribe
  PATCH  /api/billing/subscription
  DELETE /api/billing/subscription
  GET    /api/billing/plans
  POST   /api/billing/checkout-session
  POST   /api/billing/webhooks/stripe
  GET    /api/billing/metrics
  (+ endpoints internos)

WEBHOOKS RECEIVER (8 endpoints):
  POST   /api/webhooks/tiny
  POST   /api/webhooks/pagarme
  POST   /api/webhooks/appmax
  POST   /api/webhooks/conta-simples
  POST   /api/webhooks/generic
  GET    /api/webhooks/events
  GET    /api/webhooks/events/:id
  POST   /api/webhooks/events/:id/retry

JOBS/ADMIN (12 endpoints):
  GET    /api/admin/jobs
  GET    /api/admin/jobs/:id
  POST   /api/admin/jobs/:id/retry
  DELETE /api/admin/jobs/:id
  GET    /api/admin/queues
  GET    /api/admin/queues/:name/stats
  POST   /api/admin/queues/:name/pause
  POST   /api/admin/queues/:name/resume
  POST   /api/admin/queues/:name/clean
  GET    /api/admin/system/health
  GET    /api/admin/system/metrics
  POST   /api/admin/cache/invalidate

COLLABORATION (12 endpoints):
  GET    /api/comments/:entityType/:entityId
  POST   /api/comments
  PATCH  /api/comments/:id
  DELETE /api/comments/:id
  GET    /api/assignments
  POST   /api/assignments/rules
  PATCH  /api/assignments/rules/:id
  POST   /api/assignments/distribute
  GET    /api/presence/:sessionId
  POST   /api/locks/:entityType/:entityId
  DELETE /api/locks/:entityType/:entityId
  GET    /api/locks/my-locks

TOTAL: ~350 endpoints
```

---

## JUSTIFICATIVAS ARQUITETURAIS CONSOLIDADAS

### Por que Supabase client direto em vez de Prisma/TypeORM?

O Supabase JS client provê: (1) query builder tipado; (2) RLS automatico via JWT; (3) connection pooling gerenciado; (4) real-time subscriptions no mesmo client; (5) storage API integrada. Adicionar um ORM adicionaria 200+ linhas de schema definition, complexidade de migrations dual (ORM + Supabase), e conflito com RLS. O trade-off e perder migrations type-safe do Prisma, mas ganhamos simplicidade operacional. Para um time de 1-3 devs, a escolha certa e minimizar camadas.

### Por que EventEmitter2 em vez de RabbitMQ?

Com 1 instancia NestJS no Render ($7/mo), um message broker externo e overhead. EventEmitter2 e sincrono in-process, zero latencia de rede, zero custo operacional. Para trabalho assincrono pesado, BullMQ (Redis) ja resolve. Se escalar para 3+ instancias, migramos eventos criticos para Redis Pub/Sub (mesma infra).

### Por que BullMQ em vez de SQS/Cloud Tasks?

BullMQ usa o Redis que ja temos, suporta rate limiting, prioridades, cron, dead letter queues, e UI de monitoramento (Bull Board). SQS adicionaria vendor lock-in e complexidade de IAM. Cloud Tasks nao tem rate limiting nativo.

### Por que Redis Upstash em vez de Redis Render?

Ambos funcionam. Upstash tem melhor DX (REST API, dashboard, per-request pricing). Render Redis e mais simples (mesma rede, lower latency). Recomendo Render Redis para custo previsivel, Upstash se precisar serverless ou global.

### Por que Materialized Views em vez de tabela de aggregates?

MVs sao gerenciadas pelo PostgreSQL, refresh CONCURRENTLY permite zero-downtime, e o optimizer as trata como tabelas normais. Tabelas de aggregates requereriam triggers custom para manter atualizadas — mais codigo, mais bugs.

### Por que particionar audit_log por mes?

Audit log e append-only, crece indefinidamente. Com particoes mensais: (1) queries filtram automaticamente pela particao correta; (2) backup/archive de particoes antigas e trivial (detach + move); (3) VACUUM opera por particao sem lock na tabela inteira; (4) retention policy = drop particao (instantaneo vs DELETE from + VACUUM).

### Por que separar Web e Worker no Render?

Quando um worker esta fazendo parse de um OFX de 10MB ou chamando Claude API (10-30s), ele consume CPU e memoria. Se isso rodasse no mesmo processo da API, requests HTTP sofreriam latencia. Separar permite: (1) scaling independente; (2) deploy sem interromper workers; (3) crash isolation — worker cai, API continua; (4) resource tuning separado.

---

## SEQUENCIAMENTO DE IMPLEMENTACAO

Baseado no sprint plan existente (10 sprints backend + 5 frontend), a evolucao para 112 tabelas/350+ endpoints adiciona 8 sprints:

```
PHASE 1 — CORE (Sprints 1-10, existentes no PRD)
  17 tabelas, 80 endpoints, reconciliacao basica + AI

PHASE 2 — BPO FOUNDATIONS (Sprints 11-14)
  Sprint 11: Predictions + Analytics (8 tabelas, 30 endpoints)
  Sprint 12: Collections multi-canal (3 tabelas, 20 endpoints)
  Sprint 13: Workflow + Automations (6 tabelas, 25 endpoints)
  Sprint 14: Documents + NF-e (4 tabelas, 15 endpoints)

PHASE 3 — MULTI-TENANT BPO (Sprints 15-18)
  Sprint 15: BPO Multi-tenant + Portal (5 tabelas, 20 endpoints)
  Sprint 16: Billing + Usage Metrics (4 tabelas, 15 endpoints)
  Sprint 17: Collaboration + Assignments (4 tabelas, 12 endpoints)
  Sprint 18: Integrations + Open Finance (5 tabelas, 8 endpoints)

TOTAL: 18 sprints x 2 semanas = 36 semanas = 9 meses
```

---

### Critical Files for Implementation

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md` -- PRD completo de 650KB que contem schema de 17 tabelas, 80 endpoints, sprint plan, e 35+ features detalhadas. Este arquivo e a base de verdade para o sistema e precisa ser estendido com os modulos/endpoints/tabelas adicionais desta arquitetura.

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` -- Documentacao de regras de negocio das APIs (Tiny V2/V3, Conta Simples, Pagar.me, AppMax) incluindo limitacoes, bugs conhecidos, e padroes operacionais. Critico para implementar TinySyncModule e GatewayModule corretamente.

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliar_cp_indneon_ofx.js` -- Script de conciliacao ativo com OFX parser funcional (parseOFX function, STMTTRN regex, encoding handling) e Tiny V2 client. Logica de matching por valor+data que deve ser migrada para ReconciliationModule do NestJS.

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliacao_titulos.js` -- Engine de matching de titulos (pedidos x CRs) com logica de tolerancia, parcelas, e report XLSX. Referencia principal para implementar o CandidateService e auto-reconciliation rules.

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/.env` -- Contem todas as credenciais atuais (tokens Tiny V2/V3, Conta Simples keys, Pagar.me secret) que devem ser migradas para environment variables do Render e encriptadas com AES-256-GCM no banco via CryptoService.

---

# PARTE VII — MCP SERVERS & INTEGRAÇÕES

> 8 MCP Servers (Tiny ERP, Bancos, Gateways, Comunicação, AI/Claude, Documentos/OCR, Compliance, Contabilidade), Orquestração, Saga Pattern, Claude AI Integration.

---


---

# ARQUITETURA COMPLETA DE MCP SERVERS PARA PLATAFORMA BPO FINANCEIRO SAAS

## 1. VISAO GERAL DA ARQUITETURA

### 1.1 Decisao Arquitetural: NestJS Modules vs Standalone Servers

Apos analisar o codebase existente -- um backend NestJS com BullMQ + Redis ja planejado (PRD_BPO_FINANCEIRO.md, linhas 297-336) e scripts Node.js operacionais que ja integram com Tiny V2/V3, Conta Simples, Pagar.me e AppMax -- a decisao arquitetural fundamental e:

**Cada MCP server sera implementado como um NestJS module dentro do monolito, com interface MCP padronizada exposta via SDK `@modelcontextprotocol/sdk`.** Nao serao processos separados (Docker containers independentes) na fase inicial. A razao e pragmatica: o sistema ja compartilha credenciais encriptadas via Supabase (tabela `companies` com AES-256-GCM), fila BullMQ via Redis, e contexto de tenant via RLS. Separar em microservicos agora adicionaria complexidade de rede, autenticacao inter-servico e deployment sem beneficio proporcional para um sistema que atende dezenas (nao milhares) de tenants.

A interface MCP, porem, sera rigorosamente respeitada: cada module expoe tools com `inputSchema`/`outputSchema` JSON Schema, registra-se no `McpRegistryModule`, e pode ser chamado tanto pelo Claude (via MCP protocol) quanto internamente (via injecao de dependencia NestJS). Isso permite futura extracaoo para microservicos sem reescrita.

### 1.2 Topologia Geral

```
                        ┌─────────────────────────────────┐
                        │       Claude AI (Anthropic)      │
                        │   Tool Use via MCP Protocol      │
                        └──────────┬──────────────────────┘
                                   │ SSE/stdio
                        ┌──────────▼──────────────────────┐
                        │    MCP Gateway Module (NestJS)   │
                        │  - Tool registry & routing       │
                        │  - Auth & tenant context          │
                        │  - Rate limiting per tool         │
                        │  - Audit logging                  │
                        │  - Human-in-the-loop gates        │
                        │  - Cost tracking                  │
                        └──┬────┬────┬────┬────┬────┬────┬─┘
                           │    │    │    │    │    │    │
        ┌──────────────────┤    │    │    │    │    │    ├──────────────────┐
        ▼                  ▼    ▼    ▼    ▼    ▼    ▼    ▼                  ▼
   MCP-Tiny           MCP-Banks  MCP-Gateways  MCP-Comms  MCP-AI   MCP-Docs  MCP-RF  MCP-Contab
   (Module)           (Module)   (Module)      (Module)   (Module) (Module)  (Module) (Module)
        │                  │         │             │         │        │         │        │
   Tiny V2/V3 API    Sicoob/OFX  Pagar.me      Gupshup   Claude   Tesseract SERPRO    Dominio
                     Conta Simples AppMax       SendGrid   API     GVision   ReceitaWS Omie
                     Itau/Bradesco Cielo/Stone  Twilio                                  Fortes
                     Inter/Nubank  PagSeguro    ChatGuru
```

### 1.3 Camada de Abstracoes Compartilhadas

Todos os MCP servers compartilham infraestrutura transversal implementada no monolito NestJS:

```typescript
// src/mcp/shared/interfaces/mcp-tool.interface.ts

export interface McpToolDefinition {
  name: string;                    // ex: 'tiny.contasPagar.listar'
  description: string;             // descricao para o Claude entender
  category: McpCategory;           // FINANCIAL | BANKING | COMMUNICATION | AI | DOCUMENT | COMPLIANCE | ACCOUNTING
  riskLevel: 'read' | 'write' | 'critical'; // determina se precisa human approval
  inputSchema: JsonSchema;         // JSON Schema validado com ajv
  outputSchema: JsonSchema;        // JSON Schema do retorno
  rateLimitKey?: string;           // key para rate limit especifico
  requiresApproval?: boolean;      // true para operacoes criticas
  idempotencyKeyField?: string;    // campo do input que serve como idempotency key
  retryConfig?: RetryConfig;
  timeoutMs?: number;
}

export interface McpToolExecution<TInput, TOutput> {
  execute(input: TInput, context: McpExecutionContext): Promise<McpToolResult<TOutput>>;
}

export interface McpExecutionContext {
  tenantId: string;                // org_id do RLS
  companyId: string;               // company_id para multi-empresa
  userId?: string;                 // user que acionou (ou 'system' para cron)
  actorType: 'user' | 'system' | 'ai';
  correlationId: string;           // UUID para rastreamento end-to-end
  idempotencyKey?: string;
  credentials: EncryptedCredentials; // desencriptadas no momento do uso
}

export interface McpToolResult<T> {
  success: boolean;
  data?: T;
  error?: McpError;
  metadata: {
    executionTimeMs: number;
    provider: string;
    apiVersion: string;
    rateLimitRemaining?: number;
    cached?: boolean;
  };
}

export interface McpError {
  code: string;                    // 'RATE_LIMIT' | 'AUTH_FAILURE' | 'TIMEOUT' | 'VALIDATION' | 'PROVIDER_ERROR'
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  providerError?: unknown;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];       // codigos de erro que permitem retry
}
```

### 1.4 Encryption Service (Compartilhado)

Conforme identificado no PRD (tabela `companies` com credenciais encriptadas AES-256-GCM), todas as credenciais sao armazenadas cifradas e desencriptadas apenas no momento do uso, nunca logadas:

```typescript
// src/mcp/shared/services/credential-vault.service.ts

export interface CredentialVaultService {
  encrypt(plaintext: string, companyId: string): Promise<string>;
  decrypt(ciphertext: string, companyId: string): Promise<string>;
  getCredentials(companyId: string, provider: string): Promise<ProviderCredentials>;
  rotateKey(companyId: string): Promise<void>;
}

// Implementacao: AES-256-GCM com IV unico por operacao
// Key derivation: HKDF do master key + companyId como salt
// Master key: variavel de ambiente ENCRYPTION_MASTER_KEY (nunca no DB)
// Nunca em logs: middleware que sanitiza patterns de token/secret/key
```

### 1.5 Circuit Breaker & Rate Limiter (Compartilhado)

```typescript
// src/mcp/shared/services/circuit-breaker.service.ts

export interface CircuitBreakerConfig {
  failureThreshold: number;        // ex: 5 falhas consecutivas
  recoveryTimeMs: number;          // ex: 60000 (1 min)
  halfOpenMaxCalls: number;        // ex: 2 chamadas de teste
  monitorWindowMs: number;         // ex: 300000 (5 min)
}

// Estados: CLOSED (normal) -> OPEN (bloqueado) -> HALF_OPEN (testando)
// Persistencia: Redis para compartilhar estado entre workers

// src/mcp/shared/services/rate-limiter.service.ts

export interface RateLimiterConfig {
  provider: string;                // 'tiny_v2' | 'conta_simples' | 'pagarme'
  maxRequestsPerWindow: number;
  windowMs: number;
  perTenant: boolean;              // rate limit por tenant ou global
  queueExcess: boolean;            // se true, enfileira ao inves de rejeitar
}
```

---

## 2. MCP 1: TINY ERP SERVER

### 2.1 Arquitetura Interna

O MCP Tiny e o mais complexo pois gerencia duas versoes de API (V2 e V3) com limitacoes diferentes documentadas em `PROCESSOS_FINANCEIRO.md`. O module encapsula ambas APIs atras de uma fachada unificada que escolhe automaticamente V2 ou V3 baseado na operacao.

```typescript
// src/mcp/tiny/tiny-mcp.module.ts

@Module({
  imports: [SharedMcpModule, BullModule.registerQueue({ name: 'tiny-sync' })],
  providers: [
    TinyMcpServer,
    TinyV2Client,
    TinyV3Client,
    TinyFacade,          // decide V2 vs V3 por operacao
    TinyRateLimiter,     // 2-3 req/s V2, diferente V3
    TinyTokenRefresher,  // OAuth2 refresh para V3
    TinySyncProcessor,   // BullMQ processor
    TinyFieldMapper,     // mapeamento customizado por tenant
  ],
  exports: [TinyMcpServer],
})
export class TinyMcpModule {}
```

### 2.2 Decisao V2 vs V3 por Operacao

Baseado nas limitacoes documentadas em PROCESSOS_FINANCEIRO.md:

| Operacao | V2 | V3 | Decisao |
|----------|----|----|---------|
| Listar CP/CR | OK (paginacao funciona) | BUG de paginacao (duplicatas) | **V2** |
| Criar CP | OK mas SEM marcador | OK com marcador, SEM categoria | **V2 para CP com categoria, V3 se precisa marcador** |
| Criar CR | OK | OK | V2 (mais estavel) |
| Baixar CP/CR | OK | N/A | **V2** |
| Listar pedidos | OK | OK | V2 (paginacao confiavel) |
| OAuth | N/A | OK | V3 |

A estrategia: V2 como primario, V3 apenas para operacoes que exigem funcionalidades exclusivas (marcadores). Se V3 falha na paginacao (detectado por IDs repetidos), fallback automatico para V2.

### 2.3 Schema de Tools Completo

```typescript
// src/mcp/tiny/tools/contas-pagar-listar.tool.ts

export const TinyContasPagarListarTool: McpToolDefinition = {
  name: 'tiny.contasPagar.listar',
  description: 'Lista contas a pagar do Tiny ERP com filtros de data, situacao, fornecedor e categoria. Retorna lista paginada com valor, vencimento, situacao e dados do fornecedor.',
  category: 'FINANCIAL',
  riskLevel: 'read',
  timeoutMs: 30000,
  rateLimitKey: 'tiny_v2',
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 15000,
    backoffMultiplier: 3,
    retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'PROVIDER_ERROR'],
  },
  inputSchema: {
    type: 'object',
    properties: {
      dataInicial: {
        type: 'string',
        format: 'date',
        description: 'Data inicial do filtro (YYYY-MM-DD). Convertido para DD/MM/YYYY na API Tiny.',
      },
      dataFinal: {
        type: 'string',
        format: 'date',
        description: 'Data final do filtro (YYYY-MM-DD).',
      },
      situacao: {
        type: 'string',
        enum: ['aberto', 'pago', 'parcial', 'cancelado', 'todos'],
        default: 'todos',
        description: 'Filtro por situacao da conta.',
      },
      fornecedor: {
        type: 'string',
        description: 'Nome ou CNPJ/CPF do fornecedor para filtro (busca parcial).',
      },
      categoria: {
        type: 'string',
        description: 'Nome da categoria no Tiny para filtro.',
      },
      pagina: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Numero da pagina para paginacao.',
      },
      marcador: {
        type: 'string',
        description: 'Filtrar por marcador (ex: CLAUDE). Nota: V2 nao retorna marcadores em CR.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      contas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'ID interno do Tiny' },
            fornecedor: {
              type: 'object',
              properties: {
                nome: { type: 'string' },
                cpfCnpj: { type: 'string' },
                tipoPessoa: { type: 'string', enum: ['F', 'J'] },
              },
            },
            valor: { type: 'number', description: 'Valor original da conta' },
            valorPago: { type: 'number', description: 'Valor ja pago' },
            vencimento: { type: 'string', format: 'date' },
            dataPagamento: { type: 'string', format: 'date', nullable: true },
            historico: { type: 'string', description: 'Descricao/historico da conta' },
            situacao: { type: 'string' },
            categoria: { type: 'string', nullable: true },
            marcadores: { type: 'array', items: { type: 'string' } },
            contaOrigem: { type: 'string', nullable: true, description: 'Conta bancaria no Tiny usada para baixa' },
            pedidoNumero: { type: 'string', nullable: true },
          },
        },
      },
      paginacao: {
        type: 'object',
        properties: {
          paginaAtual: { type: 'integer' },
          totalPaginas: { type: 'integer' },
          totalRegistros: { type: 'integer' },
        },
      },
    },
  },
};

// src/mcp/tiny/tools/contas-pagar-criar.tool.ts

export const TinyContasPagarCriarTool: McpToolDefinition = {
  name: 'tiny.contasPagar.criar',
  description: 'Cria uma conta a pagar no Tiny ERP. IMPORTANTE: sempre definir categoria (por nome, nao ID). Marcador CLAUDE sera adicionado automaticamente. Usa V2 para garantir que categoria seja salva (V3 tem bug que nao salva categoria).',
  category: 'FINANCIAL',
  riskLevel: 'write',
  requiresApproval: false, // aprovacao depende do valor (configuravel)
  idempotencyKeyField: 'idempotencyKey',
  timeoutMs: 15000,
  rateLimitKey: 'tiny_v2',
  retryConfig: {
    maxRetries: 1, // operacao de escrita: retry conservador
    initialDelayMs: 2000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: ['RATE_LIMIT', 'TIMEOUT'],
  },
  inputSchema: {
    type: 'object',
    properties: {
      idempotencyKey: {
        type: 'string',
        format: 'uuid',
        description: 'UUID unico para garantir idempotencia. Se ja foi processado, retorna resultado anterior.',
      },
      fornecedor: {
        type: 'object',
        properties: {
          nome: { type: 'string', minLength: 2 },
          cpfCnpj: { type: 'string' },
          tipoPessoa: { type: 'string', enum: ['F', 'J'], default: 'J' },
        },
        required: ['nome'],
      },
      valor: { type: 'number', exclusiveMinimum: 0, description: 'Valor da conta em reais (ex: 1234.56)' },
      vencimento: { type: 'string', format: 'date', description: 'Data de vencimento (YYYY-MM-DD)' },
      historico: { type: 'string', minLength: 3, description: 'Descricao/historico da conta' },
      categoria: { type: 'string', description: 'Nome exato da categoria no Tiny (ex: "Despesa de Marketing - EngaggePlacas")' },
      numeroBancario: { type: 'string', description: 'Numero do documento bancario' },
      competencia: { type: 'string', format: 'date', description: 'Data de competencia (YYYY-MM-DD)' },
    },
    required: ['fornecedor', 'valor', 'vencimento', 'historico', 'categoria', 'idempotencyKey'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      id: { type: 'integer', description: 'ID da conta criada no Tiny' },
      status: { type: 'string', enum: ['created', 'already_exists'] },
      marcadorAdicionado: { type: 'boolean', description: 'Se o marcador CLAUDE foi adicionado com sucesso' },
    },
  },
};

// src/mcp/tiny/tools/contas-pagar-baixar.tool.ts

export const TinyContasPagarBaixarTool: McpToolDefinition = {
  name: 'tiny.contasPagar.baixar',
  description: 'Da baixa (marca como paga) em uma conta a pagar no Tiny. CRITICO: sempre especificar contaOrigem com o nome exato da conta bancaria no Tiny (ex: "Conta Simples - BlueLight"). NUNCA baixar pelo Caixa generico.',
  category: 'FINANCIAL',
  riskLevel: 'critical', // requer human approval
  requiresApproval: true,
  idempotencyKeyField: 'idempotencyKey',
  timeoutMs: 15000,
  rateLimitKey: 'tiny_v2',
  retryConfig: {
    maxRetries: 0, // ZERO retry para baixa - operacao financeira irreversivel no Tiny
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    retryableErrors: [],
  },
  inputSchema: {
    type: 'object',
    properties: {
      idempotencyKey: { type: 'string', format: 'uuid' },
      contaId: { type: 'integer', description: 'ID da conta a pagar no Tiny' },
      dataPagamento: { type: 'string', format: 'date', description: 'Data do pagamento efetivo (YYYY-MM-DD)' },
      valorPago: { type: 'number', exclusiveMinimum: 0, description: 'Valor efetivamente pago' },
      contaOrigem: {
        type: 'string',
        description: 'Nome EXATO da conta bancaria no Tiny (ex: "Conta Simples - BlueLight", "Sicoob - Industrias Neon"). NUNCA usar Caixa generico.',
      },
    },
    required: ['contaId', 'dataPagamento', 'valorPago', 'contaOrigem', 'idempotencyKey'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      contaId: { type: 'integer' },
      status: { type: 'string', enum: ['baixada', 'ja_baixada', 'erro'] },
      alertas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alertas como "Nao existe endpoint de estorno no Tiny. Baixa e irreversivel via API."',
      },
    },
  },
};

// Tools analogas para CR (contasReceber.listar, criar, baixar)
// seguem o mesmo padrao, com a diferenca:
// - CR.baixar NAO tem campo contaOrigem (API V2 nao exige)
// - CR listar: V2 NAO retorna marcadores (limitacao documentada)

// src/mcp/tiny/tools/contatos-listar.tool.ts

export const TinyContatosListarTool: McpToolDefinition = {
  name: 'tiny.contatos.listar',
  description: 'Lista contatos (clientes e fornecedores) do Tiny ERP.',
  category: 'FINANCIAL',
  riskLevel: 'read',
  timeoutMs: 30000,
  rateLimitKey: 'tiny_v2',
  inputSchema: {
    type: 'object',
    properties: {
      pesquisa: { type: 'string', description: 'Busca por nome, CNPJ ou CPF' },
      tipoPessoa: { type: 'string', enum: ['F', 'J', 'todos'], default: 'todos' },
      pagina: { type: 'integer', minimum: 1, default: 1 },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      contatos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nome: { type: 'string' },
            cpfCnpj: { type: 'string' },
            tipoPessoa: { type: 'string' },
            email: { type: 'string' },
            telefone: { type: 'string' },
            cidade: { type: 'string' },
            uf: { type: 'string' },
          },
        },
      },
      paginacao: { type: 'object', properties: { paginaAtual: { type: 'integer' }, totalPaginas: { type: 'integer' } } },
    },
  },
};

// src/mcp/tiny/tools/notas-fiscais-obter.tool.ts

export const TinyNotasFiscaisObterTool: McpToolDefinition = {
  name: 'tiny.notasFiscais.obter',
  description: 'Obtem detalhes de uma nota fiscal incluindo XML. Util para cross-reference fiscal.',
  category: 'FINANCIAL',
  riskLevel: 'read',
  timeoutMs: 15000,
  rateLimitKey: 'tiny_v2',
  inputSchema: {
    type: 'object',
    properties: {
      notaId: { type: 'integer', description: 'ID da NF no Tiny' },
      incluirXml: { type: 'boolean', default: true, description: 'Se deve incluir o XML completo da NF-e' },
    },
    required: ['notaId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      numero: { type: 'string' },
      serie: { type: 'string' },
      chaveNfe: { type: 'string' },
      cnpjEmitente: { type: 'string' },
      cnpjDestinatario: { type: 'string' },
      valorTotal: { type: 'number' },
      dataEmissao: { type: 'string', format: 'date' },
      situacao: { type: 'string' },
      xml: { type: 'string', nullable: true, description: 'XML completo da NF-e (se solicitado)' },
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descricao: { type: 'string' },
            quantidade: { type: 'number' },
            valorUnitario: { type: 'number' },
            valorTotal: { type: 'number' },
          },
        },
      },
    },
  },
};
```

### 2.4 Configuracao por Tenant

```typescript
// src/mcp/tiny/tiny-tenant-config.interface.ts

export interface TinyTenantConfig {
  companyId: string;
  v2: {
    token: string;                    // encrypted AES-256-GCM
    rateLimit: {
      maxRequestsPerSecond: number;   // default 2, max 3
      burstSize: number;              // default 5
    };
  };
  v3: {
    clientId: string;                 // encrypted
    clientSecret: string;             // encrypted
    accessToken: string;              // encrypted, auto-refreshed
    refreshToken: string;             // encrypted
    tokenExpiresAt: Date;
    rateLimit: {
      maxRequestsPerSecond: number;   // default 5
      burstSize: number;
    };
  };
  fieldMappings: {                    // mapeamento customizado por tenant
    categoryMap: Record<string, string>;  // ex: { 'Trafego Pago Engagge': 'Despesa de Marketing - EngaggePlacas' }
    contaOrigemMap: Record<string, string>; // ex: { 'sicoob_industrias': 'Sicoob - Industrias Neon' }
    marcadorPadrao: string;           // default 'CLAUDE'
  };
  paginationBugWorkaround: boolean;  // true para V3 (detecta e desduplicata)
  preferredApi: 'v2' | 'v3';        // default 'v2'
}
```

### 2.5 Error Handling & V3 Pagination Bug

```typescript
// src/mcp/tiny/services/tiny-v3-pagination-guard.ts

export class TinyV3PaginationGuard {
  /**
   * V3 tem bug documentado: retorna mesmos 100 registros em loop.
   * Deteccao: se set de IDs da pagina N intersecta >50% com pagina N-1, para.
   * Fallback: volta para V2 e retorna dados acumulados ate ali.
   */
  async paginateWithGuard<T extends { id: number }>(
    fetcher: (page: number) => Promise<T[]>,
    fallbackFetcher: (page: number) => Promise<T[]>,
  ): Promise<{ items: T[]; usedFallback: boolean; totalPages: number }> {
    const allItems: T[] = [];
    const seenIds = new Set<number>();
    let page = 1;
    let usedFallback = false;

    while (page <= 100) { // safety limit
      const batch = await fetcher(page);
      if (batch.length === 0) break;

      const batchIds = batch.map(item => item.id);
      const overlap = batchIds.filter(id => seenIds.has(id));

      if (overlap.length > batch.length * 0.5) {
        // Bug detectado: >50% duplicatas. Fallback para V2.
        usedFallback = true;
        // Continua com V2 a partir da pagina correspondente
        let v2Page = Math.ceil(allItems.length / 100) + 1;
        while (v2Page <= 100) {
          const v2Batch = await fallbackFetcher(v2Page);
          if (v2Batch.length === 0) break;
          for (const item of v2Batch) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              allItems.push(item);
            }
          }
          v2Page++;
        }
        break;
      }

      for (const item of batch) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allItems.push(item);
        }
      }
      batchIds.forEach(id => seenIds.add(id));

      if (batch.length < 100) break; // ultima pagina
      page++;
    }

    return { items: allItems, usedFallback, totalPages: page };
  }
}
```

### 2.6 Health Check

```typescript
// src/mcp/tiny/tiny-health.service.ts

export class TinyHealthService implements HealthIndicator {
  async check(companyId: string): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];

    // 1. V2 connectivity: GET /api2/info.php
    try {
      const v2Response = await this.v2Client.info(companyId);
      checks.push({ name: 'tiny_v2', status: 'up', latencyMs: v2Response.latency });
    } catch (e) {
      checks.push({ name: 'tiny_v2', status: 'down', error: e.message });
    }

    // 2. V3 token validity
    const tokenConfig = await this.configService.getTinyV3Config(companyId);
    const tokenExpiresIn = tokenConfig.tokenExpiresAt.getTime() - Date.now();
    checks.push({
      name: 'tiny_v3_token',
      status: tokenExpiresIn > 300000 ? 'up' : tokenExpiresIn > 0 ? 'degraded' : 'down',
      expiresInMs: tokenExpiresIn,
    });

    // 3. Rate limit headroom
    const remaining = await this.rateLimiter.getRemaining('tiny_v2', companyId);
    checks.push({
      name: 'tiny_v2_rate_limit',
      status: remaining > 10 ? 'up' : remaining > 0 ? 'degraded' : 'down',
      remaining,
    });

    // 4. Last successful sync
    const lastSync = await this.syncRepo.getLastSuccessful(companyId);
    const staleness = Date.now() - lastSync.getTime();
    checks.push({
      name: 'tiny_data_freshness',
      status: staleness < 14400000 ? 'up' : staleness < 86400000 ? 'degraded' : 'down', // 4h / 24h
      lastSyncAt: lastSync,
      stalenessMs: staleness,
    });

    return {
      provider: 'tiny',
      companyId,
      overall: checks.every(c => c.status === 'up') ? 'healthy' :
               checks.some(c => c.status === 'down') ? 'unhealthy' : 'degraded',
      checks,
      checkedAt: new Date(),
    };
  }
}
```

### 2.7 Testing Strategy

```typescript
// Abordagem de testes para o MCP Tiny:

// 1. Unit Tests: Mock do HttpService, validacao de schemas, transformacao V2<->V3
// 2. Integration Tests: Tiny API sandbox (nao existe oficialmente - usar recorded fixtures)
// 3. Fixture-based: Gravar respostas reais e replay com nock/msw

// Fixture de resposta V2 contas a pagar (baseado nos scripts existentes):
// Capturada de: criar_contas_pagar.js, conciliacao_titulos.js

const FIXTURE_CP_LISTAR_V2 = {
  retorno: {
    status: 'OK',
    contas: [
      {
        conta: {
          id: 123456789,
          nome_cliente: 'Meta Platforms (Facebook Ads)',
          historico: 'Trafego pago - Campanha Abril/2026',
          valor: '2450.00',
          data_vencimento: '10/04/2026',
          situacao: 'aberto',
          categoria: 'Despesa de Marketing - EngaggePlacas',
        },
      },
    ],
    numero_paginas: 1,
  },
};

// 4. Contract Tests: Validar que inputSchema/outputSchema batem com dados reais
// 5. E2E: Usando as credenciais de staging (nunca producao) em CI/CD semanal
```

---

## 3. MCP 2: BANCOS SERVER

### 3.1 Arquitetura com Adapter Pattern

Cada banco e um adapter que implementa a interface `BankAdapter`. O MCP Bancos roteia para o adapter correto baseado no `bank_account.source_type` e `bank_account.bank_code`.

```typescript
// src/mcp/banks/interfaces/bank-adapter.interface.ts

export interface BankAdapter {
  readonly bankCode: string;         // 'sicoob' | 'conta_simples' | 'itau' | 'bradesco' | 'inter' | 'nubank'
  readonly capabilities: BankCapability[];  // ['ofx_import', 'api_extrato', 'api_transfer', 'api_boleto', 'api_pix']

  importStatement(config: BankConfig, file: Buffer, format: 'ofx' | 'csv'): Promise<BankTransaction[]>;
  fetchTransactions?(config: BankConfig, dateFrom: Date, dateTo: Date): Promise<BankTransaction[]>;
  getBalance?(config: BankConfig): Promise<BankBalance>;
  executeTransfer?(config: BankConfig, transfer: TransferRequest): Promise<TransferResult>;
  registerBoleto?(config: BankConfig, boleto: BoletoRequest): Promise<BoletoResult>;
  generatePixQRCode?(config: BankConfig, pix: PixQRCodeRequest): Promise<PixQRCodeResult>;
}

export type BankCapability = 'ofx_import' | 'csv_import' | 'api_extrato' | 'api_transfer' | 'api_boleto' | 'api_pix';
```

### 3.2 Adapter: Sicoob (OFX)

```typescript
// src/mcp/banks/adapters/sicoob.adapter.ts

export class SicoobAdapter implements BankAdapter {
  readonly bankCode = 'sicoob';
  readonly capabilities: BankCapability[] = ['ofx_import'];

  async importStatement(config: BankConfig, file: Buffer, format: 'ofx'): Promise<BankTransaction[]> {
    // Sicoob OFX vem em Latin-1 (ISO-8859-1)
    // Deteccao automatica de encoding: tenta UTF-8, se falha tenta Latin-1
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(file);
    } catch {
      content = new TextDecoder('iso-8859-1').decode(file);
    }

    // Parser OFX baseado no codigo existente em ler_todos_ofx.js (linhas 6-44)
    const transactions = this.parseOFX(content);

    return transactions.map(t => ({
      externalId: t.fitid,     // FITID para dedup (UNIQUE constraint no DB)
      transactionDate: t.date,
      amount: t.amount,
      description: t.memo,
      type: t.amount > 0 ? 'credit' : 'debit',
      rawData: t,
    }));
  }

  private parseOFX(content: string): RawOFXTransaction[] {
    // Implementacao identica ao parseOFX de ler_todos_ofx.js
    // Regex <STMTTRN>...</STMTTRN>, extrai TRNTYPE, DTPOSTED, TRNAMT, MEMO, FITID, NAME
    // BANKID e ACCTID para validacao
    // Formato data: YYYYMMDD -> Date
    // Formato valor: string com ponto ou virgula -> number
  }
}
```

### 3.3 Adapter: Conta Simples (API REST)

```typescript
// src/mcp/banks/adapters/conta-simples.adapter.ts

export class ContaSimplesAdapter implements BankAdapter {
  readonly bankCode = 'conta_simples';
  readonly capabilities: BankCapability[] = ['api_extrato', 'csv_import'];

  // Token OAuth2 client_credentials, expira em 30 minutos
  // Documentado em PROCESSOS_FINANCEIRO.md linhas 67-86

  private async authenticate(config: BankConfig): Promise<string> {
    const cached = await this.tokenCache.get(`cs_token:${config.companyId}`);
    if (cached && cached.expiresAt > Date.now() + 300000) { // refresh 5min antes
      return cached.accessToken;
    }

    // POST https://api.contasimples.com/oauth/v1/access-token
    // Basic auth: base64(api_key:api_secret)
    // Body: grant_type=client_credentials
    const response = await this.httpService.post(
      'https://api.contasimples.com/oauth/v1/access-token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      },
    );

    await this.tokenCache.set(`cs_token:${config.companyId}`, {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + 25 * 60 * 1000, // 25min (margem de 5min)
    });

    return response.data.access_token;
  }

  async fetchTransactions(config: BankConfig, dateFrom: Date, dateTo: Date): Promise<BankTransaction[]> {
    const token = await this.authenticate(config);
    const allTransactions: BankTransaction[] = [];
    let nextPageStartKey: string | undefined;

    do {
      // GET /statements/v1/credit-card?limit=100&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
      // Campo de dados: transactions (NAO items) - documentado em PROCESSOS_FINANCEIRO.md
      // Paginacao: nextPageStartKey
      const params: Record<string, string> = {
        limit: '100',
        startDate: dateFrom.toISOString().split('T')[0],
        endDate: dateTo.toISOString().split('T')[0],
      };
      if (nextPageStartKey) params.nextPageStartKey = nextPageStartKey;

      const response = await this.httpService.get(
        'https://api.contasimples.com/statements/v1/credit-card',
        { headers: { Authorization: `Bearer ${token}` }, params, timeout: 30000 },
      );

      const transactions = response.data.transactions || [];
      for (const t of transactions) {
        allTransactions.push({
          externalId: t.id,
          transactionDate: new Date(t.date),
          amount: t.amount, // ja em reais
          description: t.merchant || t.description,
          type: this.mapType(t.type),
          category: t.costCenter?.name,
          rawData: t,
        });
      }

      nextPageStartKey = response.data.nextPageStartKey;
    } while (nextPageStartKey);

    return allTransactions;
  }

  private mapType(csType: string): string {
    // PROCESSOS_FINANCEIRO.md linhas 79-80:
    // PURCHASE=compra, LIMIT=recarga/transferencia, IOF, PURCHASE_INTERNATIONAL, REFUND
    // LIMIT = transferencia entre contas, NAO entra no DRE
    const map: Record<string, string> = {
      PURCHASE: 'debit',
      PURCHASE_INTERNATIONAL: 'debit',
      IOF: 'debit',
      LIMIT: 'transfer', // special: nao e receita/despesa
      REFUND: 'credit',
    };
    return map[csType] || 'debit';
  }
}
```

### 3.4 Tools do MCP Bancos

```typescript
export const BancoExtratoImportarTool: McpToolDefinition = {
  name: 'banco.extrato.importar',
  description: 'Importa extrato bancario a partir de arquivo OFX ou CSV. Dedup automatico por FITID/external_id. Suporta Sicoob (OFX Latin-1), Conta Simples (API), Olist (OFX), Inter (OFX), Nubank (OFX).',
  category: 'BANKING',
  riskLevel: 'write',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      bankAccountId: { type: 'string', format: 'uuid', description: 'ID da conta bancaria cadastrada' },
      fileBase64: { type: 'string', description: 'Conteudo do arquivo em base64' },
      format: { type: 'string', enum: ['ofx', 'csv'], description: 'Formato do arquivo' },
      csvTemplate: { type: 'string', description: 'ID do template CSV (se format=csv)' },
    },
    required: ['bankAccountId', 'fileBase64', 'format'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      batchId: { type: 'string', format: 'uuid' },
      totalRecords: { type: 'integer' },
      imported: { type: 'integer' },
      skipped: { type: 'integer', description: 'Registros duplicados (mesmo FITID)' },
      errors: { type: 'integer' },
      fileHash: { type: 'string', description: 'SHA256 do arquivo para anti-duplicata de batch' },
    },
  },
};

export const BancoSaldoConsultarTool: McpToolDefinition = {
  name: 'banco.saldo.consultar',
  description: 'Consulta saldo atual da conta bancaria. Para OFX-only, retorna ultimo saldo do ultimo extrato importado. Para API (Conta Simples), consulta em tempo real.',
  category: 'BANKING',
  riskLevel: 'read',
  timeoutMs: 15000,
  inputSchema: {
    type: 'object',
    properties: {
      bankAccountId: { type: 'string', format: 'uuid' },
    },
    required: ['bankAccountId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      saldo: { type: 'number' },
      dataReferencia: { type: 'string', format: 'date-time' },
      fonte: { type: 'string', enum: ['api_realtime', 'ultimo_extrato_ofx'] },
      banco: { type: 'string' },
      conta: { type: 'string' },
    },
  },
};

export const BancoTransferenciaExecutarTool: McpToolDefinition = {
  name: 'banco.transferencia.executar',
  description: 'Executa transferencia bancaria (PIX ou TED). Operacao CRITICA que requer aprovacao humana. Disponivel apenas para bancos com API de transferencia.',
  category: 'BANKING',
  riskLevel: 'critical',
  requiresApproval: true,
  idempotencyKeyField: 'idempotencyKey',
  timeoutMs: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      idempotencyKey: { type: 'string', format: 'uuid' },
      bankAccountId: { type: 'string', format: 'uuid' },
      tipo: { type: 'string', enum: ['pix', 'ted'] },
      valor: { type: 'number', exclusiveMinimum: 0 },
      destinatario: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          cpfCnpj: { type: 'string' },
          chavePix: { type: 'string', description: 'Para PIX: email, telefone, CPF/CNPJ ou chave aleatoria' },
          banco: { type: 'string', description: 'Para TED: codigo do banco' },
          agencia: { type: 'string', description: 'Para TED: numero da agencia' },
          conta: { type: 'string', description: 'Para TED: numero da conta' },
          tipoConta: { type: 'string', enum: ['corrente', 'poupanca'] },
        },
        required: ['nome', 'cpfCnpj'],
      },
      descricao: { type: 'string', maxLength: 140 },
    },
    required: ['idempotencyKey', 'bankAccountId', 'tipo', 'valor', 'destinatario'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      transactionId: { type: 'string' },
      status: { type: 'string', enum: ['completed', 'pending', 'scheduled', 'failed'] },
      endToEndId: { type: 'string', description: 'ID end-to-end do PIX (para rastreamento)' },
      comprovante: { type: 'string', description: 'URL do comprovante em PDF' },
    },
  },
};
```

---

## 4. MCP 3: GATEWAYS DE PAGAMENTO

### 4.1 Adapter por Gateway

```typescript
// src/mcp/gateways/interfaces/gateway-adapter.interface.ts

export interface GatewayAdapter {
  readonly gatewayCode: string;
  listTransactions(config: GatewayConfig, filters: TransactionFilters): Promise<GatewayTransaction[]>;
  getTransaction(config: GatewayConfig, transactionId: string): Promise<GatewayTransactionDetail>;
  getBalance(config: GatewayConfig): Promise<GatewayBalance>;
  simulateAnticipation?(config: GatewayConfig, params: AnticipationParams): Promise<AnticipationSimulation>;
  executeAnticipation?(config: GatewayConfig, params: AnticipationExecution): Promise<AnticipationResult>;
}
```

### 4.2 Adapter: Pagar.me

```typescript
// src/mcp/gateways/adapters/pagarme.adapter.ts

export class PagarmeAdapter implements GatewayAdapter {
  readonly gatewayCode = 'pagarme';

  // Autenticacao: Basic auth com sk_key (documentado em PROCESSOS_FINANCEIRO.md linhas 89-98)
  // Base URL: https://api.pagar.me/core/v5
  // IMPORTANTE: valores vem em CENTAVOS, dividir por 100

  async listTransactions(config: GatewayConfig, filters: TransactionFilters): Promise<GatewayTransaction[]> {
    const allOrders: GatewayTransaction[] = [];
    let page = 1;

    while (true) {
      const response = await this.httpService.get(
        `${config.baseUrl || 'https://api.pagar.me/core/v5'}/orders`,
        {
          auth: { username: config.secretKey, password: '' },
          params: {
            page,
            size: 100,
            created_since: filters.dateFrom?.toISOString(),
            created_until: filters.dateTo?.toISOString(),
          },
          timeout: 30000,
        },
      );

      const orders = response.data.data || [];
      for (const order of orders) {
        allOrders.push({
          externalId: order.id,
          amount: order.amount / 100, // CENTAVOS -> REAIS
          netAmount: (order.amount - (order.charges?.[0]?.last_transaction?.gateway_response?.fee || 0)) / 100,
          date: new Date(order.created_at),
          status: order.status,
          customer: order.customer?.name,
          paymentMethod: order.charges?.[0]?.payment_method,
          installments: order.charges?.[0]?.last_transaction?.installments || 1,
          rawData: order,
        });
      }

      if (!response.data.paging?.next || orders.length === 0) break;
      page++;
    }

    return allOrders;
  }

  // REGRA DE NEGOCIO CRITICA (PROCESSOS_FINANCEIRO.md linhas 99-103):
  // NAO baixar CR quando cartao e aprovado. So baixar quando dinheiro aparece no extrato bancario.
  // Pagar.me repassa com delay (D+30 cartao credito, D+1 PIX/boleto).
}

// src/mcp/gateways/adapters/appmax.adapter.ts

export class AppMaxAdapter implements GatewayAdapter {
  readonly gatewayCode = 'appmax';
  // AppMax: CSV only (sem API real-time)
  // Taxa media: ~3% sobre bruto
  // Tiny registra CR por PARCELA individual (valor bruto / parcelas)
  // Nomes no AppMax podem divergir do Tiny (nome cartao vs razao social)
  // Documentado em PROCESSOS_FINANCEIRO.md linhas 106-113
}
```

### 4.3 Tools do MCP Gateways

```typescript
export const GatewayTransacoesListarTool: McpToolDefinition = {
  name: 'gateway.transacoes.listar',
  description: 'Lista transacoes de um gateway de pagamento (Pagar.me, AppMax, Cielo, Stone, PagSeguro). Valores SEMPRE em reais (conversao automatica de centavos para Pagar.me).',
  category: 'FINANCIAL',
  riskLevel: 'read',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      gatewayCode: { type: 'string', enum: ['pagarme', 'appmax', 'cielo', 'stone', 'pagseguro'] },
      dataInicial: { type: 'string', format: 'date' },
      dataFinal: { type: 'string', format: 'date' },
      status: { type: 'string', enum: ['approved', 'pending', 'refunded', 'cancelled', 'all'], default: 'all' },
      pagina: { type: 'integer', minimum: 1, default: 1 },
    },
    required: ['gatewayCode', 'dataInicial', 'dataFinal'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      transacoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            valor: { type: 'number', description: 'Valor bruto em reais' },
            valorLiquido: { type: 'number', description: 'Valor liquido (descontadas taxas)' },
            taxa: { type: 'number', description: 'Valor da taxa do gateway' },
            data: { type: 'string', format: 'date-time' },
            status: { type: 'string' },
            cliente: { type: 'string' },
            meioPagamento: { type: 'string' },
            parcelas: { type: 'integer' },
            dataPrevisaoRepasse: { type: 'string', format: 'date', description: 'Data prevista de repasse ao banco' },
          },
        },
      },
      resumo: {
        type: 'object',
        properties: {
          totalBruto: { type: 'number' },
          totalLiquido: { type: 'number' },
          totalTaxas: { type: 'number' },
          quantidade: { type: 'integer' },
        },
      },
    },
  },
};

export const GatewayAntecipacaoSimularTool: McpToolDefinition = {
  name: 'gateway.antecipacao.simular',
  description: 'Simula antecipacao de recebiveis em um gateway. Retorna valor liquido apos taxas de antecipacao, sem executar.',
  category: 'FINANCIAL',
  riskLevel: 'read',
  timeoutMs: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      gatewayCode: { type: 'string', enum: ['pagarme', 'cielo', 'stone'] },
      valor: { type: 'number', description: 'Valor desejado para antecipacao' },
      dataAntecipacao: { type: 'string', format: 'date', description: 'Data desejada para recebimento' },
    },
    required: ['gatewayCode', 'valor'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      valorBruto: { type: 'number' },
      valorLiquido: { type: 'number' },
      taxaAntecipacao: { type: 'number', description: 'Taxa percentual aplicada' },
      valorTaxa: { type: 'number' },
      dataDisponivel: { type: 'string', format: 'date' },
      transacoesIncluidas: { type: 'integer' },
    },
  },
};
```

---

## 5. MCP 4: COMUNICACAO (COBRANCA)

### 5.1 Adapters de Canal

```typescript
// src/mcp/communication/interfaces/channel-adapter.interface.ts

export interface ChannelAdapter {
  readonly channel: 'whatsapp' | 'email' | 'sms';
  readonly provider: string;

  sendMessage(config: ChannelConfig, message: MessagePayload): Promise<MessageResult>;
  sendTemplate(config: ChannelConfig, template: TemplatePayload): Promise<MessageResult>;
  getStatus(config: ChannelConfig, messageId: string): Promise<MessageStatus>;
}

// Adapters:
// WhatsApp: ChatGuru (numeros normais) + Gupshup (WABA oficial)
// Email: SendGrid ou Resend
// SMS: Twilio ou Zenvia
```

### 5.2 Tools do MCP Comunicacao

```typescript
export const WhatsAppMensagemEnviarTool: McpToolDefinition = {
  name: 'whatsapp.mensagem.enviar',
  description: 'Envia mensagem WhatsApp para um numero. Usa Gupshup (WABA) para mensagens de cobranca e ChatGuru para mensagens informais. ATENCAO: respeitar opt-out do cliente.',
  category: 'COMMUNICATION',
  riskLevel: 'write',
  requiresApproval: false, // templates pre-aprovados nao precisam
  timeoutMs: 15000,
  inputSchema: {
    type: 'object',
    properties: {
      telefone: { type: 'string', pattern: '^\\+55\\d{10,11}$', description: 'Numero com DDI +55 e DDD' },
      mensagem: { type: 'string', maxLength: 4096 },
      provider: { type: 'string', enum: ['gupshup', 'chatguru'], default: 'gupshup' },
      contexto: {
        type: 'object',
        description: 'Contexto da mensagem para auditoria',
        properties: {
          tipo: { type: 'string', enum: ['cobranca', 'lembrete', 'confirmacao', 'informativo'] },
          contaReceberId: { type: 'string' },
          campanhaId: { type: 'string' },
        },
      },
    },
    required: ['telefone', 'mensagem'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      messageId: { type: 'string' },
      status: { type: 'string', enum: ['sent', 'queued', 'failed'] },
      provider: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
};

export const WhatsAppTemplateEnviarTool: McpToolDefinition = {
  name: 'whatsapp.template.enviar',
  description: 'Envia template de WhatsApp pre-aprovado pelo Meta. Para cobranca, usa templates como "lembrete_vencimento", "segunda_cobranca", etc. Variaveis: {nome}, {valor}, {vencimento}, {empresa}, {link_pagamento}.',
  category: 'COMMUNICATION',
  riskLevel: 'write',
  timeoutMs: 15000,
  inputSchema: {
    type: 'object',
    properties: {
      telefone: { type: 'string', pattern: '^\\+55\\d{10,11}$' },
      templateName: { type: 'string', description: 'Nome do template aprovado' },
      variaveis: {
        type: 'object',
        description: 'Variaveis para preencher o template',
        additionalProperties: { type: 'string' },
      },
      idioma: { type: 'string', default: 'pt_BR' },
    },
    required: ['telefone', 'templateName', 'variaveis'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      messageId: { type: 'string' },
      status: { type: 'string', enum: ['sent', 'queued', 'failed'] },
      templateUsed: { type: 'string' },
    },
  },
};

export const EmailEnviarTool: McpToolDefinition = {
  name: 'email.enviar',
  description: 'Envia email transacional. Para cobracas, inclui boleto/PIX como anexo ou link.',
  category: 'COMMUNICATION',
  riskLevel: 'write',
  timeoutMs: 15000,
  inputSchema: {
    type: 'object',
    properties: {
      para: { type: 'string', format: 'email' },
      assunto: { type: 'string', maxLength: 200 },
      corpo: { type: 'string', description: 'HTML do email' },
      templateId: { type: 'string', description: 'ID do template (alternativa ao corpo HTML)' },
      variaveis: { type: 'object', additionalProperties: { type: 'string' } },
      anexos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            contentBase64: { type: 'string' },
            mimeType: { type: 'string' },
          },
        },
      },
      replyTo: { type: 'string', format: 'email' },
    },
    required: ['para', 'assunto'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      messageId: { type: 'string' },
      status: { type: 'string', enum: ['sent', 'queued', 'failed'] },
    },
  },
};
```

---

## 6. MCP 5: AI / CLAUDE SERVER

Este e o MCP mais estrategico: define as tools que o Claude usa para operar o financeiro de forma autonoma.

### 6.1 Arquitetura

```typescript
// src/mcp/ai/ai-mcp.module.ts

@Module({
  imports: [
    SharedMcpModule,
    TinyMcpModule,    // para acessar dados do Tiny
    BanksMcpModule,   // para acessar extratos
    GatewaysMcpModule, // para acessar gateways
    CommunicationMcpModule, // para cobranca
  ],
  providers: [
    AiMcpServer,
    ConciliacaoService,
    CategorizacaoService,
    DiagnosticoService,
    RelatorioService,
    PrevisaoService,
    CobrancaService,
    DuplicataService,
    AnomaliaService,
    PromptBuilderService,
    FewShotLearningService,
    ConfidenceScoringService,
    CostTrackingService,
  ],
  exports: [AiMcpServer],
})
export class AiMcpModule {}
```

### 6.2 Tools do MCP AI

```typescript
export const FinanceiroConciliarTool: McpToolDefinition = {
  name: 'financeiro.conciliar',
  description: `Executa conciliacao entre transacoes bancarias e lancamentos do Tiny (CP/CR). 
  Motor de 4 camadas: 
  1) Match exato (valor ±R$0.05 + data ±2d + referencia pedido) -> confidence 0.95-1.00
  2) Valor+Data (valor identico + data ±5d + nome parcial) -> confidence 0.80-0.94
  3) Parcela (valor = total/parcelas + mesmo pedido) -> confidence 0.70-0.89
  4) IA Fuzzy (analise de descricao, nomes abreviados, padroes) -> confidence 0.50-0.85
  
  Retorna sugestoes rankeadas por confidence. Acima de 0.95 pode auto-reconciliar (se config permite).
  Abaixo de 0.75 descarta. Entre 0.75-0.94 sugere para revisao humana.`,
  category: 'AI',
  riskLevel: 'write',
  timeoutMs: 120000,
  inputSchema: {
    type: 'object',
    properties: {
      bankAccountId: { type: 'string', format: 'uuid', description: 'Conta bancaria a conciliar' },
      contaTipo: { type: 'string', enum: ['pagar', 'receber'], description: 'Tipo de conta para matching' },
      dataInicial: { type: 'string', format: 'date' },
      dataFinal: { type: 'string', format: 'date' },
      autoReconciliarAcimaDe: {
        type: 'number',
        minimum: 0.90,
        maximum: 1.0,
        default: 0.95,
        description: 'Threshold de confidence para auto-reconciliacao. Default 0.95.',
      },
      maxSugestoesPorTransacao: { type: 'integer', default: 5, maximum: 20 },
      incluirCamadaIA: { type: 'boolean', default: true, description: 'Se deve usar Claude para matches fuzzy (camada 4)' },
    },
    required: ['bankAccountId', 'contaTipo', 'dataInicial', 'dataFinal'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      resumo: {
        type: 'object',
        properties: {
          totalTransacoes: { type: 'integer' },
          autoReconciliadas: { type: 'integer' },
          sugestoesPendentes: { type: 'integer' },
          semMatch: { type: 'integer' },
          valorAutoReconciliado: { type: 'number' },
          valorPendente: { type: 'number' },
        },
      },
      sugestoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            transacaoBancariaId: { type: 'string', format: 'uuid' },
            transacaoDescricao: { type: 'string' },
            transacaoValor: { type: 'number' },
            candidatos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contaId: { type: 'string' },
                  contaTinyId: { type: 'integer' },
                  contaValor: { type: 'number' },
                  contaHistorico: { type: 'string' },
                  confidence: { type: 'number' },
                  camadaMatch: { type: 'integer', enum: [1, 2, 3, 4] },
                  razao: { type: 'string', description: 'Explicacao do match' },
                },
              },
            },
          },
        },
      },
      custoIA: {
        type: 'object',
        properties: {
          promptTokens: { type: 'integer' },
          completionTokens: { type: 'integer' },
          custoEstimadoUSD: { type: 'number' },
        },
      },
    },
  },
};

export const FinanceiroCategorizarTool: McpToolDefinition = {
  name: 'financeiro.categorizar',
  description: 'Categoriza lancamento financeiro com base em historico de decisoes anteriores e regras de mapeamento. Usa pattern matching primeiro (descricao normalizada -> categoria) e IA como fallback. Mapeamentos conhecidos: Meta/FACEBK -> Marketing, ANTHROPIC -> Tecnologia, GUPSHUP -> Tecnologia.',
  category: 'AI',
  riskLevel: 'write',
  timeoutMs: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      transacaoId: { type: 'string', format: 'uuid' },
      descricao: { type: 'string', description: 'Descricao/memo da transacao bancaria' },
      valor: { type: 'number' },
      fornecedorOuCliente: { type: 'string' },
      bankAccountId: { type: 'string', format: 'uuid' },
    },
    required: ['descricao', 'valor'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      categoria: { type: 'string', description: 'Nome da categoria sugerida' },
      categoriaId: { type: 'integer', description: 'ID da categoria no Tiny' },
      confidence: { type: 'number' },
      metodo: { type: 'string', enum: ['regra_exata', 'pattern_historico', 'ia_fuzzy'] },
      explicacao: { type: 'string' },
      categoriasAlternativas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            categoria: { type: 'string' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
};

export const FinanceiroDiagnosticarTool: McpToolDefinition = {
  name: 'financeiro.diagnosticar',
  description: 'Diagnostica a saude financeira de uma empresa do grupo. Analisa liquidez, rentabilidade, eficiencia operacional e tendencia. Retorna score 0-100, insights e recomendacoes.',
  category: 'AI',
  riskLevel: 'read',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' },
      periodo: { type: 'string', description: 'Periodo de analise (ex: "2026-03", "2026-Q1")' },
    },
    required: ['companyId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      componentes: {
        type: 'object',
        properties: {
          liquidez: { type: 'number', description: 'Score 0-100 de liquidez' },
          rentabilidade: { type: 'number' },
          eficiencia: { type: 'number' },
          tendencia: { type: 'number' },
        },
      },
      insights: { type: 'array', items: { type: 'string' } },
      recomendacoes: { type: 'array', items: { type: 'string' } },
      narrativa: { type: 'string', description: 'Texto narrativo gerencial gerado pelo Claude' },
    },
  },
};

export const FinanceiroDuplicataDetectarTool: McpToolDefinition = {
  name: 'financeiro.duplicata.detectar',
  description: 'Detecta lancamentos duplicados. Verifica: mesmo valor + mesma data + mesmo counterparty, e tambem parcelas duplicadas (mesma parcela lançada 2x).',
  category: 'AI',
  riskLevel: 'read',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' },
      contaTipo: { type: 'string', enum: ['pagar', 'receber', 'ambos'], default: 'ambos' },
      dataInicial: { type: 'string', format: 'date' },
      dataFinal: { type: 'string', format: 'date' },
      toleranciaValor: { type: 'number', default: 0.02, description: 'Tolerancia em reais para considerar duplicata' },
    },
    required: ['companyId', 'dataInicial', 'dataFinal'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      duplicatas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            grupo: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, tinyId: { type: 'integer' }, valor: { type: 'number' }, data: { type: 'string' }, historico: { type: 'string' } } } },
            confidence: { type: 'number' },
            tipo: { type: 'string', enum: ['exata', 'provavel', 'possivel'] },
            razao: { type: 'string' },
          },
        },
      },
      totalDuplicatasEncontradas: { type: 'integer' },
      valorTotalDuplicado: { type: 'number' },
    },
  },
};

export const FinanceiroPrevisaoTool: McpToolDefinition = {
  name: 'financeiro.previsao',
  description: 'Preve fluxo de caixa futuro com cenarios otimista/realista/pessimista. Usa historico de pagamentos, sazonalidade e dados de CRs/CPs previstas.',
  category: 'AI',
  riskLevel: 'read',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' },
      horizonte: { type: 'string', enum: ['7d', '15d', '30d', '60d', '90d'], default: '30d' },
      incluirCenarios: { type: 'boolean', default: true },
    },
    required: ['companyId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      saldoAtual: { type: 'number' },
      projecoes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            data: { type: 'string', format: 'date' },
            otimista: { type: 'number' },
            realista: { type: 'number' },
            pessimista: { type: 'number' },
            entradasPrevistas: { type: 'number' },
            saidasPrevistas: { type: 'number' },
          },
        },
      },
      alertas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            data: { type: 'string', format: 'date' },
            tipo: { type: 'string', enum: ['deficit_projetado', 'folha_pagamento', 'vencimento_imposto', 'recebivel_grande'] },
            mensagem: { type: 'string' },
            valor: { type: 'number' },
          },
        },
      },
      narrativa: { type: 'string' },
    },
  },
};

export const FinanceiroCobrancaSugerirTool: McpToolDefinition = {
  name: 'financeiro.cobranca.sugerir',
  description: 'Sugere estrategia de cobranca para um cliente com base no comportamento historico, score de pagamento, canal preferido e valor em aberto.',
  category: 'AI',
  riskLevel: 'read',
  timeoutMs: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      clienteCpfCnpj: { type: 'string' },
      companyId: { type: 'string', format: 'uuid' },
    },
    required: ['clienteCpfCnpj', 'companyId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      cliente: { type: 'object', properties: { nome: { type: 'string' }, score: { type: 'integer' }, risco: { type: 'string' } } },
      titulosVencidos: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, valor: { type: 'number' }, diasVencido: { type: 'integer' } } } },
      valorTotalVencido: { type: 'number' },
      estrategia: {
        type: 'object',
        properties: {
          canal: { type: 'string', enum: ['whatsapp', 'email', 'telefone', 'carta'] },
          tom: { type: 'string', enum: ['amigavel', 'formal', 'firme', 'juridico'] },
          mensagemSugerida: { type: 'string' },
          acaoRecomendada: { type: 'string' },
          urgencia: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
        },
      },
    },
  },
};

export const FinanceiroAnomaliaDetectarTool: McpToolDefinition = {
  name: 'financeiro.anomalia.detectar',
  description: 'Detecta anomalias em lancamentos: valores atipicos (>3 desvios padrao), fornecedores novos com valores altos, duplicidades, timing anomalo, sequencias quebradas.',
  category: 'AI',
  riskLevel: 'read',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' },
      dataInicial: { type: 'string', format: 'date' },
      dataFinal: { type: 'string', format: 'date' },
      severidadeMinima: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'], default: 'media' },
    },
    required: ['companyId', 'dataInicial', 'dataFinal'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      anomalias: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['valor_atipico', 'fornecedor_novo_alto_valor', 'duplicidade', 'timing_anomalo', 'sequencia_quebrada', 'categoria_inconsistente', 'velocidade_anomala'] },
            severidade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
            descricao: { type: 'string' },
            transacaoId: { type: 'string' },
            valorEnvolvido: { type: 'number' },
            detalhe: { type: 'object' },
          },
        },
      },
      totalAnomalias: { type: 'integer' },
      porSeveridade: { type: 'object', properties: { critica: { type: 'integer' }, alta: { type: 'integer' }, media: { type: 'integer' }, baixa: { type: 'integer' } } },
    },
  },
};
```

### 6.3 Resources (Contexto para o Claude)

```typescript
// src/mcp/ai/resources/company-context.resource.ts

export const CompanyContextResource = {
  uri: 'context://company/{companyId}',
  name: 'Dados da empresa',
  description: 'Contexto completo da empresa para o Claude: faturamento, setor, regime tributario, plano de contas, historico de decisoes.',
  mimeType: 'application/json',

  // Montado dinamicamente com:
  // 1. Dados da tabela companies (nome, CNPJ, setor, regime)
  // 2. Mapeamento de categorias (category_mappings)
  // 3. Ultimas 50 decisoes de conciliacao (aceites/rejeicoes com razao)
  // 4. Regras de tolerancia ativas
  // 5. Score de saude atual
  // 6. Top 20 fornecedores/clientes por volume
};

export const DecisionHistoryResource = {
  uri: 'context://decisions/{companyId}',
  name: 'Historico de decisoes',
  description: '5 ultimas decisoes aceitas e 5 rejeitadas para few-shot learning.',
  mimeType: 'application/json',

  // Extraido de ai_suggestions onde status = 'accepted' ou 'rejected'
  // Inclui: transacao original, candidato, confidence, razao aceite/rejeicao
  // Usado como exemplos no prompt do Claude
};

export const BusinessRulesResource = {
  uri: 'context://rules/{companyId}',
  name: 'Regras de negocio',
  description: 'Regras especificas: mapeamentos Conta Simples -> Tiny, regras de tolerancia, marcador padrao, contaOrigem por banco.',
  mimeType: 'application/json',

  // Inclui o conteudo de PROCESSOS_FINANCEIRO.md relevante para a empresa:
  // - Mapa CC Conta Simples -> Categoria Tiny
  // - Regra: LIMIT = transferencia (nao DRE)
  // - Regra: nunca baixar pelo Caixa generico
  // - Regra: so baixar CR quando dinheiro cair na conta
};
```

---

## 7. MCP 6: DOCUMENTOS / OCR

```typescript
// src/mcp/documents/tools/

export const DocumentoOcrTool: McpToolDefinition = {
  name: 'documento.ocr',
  description: 'Extrai texto estruturado de imagem ou PDF usando OCR. Tenta Tesseract.js primeiro (gratis), se qualidade <80% usa Google Vision API.',
  category: 'DOCUMENT',
  riskLevel: 'read',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      fileBase64: { type: 'string' },
      mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'application/pdf'] },
      tipo: { type: 'string', enum: ['nfe', 'boleto', 'comprovante', 'extrato_pdf', 'generico'], description: 'Tipo de documento para orientar a extracao' },
      forcarProvider: { type: 'string', enum: ['tesseract', 'google_vision', 'claude_vision'] },
    },
    required: ['fileBase64', 'mimeType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      textoExtraido: { type: 'string' },
      dadosEstruturados: { type: 'object', description: 'Dados extraidos conforme o tipo (chave NFe, valor, vencimento, etc.)' },
      confidence: { type: 'number' },
      providerUsado: { type: 'string' },
    },
  },
};

export const DocumentoNfeXmlTool: McpToolDefinition = {
  name: 'documento.nfe.ler',
  description: 'Le e parseia XML de NF-e, extraindo chave de acesso, CNPJ emitente/destinatario, valor total, itens, impostos.',
  category: 'DOCUMENT',
  riskLevel: 'read',
  timeoutMs: 10000,
  inputSchema: {
    type: 'object',
    properties: {
      xmlContent: { type: 'string', description: 'Conteudo XML da NF-e' },
      xmlBase64: { type: 'string', description: 'XML em base64 (alternativa)' },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      chaveNfe: { type: 'string' },
      numero: { type: 'string' },
      serie: { type: 'string' },
      cnpjEmitente: { type: 'string' },
      nomeEmitente: { type: 'string' },
      cnpjDestinatario: { type: 'string' },
      valorTotal: { type: 'number' },
      valorProdutos: { type: 'number' },
      valorFrete: { type: 'number' },
      valorDesconto: { type: 'number' },
      dataEmissao: { type: 'string', format: 'date' },
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descricao: { type: 'string' },
            ncm: { type: 'string' },
            quantidade: { type: 'number' },
            valorUnitario: { type: 'number' },
            valorTotal: { type: 'number' },
          },
        },
      },
      impostos: {
        type: 'object',
        properties: {
          icms: { type: 'number' },
          ipi: { type: 'number' },
          pis: { type: 'number' },
          cofins: { type: 'number' },
          issqn: { type: 'number' },
        },
      },
    },
  },
};

export const DocumentoBoletoLerTool: McpToolDefinition = {
  name: 'documento.boleto.ler',
  description: 'Extrai dados de boleto (imagem ou PDF): linha digitavel, valor, vencimento, beneficiario, pagador.',
  category: 'DOCUMENT',
  riskLevel: 'read',
  timeoutMs: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      fileBase64: { type: 'string' },
      mimeType: { type: 'string' },
    },
    required: ['fileBase64', 'mimeType'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      linhaDigitavel: { type: 'string' },
      codigoBarras: { type: 'string' },
      valor: { type: 'number' },
      vencimento: { type: 'string', format: 'date' },
      beneficiario: { type: 'object', properties: { nome: { type: 'string' }, cnpjCpf: { type: 'string' } } },
      pagador: { type: 'object', properties: { nome: { type: 'string' }, cnpjCpf: { type: 'string' } } },
      banco: { type: 'string' },
      nossoNumero: { type: 'string' },
    },
  },
};
```

---

## 8. MCP 7: RECEITA FEDERAL / COMPLIANCE

```typescript
export const CnpjConsultarTool: McpToolDefinition = {
  name: 'cnpj.consultar',
  description: 'Consulta dados de CNPJ na Receita Federal via API publica. Retorna razao social, situacao, endereco, CNAEs, socios.',
  category: 'COMPLIANCE',
  riskLevel: 'read',
  timeoutMs: 30000,
  retryConfig: { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 30000, backoffMultiplier: 3, retryableErrors: ['RATE_LIMIT', 'TIMEOUT'] },
  inputSchema: {
    type: 'object',
    properties: {
      cnpj: { type: 'string', pattern: '^\\d{14}$', description: 'CNPJ somente numeros (14 digitos)' },
    },
    required: ['cnpj'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      cnpj: { type: 'string' },
      razaoSocial: { type: 'string' },
      nomeFantasia: { type: 'string' },
      situacao: { type: 'string', enum: ['ATIVA', 'BAIXADA', 'INAPTA', 'SUSPENSA', 'NULA'] },
      dataAbertura: { type: 'string', format: 'date' },
      naturezaJuridica: { type: 'string' },
      endereco: {
        type: 'object',
        properties: { logradouro: { type: 'string' }, numero: { type: 'string' }, bairro: { type: 'string' }, cidade: { type: 'string' }, uf: { type: 'string' }, cep: { type: 'string' } },
      },
      cnaePrincipal: { type: 'object', properties: { codigo: { type: 'string' }, descricao: { type: 'string' } } },
      cnaeSecundarios: { type: 'array', items: { type: 'object', properties: { codigo: { type: 'string' }, descricao: { type: 'string' } } } },
      socios: { type: 'array', items: { type: 'object', properties: { nome: { type: 'string' }, qualificacao: { type: 'string' }, cpfCnpj: { type: 'string' } } } },
      capitalSocial: { type: 'number' },
      regimeTributario: { type: 'string' },
    },
  },
};

export const CpfValidarTool: McpToolDefinition = {
  name: 'cpf.validar',
  description: 'Valida CPF por algoritmo (digitos verificadores). Nao consulta Receita Federal.',
  category: 'COMPLIANCE',
  riskLevel: 'read',
  timeoutMs: 100,
  inputSchema: {
    type: 'object',
    properties: { cpf: { type: 'string', pattern: '^\\d{11}$' } },
    required: ['cpf'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      valido: { type: 'boolean' },
      cpfFormatado: { type: 'string', description: 'CPF com mascara XXX.XXX.XXX-XX' },
    },
  },
};
```

---

## 9. MCP 8: CONTABILIDADE

```typescript
export const ContabilidadeExportarTool: McpToolDefinition = {
  name: 'contabilidade.exportar',
  description: 'Exporta lancamentos financeiros para sistema contabil. Formato de saida depende do adapter: Dominio (TXT padronizado), Omie (API REST), Conta Azul (API REST), Fortes (CSV).',
  category: 'ACCOUNTING',
  riskLevel: 'write',
  timeoutMs: 60000,
  inputSchema: {
    type: 'object',
    properties: {
      sistema: { type: 'string', enum: ['dominio', 'omie', 'conta_azul', 'fortes'] },
      dataInicial: { type: 'string', format: 'date' },
      dataFinal: { type: 'string', format: 'date' },
      companyId: { type: 'string', format: 'uuid' },
      formato: { type: 'string', enum: ['api', 'arquivo'], default: 'arquivo' },
    },
    required: ['sistema', 'dataInicial', 'dataFinal', 'companyId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      totalLancamentos: { type: 'integer' },
      formato: { type: 'string' },
      arquivoUrl: { type: 'string', nullable: true, description: 'URL para download se formato=arquivo' },
      apiResult: { type: 'object', nullable: true, description: 'Resultado da integracao API se formato=api' },
    },
  },
};

export const ContabilidadeDreGerarTool: McpToolDefinition = {
  name: 'contabilidade.dre.gerar',
  description: 'Gera DRE (Demonstracao de Resultado do Exercicio) gerencial com comparativo periodo anterior.',
  category: 'ACCOUNTING',
  riskLevel: 'read',
  timeoutMs: 30000,
  inputSchema: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' },
      periodo: { type: 'string', description: 'YYYY-MM para mensal ou YYYY-Q1 para trimestral' },
      comparativo: { type: 'boolean', default: true, description: 'Incluir periodo anterior para comparacao' },
      formato: { type: 'string', enum: ['json', 'xlsx', 'pdf'], default: 'json' },
    },
    required: ['companyId', 'periodo'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      periodoAtual: {
        type: 'object',
        properties: {
          receitaBruta: { type: 'number' },
          deducoes: { type: 'number' },
          receitaLiquida: { type: 'number' },
          custoMercadoria: { type: 'number' },
          lucroBruto: { type: 'number' },
          despesasOperacionais: {
            type: 'object',
            properties: {
              marketing: { type: 'number' },
              tecnologia: { type: 'number' },
              administrativas: { type: 'number' },
              pessoal: { type: 'number' },
              financeiras: { type: 'number' },
            },
          },
          ebitda: { type: 'number' },
          margemEbitda: { type: 'number' },
          resultadoLiquido: { type: 'number' },
        },
      },
      periodoAnterior: { type: 'object', description: 'Mesma estrutura (se comparativo=true)' },
      variacao: { type: 'object', description: 'Variacao % entre periodos' },
      narrativa: { type: 'string', description: 'Analise gerada por Claude (se disponivel)' },
    },
  },
};

export const ContabilidadeImpostosCalcularTool: McpToolDefinition = {
  name: 'contabilidade.impostos.calcular',
  description: 'Calcula provisao de impostos com base no faturamento e regime tributario. Simples Nacional (DAS), Lucro Presumido (PIS/COFINS/IRPJ/CSLL), Lucro Real.',
  category: 'ACCOUNTING',
  riskLevel: 'read',
  timeoutMs: 15000,
  inputSchema: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' },
      competencia: { type: 'string', description: 'YYYY-MM' },
      regimeTributario: { type: 'string', enum: ['simples_nacional', 'lucro_presumido', 'lucro_real'] },
    },
    required: ['companyId', 'competencia'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      faturamentoPeriodo: { type: 'number' },
      regime: { type: 'string' },
      impostos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string', description: 'DAS, PIS, COFINS, IRPJ, CSLL, ISS' },
            base: { type: 'number' },
            aliquota: { type: 'number' },
            valor: { type: 'number' },
            vencimento: { type: 'string', format: 'date' },
          },
        },
      },
      totalImpostos: { type: 'number' },
      cargaTributariaPercentual: { type: 'number' },
    },
  },
};
```

---

## 10. ORQUESTRACAO DE MCPs

### 10.1 Event Bus (Redis Pub/Sub)

```typescript
// src/mcp/orchestration/event-bus.service.ts

// Eventos entre MCPs via Redis pub/sub:
export type McpEvent =
  | { type: 'BANK_TRANSACTION_IMPORTED'; data: { companyId: string; batchId: string; count: number } }
  | { type: 'TINY_SYNC_COMPLETED'; data: { companyId: string; contasPagar: number; contasReceber: number } }
  | { type: 'RECONCILIATION_CREATED'; data: { companyId: string; reconciliationId: string; amount: number } }
  | { type: 'CR_VENCIDA'; data: { companyId: string; contaReceberId: string; clienteDoc: string; valor: number; diasVencido: number } }
  | { type: 'ANOMALIA_DETECTADA'; data: { companyId: string; tipo: string; severidade: string; transacaoId: string } }
  | { type: 'APPROVAL_REQUIRED'; data: { entityType: string; entityId: string; amount: number; approvers: string[] } }
  | { type: 'GATEWAY_TRANSACTION_RECEIVED'; data: { companyId: string; gatewayCode: string; transactionId: string } };

// Canais Redis: mcp:events:{companyId}
// Subscribers registram interesse por tipo de evento
```

### 10.2 Saga Pattern para Operacoes Multi-Step

```typescript
// src/mcp/orchestration/sagas/cobranca.saga.ts

// Exemplo: Criar CR no Tiny + Enviar cobranca WhatsApp + Atualizar status

export class CobrancaSaga {
  readonly steps: SagaStep[] = [
    {
      name: 'criar_cr_tiny',
      execute: async (ctx) => {
        const result = await this.tinyMcp.execute('tiny.contasReceber.criar', ctx.input.cr, ctx);
        return { crId: result.data.id };
      },
      compensate: async (ctx, stepResult) => {
        // Tiny V2 NAO tem endpoint de delete para CR (documentado em PROCESSOS_FINANCEIRO.md)
        // Compensacao: marcar como cancelada internamente no DB (nao e possivel deletar no Tiny)
        await this.db.updateCR(stepResult.crId, { status: 'cancelled_by_saga' });
        this.logger.warn(`CR ${stepResult.crId} criada no Tiny nao pode ser deletada. Marcada como cancelada internamente.`);
      },
    },
    {
      name: 'enviar_whatsapp',
      execute: async (ctx, previousResults) => {
        const result = await this.commsMcp.execute('whatsapp.template.enviar', {
          telefone: ctx.input.clienteTelefone,
          templateName: 'lembrete_vencimento',
          variaveis: { nome: ctx.input.clienteNome, valor: ctx.input.cr.valor, vencimento: ctx.input.cr.vencimento },
        }, ctx);
        return { messageId: result.data.messageId };
      },
      compensate: async () => {
        // WhatsApp enviado nao pode ser desfeito. Log apenas.
        this.logger.warn('Mensagem WhatsApp ja enviada. Compensacao nao possivel.');
      },
    },
    {
      name: 'atualizar_status',
      execute: async (ctx, previousResults) => {
        await this.db.updateCollectionCampaignStatus(ctx.input.campanhaId, 'message_sent', previousResults);
      },
      compensate: async (ctx) => {
        await this.db.updateCollectionCampaignStatus(ctx.input.campanhaId, 'reverted');
      },
    },
  ];

  async run(input: CobrancaSagaInput, context: McpExecutionContext): Promise<SagaResult> {
    const executor = new SagaExecutor(this.steps);
    return executor.execute(input, context);
  }
}

// src/mcp/orchestration/saga-executor.ts

export class SagaExecutor {
  async execute(input: unknown, context: McpExecutionContext): Promise<SagaResult> {
    const completedSteps: { step: SagaStep; result: unknown }[] = [];

    for (const step of this.steps) {
      try {
        const previousResults = completedSteps.map(s => s.result);
        const result = await step.execute(context, previousResults);
        completedSteps.push({ step, result });
      } catch (error) {
        // Compensating transactions: desfaz em ordem reversa
        this.logger.error(`Saga failed at step ${step.name}. Compensating...`);
        for (const completed of completedSteps.reverse()) {
          try {
            await completed.step.compensate(context, completed.result);
          } catch (compensateError) {
            // Compensacao falhou: log critico + alerta humano
            this.logger.critical(`Compensation failed for step ${completed.step.name}`, compensateError);
            await this.alertService.sendCritical({
              message: `Saga compensation failed. Manual intervention required.`,
              sagaId: context.correlationId,
              step: completed.step.name,
              error: compensateError,
            });
          }
        }
        return { success: false, failedStep: step.name, error, compensated: true };
      }
    }

    return { success: true, results: completedSteps.map(s => s.result) };
  }
}
```

### 10.3 Idempotency

```typescript
// src/mcp/orchestration/idempotency.service.ts

// Tabela Supabase: idempotency_keys
// - key (PK), result (jsonb), created_at, expires_at (TTL 24h)

export class IdempotencyService {
  async executeIdempotent<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<{ result: T; fromCache: boolean }> {
    // 1. Verifica se key ja existe
    const existing = await this.db.query(
      'SELECT result FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()',
      [key],
    );
    if (existing) return { result: existing.result as T, fromCache: true };

    // 2. Executa operacao
    const result = await operation();

    // 3. Salva resultado (INSERT com ON CONFLICT DO NOTHING para race condition)
    await this.db.query(
      `INSERT INTO idempotency_keys (key, result, expires_at) 
       VALUES ($1, $2, NOW() + INTERVAL '24 hours') 
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(result)],
    );

    return { result, fromCache: false };
  }
}
```

---

## 11. CLAUDE AI INTEGRATION

### 11.1 System Prompt Builder

```typescript
// src/mcp/ai/services/prompt-builder.service.ts

export class PromptBuilderService {
  async buildSystemPrompt(companyId: string): Promise<string> {
    const company = await this.companyRepo.findById(companyId);
    const rules = await this.rulesRepo.getActiveRules(companyId);
    const recentDecisions = await this.suggestionsRepo.getRecentDecisions(companyId, 5);
    const categoryMap = await this.categoryRepo.getMappings(companyId);

    return `Voce e um assistente financeiro especializado em conciliacao bancaria para a empresa ${company.name} (${company.cnpj}).

CONTEXTO DA EMPRESA:
- Setor: ${company.sector}
- Regime tributario: ${company.taxRegime}
- Bancos: ${company.bankAccounts.map(b => b.name).join(', ')}
- Gateways: ${company.gateways.join(', ')}
- Categorias de despesa mais usadas: ${categoryMap.slice(0, 10).map(c => c.tinyCategory).join(', ')}

REGRAS DE NEGOCIO:
- NUNCA baixar conta pelo "Caixa" generico. Sempre usar conta bancaria especifica.
- Tipo LIMIT na Conta Simples = transferencia entre contas, NAO e receita/despesa.
- Pagar.me: so considerar recebido quando aparecer no extrato bancario (D+30 cartao, D+1 PIX).
- Marcador CLAUDE deve ser adicionado a tudo que voce criar/alterar.
- Tolerancia padrao de matching: R$0.05 para valor, 2 dias para data.

${rules.map(r => `REGRA: ${r.name} - ${r.description}`).join('\n')}

EXEMPLOS DE DECISOES ANTERIORES (few-shot):
${recentDecisions.map(d => this.formatDecisionExample(d)).join('\n---\n')}

FORMATO DE RESPOSTA: JSON conforme o schema da tool acionada.
Sempre inclua "confidence" (0.0-0.99, nunca 1.0) e "razao" explicando sua decisao.`;
  }

  private formatDecisionExample(decision: AiSuggestion): string {
    return `Transacao bancaria: ${decision.bankTransaction.description}, R$${decision.bankTransaction.amount}, ${decision.bankTransaction.date}
Candidato: ${decision.conta.historico}, R$${decision.conta.valor}, ${decision.conta.vencimento}
Confidence: ${decision.confidence}
Decisao: ${decision.status === 'accepted' ? 'ACEITO' : 'REJEITADO'}
${decision.reviewerNotes ? `Nota do revisor: ${decision.reviewerNotes}` : ''}`;
  }
}
```

### 11.2 Human-in-the-Loop

```typescript
// src/mcp/ai/services/human-approval.service.ts

export class HumanApprovalService {
  /**
   * Determina se a operacao precisa de aprovacao humana.
   * Regras:
   * - riskLevel 'critical' -> SEMPRE aprovacao
   * - riskLevel 'write' + valor > threshold da empresa -> aprovacao
   * - confidence < 0.80 na sugestao IA -> aprovacao
   * - Primeira vez executando esse tipo de operacao -> aprovacao
   */
  async requiresApproval(
    tool: McpToolDefinition,
    input: unknown,
    context: McpExecutionContext,
    aiConfidence?: number,
  ): Promise<{ required: boolean; reason?: string; approvers?: string[] }> {
    if (tool.riskLevel === 'critical') {
      return {
        required: true,
        reason: `Operacao critica: ${tool.name}`,
        approvers: await this.getApprovers(context.companyId, tool.name, input),
      };
    }

    if (tool.riskLevel === 'write') {
      const amount = this.extractAmount(input);
      const threshold = await this.getApprovalThreshold(context.companyId, tool.category);
      if (amount && amount > threshold) {
        return {
          required: true,
          reason: `Valor R$${amount} acima do threshold R$${threshold}`,
          approvers: await this.getApprovers(context.companyId, tool.name, input),
        };
      }
    }

    if (aiConfidence !== undefined && aiConfidence < 0.80) {
      return {
        required: true,
        reason: `Confianca IA ${(aiConfidence * 100).toFixed(0)}% abaixo do minimo 80%`,
      };
    }

    return { required: false };
  }
}
```

### 11.3 Confidence Scoring (Post-Processing)

```typescript
// src/mcp/ai/services/confidence-scoring.service.ts

export class ConfidenceScoringService {
  /**
   * Post-processing do confidence retornado pelo Claude:
   * - Boost +0.10 se valor e identico (diferenca < R$0.05)
   * - Penalize -0.10 se gap de data > 15 dias
   * - Penalize -1.00 se direction mismatch (credito tentando match com CR, ou debito com CP errado)
   * - Cap em 0.99 (nunca 1.0 para decisoes de IA)
   * - Boost +0.05 se pattern historico confirma (mesmo fornecedor ja teve match aceito)
   */
  adjustConfidence(
    rawConfidence: number,
    bankTransaction: BankTransaction,
    candidate: TinyContaPagarOuReceber,
    companyHistory: PatternHistory,
  ): number {
    let adjusted = rawConfidence;

    // Amount match
    const amountDiff = Math.abs(bankTransaction.amount) - candidate.valor;
    if (Math.abs(amountDiff) < 0.05) adjusted += 0.10;

    // Date gap
    const dateGap = Math.abs(
      bankTransaction.transactionDate.getTime() - new Date(candidate.vencimento).getTime()
    ) / (1000 * 60 * 60 * 24);
    if (dateGap > 15) adjusted -= 0.10;

    // Direction mismatch
    const isCredit = bankTransaction.amount > 0;
    const isCR = candidate.tipo === 'receber';
    if (isCredit !== isCR) adjusted -= 1.0;

    // Historical pattern
    const hasPattern = companyHistory.hasAcceptedMatch(
      candidate.fornecedorCpfCnpj || candidate.clienteCpfCnpj,
      bankTransaction.description,
    );
    if (hasPattern) adjusted += 0.05;

    // Cap
    return Math.max(0, Math.min(0.99, adjusted));
  }
}
```

### 11.4 Cost Control

```typescript
// src/mcp/ai/services/cost-tracking.service.ts

export class CostTrackingService {
  // Precos Claude claude-sonnet-4-20250514 (conforme PRD):
  // Input: $3.00 / 1M tokens
  // Output: $15.00 / 1M tokens
  // Cache: $0.30 / 1M tokens (prompt caching)

  async trackUsage(companyId: string, usage: { promptTokens: number; completionTokens: number; model: string }): Promise<void> {
    const costUsd =
      (usage.promptTokens / 1_000_000) * 3.0 +
      (usage.completionTokens / 1_000_000) * 15.0;

    await this.db.query(
      `INSERT INTO ai_usage_log (company_id, prompt_tokens, completion_tokens, model, cost_usd, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [companyId, usage.promptTokens, usage.completionTokens, usage.model, costUsd],
    );

    // Check daily cap
    const todayTotal = await this.getTodayCost(companyId);
    const dailyCap = await this.getDailyCap(companyId);
    if (todayTotal + costUsd > dailyCap) {
      throw new McpError({
        code: 'DAILY_COST_CAP_EXCEEDED',
        message: `Daily AI cost cap of $${dailyCap} exceeded. Today: $${(todayTotal + costUsd).toFixed(4)}`,
        retryable: false,
      });
    }
  }

  // Fallback: se Claude falha ou cap excedido, usar regras deterministicas
  async shouldUseFallback(companyId: string): Promise<boolean> {
    const todayCost = await this.getTodayCost(companyId);
    const dailyCap = await this.getDailyCap(companyId);
    const recentErrors = await this.getRecentErrorCount(companyId, 60); // ultimos 60 min
    return todayCost >= dailyCap * 0.9 || recentErrors > 5;
  }
}
```

---

## 12. MCP GATEWAY MODULE (Roteamento Central)

```typescript
// src/mcp/gateway/mcp-gateway.module.ts

@Module({
  imports: [
    TinyMcpModule,
    BanksMcpModule,
    GatewaysMcpModule,
    CommunicationMcpModule,
    AiMcpModule,
    DocumentsMcpModule,
    ComplianceMcpModule,
    AccountingMcpModule,
  ],
  providers: [
    McpGatewayService,
    McpToolRegistry,
    McpAuditInterceptor,
    McpRateLimitGuard,
    McpApprovalGate,
  ],
  controllers: [McpSseController], // SSE endpoint para Claude
})
export class McpGatewayModule {}

// src/mcp/gateway/mcp-gateway.service.ts

export class McpGatewayService {
  constructor(
    private readonly registry: McpToolRegistry,
    private readonly audit: McpAuditInterceptor,
    private readonly rateLimit: McpRateLimitGuard,
    private readonly approval: McpApprovalGate,
    private readonly idempotency: IdempotencyService,
  ) {}

  async executeTool(toolName: string, input: unknown, context: McpExecutionContext): Promise<McpToolResult<unknown>> {
    const tool = this.registry.getTool(toolName);
    if (!tool) throw new McpError({ code: 'TOOL_NOT_FOUND', message: `Tool ${toolName} not found`, retryable: false });

    // 1. Validate input against schema
    const validation = this.validateSchema(tool.inputSchema, input);
    if (!validation.valid) throw new McpError({ code: 'VALIDATION', message: validation.errors.join(', '), retryable: false });

    // 2. Rate limit check
    await this.rateLimit.check(tool.rateLimitKey || toolName, context.tenantId);

    // 3. Idempotency check (se aplicavel)
    if (tool.idempotencyKeyField && input[tool.idempotencyKeyField]) {
      return this.idempotency.executeIdempotent(
        `${toolName}:${input[tool.idempotencyKeyField]}`,
        () => this.executeWithAudit(tool, input, context),
      );
    }

    return this.executeWithAudit(tool, input, context);
  }

  private async executeWithAudit(tool: McpToolDefinition, input: unknown, context: McpExecutionContext): Promise<McpToolResult<unknown>> {
    // 4. Approval gate (se necessario)
    const approvalCheck = await this.approval.check(tool, input, context);
    if (approvalCheck.required) {
      // Cria approval request e retorna status pending
      const requestId = await this.approval.createRequest(tool, input, context, approvalCheck.approvers);
      return {
        success: false,
        error: {
          code: 'APPROVAL_REQUIRED',
          message: `Operacao requer aprovacao. Request ID: ${requestId}. Razao: ${approvalCheck.reason}`,
          retryable: false,
        },
        metadata: { executionTimeMs: 0, provider: tool.name, apiVersion: '1.0', approvalRequestId: requestId },
      };
    }

    // 5. Execute
    const startTime = Date.now();
    try {
      const executor = this.registry.getExecutor(tool.name);
      const result = await executor.execute(input, context);

      // 6. Audit log
      await this.audit.log({
        action: `mcp.${tool.name}`,
        entityType: tool.category,
        actorId: context.userId,
        actorType: context.actorType,
        input: this.sanitize(input), // remove tokens/secrets
        output: result.success ? { success: true } : { error: result.error?.code },
        correlationId: context.correlationId,
        executionTimeMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      await this.audit.log({
        action: `mcp.${tool.name}.error`,
        entityType: tool.category,
        actorId: context.userId,
        actorType: context.actorType,
        input: this.sanitize(input),
        output: { error: error.message },
        correlationId: context.correlationId,
        executionTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

---

## 13. TESTING STRATEGY (Todos os MCPs)

| Nivel | Ferramenta | Escopo | Frequencia |
|-------|-----------|--------|-----------|
| Unit | Jest + ts-mockito | Transformacao de dados, validacao de schema, logica de matching | PR check |
| Integration | Jest + nock/msw | Cada adapter contra fixtures (respostas gravadas das APIs reais) | PR check |
| Contract | JSON Schema validator | inputSchema/outputSchema vs dados reais | PR check |
| E2E Sandbox | Jest + Supabase local | Pipeline completo: import OFX -> sync Tiny -> conciliar -> baixar | Nightly |
| E2E Staging | Credenciais staging | Chamada real a APIs com dados de teste | Weekly |
| Load | k6 ou Artillery | Rate limiter, circuit breaker, queue behavior | Pre-release |

Para cada adapter, fixtures sao gravadas de respostas reais (com dados sanitizados) e versionadas no repositorio sob `test/fixtures/{provider}/`.

---

## 14. SECURITY MATRIX

| Aspecto | Implementacao |
|---------|-------------|
| Credenciais at rest | AES-256-GCM, IV unico por operacao, key derivation HKDF com companyId como salt |
| Credenciais in transit | TLS 1.3, nunca em query params |
| Credenciais em logs | Middleware de sanitizacao: regex para patterns token/secret/key/password/api_key |
| Credenciais em memory | Zeradas apos uso (buffer.fill(0)) |
| Multi-tenant isolation | Supabase RLS: `org_id = get_org_id()` em todas as tabelas |
| API keys rotation | Endpoint para rotacao, notifica admin, invalida chave antiga apos 24h grace period |
| Audit trail | Insert-only, particionado por mes, RLS SELECT only, zero UPDATE/DELETE |
| Rate limiting | Por tenant E por provider, Redis sliding window |
| Input validation | ajv strict mode contra JSON Schema, sanitizacao de strings |

---

## 15. PLANO DE IMPLEMENTACAO SEQUENCIADO

### Fase 1 (Sprint 1-2): Foundation
1. `SharedMcpModule` com interfaces, credential vault, circuit breaker, rate limiter
2. `McpGatewayModule` com tool registry, audit interceptor, approval gate
3. `TinyMcpModule` com V2 client (read tools: listar CP/CR/contatos/NFs)

### Fase 2 (Sprint 3-4): Core Integrations
4. `TinyMcpModule` write tools (criar CP/CR, baixar)
5. `BanksMcpModule` com adapters Sicoob OFX + Conta Simples API
6. `GatewaysMcpModule` com adapter Pagar.me

### Fase 3 (Sprint 5-6): AI + Communication
7. `AiMcpModule` com conciliar, categorizar, duplicata.detectar
8. `CommunicationMcpModule` com Gupshup WhatsApp + email
9. Saga orchestration para cobranca automatizada

### Fase 4 (Sprint 7-8): Extended
10. `DocumentsMcpModule` com OCR + NF-e parser
11. `ComplianceMcpModule` com CNPJ/CPF
12. `AccountingMcpModule` com exportacao + DRE
13. Adapters adicionais: AppMax, Inter, Nubank, Cielo, Stone

### Fase 5 (Sprint 9-10): Production Hardening
14. Health checks para todos os MCPs
15. Monitoring dashboard (circuit breaker states, rate limit headroom, API latencies)
16. Cost tracking e daily caps para Claude
17. Load testing e tuning de concurrency
18. Documentation (OpenAPI/Swagger para todas as tools)

---

### Critical Files for Implementation

- C:\CLAUDECODE\CONCILIADOR FINANCEIRO\PROCESSOS_FINANCEIRO.md
- C:\CLAUDECODE\CONCILIADOR FINANCEIRO\PRD_BPO_FINANCEIRO.md
- C:\CLAUDECODE\CONCILIADOR FINANCEIRO\criar_contas_pagar.js
- C:\CLAUDECODE\CONCILIADOR FINANCEIRO\ler_todos_ofx.js
- C:\CLAUDECODE\CONCILIADOR FINANCEIRO\conciliacao_titulos.js

---

# PARTE VIII — VISÃO ESTRATÉGICA: DE CONCILIADOR PARA SISTEMA OPERACIONAL FINANCEIRO

## O Salto

O produto NÃO é um "conciliador financeiro inteligente".
O produto é um **sistema operacional financeiro para PMEs e BPOs**.

Conciliador resolve uma dor técnica.
Sistema operacional financeiro comanda rotina, decisão, caixa, cobrança, fechamento e governança.

A promessa simples: **"Eu faço seu financeiro rodar com menos gente, menos erro, caixa previsível e fechamento mensal confiável."**

## 10 Camadas de Poder (evolução pós-MVP)

### 1. FINANCEIRO AUTÔNOMO — Motor de Decisão com Ações Recomendadas

O sistema não deve só mostrar pendência. Ele deve dizer: **"Faça isso agora, senão tal problema vai acontecer."**

Motor de decisão com ações recomendadas:
- Pagar agora
- Segurar pagamento
- Cobrar cliente
- Antecipar recebível
- Renegociar fornecedor
- Bloquear compra
- Revisar categoria
- Pedir documento
- Fechar mês
- Escalar para gestor

Isso muda o produto de "sistema de conciliação" para **copiloto financeiro operacional**.

### 2. COCKPIT DIÁRIO DO DONO

PME não vai entrar para ver tabela. Ela precisa abrir e ver:

**Hoje:**
- Dinheiro em caixa
- Contas que vencem
- Recebíveis esperados
- Clientes atrasados
- Risco dos próximos 7 dias
- Decisões pendentes

**Essa semana:**
- Caixa projetado
- Buraco futuro
- Pagamentos críticos
- Cobranças prioritárias

**Esse mês:**
- Resultado parcial
- Margem
- Despesas fora do padrão
- Meta de faturamento vs realizado
- Lucro previsto

O dono quer resposta, não BI.

### 3. GOVERNANÇA DE PAGAMENTO — Sistema de Aprovação de Dinheiro

Fluxo completo:
1. Conta entra
2. Sistema classifica
3. Anexa documento
4. Valida duplicidade
5. Verifica caixa futuro
6. Recomenda pagar ou segurar
7. Envia para aprovação
8. Gera lote
9. Baixa
10. Concilia
11. Registra auditoria

Isso vira governança de pagamento — muito mais valioso que conciliação.

### 4. MOTOR DE COBRANÇA CONECTADO AO CAIXA

Não é "listar inadimplentes". Tem que priorizar por IMPACTO:
- Cliente com maior valor vencido
- Cliente com maior chance de pagar
- Cliente que destrava o caixa da semana
- Cliente recorrente que está mudando comportamento
- Cliente estratégico
- Cobrança que evita saldo negativo

Régua automática com inteligência:
- Lembrete antes do vencimento
- Cobrança no vencimento
- Cobrança humanizada após atraso
- Promessa de pagamento
- Renegociação
- Escalonamento
- Bloqueio comercial

ROI direto: **entrou dinheiro mais rápido**.

### 5. FECHAMENTO MENSAL BLINDADO

Botão: **"Fechar competência"**

Antes verifica:
- Banco 100% conciliado
- CP/CR sem divergência
- Lançamentos sem categoria
- Documentos ausentes
- Impostos provisionados
- Folha lançada
- Intercompany eliminado
- Pró-labore registrado
- Distribuição de lucros registrada
- DRE validado
- Caixa inicial/final conferido

Depois trava o mês. Reabertura com motivo. Isso é onde o software começa a parecer adulto.

### 6. SCORE DE MATURIDADE FINANCEIRA (0-100)

Cada empresa recebe nota:
- Conciliação em dia
- Documentos completos
- Contas vencidas
- Inadimplência
- Despesas sem categoria
- Caixa projetado positivo
- Margem saudável
- Dependência de poucos clientes
- Atraso no fechamento
- Previsibilidade de recebimento

Você não vende "conciliação". Você vende: **"Sua empresa saiu de nota 42 para 78 em 90 dias."**

### 7. BENCHMARK ENTRE EMPRESAS (anonimizado)

Com múltiplas PMEs no sistema:
- Sua inadimplência está acima da média
- Seu gasto com marketing é alto para sua margem
- Seu prazo médio de recebimento piorou
- Seu caixa mínimo está baixo
- Seu custo fixo está pesado
- Sua margem está abaixo do padrão do segmento

Dados anonimizados. Fosso competitivo — o concorrente não tem esse banco de inteligência.

### 8. MODO BPO ESCALA — Tela do Gestor

- Clientes por analista
- Tarefas atrasadas
- Fechamento por competência
- SLA por cliente
- Pendências por responsável
- Produtividade
- Retrabalho
- Erro por analista
- Horas gastas por cliente
- Margem operacional por cliente

**"Este cliente paga R$1.500/mês, mas consome 18 horas. Ele é prejuízo."**

### 9. PRECIFICAÇÃO AUTOMÁTICA DO BPO

Baseado em esforço medido:
- Quantidade de contas bancárias
- Volume de transações
- Volume de documentos
- Número de empresas
- Integrações
- Complexidade fiscal
- Quantidade de usuários
- Frequência de fechamento
- Nível de atendimento

**"Cliente A deveria pagar R$2.800/mês, não R$1.200."**

Transforma o software em máquina de margem para BPO.

### 10. AGENTE FINANCEIRO COM MEMÓRIA OPERACIONAL

Não chatbot idiota. Um agente que SABE:
- O que aconteceu no mês passado
- Quais clientes sempre atrasam
- Quais fornecedores são críticos
- Qual pagamento não pode atrasar
- Quais categorias explodiram
- Quais contas estão sem documento
- Quais decisões o dono costuma tomar

Exemplo de comando: "Posso pagar esses fornecedores hoje?"

Resposta boa: "Pode pagar A e B. Não pague C hoje. Se pagar C, seu caixa fica negativo em 6 dias considerando a folha de sexta. Melhor renegociar C para dia 20 ou cobrar os clientes X e Y primeiro."

## Ordem de Evolução Pós-MVP

1. Fechamento mensal blindado
2. Portal do cliente/dono
3. Aprovação de pagamentos
4. Cobrança inteligente
5. Cockpit diário de decisão
6. BPO Ops: SLA, analistas, produtividade
7. Score de maturidade financeira
8. Precificação automática do BPO
9. Benchmark anonimizado
10. Agente financeiro com memória e recomendações

O que NÃO fazer cedo demais: mil integrações, app mobile, dashboard bonito ou IA demais. Isso seria vaidade técnica.
