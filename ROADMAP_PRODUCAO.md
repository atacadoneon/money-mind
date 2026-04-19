# MONEY MIND — ROADMAP PARA PRODUÇÃO 100%

> Documento brutal sobre o que tem, o que falta, e o que custa chegar em produção real.
> Data: 2026-04-14

---

## 1. RESUMO EXECUTIVO

### O que você tem hoje
**MVP foundation compilável.** 232 arquivos TypeScript (97 api + 100 web + 35 packages), 26 tabelas, 21 rotas web, 18 módulos backend, CI/CD configurado, docs e scripts prontos.

### O que isso significa
Você tem um **scaffold profissional** com CRUD básico funcionando para CP/CR/contatos/cadastros, auth Supabase estruturada, upload OFX parsing básico, e esqueleto de conciliação. **Não é um produto pronto para cliente pagante.**

### Para chegar em produção real (100%)
- **Backend**: hoje ~1.000 linhas de services → precisa **~15–25 mil linhas** para cobrir PRD (31k linhas de specs)
- **Frontend**: hoje 21 rotas básicas → precisa **completar 80+ páginas/subtelas** do Tiny
- **Integrações**: hoje 0 reais → precisa **8 MCPs** com credenciais vivas
- **Qualidade**: hoje 3 testes → precisa **>800 testes** (80% coverage)
- **Tempo realista para GA (General Availability)**: **6–9 meses** com equipe de 3–5 devs full-time

---

## 2. O QUE ESTÁ 100% PRONTO

### Infraestrutura e scaffold
- ✅ Monorepo Turborepo + pnpm workspaces (6 projetos)
- ✅ TypeScript strict em toda cadeia
- ✅ ESLint + Prettier + commitlint + husky pre-commit
- ✅ Docker Compose dev (Postgres 16 + Redis 7 + pgAdmin)
- ✅ Dockerfiles prod (api + web multi-stage)
- ✅ GitHub Actions CI (install + lint + typecheck + test + build matrix)
- ✅ Deploy blueprints (render.yaml + vercel.json)
- ✅ Scripts automação (bootstrap, reset, backup, healthcheck) — bash + PowerShell

### Database
- ✅ 9 migrations SQL idempotentes → **26 tabelas**
- ✅ RLS ativo em todas (isolamento por `org_id` via `get_org_id()`)
- ✅ Trigram GIN em `historico`, `fornecedor_nome`, `cliente_nome`
- ✅ Triggers `set_updated_at` automáticos
- ✅ Soft delete universal (`deleted_at IS NULL`)
- ✅ Particionamento mensal em `audit_log` (24 partições 2026–2027)
- ✅ Trigger de imutabilidade em audit
- ✅ `reconciliations.diferenca` como GENERATED column
- ✅ Seed: Grupo Lauxen + 5 empresas + ~40 categorias DRE + formas pagamento + 5 contas bancárias

### Backend (apps/api) — módulos com CRUD funcional
- ✅ Auth Supabase Guard + OrgContextGuard + RolesGuard (owner/admin/accountant/viewer)
- ✅ Organizations module (CRUD)
- ✅ Companies module (CRUD + criptografia AES-256-GCM para tokens)
- ✅ Contatos module (CRUD + busca trigram + tipo F/J)
- ✅ Categorias module (CRUD + hierarquia)
- ✅ Formas-pagamento module (CRUD)
- ✅ Marcadores module (tags coloridas)
- ✅ Contas-bancarias module (CRUD)
- ✅ Contas-pagar module (CRUD + filtros + tabs de status)
- ✅ Contas-receber module (CRUD + filtros)
- ✅ Audit-log module (interceptor automático)
- ✅ Health module (liveness/readiness)
- ✅ Swagger/OpenAPI em `/docs`
- ✅ BullMQ + Redis (estrutura)
- ✅ Helmet + CORS + ValidationPipe global

### Frontend (apps/web) — 21 rotas
- ✅ Auth: login, register (Supabase SSR)
- ✅ Layout: sidebar 240/56px + topbar + company selector + Cmd+K palette
- ✅ Dashboard `/inicio` (KPIs + gráficos)
- ✅ Cadastros: clientes-fornecedores (lista + detalhe), categorias (hierárquica), formas-pagamento
- ✅ Finanças: CP, CR (filtros, bulk actions, modais nova/baixar)
- ✅ Extratos bancários (upload dropzone OFX + drill-down)
- ✅ Conciliação (split-screen básico com click-to-match)
- ✅ Caixa, conta-digital, transacoes-vendas, cobrancas, relatórios (estrutura)
- ✅ Configurações (empresas, integrações com tokens masked, usuários, plano)
- ✅ Design system shadcn/ui + Tailwind + dark mode
- ✅ TanStack Query + Zustand
- ✅ Formatação pt-BR (R$, dd/MM/yyyy)

### Packages compartilhados
- ✅ `@money-mind/shared-types`: 21 arquivos (entities + enums + DTOs)
- ✅ `@money-mind/utils`: currency, date, cpf-cnpj, trigram, encryption AES-256-GCM, ofx stub, cep
- ✅ `@money-mind/config`: eslint preset, tailwind preset, tsconfig preset

### Documentação (docs/)
- ✅ ARCHITECTURE, API, DATABASE, DEPLOYMENT, GETTING_STARTED, CONTRIBUTING, SECURITY, RUNBOOK, MONITORING, OBSERVABILITY
- ✅ 7 ADRs (monorepo, supabase, nestjs, typeorm, shadcn, RLS, bullmq)

---

## 3. O QUE ESTÁ PARCIAL (scaffold / stub)

> Tem a estrutura mas a lógica real não foi implementada.

### Backend — implementação superficial
| Módulo | Linhas service | O que falta |
|---|---|---|
| Reconciliation Engine | 68 | Motor real das 4 camadas (hoje só interface). Pattern matching com trigram + ML. Matching batch. Tolerância configurável. Sugestões com confidence. |
| OFX Parser | 60 | Suporte completo FITID, parsing de múltiplos bancos brasileiros (Sicoob, Itaú, Bradesco, BB, Santander). Dedup por hash. Tratamento de erros. |
| Workers BullMQ | 24 | `tiny-sync`, `extrato-parse`, `reconciliation`, `ai-suggest` têm só 1 linha com TODO. Precisa: retry policy, DLQ, monitoring, backoff exponencial. |
| Auth Service | 39 | Só validação JWT Supabase. Falta: invite flow, reset senha, MFA, API keys, service accounts, session mgmt. |
| Contas-pagar baixar/estornar | — | Endpoints existem mas lógica de baixa com banco origem + criação de pagamento record não está completa. |
| Contas-receber recebimentos | — | Mesmo problema — endpoint stub. |
| Bulk actions | — | `bulk-update`, `bulk-delete`, `bulk-baixar` só retornam 200 sem processar. |
| Import CSV/XLSX | — | Endpoint existe, parser real não. |
| Export XLSX | — | Stub que retorna buffer vazio. |
| Gerar remessa bancária | — | Não existe (nem CNAB 240 nem 400). |
| Buscar boletos DDA | — | Não existe. |

### Frontend — telas com dados mock
| Tela | Status | O que falta |
|---|---|---|
| `/financas/caixa` | mock | Endpoint backend real + conciliação com extrato |
| `/financas/conta-digital` | mock | Integração real com bancos (Sicoob/Olist/ContaSimples) |
| `/financas/transacoes-vendas` | mock | Integração Pagar.me/AppMax real |
| `/financas/cobrancas-bancarias` | mock | Geração boleto + tracking status |
| `/financas/reconciliation/suggestions` | mock | IA real sugerindo matches |
| `/financas/relatorios` (DRE, fluxo caixa) | mock | Queries SQL complexas + gráficos reais |
| Conciliação drag-to-match | parcial | Hoje é click-to-match, falta drag-n-drop @dnd-kit |
| DateRangePicker | placeholder | Hoje são 2 inputs, trocar por shadcn Calendar |
| Filtros avançados CP/CR | placeholder | Botão "Mais filtros" sem conteúdo |

### Qualidade
- ⚠️ Tests: ~3 unit tests totais. Target: **>800 tests** (80% coverage)
- ⚠️ E2E: **0**. Target: Playwright cobrindo top 10 fluxos críticos
- ⚠️ Load test: **0**. Target: k6 ou Artillery → 500 req/s sustentados
- ⚠️ Observability: Sentry/Pino/OpenTelemetry só em docs, não implementados

---

## 4. O QUE FALTA (mas está mapeado nos docs)

> Especificado no PRD (19.926 linhas) e ARQUITETURA (11.436 linhas) mas **não implementado**.

### 4.1. MCPs de integração (PARTE IV da arquitetura — 8 MCPs)
Cada um é um módulo NestJS separado + conexão real + retry/idempotência.

| MCP | O que faz | Esforço |
|---|---|---|
| **MCP 1 — Tiny ERP** | Sync V2 + V3 bidirecional: CP, CR, contatos, categorias, pedidos, notas. Tratamento dos bugs V3 (paginação loop). Queue de sync agendada. | 3–4 semanas |
| **MCP 2 — Bancos** | Open Banking / Sicoob API / Itaú API / BB API: saldo, extrato auto-download, Pix API, cobranças boletos, geração CNAB 240/400, retorno bancário. | 6–8 semanas |
| **MCP 3 — Gateways** | Pagar.me, AppMax, Stripe, Mercado Pago — ingestão de transações, conciliação de repasse. | 2–3 semanas |
| **MCP 4 — Comunicação** | WhatsApp Business API (Gupshup), SendGrid, Twilio SMS — cobrança automatizada, notificações, templates. | 2–3 semanas |
| **MCP 5 — AI/Claude** | Claude 4.6 API: sugestões conciliação, classificação automática histórico, extração OCR, chat financeiro. | 3–4 semanas |
| **MCP 6 — Docs/OCR** | XML NFe parsing, PDF boleto DDA, recibos, AWS Textract ou Google Vision. | 2–3 semanas |
| **MCP 7 — Receita Federal** | Consulta CNPJ, SPC/Serasa score, situação fiscal, Simples Nacional. | 1–2 semanas |
| **MCP 8 — Contabilidade** | Export SPED, Conta Azul, Omie, Contabilizei, planilha contábil mensal. | 2–3 semanas |
| **Gateway MCP** | Roteamento central, rate limit por tenant, circuit breaker, fallback. | 1–2 semanas |

**Total MCPs**: ~22–32 semanas de engenharia.

### 4.2. Features avançadas de Contas a Pagar (PRD parte II, 18 features)
| # | Feature | Esforço |
|---|---|---|
| F1 | Payment Orchestration Engine (plano diário) | 2 sem |
| F2 | Cash Float Maximizer (otimizador caixa) | 2 sem |
| F3 | Negociador desconto antecipado | 1 sem |
| F4 | Detector duplicatas com IA | 1 sem |
| F5 | Context-aware approval | 1 sem |
| F6 | Calendário financeiro Gantt | 2 sem |
| F7 | Payment batching inteligente | 1 sem |
| F8 | Supplier scoring | 2 sem |
| F9 | Alerta reajuste automático | 1 sem |
| F10 | Antecipação estratégica | 1 sem |
| F11 | Cash waterfall | 2 sem |
| F12 | PIX vs Boleto vs TED optimizer | 1 sem |
| F13 | Pagamento recorrente inteligente | 2 sem |
| F14 | Compliance pré-pagamento | 1 sem |
| F15 | Portal do fornecedor (área logada externa) | 4 sem |
| F16 | Previsão inadimplência fornecedor | 2 sem |
| F17 | Split pagamento | 1 sem |
| F18 | Histórico negociações | 1 sem |

**Total CP avançado**: ~28 semanas.

### 4.3. Features de CR (análogas)
- Cobrança inteligente régua automática
- Score de cliente
- Forecast de recebimento
- Split de comissões
- Antecipação de recebíveis (simulador)
- Múltiplos gateways com roteamento
- Dunning management (cobrança escalonada)
- ~**15–20 semanas**

### 4.4. Inteligência financeira (PRD parte B)
- Análise vertical/horizontal DRE automatizada
- Benchmarking entre empresas do grupo
- Previsão de fluxo 12 meses com ML
- Alertas proativos (cash shortage iminente)
- Sugestões de economia
- Detecção de anomalias
- ~**12–16 semanas**

### 4.5. Micro-interações UX (14 especificadas)
Drag-to-match polido, reconciliation ritual, split-screen resize, filter chips, AI suggestion reveal, command palette avançada, notification stack, dark/light animado, empty state animations.
- ~**6–8 semanas** de front senior

### 4.6. Reporting avançado
- DRE gerencial + fiscal
- Fluxo de caixa direto e indireto
- Balanço patrimonial simplificado
- Exportação PDF profissional (puppeteer + template)
- Excel formatado com fórmulas
- Agendamento envio email
- Apresentação executiva (deck auto-gerado)
- ~**6–8 semanas**

### 4.7. Mobile / PWA (PRD parte G)
- PWA completo com service worker
- Push notifications
- Offline-first
- App React Native (opcional)
- ~**8–12 semanas**

### 4.8. White-label e multi-tenancy avançada (PRD parte H)
- Tema customizável por org
- Domínio customizado
- Onboarding auto
- Self-service billing
- Subscription management (Stripe)
- Feature flags por plano
- ~**8–12 semanas**

---

## 5. O QUE NÃO ESTÁ NOS DOCS (mas precisa pra produção)

### 5.1. Produto/Comercial
- [ ] **Landing page de venda** (Framer, Webflow ou próprio Next)
- [ ] **Pricing page** com planos (Starter R$49, Pro R$149, Business R$449, Enterprise custom)
- [ ] **Onboarding wizard** (14 dias free trial, setup inicial, import inicial Tiny)
- [ ] **Help center** (Docusaurus, Mintlify ou Intercom Articles)
- [ ] **Changelog público** (release notes visíveis)
- [ ] **Status page** (status.moneymind.com.br — BetterStack ou StatusPage.io)
- [ ] **Suporte chat** (Intercom, Crisp ou Chatwoot self-hosted)
- [ ] **Demo playground** (conta demo com dados fake)
- [ ] **Video onboarding** (Loom ou embedded)
- [ ] **API pública documentada** (para integrar em ERPs e sistemas externos)
- [ ] **Webhooks** (cliente assina eventos: conta criada/paga/atrasada)

### 5.2. Billing / Cobrança do SaaS
- [ ] **Stripe ou Pagar.me** para cobrança recorrente
- [ ] **Trials de 14 dias**
- [ ] **Upgrade/downgrade de plano**
- [ ] **Dunning** (fluxo cobrança quando cartão falha)
- [ ] **Notas fiscais automáticas** (emissão NFSe por cliente)
- [ ] **Cupons e descontos**
- [ ] **Affiliate/referral program**
- [ ] **Usage-based pricing** (cobrar por transação conciliada ou empresa adicional)

### 5.3. LGPD / Compliance
- [ ] **Termos de uso** (assessoria jurídica)
- [ ] **Política de privacidade** (assessoria jurídica)
- [ ] **DPO designado** e contato público
- [ ] **Data Processing Agreement** (DPA) para clientes
- [ ] **Consent management** granular
- [ ] **Right to erasure** endpoint (apagar dados do titular)
- [ ] **Data portability** (export pessoal LGPD Art. 18)
- [ ] **Audit trail exportável** (quem acessou o quê, quando)
- [ ] **Anonimização** de dados em ambientes não-prod
- [ ] **Criptografia at-rest** confirmada (Supabase faz por default)
- [ ] **Data retention policy** (CP/CR expiradas: manter 5 anos conforme fiscal)
- [ ] **RPO/RTO definidos** (Recovery Point/Time Objective)
- [ ] **Ciber-seguro** contratado (R$300k–R$1M cobertura)

### 5.4. Segurança hardening
- [ ] **Pentesting externo** (Conviso, Tempest, ou bug bounty — R$15k–R$40k)
- [ ] **OWASP Top 10** checklist documentado e testado
- [ ] **Rate limiting** por endpoint + por tenant (hoje não tem)
- [ ] **Cloudflare** na frente (DDoS + WAF)
- [ ] **Secrets rotation** automático (Doppler, AWS Secrets Manager)
- [ ] **BYOK** opcional para Enterprise (AWS KMS, GCP KMS)
- [ ] **Backup diário testado** (restore drill mensal)
- [ ] **Disaster recovery** runbook com passos verificados
- [ ] **Principle of Least Privilege** em todos os papéis DB
- [ ] **2FA/MFA** obrigatório para owner/admin
- [ ] **Session timeout** configurável por plano
- [ ] **IP allowlist** para Enterprise
- [ ] **SSO/SAML** (Okta, Azure AD) para Enterprise
- [ ] **Audit log imutável** com cloud storage write-once (hoje tem partição, não tem WORM)

### 5.5. Qualidade e testes
- [ ] **>80% coverage unit** (hoje <5%)
- [ ] **E2E Playwright** top 20 fluxos (login → criar conta → baixar → conciliar)
- [ ] **Integration tests** com DB real (testcontainers)
- [ ] **Contract tests** (backend/frontend)
- [ ] **Load tests** k6 — 500 req/s sustentados por 1h
- [ ] **Chaos engineering** (Postgres down, Redis down, Supabase lag)
- [ ] **Visual regression** (Chromatic, Percy)
- [ ] **Accessibility audit** (WCAG 2.1 AA — axe-core CI)
- [ ] **i18n coverage** (pt-BR ✅, en-US e es-ES pendentes se for escalar fora)
- [ ] **Mutation testing** (Stryker) para lógica crítica
- [ ] **Lighthouse CI** (performance budget)

### 5.6. Observability em produção
- [ ] **Sentry** integrado (frontend + backend) com source maps
- [ ] **OpenTelemetry** traces end-to-end (Tempo, Honeycomb ou Datadog)
- [ ] **Pino** logs estruturados → shipping para Logtail/Datadog/ELK
- [ ] **Grafana** dashboards custom (Prometheus metrics)
- [ ] **Uptime monitoring** (Better Stack, Pingdom)
- [ ] **Real User Monitoring** (RUM) — frontend perceived performance
- [ ] **APM** (DataDog, New Relic ou Elastic APM)
- [ ] **Slow query log** Postgres monitorado
- [ ] **SLO definidos**: 99.9% uptime, p95 < 500ms, error rate < 0.1%
- [ ] **On-call rotation** (PagerDuty ou OpsGenie)
- [ ] **Error budget** com alertas

### 5.7. DevOps maturo
- [ ] **Preview deploys por PR** (Vercel faz, Render não — usar branch deploys)
- [ ] **Staging environment** separado de prod
- [ ] **Feature flags** (Unleash, PostHog, LaunchDarkly)
- [ ] **Blue-green** ou **canary deploys** em api
- [ ] **Database migration testing** (shadow DB, automated rollback)
- [ ] **Backup automation** (Supabase faz, validar restore mensal)
- [ ] **Secrets** fora de `.env` em prod (Vault ou Doppler)
- [ ] **Image scanning** (Trivy, Snyk) no CI
- [ ] **Dependency scanning** (Dependabot + Renovate)
- [ ] **SAST** (Semgrep, CodeQL) no PR
- [ ] **License compliance** (FOSSA) — uso OSS ok?

### 5.8. Escalabilidade
- [ ] **Read replicas** Postgres (Supabase Pro tem)
- [ ] **Connection pooling** (PgBouncer — Supabase Supavisor)
- [ ] **Redis cluster** para BullMQ em alta carga
- [ ] **CDN** estático (Bunny, Cloudflare R2)
- [ ] **Edge functions** Supabase para latência regional
- [ ] **Rate limit por plano** (Starter 100 req/min, Enterprise ilimitado)
- [ ] **Query optimization** (pg_stat_statements + index tuning)
- [ ] **Caching**: dashboard SWR + Redis cache para summaries pesados
- [ ] **Archive antigo** (mover CP/CR > 3 anos para cold storage)
- [ ] **Partitioning** de tabelas grandes (extrato_linhas por mês)

---

## 6. ROADMAP SUGERIDO POR FASES

### FASE 1 — MVP INTERNO (2–3 semanas) — para você usar primeiro
Objetivo: Everton usa no Grupo Lauxen para substituir trabalho manual que você faz hoje nos 5 CNPJs.

**Deliverables**:
1. Preencher CNPJs reais das 5 empresas no seed
2. Subir Supabase prod + Render api + Vercel web
3. Implementar **MCP 1 Tiny ERP** (V2 + V3) com sync real
4. Conciliation engine **camadas 1+2** (match exato + tolerância) funcionando
5. Import OFX real Sicoob e Olist
6. Baixar CP/CR real com conta origem (bug atual)
7. Bulk actions funcionais
8. Export XLSX funcional
9. Sentry + Pino logs
10. Testes críticos: baixa CP, baixa CR, conciliação

### FASE 2 — BETA FECHADO (1–2 meses)
Objetivo: 3–5 clientes beta não-pagantes validando o produto.

**Deliverables**:
1. MCP 2 Bancos (Sicoob + Itaú ao menos)
2. MCP 3 Gateways (Pagar.me + AppMax)
3. MCP 5 AI/Claude → sugestões conciliação com confidence
4. Conciliation camadas 3+4 (pattern matching + IA)
5. Relatórios DRE + Fluxo Caixa reais
6. Auth: invite, reset senha, MFA
7. Onboarding wizard
8. LGPD: termos, política, export pessoal
9. Sentry + OpenTelemetry + Grafana
10. E2E Playwright top 10 fluxos
11. Landing page de venda

### FASE 3 — GA (3–4 meses)
Objetivo: vender para qualquer empresa com Tiny.

**Deliverables**:
1. MCPs 4, 6, 7, 8
2. Features CP avançadas: F1, F2, F4, F6, F14, F15
3. Features CR avançadas: cobrança régua + dunning
4. Billing Stripe recorrente + trial 14 dias
5. Plans: Starter/Pro/Business/Enterprise
6. Help center + chat suporte
7. Status page pública
8. Pentesting + correções
9. Load test 500 req/s validado
10. SSO/SAML Enterprise
11. API pública + webhooks
12. PWA + push notifications

### FASE 4 — SCALE (6–12 meses pós-GA)
1. Features restantes CP (F3, F5, F7–F13, F16–F18)
2. Inteligência financeira (forecast 12m, anomalia, benchmarking)
3. White-label completo
4. Mobile app nativo (se demanda)
5. Multi-região (mercado LatAm)
6. Portal do fornecedor
7. Marketplace de integrações (partners)
8. Affiliate / revenue-share program

---

## 7. ESTIMATIVA DE RECURSOS

### Cenário A — Solo dev (Everton + IA)
- Fase 1: 2 meses part-time
- Fase 2: 4 meses
- Fase 3: 8 meses
- **Total até GA: 14 meses**

### Cenário B — Time enxuto (você + 1 full-stack + 1 product)
- Fase 1: 3 semanas
- Fase 2: 6 semanas
- Fase 3: 12 semanas
- **Total até GA: ~5 meses**
- Custo: ~R$60k–R$120k (2 senior devs por 5 meses CLT ou R$25k/mês PJ cada)

### Cenário C — Time agressivo (3 full-stack + 1 product + 1 designer)
- Fase 1: 2 semanas
- Fase 2: 4 semanas
- Fase 3: 8 semanas
- **Total até GA: ~3,5 meses**
- Custo: ~R$250k–R$400k investimento

### Custo de infra em prod (mensal)
| Serviço | Plano | Custo/mês |
|---|---|---|
| Supabase Pro | 2 org compute | US$ 25–100 |
| Render api | Standard 2GB | US$ 25 |
| Render Redis | Standard | US$ 15 |
| Vercel Pro | Team | US$ 20 |
| Cloudflare | Pro | US$ 20 |
| Sentry | Team | US$ 26 |
| Datadog ou Logtail | starter | US$ 40 |
| Stripe | por venda | 2,9% + R$0,39 |
| WhatsApp Gupshup | por msg | R$0,05–0,15 |
| Claude API | por uso | US$ 3/M tokens input |
| **Total fixo** | | **~US$ 170–250 (~R$850–1250)** |

---

## 8. RISCOS E BLOQUEADORES

### Técnicos
1. **Tiny V3 bug de paginação** (documentado em PROCESSOS_FINANCEIRO.md) — precisa mitigação robusta no MCP 1
2. **Reconciliation accuracy** — se IA erra demais, quebra confiança. Precisa threshold alto + fallback humano sempre visível.
3. **OFX brasileiro não-padrão** — cada banco tem variação. Testar com 5+ bancos reais antes de prometer.
4. **Latência Supabase pooler** — em alta carga, Supavisor pode gargalo. Ter plano B (RDS self-hosted).
5. **Idempotência sync Tiny** — se processar mesmo CP 2x cria duplicata. Usar `tiny_id` com UNIQUE + retry-seguro.

### Negócio
1. **Disputa com Tiny/Olist** — você está construindo camada em cima do ERP deles. Risco de mudarem API ou bloquearem acesso (tem histórico de API restritiva).
2. **Concorrência** — Conciliador da Conta Azul, Omie, Granatum. Precisa diferencial claro (IA + velocidade).
3. **CAC alto** — B2B financeiro tem venda consultiva. Precisa orçar aquisição.
4. **Churn se produto não for confiável** — erro em R$ é fatal. Precisa 99.99% correção em baixas.
5. **Regulatório** — se entrar em Open Banking oficial, precisa credenciamento BC (demora 6–12 meses, custa).

### Pessoal (Everton)
1. **Dispersão** — esse projeto compete com DarkSales, Atacado Neon, Engagge, RYU. Pergunta: é prioridade real ou distração?
2. **Subestimar operação pós-venda** — suporte de cliente financeiro é pesado (nota errada gera ligação imediata).
3. **Construir sem validar** — antes de fase 3, vender fase 1 pra 3 clientes beta e medir se pagam R$150/mês.

---

## 9. DECISÃO RECOMENDADA

**Parar de construir feature. Começar a validar comercialmente.**

O produto atual (MVP foundation) + Fase 1 (3 semanas) dá um produto **utilizável internamente**. Antes de investir mais 6 meses, faça:

1. **Semana 1–3**: Fase 1 (MCP Tiny + conciliação camadas 1+2 + subir em prod).
2. **Semana 4**: Usar no Grupo Lauxen 30 dias. Medir: quanto tempo você economiza?
3. **Semana 8**: Mostrar pra 5 empresas conhecidas (contadores, amigos empresários). Pedir: "pagaria R$149/mês por isso?"
4. **Semana 10**: Se 3+ disseram sim → seguir Fase 2. Se não → parar e iterar posicionamento.

**Gasto até essa decisão**: baixo (~R$5k–15k infra + tempo).
**Perda máxima**: 2,5 meses.
**Upside se validar**: produto com ~R$50k–150k MRR em 12 meses viáveis.

> Não construa fase 3 antes de validar fase 1 com clientes pagantes reais. Essa é a diferença entre SaaS que sobrevive e SaaS que vira portfolio de código.

---

## 10. CHECKLIST PRÉ-LAUNCH PRODUÇÃO (fase 3)

### Técnico
- [ ] Uptime 99.9% validado em staging por 30 dias
- [ ] Pentesting externo sem P0/P1 abertos
- [ ] Backup diário testado com restore drill
- [ ] Monitoring Sentry + APM + logs + uptime configurados
- [ ] Rate limiting por plano
- [ ] Secrets rotativos
- [ ] 80% coverage unit + E2E top 20
- [ ] Load test 2x pico esperado passou

### Legal
- [ ] Termos de uso e política de privacidade revisados por advogado
- [ ] DPA disponível
- [ ] LGPD compliant (audit, erasure, portability)
- [ ] Contrato SaaS padrão
- [ ] MSA/DPA para Enterprise

### Comercial
- [ ] Landing + pricing + demo
- [ ] Billing Stripe funcional
- [ ] Onboarding <15 min
- [ ] Help center com top 50 artigos
- [ ] Status page live
- [ ] Email transacional (SendGrid) com templates
- [ ] SLA publicado

### Operação
- [ ] On-call rotation definido
- [ ] Runbook de incidentes
- [ ] Comms template (email cliente em downtime)
- [ ] DPO contato
- [ ] Seguro cyber contratado

---

**Fim do documento. 31k linhas de spec → 6–9 meses de engenharia séria. Valida o mercado antes de queimar o investimento.**
