# BPO FINANCEIRO — DOCUMENTO DE ARQUITETURA TÉCNICA

## Stack Definida
- **Frontend**: Next.js 14 (App Router) + TypeScript strict + shadcn/ui + Tailwind CSS + TanStack Query + Zustand
- **Backend**: NestJS + TypeORM + class-validator + Swagger + BullMQ + Redis
- **Database**: PostgreSQL 16 (Supabase)
- **Monorepo**: Turborepo (apps/ + packages/)
- **Deploy**: Vercel (frontend) + Render (backend)

---

# PARTE I — ENTIDADES, SCHEMA, ENDPOINTS E COMPONENTES

> Mapeamento completo de cada tela do Tiny ERP com schema PostgreSQL, endpoints NestJS, DTOs e componentes Next.js.

---


---

# ARQUITETURA COMPLETA: Sistema BPO Financeiro — Replica Tiny ERP + Inteligencia

## 1. VISAO GERAL DA ARQUITETURA

O sistema replica as telas financeiras do Tiny ERP (Olist) com fidelidade visual absoluta e adiciona camadas de inteligencia (conciliacao automatica, pattern matching, IA). A stack definida -- Next.js 14 App Router no frontend, NestJS no backend, PostgreSQL 16 via Supabase -- suporta multi-tenant, RLS nativo, filas assincrona via BullMQ, e deploy split entre Vercel e Render.

A arquitetura e composta por 3 camadas principais:

```
VERCEL (Next.js 14 App Router + shadcn/ui + Tailwind)
   |
   | HTTPS REST + Supabase Realtime (WebSocket)
   |
RENDER (NestJS + BullMQ + Redis)
   |
   | TypeORM + Supabase Auth JWT validation
   |
SUPABASE (PostgreSQL 16 + RLS + Auth + Storage + Realtime)
```

O banco possui 25 tabelas divididas em 5 dominios: Core (organizacao/auth), Cadastros (contatos), Financeiro (CP/CR/caixa/cobrancas), Bancario (contas/extratos), e Operacional (categorias/marcadores/formas pagamento/relatorios).

---

## 2. ENTIDADES PRINCIPAIS — SCHEMA POSTGRESQL COMPLETO

### 2.1 TABELA: `organizations`

Representa o grupo economico (ex: Grupo Lauxen). Todas as demais tabelas referenciam `org_id`.

```sql
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#2563EB',
  plan            TEXT NOT NULL DEFAULT 'starter'
                    CHECK (plan IN ('starter','pro','business','enterprise')),
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_org_slug ON organizations(slug);
```

### 2.2 TABELA: `profiles`

Extende `auth.users` do Supabase.

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL,
  avatar_url      TEXT,
  phone           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 2.3 TABELA: `org_members`

Vincula usuarios a organizacoes com papeis.

```sql
CREATE TABLE org_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('owner','admin','accountant','viewer')),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);
```

### 2.4 TABELA: `companies`

Empresas do grupo (BlueLight, Industrias Neon, Atacado Neon, etc).

```sql
CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  nome_fantasia   TEXT,
  cnpj            VARCHAR(18),
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  slug            TEXT NOT NULL,
  color           TEXT DEFAULT '#3B82F6',
  is_active       BOOLEAN DEFAULT true,
  -- Credenciais encriptadas AES-256-GCM
  tiny_v2_token_enc       BYTEA,
  tiny_v3_client_id_enc   BYTEA,
  tiny_v3_client_secret_enc BYTEA,
  tiny_v3_access_token_enc  BYTEA,
  tiny_v3_refresh_token_enc BYTEA,
  conta_simples_key_enc     BYTEA,
  conta_simples_secret_enc  BYTEA,
  pagarme_sk_enc            BYTEA,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, slug),
  UNIQUE(org_id, cnpj)
);

CREATE INDEX idx_companies_org ON companies(org_id);
```

---

## 3. TELA 1 — MENU FINANCEIRO (SIDEBAR)

### 3A. Nao requer tabela propria

O menu e puramente componente frontend. A estrutura de navegacao e definida em constantes.

### 3D. Componentes Next.js

**Arvore de paginas (App Router):**

```
app/
  layout.tsx                    -- RootLayout (providers, fonts)
  (auth)/
    login/page.tsx              -- LoginPage
    register/page.tsx           -- RegisterPage
  (app)/
    layout.tsx                  -- AppLayout (sidebar + topbar + outlet)
    inicio/page.tsx             -- Dashboard
    cadastros/
      clientes-fornecedores/
        page.tsx                -- ContactListPage
        [id]/page.tsx           -- ContactEditPage
    finanças/
      caixa/page.tsx            -- CashFlowPage
      conta-digital/page.tsx    -- DigitalAccountPage
      transacoes-vendas/page.tsx -- SalesTransactionsPage
      contas-a-pagar/page.tsx   -- AccountsPayablePage
      contas-a-receber/page.tsx -- AccountsReceivablePage
      cobrancas-bancarias/page.tsx -- BankCollectionsPage
      extratos-bancarios/page.tsx  -- BankStatementsPage
      relatorios/page.tsx       -- ReportsPage
    configuracoes/
      page.tsx                  -- SettingsPage
```

**Componentes do sidebar:**

| Componente | Props | Descricao |
|---|---|---|
| `AppSidebar` | `collapsed: boolean, onToggle: () => void` | Container principal do menu lateral, 240px expanded / 56px collapsed |
| `SidebarSection` | `title: string, children: ReactNode` | Agrupamento com titulo (ex: "finanças") |
| `SidebarItem` | `href: string, icon: LucideIcon, label: string, badge?: { text: string, variant: 'info' \| 'success' \| 'new' }, isActive: boolean, isExpanded?: boolean, children?: SidebarItem[]` | Item individual do menu |
| `SidebarBadge` | `text: string, variant: 'info' \| 'success' \| 'new' \| 'beta'` | Badge "pix gratis", "Novo", "beta" |
| `SidebarToggle` | `collapsed: boolean, onToggle: () => void` | Botao expandir/colapsar no rodape |
| `CompanySelector` | `companies: Company[], selected: Company, onChange: (c: Company) => void` | Seletor de empresa no topo da sidebar |

**Definicao das rotas do menu financeiro (constante):**

```typescript
interface SidebarRoute {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: { text: string; variant: BadgeVariant };
  children?: SidebarRoute[];
}

const FINANCE_ROUTES: SidebarRoute[] = [
  { href: '/financas/caixa', label: 'Caixa', icon: Wallet },
  { href: '/financas/conta-digital', label: 'Conta Digital', icon: CreditCard, badge: { text: 'pix grátis', variant: 'success' } },
  { href: '/financas/credito', label: 'Crédito da Olist', icon: Banknote, badge: { text: 'Novo', variant: 'new' } },
  { href: '/financas/transacoes-vendas', label: 'Transações de vendas', icon: ShoppingCart },
  { href: '/financas/contas-a-pagar', label: 'Contas a Pagar', icon: ArrowDownCircle },
  { href: '/financas/contas-a-receber', label: 'Contas a Receber', icon: ArrowUpCircle },
  { href: '/financas/cobrancas-bancarias', label: 'Cobranças Bancárias', icon: FileText },
  { href: '/financas/extratos-bancarios', label: 'Extratos Bancários', icon: ScrollText },
  { href: '/financas/relatorios', label: 'Relatórios', icon: BarChart3 },
];
```

---

## 4. TELA 2 — CONTAS A PAGAR

### 4A. Entidade PostgreSQL: `contas_pagar`

```sql
CREATE TABLE contas_pagar (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identificadores externos
  tiny_id               BIGINT,
  numero_documento      TEXT,
  pedido_numero         TEXT,
  
  -- Fornecedor (referencia ou inline)
  contato_id            UUID REFERENCES contatos(id) ON DELETE SET NULL,
  fornecedor_nome       TEXT NOT NULL,
  fornecedor_nome_fantasia TEXT,
  fornecedor_cpf_cnpj   VARCHAR(18),
  
  -- Dados financeiros
  historico             TEXT,
  categoria_id          UUID REFERENCES categorias(id) ON DELETE SET NULL,
  categoria_nome        TEXT,
  valor                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_pago            NUMERIC(14,2) NOT NULL DEFAULT 0,
  
  -- Datas
  data_emissao          DATE,
  data_vencimento       DATE NOT NULL,
  data_pagamento        DATE,
  data_competencia      DATE,
  
  -- Status e classificacao
  situacao              TEXT NOT NULL DEFAULT 'aberto'
                          CHECK (situacao IN ('aberto','emitido','pago','parcial','atrasado','cancelado')),
  forma_pagamento_id    UUID REFERENCES formas_pagamento(id),
  forma_pagamento_nome  TEXT,
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),
  conta_origem          TEXT, -- nome exato no Tiny para baixa
  
  -- Buscador (campo especifico do Tiny)
  buscador              TEXT,
  buscador_status       TEXT CHECK (buscador_status IN ('pendente','liberado','bloqueado')),
  
  -- Marcadores
  marcadores            JSONB DEFAULT '[]',
  
  -- Conciliacao
  reconciliation_status TEXT DEFAULT 'pending'
                          CHECK (reconciliation_status IN ('pending','suggested','reconciled','ignored','reversed')),
  reconciliation_id     UUID,
  
  -- Parcela
  parcela_numero        INTEGER,
  parcela_total         INTEGER,
  parcela_grupo_id      UUID,
  
  -- Observacoes e anexos
  observacoes           TEXT,
  anexos                JSONB DEFAULT '[]',
  
  -- Integracao
  raw_data              JSONB,
  last_synced_at        TIMESTAMPTZ,
  sync_source           TEXT CHECK (sync_source IN ('tiny_v2','tiny_v3','manual','import')),
  
  -- Metadados
  created_by            UUID REFERENCES profiles(id),
  updated_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  
  UNIQUE(company_id, tiny_id)
);

-- Indices
CREATE INDEX idx_cp_org ON contas_pagar(org_id);
CREATE INDEX idx_cp_company ON contas_pagar(company_id);
CREATE INDEX idx_cp_situacao ON contas_pagar(situacao);
CREATE INDEX idx_cp_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX idx_cp_fornecedor ON contas_pagar(fornecedor_nome);
CREATE INDEX idx_cp_valor ON contas_pagar(valor);
CREATE INDEX idx_cp_reconciliation ON contas_pagar(reconciliation_status);
CREATE INDEX idx_cp_categoria ON contas_pagar(categoria_id);
CREATE INDEX idx_cp_contato ON contas_pagar(contato_id);
CREATE INDEX idx_cp_tiny_id ON contas_pagar(tiny_id);
CREATE INDEX idx_cp_historico_trgm ON contas_pagar USING gin(historico gin_trgm_ops);
CREATE INDEX idx_cp_fornecedor_trgm ON contas_pagar USING gin(fornecedor_nome gin_trgm_ops);
CREATE INDEX idx_cp_deleted ON contas_pagar(deleted_at) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_org_isolation ON contas_pagar
  FOR ALL USING (org_id = get_org_id());
```

### 4B. Endpoints NestJS: Contas a Pagar

```
Module: ContasPagarModule
Controller: /api/contas-pagar

GET    /                           -- Listagem paginada com filtros
GET    /:id                        -- Detalhe de uma conta
POST   /                           -- Criar conta a pagar
PUT    /:id                        -- Atualizar conta
PATCH  /:id/situacao               -- Alterar situacao (pagar, cancelar)
DELETE /:id                        -- Soft delete
POST   /bulk-update                -- Atualizar em lote (categoria, marcadores, situacao)
POST   /bulk-delete                -- Soft delete em lote
POST   /import                     -- Importar de planilha/CSV
GET    /export                     -- Exportar XLSX/CSV
GET    /summary                    -- Totais por status (dashboard abas)
POST   /:id/baixar                 -- Registrar pagamento (baixa)
POST   /bulk-baixar                -- Baixa em lote
POST   /:id/estornar               -- Estornar pagamento
POST   /gerenciar-pagamentos       -- Geracao de remessa bancaria
POST   /buscar-boletos             -- Busca DDA/boletos pendentes
```

**GET / — Request Query:**
```
?page=1
&limit=50
&situacao=aberto,atrasado
&search=texto livre (historico trigram)
&search_field=historico|fornecedor|categoria
&fornecedor_nome=Jessica
&categoria_id=uuid
&vencimento_de=2025-01-01
&vencimento_ate=2025-12-31
&valor_min=100
&valor_max=5000
&marcador=CLAUDE
&forma_pagamento_id=uuid
&sort_by=vencimento|valor|fornecedor_nome|saldo
&sort_dir=asc|desc
&company_id=uuid
```

**GET / — Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "fornecedor_nome": "Jessica Bibiane Duarte Garcia",
      "fornecedor_nome_fantasia": null,
      "historico": "PRESENTE UILIAN",
      "categoria_nome": "MDO Comercial - AtacadoNeon",
      "data_vencimento": "2025-01-23",
      "valor": 220.00,
      "saldo": 0.00,
      "valor_pago": 220.00,
      "situacao": "pago",
      "buscador": null,
      "marcadores": [{"descricao": "CLAUDE", "cor": "#E91E63"}],
      "forma_pagamento_nome": "PIX",
      "forma_pagamento_icon": "qr-code"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1274,
    "total_pages": 26
  },
  "summary": {
    "todas": 1274,
    "em_aberto": 111,
    "emitidas": 1274,
    "pagas": 1163,
    "atrasadas": 37,
    "canceladas": 0,
    "valor_total": 2842976.06
  }
}
```

### 4C. DTOs — Contas a Pagar

```typescript
// create-conta-pagar.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString, IsUUID, 
         IsEnum, IsArray, ValidateNested, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContaPagarDto {
  @IsUUID()
  company_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fornecedor_nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor_nome_fantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  fornecedor_cpf_cnpj?: string;

  @IsOptional()
  @IsUUID()
  contato_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  historico?: string;

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @IsOptional()
  @IsString()
  categoria_nome?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor: number;

  @IsDateString()
  data_vencimento: string;

  @IsOptional()
  @IsDateString()
  data_emissao?: string;

  @IsOptional()
  @IsDateString()
  data_competencia?: string;

  @IsOptional()
  @IsEnum(['aberto', 'emitido'])
  situacao?: string;

  @IsOptional()
  @IsUUID()
  forma_pagamento_id?: string;

  @IsOptional()
  @IsUUID()
  conta_bancaria_id?: string;

  @IsOptional()
  @IsString()
  conta_origem?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarcadorDto)
  marcadores?: MarcadorDto[];

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsNumber()
  parcela_numero?: number;

  @IsOptional()
  @IsNumber()
  parcela_total?: number;
}

export class MarcadorDto {
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsOptional()
  @IsString()
  cor?: string;
}

// update-conta-pagar.dto.ts
export class UpdateContaPagarDto extends PartialType(CreateContaPagarDto) {}

// baixar-conta-pagar.dto.ts
export class BaixarContaPagarDto {
  @IsDateString()
  data_pagamento: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor_pago: number;

  @IsOptional()
  @IsString()
  conta_origem?: string;

  @IsOptional()
  @IsUUID()
  conta_bancaria_id?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

// bulk-update-cp.dto.ts
export class BulkUpdateContaPagarDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids: string[];

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarcadorDto)
  marcadores?: MarcadorDto[];

  @IsOptional()
  @IsEnum(['aberto', 'emitido', 'cancelado'])
  situacao?: string;
}

// list-contas-pagar-query.dto.ts
export class ListContasPagarQueryDto {
  @IsOptional() @IsNumber() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsNumber() @Type(() => Number) limit?: number = 50;
  @IsOptional() @IsString() situacao?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() search_field?: string;
  @IsOptional() @IsString() fornecedor_nome?: string;
  @IsOptional() @IsUUID() categoria_id?: string;
  @IsOptional() @IsDateString() vencimento_de?: string;
  @IsOptional() @IsDateString() vencimento_ate?: string;
  @IsOptional() @IsNumber() @Type(() => Number) valor_min?: number;
  @IsOptional() @IsNumber() @Type(() => Number) valor_max?: number;
  @IsOptional() @IsString() marcador?: string;
  @IsOptional() @IsUUID() forma_pagamento_id?: string;
  @IsOptional() @IsString() sort_by?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) sort_dir?: string;
  @IsOptional() @IsUUID() company_id?: string;
}
```

### 4D. Componentes Next.js — Contas a Pagar

| Componente | Arquivo | Props |
|---|---|---|
| `ContasPagarPage` | `app/(app)/financas/contas-a-pagar/page.tsx` | Server component, busca dados iniciais |
| `ContasPagarHeader` | `components/contas-pagar/header.tsx` | `{ breadcrumb: string[] }` |
| `ContasPagarActions` | `components/contas-pagar/actions.tsx` | `{ onPrint, onGerenciarPagamentos, onBuscarBoletos, onIncluir, onMaisAcoes }` |
| `ContasPagarSearchBar` | `components/contas-pagar/search-bar.tsx` | `{ search, setSearch, searchField, setSearchField, activeTab, setActiveTab }` |
| `ContasPagarStatusTabs` | `components/contas-pagar/status-tabs.tsx` | `{ summary: CpSummary, activeStatus, onStatusChange }` |
| `ContasPagarTable` | `components/contas-pagar/table.tsx` | `{ data: ContaPagar[], onSort, sortBy, sortDir, selectedIds, onSelect, onSelectAll }` |
| `ContasPagarRow` | `components/contas-pagar/table-row.tsx` | `{ conta: ContaPagar, isSelected, onSelect, onContextMenu }` |
| `ContasPagarPagination` | `components/contas-pagar/pagination.tsx` | `{ page, totalPages, total, valorTotal, onPageChange }` |
| `ContasPagarAlertBar` | `components/contas-pagar/alert-bar.tsx` | `{ boletosPendentes: number, onRevisar }` |
| `ContaPagarContextMenu` | `components/contas-pagar/context-menu.tsx` | `{ onEdit, onBaixar, onEstornar, onCancelar, onDuplicar }` |
| `ContaPagarFormDialog` | `components/contas-pagar/form-dialog.tsx` | `{ open, onOpenChange, conta?: ContaPagar, mode: 'create' \| 'edit' }` |
| `BaixaDialog` | `components/contas-pagar/baixa-dialog.tsx` | `{ open, onOpenChange, conta: ContaPagar }` |
| `GerenciarPagamentosSheet` | `components/contas-pagar/gerenciar-pagamentos-sheet.tsx` | `{ open, onOpenChange, contas: ContaPagar[] }` |
| `MarcadorBadge` | `components/shared/marcador-badge.tsx` | `{ marcador: { descricao: string, cor: string } }` |
| `FormaPagamentoIcon` | `components/shared/forma-pagamento-icon.tsx` | `{ forma: string }` |

### 4E. Validacoes — Contas a Pagar

| Campo | Validacao |
|---|---|
| `fornecedor_nome` | Obrigatorio, max 200 chars |
| `fornecedor_cpf_cnpj` | Opcional. Se preenchido: algoritmo CPF (11 digitos) ou CNPJ (14 digitos) com validacao de digitos verificadores |
| `valor` | Obrigatorio, > 0, max 2 casas decimais, max R$ 99.999.999.999,99 |
| `data_vencimento` | Obrigatorio, formato ISO date |
| `data_emissao` | Se preenchido, nao pode ser futura |
| `data_pagamento` | Se preenchido, nao pode ser posterior a hoje + 30 dias |
| `valor_pago` | Na baixa: obrigatorio, > 0, max = saldo restante (se pagamento parcial nao permitido) |
| `conta_origem` | Na baixa: obrigatorio se empresa tem contas bancarias cadastradas |
| `categoria_nome` | Se categoria_id nao informado, busca ou cria por nome |
| `marcadores` | Array de objetos com `descricao` nao vazio |
| `situacao` | Transicoes validas: aberto->emitido->pago, aberto->cancelado, emitido->cancelado |

### 4F. Relacionamentos — Contas a Pagar

| FK | Para | Cardinalidade | Cascade |
|---|---|---|---|
| `org_id` | organizations | N:1 | CASCADE DELETE |
| `company_id` | companies | N:1 | CASCADE DELETE |
| `contato_id` | contatos | N:1 | SET NULL |
| `categoria_id` | categorias | N:1 | SET NULL |
| `forma_pagamento_id` | formas_pagamento | N:1 | SET NULL |
| `conta_bancaria_id` | contas_bancarias | N:1 | SET NULL |
| `created_by` | profiles | N:1 | SET NULL |
| `reconciliation_id` | reconciliations | N:1 | SET NULL |

---

## 5. TELA 3 — CONTAS A RECEBER

### 5A. Entidade PostgreSQL: `contas_receber`

```sql
CREATE TABLE contas_receber (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identificadores externos
  tiny_id               BIGINT,
  numero_documento      TEXT,
  documento_origem      TEXT, -- "Pedido 41686"
  pedido_numero         TEXT,
  nota_fiscal           TEXT,
  
  -- Cliente (referencia ou inline)
  contato_id            UUID REFERENCES contatos(id) ON DELETE SET NULL,
  cliente_nome          TEXT NOT NULL,
  cliente_nome_fantasia TEXT,
  cliente_cpf_cnpj      VARCHAR(18),
  cliente_fone          VARCHAR(20),
  cliente_email         TEXT,
  
  -- Dados financeiros
  historico             TEXT,
  categoria_id          UUID REFERENCES categorias(id) ON DELETE SET NULL,
  categoria_nome        TEXT,
  valor                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_liquido         NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_recebido        NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxa_gateway          NUMERIC(14,2) DEFAULT 0,
  
  -- Datas
  data_emissao          DATE,
  data_vencimento       DATE NOT NULL,
  data_recebimento      DATE,
  data_competencia      DATE,
  data_prevista         DATE, -- previsao com base no lag de gateway
  
  -- Status e classificacao
  situacao              TEXT NOT NULL DEFAULT 'aberto'
                          CHECK (situacao IN ('aberto','emitido','previsto','recebido','parcial','atrasado','cancelado')),
  forma_pagamento_id    UUID REFERENCES formas_pagamento(id),
  forma_pagamento_nome  TEXT,
  meio_pagamento        TEXT, -- PIX, cartao, boleto etc
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),
  
  -- Parcela
  parcela_numero        INTEGER,
  parcela_total         INTEGER,
  parcela_grupo_id      UUID,
  
  -- Marcadores e integracoes
  marcadores            JSONB DEFAULT '[]',
  integracoes           JSONB DEFAULT '[]', -- [{tipo: 'nfe', id: '123'}, {tipo: 'nfse', id: '456'}]
  
  -- Conciliacao
  reconciliation_status TEXT DEFAULT 'pending'
                          CHECK (reconciliation_status IN ('pending','suggested','reconciled','ignored','reversed')),
  reconciliation_id     UUID,
  
  -- Observacoes
  observacoes           TEXT,
  anexos                JSONB DEFAULT '[]',
  
  -- Integracao
  raw_data              JSONB,
  last_synced_at        TIMESTAMPTZ,
  sync_source           TEXT CHECK (sync_source IN ('tiny_v2','tiny_v3','manual','import','pedido')),
  
  -- Metadados
  created_by            UUID REFERENCES profiles(id),
  updated_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  
  UNIQUE(company_id, tiny_id)
);

-- Indices
CREATE INDEX idx_cr_org ON contas_receber(org_id);
CREATE INDEX idx_cr_company ON contas_receber(company_id);
CREATE INDEX idx_cr_situacao ON contas_receber(situacao);
CREATE INDEX idx_cr_vencimento ON contas_receber(data_vencimento);
CREATE INDEX idx_cr_cliente ON contas_receber(cliente_nome);
CREATE INDEX idx_cr_valor ON contas_receber(valor);
CREATE INDEX idx_cr_reconciliation ON contas_receber(reconciliation_status);
CREATE INDEX idx_cr_pedido ON contas_receber(pedido_numero);
CREATE INDEX idx_cr_contato ON contas_receber(contato_id);
CREATE INDEX idx_cr_tiny_id ON contas_receber(tiny_id);
CREATE INDEX idx_cr_historico_trgm ON contas_receber USING gin(historico gin_trgm_ops);
CREATE INDEX idx_cr_cliente_trgm ON contas_receber USING gin(cliente_nome gin_trgm_ops);
CREATE INDEX idx_cr_documento_origem ON contas_receber(documento_origem);
CREATE INDEX idx_cr_deleted ON contas_receber(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_org_isolation ON contas_receber FOR ALL USING (org_id = get_org_id());
```

### 5B. Endpoints NestJS: Contas a Receber

```
Module: ContasReceberModule
Controller: /api/contas-receber

GET    /                           -- Listagem paginada com filtros
GET    /:id                        -- Detalhe
POST   /                           -- Criar
PUT    /:id                        -- Atualizar
PATCH  /:id/situacao               -- Alterar situacao
DELETE /:id                        -- Soft delete
POST   /bulk-update                -- Atualizar em lote
POST   /bulk-delete                -- Soft delete em lote
POST   /import                     -- Importar
GET    /export                     -- Exportar XLSX/CSV
GET    /summary                    -- Totais por status
POST   /:id/baixar                 -- Registrar recebimento
POST   /bulk-baixar                -- Baixa em lote
POST   /:id/estornar               -- Estornar
POST   /gerenciar-recebimentos     -- Geracao de cobrancas
GET    /por-meio-recebimento       -- Filtro agrupado por meio
GET    /por-periodo                -- Filtro agrupado por periodo
```

**GET / — Response (identico em estrutura ao CP, com campos especificos):**
```json
{
  "data": [{
    "id": "uuid",
    "cliente_nome": "PIRES CERVEJARIA LTDA",
    "cliente_fone": "(28) 99966-7003",
    "historico": "Ref. ao pedido de venda nº 41686, PIRES CERVEJARIA LTDA",
    "data_vencimento": "2025-09-18",
    "valor": 2500.00,
    "saldo": 2500.00,
    "valor_liquido": 2500.00,
    "valor_recebido": 0.00,
    "data_emissao": "2026-04-13",
    "documento_origem": "Pedido 41686",
    "situacao": "aberto",
    "marcadores": [],
    "meio_pagamento": "boleto",
    "integracoes": [{"tipo": "nfe", "numero": "12345"}]
  }],
  "meta": { "page": 1, "limit": 50, "total": 4950, "total_pages": 99 },
  "summary": {
    "em_aberto": 4270,
    "emitidas": 4950,
    "previstas": 0,
    "recebidas": 681,
    "atrasadas": 988,
    "canceladas": 0,
    "valor_total": 747874.42
  }
}
```

### 5C. DTOs — Contas a Receber

```typescript
export class CreateContaReceberDto {
  @IsUUID() company_id: string;
  @IsString() @IsNotEmpty() @MaxLength(200) cliente_nome: string;
  @IsOptional() @IsString() cliente_nome_fantasia?: string;
  @IsOptional() @IsString() @MaxLength(18) cliente_cpf_cnpj?: string;
  @IsOptional() @IsString() @MaxLength(20) cliente_fone?: string;
  @IsOptional() @IsEmail() cliente_email?: string;
  @IsOptional() @IsUUID() contato_id?: string;
  @IsOptional() @IsString() @MaxLength(500) historico?: string;
  @IsOptional() @IsString() documento_origem?: string;
  @IsOptional() @IsString() pedido_numero?: string;
  @IsOptional() @IsUUID() categoria_id?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) valor: number;
  @IsDateString() data_vencimento: string;
  @IsOptional() @IsDateString() data_emissao?: string;
  @IsOptional() @IsEnum(['aberto', 'emitido', 'previsto']) situacao?: string;
  @IsOptional() @IsUUID() forma_pagamento_id?: string;
  @IsOptional() @IsString() meio_pagamento?: string;
  @IsOptional() @IsUUID() conta_bancaria_id?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MarcadorDto) marcadores?: MarcadorDto[];
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsNumber() parcela_numero?: number;
  @IsOptional() @IsNumber() parcela_total?: number;
}

export class BaixarContaReceberDto {
  @IsDateString() data_recebimento: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) valor_recebido: number;
  @IsOptional() @IsUUID() conta_bancaria_id?: string;
  @IsOptional() @IsString() observacoes?: string;
}

export class ListContasReceberQueryDto {
  @IsOptional() @IsNumber() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsNumber() @Type(() => Number) limit?: number = 50;
  @IsOptional() @IsString() situacao?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() search_field?: string;
  @IsOptional() @IsString() cliente_nome?: string;
  @IsOptional() @IsString() meio_pagamento?: string;
  @IsOptional() @IsUUID() categoria_id?: string;
  @IsOptional() @IsDateString() vencimento_de?: string;
  @IsOptional() @IsDateString() vencimento_ate?: string;
  @IsOptional() @IsDateString() emissao_de?: string;
  @IsOptional() @IsDateString() emissao_ate?: string;
  @IsOptional() @IsNumber() @Type(() => Number) valor_min?: number;
  @IsOptional() @IsNumber() @Type(() => Number) valor_max?: number;
  @IsOptional() @IsString() marcador?: string;
  @IsOptional() @IsString() documento_origem?: string;
  @IsOptional() @IsString() sort_by?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) sort_dir?: string;
  @IsOptional() @IsUUID() company_id?: string;
}
```

### 5D. Componentes Next.js — Contas a Receber

| Componente | Arquivo | Props |
|---|---|---|
| `ContasReceberPage` | `app/(app)/financas/contas-a-receber/page.tsx` | Server component |
| `ContasReceberHeader` | `components/contas-receber/header.tsx` | `{ breadcrumb }` |
| `ContasReceberActions` | `components/contas-receber/actions.tsx` | `{ onPrint, onGerenciarRecebimentos, onIncluir, onMaisAcoes }` |
| `ContasReceberSearchBar` | `components/contas-receber/search-bar.tsx` | `{ search, searchField, activeTab, handlers }` |
| `ContasReceberStatusTabs` | `components/contas-receber/status-tabs.tsx` | `{ summary, activeStatus, onChange }` |
| `ContasReceberTable` | `components/contas-receber/table.tsx` | `{ data, onSort, sortBy, sortDir, selectedIds, handlers }` |
| `ContasReceberRow` | `components/contas-receber/table-row.tsx` | `{ conta, isSelected, onSelect }` |
| `ContasReceberPagination` | `components/contas-receber/pagination.tsx` | `{ page, totalPages, total, valorTotal }` |
| `ContaReceberFormDialog` | `components/contas-receber/form-dialog.tsx` | `{ open, conta?, mode }` |
| `BaixaReceberDialog` | `components/contas-receber/baixa-dialog.tsx` | `{ open, conta }` |
| `IntegracaoIcon` | `components/shared/integracao-icon.tsx` | `{ tipo: 'nfe' \| 'nfse' \| 'boleto' }` |

### 5E. Validacoes — Contas a Receber

Identicas ao CP com adicoes: `cliente_fone` validado com regex `^\(\d{2}\)\s?\d{4,5}-\d{4}$`, `cliente_email` validado com `@IsEmail()`, `documento_origem` formato livre mas se comecar com "Pedido" extrai numero automaticamente.

### 5F. Relacionamentos

Identicos ao CP substituindo `contato_id` referenciando contato tipo "cliente" em vez de "fornecedor".

---

## 6. TELA 4 e 5 — CLIENTES E FORNECEDORES (CONTATOS)

### 6A. Entidade PostgreSQL: `contatos`

```sql
CREATE TABLE contatos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
  
  -- Identificacao
  codigo                SERIAL, -- sequencial por org
  tiny_id               BIGINT,
  nome                  TEXT NOT NULL,
  nome_fantasia         TEXT,
  
  -- Documento
  tipo_pessoa           TEXT NOT NULL DEFAULT 'J'
                          CHECK (tipo_pessoa IN ('F', 'J')),
  cpf_cnpj              VARCHAR(18),
  contribuinte          TEXT DEFAULT '0'
                          CHECK (contribuinte IN ('0', '1', '2')),
                          -- 0=Nao informado, 1=Contribuinte, 2=Isento
  inscricao_estadual    TEXT,
  inscricao_municipal   TEXT,
  
  -- Tipo de contato (multiplo)
  tipos                 TEXT[] NOT NULL DEFAULT '{}',
                          -- Valores: 'cliente', 'fornecedor', 'transportador', 'vendedor'
  tipo_subtipo          TEXT, -- "cliente atacado neon", "cliente engagge", etc
  
  -- Endereco
  cep                   VARCHAR(9),
  municipio             TEXT,
  uf                    VARCHAR(2),
  endereco              TEXT,
  bairro                TEXT,
  numero                TEXT,
  complemento           TEXT,
  pais                  TEXT DEFAULT 'Brasil',
  ibge_code             VARCHAR(7),
  
  -- Contato
  email                 TEXT,
  email_nfe             TEXT,
  telefone              VARCHAR(20),
  celular               VARCHAR(20),
  fax                   VARCHAR(20),
  website               TEXT,
  
  -- Dados complementares
  data_nascimento       DATE,
  limite_credito        NUMERIC(14,2),
  vendedor_id           UUID REFERENCES contatos(id),
  tabela_preco          TEXT,
  condicao_pagamento    TEXT,
  
  -- Bancarios
  banco_nome            TEXT,
  banco_agencia         TEXT,
  banco_conta           TEXT,
  banco_pix             TEXT,
  
  -- Status
  situacao              TEXT DEFAULT 'ativo'
                          CHECK (situacao IN ('ativo', 'inativo')),
  
  -- Observacoes e anexos
  observacoes           TEXT,
  anexos                JSONB DEFAULT '[]',
  
  -- Dados complementares genericos (JSONB extensivel)
  dados_complementares  JSONB DEFAULT '{}',
  
  -- Integracao
  raw_data              JSONB,
  last_synced_at        TIMESTAMPTZ,
  
  -- Metadados
  created_by            UUID REFERENCES profiles(id),
  updated_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

-- Indices
CREATE INDEX idx_contatos_org ON contatos(org_id);
CREATE INDEX idx_contatos_company ON contatos(company_id);
CREATE INDEX idx_contatos_nome ON contatos(nome);
CREATE INDEX idx_contatos_cpf_cnpj ON contatos(cpf_cnpj);
CREATE INDEX idx_contatos_tipos ON contatos USING gin(tipos);
CREATE INDEX idx_contatos_tipo_subtipo ON contatos(tipo_subtipo);
CREATE INDEX idx_contatos_situacao ON contatos(situacao);
CREATE INDEX idx_contatos_municipio ON contatos(municipio, uf);
CREATE INDEX idx_contatos_nome_trgm ON contatos USING gin(nome gin_trgm_ops);
CREATE INDEX idx_contatos_fantasia_trgm ON contatos USING gin(nome_fantasia gin_trgm_ops);
CREATE INDEX idx_contatos_email ON contatos(email);
CREATE INDEX idx_contatos_deleted ON contatos(deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_contatos_org_tiny ON contatos(org_id, tiny_id) WHERE tiny_id IS NOT NULL;
CREATE UNIQUE INDEX idx_contatos_org_cpf ON contatos(org_id, cpf_cnpj) WHERE cpf_cnpj IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contatos_org_isolation ON contatos FOR ALL USING (org_id = get_org_id());
```

### 6B. Endpoints NestJS: Contatos

```
Module: ContatosModule
Controller: /api/contatos

GET    /                           -- Listagem paginada
GET    /:id                        -- Detalhe com abas (dados gerais, complementares, anexos, observacoes)
POST   /                           -- Criar
PUT    /:id                        -- Atualizar
DELETE /:id                        -- Soft delete
POST   /bulk-delete                -- Soft delete em lote
POST   /import                     -- Importar CSV/XLSX
GET    /export                     -- Exportar
GET    /search                     -- Busca unificada (nome, cod, fantasia, email, CPF/CNPJ)
GET    /by-tipo                    -- Contagem por tipo/subtipo
POST   /:id/consultar-cnpj        -- Consulta CNPJ via ReceitaWS/BrasilAPI
POST   /:id/consultar-cep         -- Consulta CEP via ViaCEP
```

**GET / — Query:**
```
?page=1&limit=50
&search=texto (nome, codigo, fantasia, email, cpf_cnpj)
&tipo=cliente|fornecedor|transportador|vendedor
&tipo_subtipo=cliente atacado neon
&situacao=ativo|inativo
&municipio=Sao Paulo
&uf=SP
&sort_by=created_at|nome|situacao
&sort_dir=asc|desc
&company_id=uuid
```

### 6C. DTOs — Contatos

```typescript
export class CreateContatoDto {
  @IsOptional() @IsUUID() company_id?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) nome: string;
  @IsOptional() @IsString() @MaxLength(200) nome_fantasia?: string;
  @IsEnum(['F', 'J']) tipo_pessoa: string;
  
  @IsOptional() @IsString() @MaxLength(18)
  @Validate(CpfCnpjValidator) // custom validator
  cpf_cnpj?: string;
  
  @IsOptional() @IsEnum(['0', '1', '2']) contribuinte?: string;
  @IsOptional() @IsString() inscricao_estadual?: string;
  @IsOptional() @IsString() inscricao_municipal?: string;
  
  @IsArray() @IsIn(['cliente', 'fornecedor', 'transportador', 'vendedor'], { each: true })
  tipos: string[];
  
  @IsOptional() @IsString() tipo_subtipo?: string;
  
  // Endereco
  @IsOptional() @IsString() @Matches(/^\d{5}-?\d{3}$/) cep?: string;
  @IsOptional() @IsString() municipio?: string;
  @IsOptional() @IsString() @Length(2, 2) uf?: string;
  @IsOptional() @IsString() endereco?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() complemento?: string;
  
  // Contato
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Matches(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/) telefone?: string;
  @IsOptional() @IsString() celular?: string;
  
  @IsOptional() @IsString() observacoes?: string;
}

export class UpdateContatoDto extends PartialType(CreateContatoDto) {}

export class ConsultaCnpjResponseDto {
  nome: string;
  fantasia: string;
  cnpj: string;
  situacao: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  bairro: string;
  numero: string;
  complemento: string;
  email: string;
  telefone: string;
  inscricao_estadual: string;
}
```

### 6D. Componentes Next.js — Contatos

**Listagem (Tela 4):**

| Componente | Arquivo | Props |
|---|---|---|
| `ContatosPage` | `app/(app)/cadastros/clientes-fornecedores/page.tsx` | Server component |
| `ContatosHeader` | `components/contatos/header.tsx` | `{ breadcrumb }` |
| `ContatosActions` | `components/contatos/actions.tsx` | `{ onPrint, onIncluir, onMaisAcoes }` |
| `ContatosSearchBar` | `components/contatos/search-bar.tsx` | `{ search, onSearch, onFilterToggle }` |
| `ContatosSortTabs` | `components/contatos/sort-tabs.tsx` | `{ sortBy, onSort, activeFilters }` |
| `ContatosTipoTabs` | `components/contatos/tipo-tabs.tsx` | `{ tiposCounts, activeTipo, onChange }` |
| `ContatosTable` | `components/contatos/table.tsx` | `{ data, selectedIds, handlers }` |
| `ContatoRow` | `components/contatos/table-row.tsx` | `{ contato, isSelected, onSelect }` |

**Formulario (Tela 5):**

| Componente | Arquivo | Props |
|---|---|---|
| `ContatoEditPage` | `app/(app)/cadastros/clientes-fornecedores/[id]/page.tsx` | Params: id |
| `ContatoFormTabs` | `components/contatos/form/form-tabs.tsx` | `{ activeTab, onChange }` |
| `ContatoDadosGerais` | `components/contatos/form/dados-gerais.tsx` | `{ form: UseFormReturn<ContatoForm>, onConsultaCnpj, onConsultaCep }` |
| `ContatoDadosComplementares` | `components/contatos/form/dados-complementares.tsx` | `{ form }` |
| `ContatoAnexos` | `components/contatos/form/anexos.tsx` | `{ contato_id, anexos }` |
| `ContatoObservacoes` | `components/contatos/form/observacoes.tsx` | `{ form }` |
| `CnpjLookupButton` | `components/contatos/form/cnpj-lookup.tsx` | `{ cnpj, onResult: (data) => void }` |
| `CepLookupButton` | `components/contatos/form/cep-lookup.tsx` | `{ cep, onResult: (data) => void }` |
| `TipoPessoaSelect` | `components/contatos/form/tipo-pessoa-select.tsx` | `{ value, onChange }` |
| `TipoContatoMultiSelect` | `components/contatos/form/tipo-contato-multi-select.tsx` | `{ value, onChange }` |
| `UfSelect` | `components/contatos/form/uf-select.tsx` | `{ value, onChange }` |
| `ContribuinteSelect` | `components/contatos/form/contribuinte-select.tsx` | `{ value, onChange }` |

### 6E. Validacoes — Contatos

| Campo | Validacao |
|---|---|
| `nome` | Obrigatorio, 2-200 chars |
| `cpf_cnpj` | Se tipo_pessoa='F': CPF valido (11 digitos + verificadores). Se 'J': CNPJ valido (14 digitos + verificadores). Mascara automatica: XXX.XXX.XXX-XX ou XX.XXX.XXX/XXXX-XX |
| `cep` | 8 digitos, formato XXXXX-XXX. Consulta ViaCEP para validar existencia |
| `email` | RFC 5322 basico. Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `telefone` | Formato (XX) XXXX-XXXX ou (XX) XXXXX-XXXX |
| `uf` | Enum dos 26 estados + DF |
| `inscricao_estadual` | Se contribuinte='1': obrigatorio. Formato varia por UF |
| `tipos` | Array nao vazio, cada elemento deve ser valor valido |
| `tipo_pessoa` | Ao mudar de F para J (ou vice-versa): limpa cpf_cnpj, inscricao_estadual, contribuinte |

### 6F. Relacionamentos

| FK | Para | Cardinalidade | Cascade |
|---|---|---|---|
| `org_id` | organizations | N:1 | CASCADE |
| `company_id` | companies | N:1 | SET NULL |
| `vendedor_id` | contatos (self) | N:1 | SET NULL |
| contatos -> contas_pagar | via `contato_id` | 1:N | SET NULL |
| contatos -> contas_receber | via `contato_id` | 1:N | SET NULL |

---

## 7. ENTIDADES ADICIONAIS

### 7.1 CAIXA — Movimentacao de Caixa

#### 7.1A. Schema PostgreSQL: `movimentacoes_caixa`

```sql
CREATE TABLE movimentacoes_caixa (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Classificacao
  tipo                  TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia')),
  natureza              TEXT NOT NULL CHECK (natureza IN ('receita', 'despesa', 'transferencia', 'emprestimo', 'investimento', 'ajuste')),
  
  -- Dados financeiros
  valor                 NUMERIC(14,2) NOT NULL,
  descricao             TEXT NOT NULL,
  historico             TEXT,
  
  -- Referencias
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),
  conta_bancaria_destino_id UUID REFERENCES contas_bancarias(id), -- para transferencias
  categoria_id          UUID REFERENCES categorias(id),
  contato_id            UUID REFERENCES contatos(id),
  conta_pagar_id        UUID REFERENCES contas_pagar(id),
  conta_receber_id      UUID REFERENCES contas_receber(id),
  
  -- Dados
  data_movimentacao     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia      DATE,
  numero_documento      TEXT,
  
  -- Conciliacao
  reconciliation_status TEXT DEFAULT 'pending',
  bank_transaction_id   UUID,
  
  -- Saldo em tempo real (computed por trigger)
  saldo_anterior        NUMERIC(14,2),
  saldo_posterior       NUMERIC(14,2),
  
  -- Meta
  observacoes           TEXT,
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_caixa_org ON movimentacoes_caixa(org_id);
CREATE INDEX idx_caixa_company ON movimentacoes_caixa(company_id);
CREATE INDEX idx_caixa_data ON movimentacoes_caixa(data_movimentacao);
CREATE INDEX idx_caixa_tipo ON movimentacoes_caixa(tipo);
CREATE INDEX idx_caixa_conta ON movimentacoes_caixa(conta_bancaria_id);
CREATE INDEX idx_caixa_categoria ON movimentacoes_caixa(categoria_id);

-- Trigger para calcular saldo posterior
CREATE OR REPLACE FUNCTION calcular_saldo_caixa()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_saldo NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN tipo = 'entrada' THEN valor
         WHEN tipo = 'saida' THEN -valor
         ELSE 0 END
  ), 0) INTO v_saldo
  FROM movimentacoes_caixa
  WHERE conta_bancaria_id = NEW.conta_bancaria_id
    AND data_movimentacao <= NEW.data_movimentacao
    AND id != NEW.id
    AND deleted_at IS NULL;
    
  NEW.saldo_anterior := v_saldo;
  NEW.saldo_posterior := v_saldo + CASE WHEN NEW.tipo = 'entrada' THEN NEW.valor ELSE -NEW.valor END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saldo_caixa BEFORE INSERT ON movimentacoes_caixa
FOR EACH ROW EXECUTE FUNCTION calcular_saldo_caixa();

ALTER TABLE movimentacoes_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY caixa_org_isolation ON movimentacoes_caixa FOR ALL USING (org_id = get_org_id());
```

#### 7.1B. Endpoints

```
Module: CaixaModule
Controller: /api/caixa

GET    /                           -- Listagem com filtros (data, tipo, conta, categoria)
GET    /saldo                      -- Saldo atual por conta bancaria
GET    /saldo-periodo              -- Saldo em range de datas
POST   /                           -- Criar movimentacao
POST   /transferencia              -- Transferencia entre contas
PUT    /:id                        -- Atualizar
DELETE /:id                        -- Soft delete
GET    /export                     -- Exportar XLSX
GET    /resumo-diario              -- Resumo entradas/saidas por dia
```

#### 7.1C. DTOs

```typescript
export class CreateMovimentacaoCaixaDto {
  @IsUUID() company_id: string;
  @IsEnum(['entrada', 'saida', 'transferencia']) tipo: string;
  @IsEnum(['receita', 'despesa', 'transferencia', 'emprestimo', 'investimento', 'ajuste']) natureza: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) valor: number;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsString() historico?: string;
  @IsUUID() conta_bancaria_id: string;
  @IsOptional() @IsUUID() conta_bancaria_destino_id?: string;
  @IsOptional() @IsUUID() categoria_id?: string;
  @IsOptional() @IsUUID() contato_id?: string;
  @IsDateString() data_movimentacao: string;
  @IsOptional() @IsString() numero_documento?: string;
  @IsOptional() @IsString() observacoes?: string;
}

export class TransferenciaCaixaDto {
  @IsUUID() company_id: string;
  @IsUUID() conta_origem_id: string;
  @IsUUID() conta_destino_id: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) valor: number;
  @IsDateString() data_movimentacao: string;
  @IsOptional() @IsString() descricao?: string;
}
```

#### 7.1D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `CaixaPage` | `app/(app)/financas/caixa/page.tsx` | Server component |
| `CaixaSaldoCards` | `components/caixa/saldo-cards.tsx` | `{ saldos: SaldoPorConta[] }` |
| `CaixaMovimentacoesList` | `components/caixa/movimentacoes-list.tsx` | `{ data, filters }` |
| `CaixaMovimentacaoRow` | `components/caixa/movimentacao-row.tsx` | `{ mov, saldoAnterior }` |
| `CaixaFormDialog` | `components/caixa/form-dialog.tsx` | `{ open, mode, mov? }` |
| `TransferenciaDialog` | `components/caixa/transferencia-dialog.tsx` | `{ open, contas }` |
| `CaixaResumoDiario` | `components/caixa/resumo-diario.tsx` | `{ dados: ResumoDia[] }` |

---

### 7.2 EXTRATOS BANCARIOS

#### 7.2A. Schema PostgreSQL: `extratos_bancarios`

```sql
CREATE TABLE extratos_bancarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conta_bancaria_id     UUID NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,
  
  -- Dados da transacao
  data_transacao        DATE NOT NULL,
  data_compensacao      DATE,
  valor                 NUMERIC(14,2) NOT NULL,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  descricao             TEXT NOT NULL,
  memo                  TEXT,
  
  -- Identificacao externa (dedup)
  external_id           TEXT, -- FITID do OFX
  external_type         TEXT CHECK (external_type IN ('ofx','csv','api','manual')),
  check_number          TEXT,
  reference_number      TEXT,
  
  -- Classificacao
  categoria_id          UUID REFERENCES categorias(id),
  categoria_auto        BOOLEAN DEFAULT false, -- classificada por IA/regra
  contato_id            UUID REFERENCES contatos(id),
  
  -- Conciliacao
  reconciliation_status TEXT DEFAULT 'pending'
                          CHECK (reconciliation_status IN ('pending','suggested','reconciled','ignored','reversed','transfer')),
  reconciliation_id     UUID,
  conta_pagar_id        UUID REFERENCES contas_pagar(id),
  conta_receber_id      UUID REFERENCES contas_receber(id),
  
  -- Import
  import_batch_id       UUID REFERENCES import_batches(id),
  
  -- Raw
  raw_data              JSONB,
  
  -- Meta
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(conta_bancaria_id, external_id)
);

CREATE INDEX idx_extrato_org ON extratos_bancarios(org_id);
CREATE INDEX idx_extrato_company ON extratos_bancarios(company_id);
CREATE INDEX idx_extrato_conta ON extratos_bancarios(conta_bancaria_id);
CREATE INDEX idx_extrato_data ON extratos_bancarios(data_transacao);
CREATE INDEX idx_extrato_valor ON extratos_bancarios(valor);
CREATE INDEX idx_extrato_tipo ON extratos_bancarios(tipo);
CREATE INDEX idx_extrato_status ON extratos_bancarios(reconciliation_status);
CREATE INDEX idx_extrato_descricao_trgm ON extratos_bancarios USING gin(descricao gin_trgm_ops);
CREATE INDEX idx_extrato_batch ON extratos_bancarios(import_batch_id);

-- Tabela de import batches
CREATE TABLE import_batches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id),
  conta_bancaria_id     UUID NOT NULL REFERENCES contas_bancarias(id),
  
  file_name             TEXT NOT NULL,
  file_hash             VARCHAR(64) NOT NULL, -- SHA-256
  file_size             INTEGER,
  file_type             TEXT CHECK (file_type IN ('ofx', 'csv', 'xlsx')),
  storage_path          TEXT, -- Supabase Storage path
  
  -- Stats
  total_records         INTEGER DEFAULT 0,
  imported_records      INTEGER DEFAULT 0,
  skipped_records       INTEGER DEFAULT 0,
  error_records         INTEGER DEFAULT 0,
  
  -- Period
  date_start            DATE,
  date_end              DATE,
  
  -- Status
  status                TEXT DEFAULT 'processing'
                          CHECK (status IN ('processing', 'completed', 'failed', 'rolled_back')),
  error_message         TEXT,
  
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(conta_bancaria_id, file_hash)
);

ALTER TABLE extratos_bancarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY extrato_org ON extratos_bancarios FOR ALL USING (org_id = get_org_id());
CREATE POLICY batch_org ON import_batches FOR ALL USING (org_id = get_org_id());
```

#### 7.2B. Endpoints

```
Module: ExtratosBancariosModule
Controller: /api/extratos-bancarios

GET    /                           -- Listagem com filtros
GET    /:id                        -- Detalhe
POST   /import                     -- Upload OFX/CSV + parse + import
POST   /import/preview             -- Preview antes de importar
GET    /import/batches             -- Historico de imports
POST   /import/batches/:id/rollback -- Reverter import
POST   /bulk-ignore                -- Ignorar transacoes em lote
POST   /bulk-transfer              -- Marcar como transferencia em lote
POST   /bulk-categorize            -- Categorizar em lote
GET    /export                     -- Exportar XLSX
GET    /summary                    -- Resumo por conta/periodo
GET    /unmatched                  -- Apenas nao conciliadas
```

#### 7.2C. DTOs

```typescript
export class ImportExtratoDto {
  @IsUUID() conta_bancaria_id: string;
  // file: Express.Multer.File (via @UploadedFile decorator)
}

export class ImportPreviewResponseDto {
  file_name: string;
  file_hash: string;
  total_records: number;
  duplicate_records: number; // ja importados (por FITID)
  new_records: number;
  date_range: { start: string; end: string };
  sample: ExtratoPreviewItem[];
  already_imported: boolean; // file_hash duplicado
}

export class ListExtratosQueryDto {
  @IsOptional() @IsUUID() conta_bancaria_id?: string;
  @IsOptional() @IsDateString() data_de?: string;
  @IsOptional() @IsDateString() data_ate?: string;
  @IsOptional() @IsEnum(['credito', 'debito']) tipo?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(['pending', 'reconciled', 'ignored', 'transfer']) status?: string;
  @IsOptional() @IsNumber() @Type(() => Number) valor_min?: number;
  @IsOptional() @IsNumber() @Type(() => Number) valor_max?: number;
  @IsOptional() @IsNumber() @Type(() => Number) page?: number;
  @IsOptional() @IsNumber() @Type(() => Number) limit?: number;
  @IsOptional() @IsString() sort_by?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) sort_dir?: string;
}
```

#### 7.2D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `ExtratosBancariosPage` | `app/(app)/financas/extratos-bancarios/page.tsx` | Server |
| `ExtratoContaSelector` | `components/extratos/conta-selector.tsx` | `{ contas, selected, onChange }` |
| `ExtratoImportZone` | `components/extratos/import-zone.tsx` | `{ onUpload, isLoading }` |
| `ExtratoImportPreview` | `components/extratos/import-preview.tsx` | `{ preview: ImportPreviewResponse, onConfirm, onCancel }` |
| `ExtratoTable` | `components/extratos/table.tsx` | `{ data, filters, handlers }` |
| `ExtratoRow` | `components/extratos/row.tsx` | `{ transacao, isSelected }` |
| `ExtratoBatchHistory` | `components/extratos/batch-history.tsx` | `{ batches }` |
| `ExtratoSummaryCards` | `components/extratos/summary-cards.tsx` | `{ creditos, debitos, saldo, pendentes }` |

---

### 7.3 COBRANCAS BANCARIAS

#### 7.3A. Schema: `cobrancas_bancarias`

```sql
CREATE TABLE cobrancas_bancarias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Boleto
  nosso_numero          TEXT,
  numero_documento      TEXT,
  linha_digitavel       TEXT,
  codigo_barras         TEXT,
  
  -- Sacado (devedor)
  contato_id            UUID REFERENCES contatos(id),
  sacado_nome           TEXT NOT NULL,
  sacado_cpf_cnpj       VARCHAR(18),
  sacado_endereco       TEXT,
  
  -- Valores
  valor_nominal         NUMERIC(14,2) NOT NULL,
  valor_desconto        NUMERIC(14,2) DEFAULT 0,
  valor_juros           NUMERIC(14,2) DEFAULT 0,
  valor_multa           NUMERIC(14,2) DEFAULT 0,
  valor_pago            NUMERIC(14,2) DEFAULT 0,
  
  -- Datas
  data_emissao          DATE NOT NULL,
  data_vencimento       DATE NOT NULL,
  data_pagamento        DATE,
  data_credito          DATE,
  data_limite_desconto  DATE,
  
  -- Status
  situacao              TEXT DEFAULT 'registrado'
                          CHECK (situacao IN ('rascunho','registrado','enviado','pago','vencido','protestado',
                                             'baixado','cancelado','rejeitado')),
  
  -- Banco
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),
  banco_codigo          VARCHAR(3),
  carteira              TEXT,
  
  -- Vinculo CR
  conta_receber_id      UUID REFERENCES contas_receber(id),
  
  -- DDA
  dda_id                TEXT,
  is_dda                BOOLEAN DEFAULT false,
  
  -- Remessa/Retorno
  remessa_id            UUID,
  retorno_id            UUID,
  
  -- Instrucoes
  instrucao_protesto_dias INTEGER,
  instrucao_baixa_dias    INTEGER,
  mensagem_1            TEXT,
  mensagem_2            TEXT,
  
  -- Meta
  raw_data              JSONB,
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cobranca_org ON cobrancas_bancarias(org_id);
CREATE INDEX idx_cobranca_company ON cobrancas_bancarias(company_id);
CREATE INDEX idx_cobranca_situacao ON cobrancas_bancarias(situacao);
CREATE INDEX idx_cobranca_vencimento ON cobrancas_bancarias(data_vencimento);
CREATE INDEX idx_cobranca_sacado ON cobrancas_bancarias(sacado_nome);
CREATE INDEX idx_cobranca_nosso_num ON cobrancas_bancarias(nosso_numero);
CREATE INDEX idx_cobranca_cr ON cobrancas_bancarias(conta_receber_id);
CREATE INDEX idx_cobranca_conta ON cobrancas_bancarias(conta_bancaria_id);

ALTER TABLE cobrancas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cobranca_org ON cobrancas_bancarias FOR ALL USING (org_id = get_org_id());
```

#### 7.3B. Endpoints

```
Module: CobrancasBancariasModule
Controller: /api/cobrancas

GET    /                           -- Listagem
GET    /:id                        -- Detalhe
POST   /                           -- Criar boleto
PUT    /:id                        -- Atualizar
POST   /:id/registrar              -- Registrar no banco
POST   /:id/cancelar               -- Cancelar/baixar
POST   /gerar-remessa              -- Gerar arquivo CNAB 240/400
POST   /processar-retorno          -- Processar arquivo retorno
GET    /dda                        -- Listar boletos DDA pendentes
POST   /dda/:id/vincular           -- Vincular DDA a CP
GET    /export                     -- Exportar
GET    /summary                    -- Resumo por status
```

#### 7.3C. DTOs

```typescript
export class CreateCobrancaDto {
  @IsUUID() company_id: string;
  @IsUUID() conta_bancaria_id: string;
  @IsOptional() @IsUUID() contato_id?: string;
  @IsString() @IsNotEmpty() sacado_nome: string;
  @IsOptional() @IsString() sacado_cpf_cnpj?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) valor_nominal: number;
  @IsDateString() data_vencimento: string;
  @IsOptional() @IsDateString() data_emissao?: string;
  @IsOptional() @IsNumber() valor_desconto?: number;
  @IsOptional() @IsDateString() data_limite_desconto?: string;
  @IsOptional() @IsNumber() instrucao_protesto_dias?: number;
  @IsOptional() @IsNumber() instrucao_baixa_dias?: number;
  @IsOptional() @IsString() mensagem_1?: string;
  @IsOptional() @IsString() mensagem_2?: string;
  @IsOptional() @IsUUID() conta_receber_id?: string;
}
```

#### 7.3D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `CobrancasPage` | `app/(app)/financas/cobrancas-bancarias/page.tsx` | Server |
| `CobrancaTable` | `components/cobrancas/table.tsx` | `{ data, handlers }` |
| `CobrancaFormDialog` | `components/cobrancas/form-dialog.tsx` | `{ open, mode, cobranca? }` |
| `RemessaDialog` | `components/cobrancas/remessa-dialog.tsx` | `{ cobrancas, formato: 'cnab240' \| 'cnab400' }` |
| `RetornoUpload` | `components/cobrancas/retorno-upload.tsx` | `{ onUpload }` |
| `DdaPendentes` | `components/cobrancas/dda-pendentes.tsx` | `{ boletos, onVincular }` |

---

### 7.4 CATEGORIAS (Plano de Contas Hierarquico)

#### 7.4A. Schema: `categorias`

```sql
CREATE TABLE categorias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Hierarquia
  parent_id             UUID REFERENCES categorias(id) ON DELETE CASCADE,
  nivel                 INTEGER NOT NULL DEFAULT 1, -- 1=grupo, 2=subgrupo, 3=conta
  path                  TEXT NOT NULL, -- "1.01.003" para busca hierarquica
  
  -- Dados
  codigo                TEXT NOT NULL,
  nome                  TEXT NOT NULL,
  descricao             TEXT,
  
  -- Tipo
  tipo                  TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia')),
  natureza              TEXT CHECK (natureza IN ('operacional', 'nao_operacional', 'financeira', 'tributaria')),
  
  -- DRE mapping
  dre_grupo             TEXT, -- "Receita Bruta", "Deducoes", "CMV", "Despesas Operacionais", etc
  
  -- Status
  is_active             BOOLEAN DEFAULT true,
  is_system             BOOLEAN DEFAULT false, -- categorias padrão nao deletaveis
  
  -- Tiny sync
  tiny_id               BIGINT,
  tiny_nome_exato       TEXT, -- nome exato usado na API Tiny para criar contas
  
  -- Meta
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(org_id, codigo),
  UNIQUE(org_id, tiny_id)
);

CREATE INDEX idx_cat_org ON categorias(org_id);
CREATE INDEX idx_cat_parent ON categorias(parent_id);
CREATE INDEX idx_cat_tipo ON categorias(tipo);
CREATE INDEX idx_cat_path ON categorias(path);
CREATE INDEX idx_cat_nome_trgm ON categorias USING gin(nome gin_trgm_ops);
CREATE INDEX idx_cat_active ON categorias(is_active) WHERE is_active = true;

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cat_org ON categorias FOR ALL USING (org_id = get_org_id());
```

#### 7.4B. Endpoints

```
Module: CategoriasModule
Controller: /api/categorias

GET    /                           -- Arvore completa (hierarquica)
GET    /flat                       -- Lista plana (para selects)
GET    /:id                        -- Detalhe com filhos
POST   /                           -- Criar
PUT    /:id                        -- Atualizar
DELETE /:id                        -- Deletar (se nao system e sem filhos)
POST   /import                     -- Importar plano de contas (XLS do Tiny)
POST   /reorder                    -- Reordenar (drag and drop)
GET    /by-tipo/:tipo              -- Filtrar por receita/despesa
POST   /sync-tiny                  -- Sincronizar com Tiny
```

#### 7.4C. DTOs

```typescript
export class CreateCategoriaDto {
  @IsOptional() @IsUUID() parent_id?: string;
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() nome: string;
  @IsOptional() @IsString() descricao?: string;
  @IsEnum(['receita', 'despesa', 'transferencia']) tipo: string;
  @IsOptional() @IsEnum(['operacional', 'nao_operacional', 'financeira', 'tributaria']) natureza?: string;
  @IsOptional() @IsString() dre_grupo?: string;
}
```

#### 7.4D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `CategoriasPage` | `app/(app)/configuracoes/categorias/page.tsx` | Server |
| `CategoriaTree` | `components/categorias/tree.tsx` | `{ categorias: CategoriaNode[], onSelect, onDrag }` |
| `CategoriaTreeItem` | `components/categorias/tree-item.tsx` | `{ categoria, level, isExpanded, children }` |
| `CategoriaFormDialog` | `components/categorias/form-dialog.tsx` | `{ open, parent?, categoria?, mode }` |
| `CategoriaSelect` | `components/shared/categoria-select.tsx` | `{ tipo, value, onChange, placeholder }` |
| `PlanoContasImport` | `components/categorias/import-dialog.tsx` | `{ onUpload }` |

---

### 7.5 CONTAS BANCARIAS

#### 7.5A. Schema: `contas_bancarias`

```sql
CREATE TABLE contas_bancarias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Banco
  banco_codigo          VARCHAR(3),
  banco_nome            TEXT NOT NULL,
  agencia               TEXT,
  agencia_digito        VARCHAR(1),
  conta_numero          TEXT,
  conta_digito          VARCHAR(1),
  
  -- Tipo
  tipo                  TEXT NOT NULL 
                          CHECK (tipo IN ('corrente', 'poupanca', 'pagamento', 'cartao_credito', 'gateway', 'caixa')),
  
  -- Identificacao
  nome                  TEXT NOT NULL, -- "Sicoob - Industrias Neon", "Conta Simples - BlueLight"
  tiny_conta_origem     TEXT, -- nome exato no Tiny para campo contaOrigem na baixa
  
  -- Saldo
  saldo_inicial         NUMERIC(14,2) DEFAULT 0,
  saldo_atual           NUMERIC(14,2) DEFAULT 0,
  data_saldo            DATE,
  
  -- Gateway config
  source_type           TEXT CHECK (source_type IN ('ofx', 'api', 'csv', 'manual')),
  gateway_provider      TEXT, -- 'conta_simples', 'pagarme', 'appmax', 'sicoob'
  
  -- Flags
  is_active             BOOLEAN DEFAULT true,
  is_group_account      BOOLEAN DEFAULT false, -- para deteccao intercompany
  
  -- PIX
  pix_tipo              TEXT CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_chave             TEXT,
  
  -- Meta
  cor                   TEXT DEFAULT '#6B7280',
  icone                 TEXT DEFAULT 'building-2',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conta_bancaria_org ON contas_bancarias(org_id);
CREATE INDEX idx_conta_bancaria_company ON contas_bancarias(company_id);
CREATE INDEX idx_conta_bancaria_tipo ON contas_bancarias(tipo);
CREATE INDEX idx_conta_bancaria_active ON contas_bancarias(is_active);

ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY conta_bancaria_org ON contas_bancarias FOR ALL USING (org_id = get_org_id());
```

#### 7.5B. Endpoints

```
Module: ContasBancariasModule
Controller: /api/contas-bancarias

GET    /                           -- Listar por empresa
GET    /:id                        -- Detalhe com saldo
POST   /                           -- Criar
PUT    /:id                        -- Atualizar
DELETE /:id                        -- Desativar (soft)
GET    /:id/saldo                  -- Saldo detalhado com historico
GET    /:id/extrato-resumo         -- Resumo de movimentacoes (ultimos 30 dias)
POST   /:id/atualizar-saldo        -- Recalcular saldo a partir de transacoes
```

#### 7.5C. DTOs

```typescript
export class CreateContaBancariaDto {
  @IsUUID() company_id: string;
  @IsOptional() @IsString() @MaxLength(3) banco_codigo?: string;
  @IsString() @IsNotEmpty() banco_nome: string;
  @IsOptional() @IsString() agencia?: string;
  @IsOptional() @IsString() conta_numero?: string;
  @IsEnum(['corrente', 'poupanca', 'pagamento', 'cartao_credito', 'gateway', 'caixa']) tipo: string;
  @IsString() @IsNotEmpty() nome: string;
  @IsOptional() @IsString() tiny_conta_origem?: string;
  @IsOptional() @IsNumber() saldo_inicial?: number;
  @IsOptional() @IsEnum(['ofx', 'api', 'csv', 'manual']) source_type?: string;
  @IsOptional() @IsString() gateway_provider?: string;
  @IsOptional() @IsBoolean() is_group_account?: boolean;
  @IsOptional() @IsEnum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']) pix_tipo?: string;
  @IsOptional() @IsString() pix_chave?: string;
}
```

#### 7.5D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `ContasBancariasPage` | `app/(app)/configuracoes/contas-bancarias/page.tsx` | Server |
| `ContaBancariaCard` | `components/contas-bancarias/card.tsx` | `{ conta, onEdit, onDelete }` |
| `ContaBancariaGrid` | `components/contas-bancarias/grid.tsx` | `{ contas }` |
| `ContaBancariaFormDialog` | `components/contas-bancarias/form-dialog.tsx` | `{ open, conta?, mode }` |
| `ContaBancariaSelect` | `components/shared/conta-bancaria-select.tsx` | `{ companyId, value, onChange, tipoFilter? }` |
| `SaldoCard` | `components/contas-bancarias/saldo-card.tsx` | `{ saldo, dataAtualizacao }` |

---

### 7.6 MARCADORES (Tags Coloridas)

#### 7.6A. Schema: `marcadores`

```sql
CREATE TABLE marcadores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  descricao             TEXT NOT NULL,
  cor                   TEXT NOT NULL DEFAULT '#E91E63', -- rosa padrao (como no Tiny)
  
  -- Contagens (materialized, atualizado por trigger)
  count_cp              INTEGER DEFAULT 0,
  count_cr              INTEGER DEFAULT 0,
  
  is_system             BOOLEAN DEFAULT false, -- ex: "CLAUDE" nao deletavel
  
  created_at            TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(org_id, descricao)
);

CREATE INDEX idx_marcadores_org ON marcadores(org_id);
CREATE INDEX idx_marcadores_desc ON marcadores(descricao);

ALTER TABLE marcadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY marcadores_org ON marcadores FOR ALL USING (org_id = get_org_id());
```

#### 7.6B. Endpoints

```
Module: MarcadoresModule
Controller: /api/marcadores

GET    /                           -- Listar todos
POST   /                           -- Criar
PUT    /:id                        -- Atualizar (nome, cor)
DELETE /:id                        -- Deletar (se nao system)
GET    /:id/usage                  -- CPs e CRs que usam este marcador
```

#### 7.6C. DTOs

```typescript
export class CreateMarcadorDto {
  @IsString() @IsNotEmpty() @MaxLength(50) descricao: string;
  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/) cor?: string;
}
```

#### 7.6D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `MarcadoresPage` | `app/(app)/configuracoes/marcadores/page.tsx` | Server |
| `MarcadorList` | `components/marcadores/list.tsx` | `{ marcadores }` |
| `MarcadorFormDialog` | `components/marcadores/form-dialog.tsx` | `{ open, marcador? }` |
| `MarcadorColorPicker` | `components/marcadores/color-picker.tsx` | `{ value, onChange }` |
| `MarcadorMultiSelect` | `components/shared/marcador-multi-select.tsx` | `{ value: Marcador[], onChange, placeholder }` |
| `MarcadorBadge` | `components/shared/marcador-badge.tsx` | `{ descricao, cor }` |

---

### 7.7 FORMAS DE PAGAMENTO

#### 7.7A. Schema: `formas_pagamento`

```sql
CREATE TABLE formas_pagamento (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  nome                  TEXT NOT NULL,
  codigo                TEXT,
  tipo                  TEXT NOT NULL 
                          CHECK (tipo IN ('dinheiro','pix','boleto','cartao_credito','cartao_debito',
                                         'ted','doc','cheque','deposito','transferencia','gateway','outro')),
  
  -- Config
  icone                 TEXT DEFAULT 'credit-card',
  cor                   TEXT DEFAULT '#6B7280',
  taxa_percentual       NUMERIC(5,2) DEFAULT 0, -- taxa do gateway (ex: 3.5% Pagar.me)
  taxa_fixa             NUMERIC(14,2) DEFAULT 0, -- taxa fixa por transacao
  prazo_recebimento_dias INTEGER DEFAULT 0, -- D+X
  
  -- Tiny
  tiny_id               BIGINT,
  tiny_nome_exato       TEXT,
  
  is_active             BOOLEAN DEFAULT true,
  is_system             BOOLEAN DEFAULT false,
  
  created_at            TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(org_id, nome)
);

CREATE INDEX idx_forma_org ON formas_pagamento(org_id);
CREATE INDEX idx_forma_tipo ON formas_pagamento(tipo);
CREATE INDEX idx_forma_active ON formas_pagamento(is_active);

ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY forma_org ON formas_pagamento FOR ALL USING (org_id = get_org_id());
```

#### 7.7B. Endpoints

```
Module: FormasPagamentoModule
Controller: /api/formas-pagamento

GET    /                           -- Listar
POST   /                           -- Criar
PUT    /:id                        -- Atualizar
DELETE /:id                        -- Desativar
GET    /by-tipo/:tipo              -- Filtrar por tipo
```

#### 7.7C. DTOs

```typescript
export class CreateFormaPagamentoDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsOptional() @IsString() codigo?: string;
  @IsEnum(['dinheiro','pix','boleto','cartao_credito','cartao_debito','ted','doc','cheque','deposito','transferencia','gateway','outro']) tipo: string;
  @IsOptional() @IsString() icone?: string;
  @IsOptional() @IsNumber() taxa_percentual?: number;
  @IsOptional() @IsNumber() taxa_fixa?: number;
  @IsOptional() @IsNumber() prazo_recebimento_dias?: number;
}
```

#### 7.7D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `FormasPagamentoPage` | `app/(app)/configuracoes/formas-pagamento/page.tsx` | Server |
| `FormaPagamentoList` | `components/formas-pagamento/list.tsx` | `{ formas }` |
| `FormaPagamentoFormDialog` | `components/formas-pagamento/form-dialog.tsx` | `{ open, forma? }` |
| `FormaPagamentoSelect` | `components/shared/forma-pagamento-select.tsx` | `{ value, onChange, tipoFilter? }` |
| `FormaPagamentoIcon` | `components/shared/forma-pagamento-icon.tsx` | `{ tipo, size? }` |

---

### 7.8 RELATORIOS (DRE, Fluxo de Caixa, Aging, Balancete)

#### 7.8A. Schema — Nao requer tabela propria

Relatorios sao computados on-the-fly via queries sobre as tabelas existentes. Opcionalmente, views materializadas para performance:

```sql
-- View: DRE por periodo
CREATE MATERIALIZED VIEW mv_dre AS
SELECT 
  c.org_id,
  c.company_id,
  DATE_TRUNC('month', COALESCE(cp.data_pagamento, cr.data_recebimento, mc.data_movimentacao)) as periodo,
  cat.dre_grupo,
  cat.tipo,
  SUM(CASE WHEN cat.tipo = 'receita' THEN COALESCE(cr.valor_recebido, mc.valor) ELSE 0 END) as receitas,
  SUM(CASE WHEN cat.tipo = 'despesa' THEN COALESCE(cp.valor_pago, mc.valor) ELSE 0 END) as despesas
FROM categorias cat
LEFT JOIN contas_receber cr ON cr.categoria_id = cat.id AND cr.situacao = 'recebido'
LEFT JOIN contas_pagar cp ON cp.categoria_id = cat.id AND cp.situacao = 'pago'
LEFT JOIN movimentacoes_caixa mc ON mc.categoria_id = cat.id
CROSS JOIN companies c
WHERE cat.org_id = c.org_id
GROUP BY c.org_id, c.company_id, periodo, cat.dre_grupo, cat.tipo;

CREATE UNIQUE INDEX idx_mv_dre ON mv_dre(org_id, company_id, periodo, dre_grupo, tipo);

-- View: Aging (vencimento)
CREATE MATERIALIZED VIEW mv_aging_cp AS
SELECT 
  org_id, company_id,
  COUNT(*) FILTER (WHERE data_vencimento >= CURRENT_DATE) as a_vencer,
  COUNT(*) FILTER (WHERE CURRENT_DATE - data_vencimento BETWEEN 1 AND 30) as vencido_1_30,
  COUNT(*) FILTER (WHERE CURRENT_DATE - data_vencimento BETWEEN 31 AND 60) as vencido_31_60,
  COUNT(*) FILTER (WHERE CURRENT_DATE - data_vencimento BETWEEN 61 AND 90) as vencido_61_90,
  COUNT(*) FILTER (WHERE CURRENT_DATE - data_vencimento > 90) as vencido_90_mais,
  SUM(saldo) FILTER (WHERE data_vencimento >= CURRENT_DATE) as valor_a_vencer,
  SUM(saldo) FILTER (WHERE CURRENT_DATE - data_vencimento BETWEEN 1 AND 30) as valor_1_30,
  SUM(saldo) FILTER (WHERE CURRENT_DATE - data_vencimento BETWEEN 31 AND 60) as valor_31_60,
  SUM(saldo) FILTER (WHERE CURRENT_DATE - data_vencimento BETWEEN 61 AND 90) as valor_61_90,
  SUM(saldo) FILTER (WHERE CURRENT_DATE - data_vencimento > 90) as valor_90_mais
FROM contas_pagar
WHERE situacao IN ('aberto', 'atrasado') AND deleted_at IS NULL
GROUP BY org_id, company_id;

-- Refresh via Supabase cron job (pg_cron)
SELECT cron.schedule('refresh-dre', '*/15 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dre');
SELECT cron.schedule('refresh-aging', '0 */6 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_aging_cp');
```

#### 7.8B. Endpoints

```
Module: RelatoriosModule
Controller: /api/relatorios

GET    /dre                        -- DRE por periodo e empresa
GET    /dre/comparativo            -- DRE comparativo (mes a mes ou empresa a empresa)
GET    /fluxo-caixa                -- Fluxo de caixa (realizado + previsto)
GET    /fluxo-caixa/projecao       -- Projecao futura baseada em CR/CP abertas
GET    /aging/pagar                -- Aging contas a pagar
GET    /aging/receber              -- Aging contas a receber
GET    /balancete                  -- Balancete por categoria
GET    /conciliacao/progresso      -- Taxa de conciliacao por empresa/periodo
GET    /conciliacao/divergencias   -- Itens divergentes
GET    /export/:tipo               -- Exportar qualquer relatorio (XLSX/PDF)
```

#### 7.8C. DTOs

```typescript
export class RelatorioQueryDto {
  @IsUUID() company_id: string;
  @IsOptional() @IsDateString() periodo_de?: string;
  @IsOptional() @IsDateString() periodo_ate?: string;
  @IsOptional() @IsEnum(['mensal', 'trimestral', 'anual']) agrupamento?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) incluir_projecao?: boolean;
}

export class DreResponseDto {
  periodo: string;
  receita_bruta: number;
  deducoes: number;
  receita_liquida: number;
  custo_mercadoria_vendida: number;
  lucro_bruto: number;
  despesas_operacionais: number;
  despesas_administrativas: number;
  despesas_marketing: number;
  despesas_tecnologia: number;
  resultado_operacional: number;
  receitas_financeiras: number;
  despesas_financeiras: number;
  resultado_financeiro: number;
  resultado_antes_ir: number;
  margem_bruta_pct: number;
  margem_operacional_pct: number;
  margem_liquida_pct: number;
}

export class AgingResponseDto {
  faixas: {
    label: string;
    quantidade: number;
    valor: number;
    percentual: number;
  }[];
  total_quantidade: number;
  total_valor: number;
}
```

#### 7.8D. Componentes

| Componente | Arquivo | Props |
|---|---|---|
| `RelatoriosPage` | `app/(app)/financas/relatorios/page.tsx` | Server |
| `RelatorioSelector` | `components/relatorios/selector.tsx` | `{ tipoRelatorio, onChange }` |
| `DreReport` | `components/relatorios/dre.tsx` | `{ data: DreResponse[], periodo }` |
| `DreComparativo` | `components/relatorios/dre-comparativo.tsx` | `{ data, modoComparacao }` |
| `FluxoCaixaChart` | `components/relatorios/fluxo-caixa-chart.tsx` | `{ realizado, previsto, periodo }` |
| `AgingChart` | `components/relatorios/aging-chart.tsx` | `{ data: AgingResponse, tipo: 'pagar' \| 'receber' }` |
| `BalanceteTree` | `components/relatorios/balancete-tree.tsx` | `{ categorias, valores }` |
| `ExportButton` | `components/shared/export-button.tsx` | `{ onExport, formats: ('xlsx' \| 'pdf' \| 'csv')[] }` |

---

## 8. TABELA AUXILIAR: `audit_log`

```sql
CREATE TABLE audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,
  
  -- Evento
  action                TEXT NOT NULL, -- 'create', 'update', 'delete', 'baixa', 'estorno', 'reconcile', etc
  entity_type           TEXT NOT NULL, -- 'conta_pagar', 'conta_receber', 'contato', etc
  entity_id             UUID NOT NULL,
  
  -- Ator
  actor_id              UUID,
  actor_type            TEXT CHECK (actor_type IN ('user', 'system', 'ai', 'sync')),
  actor_name            TEXT,
  
  -- Mudancas
  changes               JSONB, -- { before: {...}, after: {...} }
  metadata              JSONB, -- { ip, user_agent, reason, etc }
  
  -- Timestamp
  created_at            TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Particoes mensais
CREATE TABLE audit_log_2026_01 PARTITION OF audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_log_2026_02 PARTITION OF audit_log
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... ate 2026_12

CREATE INDEX idx_audit_org ON audit_log(org_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_date ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- SELECT only para users (IMUTAVEL)
CREATE POLICY audit_select ON audit_log FOR SELECT USING (org_id = get_org_id());
-- INSERT only via service_role (backend)
```

---

## 9. DIAGRAMA DE RELACIONAMENTOS COMPLETO

```
organizations (1)
  |
  +-- companies (N)
  |     |
  |     +-- contas_bancarias (N)
  |     |     +-- extratos_bancarios (N)
  |     |     +-- import_batches (N)
  |     |     +-- movimentacoes_caixa (N)
  |     |     +-- cobrancas_bancarias (N)
  |     |
  |     +-- contas_pagar (N)
  |     +-- contas_receber (N)
  |     +-- contatos (N)
  |
  +-- org_members (N) -- profiles (N)
  +-- categorias (N, hierarquico via parent_id)
  +-- marcadores (N)
  +-- formas_pagamento (N)
  +-- audit_log (N, particionado)

contatos (1) --< contas_pagar (N)     via contato_id
contatos (1) --< contas_receber (N)   via contato_id
contatos (1) --< cobrancas_bancarias (N) via contato_id

categorias (1) --< contas_pagar (N)   via categoria_id
categorias (1) --< contas_receber (N) via categoria_id
categorias (1) --< extratos_bancarios (N) via categoria_id
categorias (1) --< movimentacoes_caixa (N) via categoria_id

formas_pagamento (1) --< contas_pagar (N)   via forma_pagamento_id
formas_pagamento (1) --< contas_receber (N) via forma_pagamento_id

contas_bancarias (1) --< contas_pagar (N)   via conta_bancaria_id
contas_bancarias (1) --< contas_receber (N) via conta_bancaria_id

cobrancas_bancarias (N) --> contas_receber (1) via conta_receber_id
```

---

## 10. MODULOS NESTJS — ESTRUTURA COMPLETA

```
src/
  main.ts
  app.module.ts
  
  common/
    guards/
      jwt-auth.guard.ts           -- Valida JWT do Supabase
      roles.guard.ts              -- RBAC: owner/admin/accountant/viewer
    decorators/
      current-user.decorator.ts   -- @CurrentUser() extrai user do JWT
      roles.decorator.ts          -- @Roles('admin', 'accountant')
      org-id.decorator.ts         -- @OrgId() extrai org_id
    filters/
      http-exception.filter.ts
      typeorm-exception.filter.ts
    interceptors/
      audit-log.interceptor.ts    -- Grava audit_log automaticamente
      response-transform.interceptor.ts
    pipes/
      cpf-cnpj-validation.pipe.ts
    validators/
      cpf-cnpj.validator.ts       -- Custom class-validator
      cep.validator.ts
    
  modules/
    auth/
      auth.module.ts
      auth.controller.ts          -- GET /health, GET /ready, GET /me
      auth.service.ts
      strategies/
        supabase-jwt.strategy.ts
    
    organizations/
      organizations.module.ts
      organizations.controller.ts
      organizations.service.ts
      entities/
        organization.entity.ts
        company.entity.ts
        org-member.entity.ts
        profile.entity.ts
      dto/
        create-organization.dto.ts
        create-company.dto.ts
        invite-member.dto.ts
    
    contatos/
      contatos.module.ts
      contatos.controller.ts
      contatos.service.ts
      entities/contato.entity.ts
      dto/
        create-contato.dto.ts
        update-contato.dto.ts
        list-contatos-query.dto.ts
      services/
        cnpj-lookup.service.ts    -- ReceitaWS / BrasilAPI
        cep-lookup.service.ts     -- ViaCEP
    
    contas-pagar/
      contas-pagar.module.ts
      contas-pagar.controller.ts
      contas-pagar.service.ts
      entities/conta-pagar.entity.ts
      dto/ (todos os DTOs listados acima)
    
    contas-receber/
      contas-receber.module.ts
      contas-receber.controller.ts
      contas-receber.service.ts
      entities/conta-receber.entity.ts
      dto/
    
    caixa/
      caixa.module.ts
      caixa.controller.ts
      caixa.service.ts
      entities/movimentacao-caixa.entity.ts
      dto/
    
    extratos-bancarios/
      extratos-bancarios.module.ts
      extratos-bancarios.controller.ts
      extratos-bancarios.service.ts
      entities/
        extrato-bancario.entity.ts
        import-batch.entity.ts
      dto/
      parsers/
        ofx.parser.ts             -- Parse OFX com deteccao encoding Latin-1/UTF-8
        csv.parser.ts             -- Parse CSV generico
        appmax-csv.parser.ts      -- Parse CSV AppMax especifico
    
    cobrancas/
      cobrancas.module.ts
      cobrancas.controller.ts
      cobrancas.service.ts
      entities/cobranca-bancaria.entity.ts
      dto/
      services/
        cnab-generator.service.ts -- Gera CNAB 240/400
        cnab-parser.service.ts    -- Processa retorno
    
    categorias/
      categorias.module.ts
      categorias.controller.ts
      categorias.service.ts
      entities/categoria.entity.ts
      dto/
    
    contas-bancarias/
      contas-bancarias.module.ts
      contas-bancarias.controller.ts
      contas-bancarias.service.ts
      entities/conta-bancaria.entity.ts
      dto/
    
    marcadores/
      marcadores.module.ts
      marcadores.controller.ts
      marcadores.service.ts
      entities/marcador.entity.ts
      dto/
    
    formas-pagamento/
      formas-pagamento.module.ts
      formas-pagamento.controller.ts
      formas-pagamento.service.ts
      entities/forma-pagamento.entity.ts
      dto/
    
    relatorios/
      relatorios.module.ts
      relatorios.controller.ts
      relatorios.service.ts
      dto/
      builders/
        dre.builder.ts
        fluxo-caixa.builder.ts
        aging.builder.ts
        balancete.builder.ts
    
    audit/
      audit.module.ts
      audit.controller.ts
      audit.service.ts
      entities/audit-log.entity.ts
    
    tiny-sync/
      tiny-sync.module.ts
      tiny-sync.controller.ts
      tiny-sync.service.ts
      clients/
        tiny-v2.client.ts
        tiny-v3.client.ts
      processors/
        sync-cp.processor.ts
        sync-cr.processor.ts
    
    bank-sync/
      bank-sync.module.ts
      bank-sync.controller.ts
      bank-sync.service.ts
      clients/
        conta-simples.client.ts
        pagarme.client.ts
    
    reconciliation/
      reconciliation.module.ts
      reconciliation.controller.ts
      reconciliation.service.ts
      entities/
        reconciliation.entity.ts
        reconciliation-session.entity.ts
      engine/
        exact-matcher.ts
        fuzzy-matcher.ts
        split-matcher.ts
        auto-reconciler.ts
    
    ai-matching/
      ai-matching.module.ts
      ai-matching.controller.ts
      ai-matching.service.ts
      entities/ai-suggestion.entity.ts
      prompt-builder.service.ts
      learning.service.ts
    
    jobs/
      jobs.module.ts
      jobs.controller.ts
      queues/
        tiny-sync.queue.ts
        bank-sync.queue.ts
        ai-suggestions.queue.ts
        import-batch.queue.ts
```

---

## 11. SWAGGER / OPENAPI

Cada endpoint decorado com `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`. O NestJS gera documentacao automatica em `/api/docs`.

Exemplo para Contas a Pagar:

```typescript
@ApiTags('Contas a Pagar')
@ApiBearerAuth()
@Controller('api/contas-pagar')
export class ContasPagarController {
  
  @Get()
  @ApiOperation({ summary: 'Listar contas a pagar com filtros e paginacao' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'situacao', required: false, enum: ['aberto','emitido','pago','atrasado','cancelado'] })
  @ApiResponse({ status: 200, description: 'Lista paginada com summary de totais por status' })
  async list(@Query() query: ListContasPagarQueryDto, @OrgId() orgId: string) {}
  
  @Post()
  @ApiOperation({ summary: 'Criar nova conta a pagar' })
  @ApiBody({ type: CreateContaPagarDto })
  @ApiResponse({ status: 201, description: 'Conta criada' })
  async create(@Body() dto: CreateContaPagarDto, @OrgId() orgId: string, @CurrentUser() user: Profile) {}
  
  @Post(':id/baixar')
  @ApiOperation({ summary: 'Registrar pagamento (baixa) de uma conta' })
  @ApiBody({ type: BaixarContaPagarDto })
  @ApiResponse({ status: 200, description: 'Baixa registrada com sucesso' })
  async baixar(@Param('id') id: string, @Body() dto: BaixarContaPagarDto) {}
}
```

---

## 12. VALIDACOES COMPARTILHADAS (Custom Validators)

### CPF/CNPJ Validator

```typescript
@ValidatorConstraint({ name: 'cpfCnpj', async: false })
export class CpfCnpjValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    if (!value) return true; // @IsOptional cuida da obrigatoriedade
    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) return this.validaCpf(clean);
    if (clean.length === 14) return this.validaCnpj(clean);
    return false;
  }
  
  private validaCpf(cpf: string): boolean {
    if (/^(\d)\1+$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(cpf[10]);
  }
  
  private validaCnpj(cnpj: string): boolean {
    if (/^(\d)\1+$/.test(cnpj)) return false;
    const pesos1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    const pesos2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let soma = pesos1.reduce((s, p, i) => s + parseInt(cnpj[i]) * p, 0);
    let dig = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (dig !== parseInt(cnpj[12])) return false;
    soma = pesos2.reduce((s, p, i) => s + parseInt(cnpj[i]) * p, 0);
    dig = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return dig === parseInt(cnpj[13]);
  }
  
  defaultMessage() { return 'CPF ou CNPJ inválido'; }
}
```

### CEP Validator

```typescript
@ValidatorConstraint({ name: 'cep', async: false })
export class CepValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    if (!value) return true;
    return /^\d{5}-?\d{3}$/.test(value);
  }
  defaultMessage() { return 'CEP deve ter 8 dígitos (formato XXXXX-XXX)'; }
}
```

---

## 13. FRONTEND — HOOKS E DATA FETCHING

Padrao React Query (TanStack) consistente para todos os modulos:

```typescript
// hooks/use-contas-pagar.ts
export function useContasPagar(filters: ContasPagarFilters) {
  return useQuery({
    queryKey: ['contas-pagar', filters],
    queryFn: () => api.get('/api/contas-pagar', { params: filters }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

export function useCreateContaPagar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateContaPagarDto) => api.post('/api/contas-pagar', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Conta a pagar criada com sucesso');
    },
  });
}

export function useBaixarContaPagar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: BaixarContaPagarDto }) =>
      api.post(`/api/contas-pagar/${id}/baixar`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Pagamento registrado');
    },
  });
}
```

Hooks analogos para cada modulo: `useContasReceber`, `useContatos`, `useCaixa`, `useExtratos`, `useCobrancas`, `useCategorias`, `useContasBancarias`, `useMarcadores`, `useFormasPagamento`, `useRelatorios`.

---

## 14. DESIGN SYSTEM (shadcn/ui + Tailwind Customizado)

```typescript
// tailwind.config.ts (extencao relevante)
{
  theme: {
    extend: {
      colors: {
        // Tiny ERP blue como primary
        primary: { DEFAULT: '#2563EB', foreground: '#FFFFFF' },
        // Status colors identicos ao Tiny
        'status-aberto': '#22C55E',
        'status-pago': '#6B7280',
        'status-atrasado': '#EF4444',
        'status-cancelado': '#9CA3AF',
        'status-emitido': '#3B82F6',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'], // valores monetarios
      },
    },
  },
}
```

Componentes shadcn/ui utilizados: Button, Input, Select, Table, Dialog, Sheet, Tabs, Badge, Breadcrumb, Command (Ctrl+K), DropdownMenu, ContextMenu, Checkbox, Calendar, DatePicker, Pagination, Skeleton, Toast (Sonner), Tooltip, Toggle, ToggleGroup, ResizablePanel.

---

## 15. SEQUENCIA DE IMPLEMENTACAO RECOMENDADA

| Sprint | Foco | Tabelas | Endpoints | Componentes |
|---|---|---|---|---|
| 1 | Core + Auth | organizations, profiles, org_members, companies | Auth (3), Org (15) | Login, Layout, Sidebar |
| 2 | Cadastros | contatos, categorias, marcadores, formas_pagamento, contas_bancarias | Contatos (12), Categorias (10), Marcadores (5), Formas (5), Contas Bancarias (8) | Formularios de cadastro |
| 3 | Financeiro Core | contas_pagar, contas_receber | CP (17), CR (18) | Listagens CP/CR |
| 4 | Caixa + Extratos | movimentacoes_caixa, extratos_bancarios, import_batches | Caixa (8), Extratos (12) | Caixa, Import OFX |
| 5 | Cobrancas + Relatorios | cobrancas_bancarias, audit_log, views materializadas | Cobrancas (12), Relatorios (10), Audit (3) | Cobrancas, DRE, Aging |
| 6 | Sync + Inteligencia | reconciliations, ai_suggestions, patterns | TinySync (10), BankSync (12), Reconciliation (10), AI (7) | Tela de conciliacao |

**Total: 25 tabelas, ~170 endpoints, ~80 componentes React.**

---

## 16. DECISOES ARQUITETURAIS E TRADE-OFFS

1. **TypeORM em vez de Prisma**: O PRD existente ja usa TypeORM. Prisma seria mais type-safe, mas TypeORM suporta melhor raw queries complexas necessarias para reconciliacao (subset sum, trigram search, CTE hierarquico das categorias).

2. **Dados inline vs referencia pura nas CP/CR**: Os campos `fornecedor_nome`, `categoria_nome`, etc. sao duplicados (tanto como FK quanto como texto inline). Isso e intencional -- replica o comportamento do Tiny que armazena o valor no momento da criacao, mesmo que o cadastro mude depois. A FK permite relacionamentos, o texto inline garante historico.

3. **Soft delete em todas as tabelas financeiras**: Nenhum registro financeiro e fisicamente deletado. O campo `deleted_at` e filtrado nos indices parciais (`WHERE deleted_at IS NULL`).

4. **JSONB para marcadores nas CP/CR**: Em vez de tabela de juncao, o array de marcadores e armazenado como JSONB na propria linha. Isso simplifica queries e replica o modelo do Tiny. A tabela `marcadores` serve como catalogo master.

5. **Particionamento do audit_log**: Com volume estimado de 10k+ registros/mes, particionamento por mes garante performance de leitura sem impactar insert.

6. **Views materializadas para relatorios**: DRE e Aging sao computados via materialized views refreshed a cada 15 minutos. Isso evita queries pesadas em tempo real enquanto mantem dados suficientemente atualizados.

---

### Critical Files for Implementation

- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md` — PRD existente com 800+ linhas de especificacao do backend de conciliacao, design system, e sprint breakdown que deve ser integrado com esta arquitetura
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` — Regras de negocio criticas (limitacoes Tiny V2/V3, regras de baixa, mapeamento Conta Simples -> categorias) que alimentam validacoes e logica de sync
- `C:/CLAUDECODE/darksales-lovable/supabase/migrations/001_full_schema.sql` — Pattern multi-tenant (organizations, profiles, org_members, get_org_id(), RLS) ja validado que serve de base para as 25 tabelas do BPO
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/criar_contas_pagar.js` — Logica real de criacao de CP via Tiny API V3 (mapas de fornecedores, categorias, classificacao) que deve ser replicada no modulo NestJS TinySync
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliacao_titulos.js` — Logica de matching pedidos vs CRs que define as regras do motor de reconciliacao (tolerancia de valores, janela de datas, parsing de parcelas)

---

# PARTE II — ESTRUTURA DO PROJETO, CONFIGURAÇÕES E MÓDULOS

> Monorepo Turborepo, Next.js App Router, NestJS modules, TypeORM entities, migrations, CI/CD.

---


---

# BPO FINANCEIRO -- ARQUITETURA COMPLETA DO MONOREPO

## 1. Estrutura de Diretorios Completa

```
bpo-financeiro/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                          # Pipeline CI: lint, type-check, test, build
│   │   ├── deploy-preview.yml              # Deploy preview por PR (Vercel + Render)
│   │   └── deploy-production.yml           # Deploy producao (merge em main)
│   ├── PULL_REQUEST_TEMPLATE.md            # Template PR com checklist
│   └── CODEOWNERS                          # Owners por diretorio
│
├── .husky/
│   ├── pre-commit                          # lint-staged
│   └── commit-msg                          # commitlint
│
├── .vscode/
│   ├── settings.json                       # Workspace settings (formatOnSave, eslint)
│   ├── extensions.json                     # Extensoes recomendadas
│   └── launch.json                         # Debug configs (NestJS + Next.js)
│
├── apps/
│   ├── web/                                # ===== NEXT.JS 14 FRONTEND =====
│   │   ├── app/                            # App Router (todas as rotas)
│   │   │   ├── (auth)/                     # Route group autenticacao (sem layout dashboard)
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx            # Tela login (email+senha, magic link)
│   │   │   │   ├── cadastro/
│   │   │   │   │   └── page.tsx            # Tela cadastro (nome, email, senha)
│   │   │   │   ├── esqueci-senha/
│   │   │   │   │   └── page.tsx            # Reset password flow
│   │   │   │   ├── callback/
│   │   │   │   │   └── page.tsx            # OAuth/magic link callback handler
│   │   │   │   └── layout.tsx              # Layout auth (card centralizado, sem sidebar)
│   │   │   │
│   │   │   ├── (onboarding)/               # Route group onboarding wizard
│   │   │   │   ├── onboarding/
│   │   │   │   │   └── page.tsx            # Wizard 5 steps (org, empresa, tiny, banco, sync)
│   │   │   │   └── layout.tsx              # Layout onboarding (progress bar, sem sidebar)
│   │   │   │
│   │   │   ├── (dashboard)/                # Route group principal (com sidebar+topbar)
│   │   │   │   ├── layout.tsx              # DashboardLayout: sidebar + topbar + outlet
│   │   │   │   ├── page.tsx                # Redirect para /dashboard
│   │   │   │   │
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx            # KPIs, progresso empresa, alertas, atividade
│   │   │   │   │
│   │   │   │   ├── financas/
│   │   │   │   │   ├── contas-a-pagar/
│   │   │   │   │   │   ├── page.tsx        # Lista CP com filtros, sync status, bulk actions
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   └── page.tsx    # Detalhe CP (dados, historico, conciliacao vinculada)
│   │   │   │   │   │   └── loading.tsx     # Skeleton loader
│   │   │   │   │   │
│   │   │   │   │   ├── contas-a-receber/
│   │   │   │   │   │   ├── page.tsx        # Lista CR com filtros, parcelas agrupadas
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   └── page.tsx    # Detalhe CR
│   │   │   │   │   │   └── loading.tsx
│   │   │   │   │   │
│   │   │   │   │   ├── extratos/
│   │   │   │   │   │   ├── page.tsx        # Lista transacoes bancarias, filtros, status
│   │   │   │   │   │   ├── importar/
│   │   │   │   │   │   │   └── page.tsx    # Import center: drag-drop OFX/CSV, preview, batch
│   │   │   │   │   │   └── loading.tsx
│   │   │   │   │   │
│   │   │   │   │   ├── cobrancas/
│   │   │   │   │   │   └── page.tsx        # Parcelas vencidas, envio de cobrancas
│   │   │   │   │   │
│   │   │   │   │   ├── caixa/
│   │   │   │   │   │   └── page.tsx        # Fluxo de caixa diario/semanal/mensal
│   │   │   │   │   │
│   │   │   │   │   └── relatorios/
│   │   │   │   │       ├── page.tsx        # Hub de relatorios (DRE, balancete, export)
│   │   │   │   │       ├── dre/
│   │   │   │   │       │   └── page.tsx    # DRE em tempo real
│   │   │   │   │       ├── fluxo-caixa/
│   │   │   │   │       │   └── page.tsx    # Fluxo de caixa projetado
│   │   │   │   │       └── previsoes/
│   │   │   │   │           └── page.tsx    # Oraculo de recebimentos (preditive)
│   │   │   │   │
│   │   │   │   ├── cadastros/
│   │   │   │   │   ├── clientes-fornecedores/
│   │   │   │   │   │   ├── page.tsx        # Lista contatos (cliente/fornecedor/transportador)
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   └── page.tsx    # Detalhe contato: dados, historico, padroes
│   │   │   │   │   │   └── loading.tsx
│   │   │   │   │   │
│   │   │   │   │   ├── categorias/
│   │   │   │   │   │   └── page.tsx        # Arvore hierarquica de categorias (receita/despesa)
│   │   │   │   │   │
│   │   │   │   │   ├── contas-bancarias/
│   │   │   │   │   │   └── page.tsx        # CRUD contas bancarias por empresa
│   │   │   │   │   │
│   │   │   │   │   ├── centros-custo/
│   │   │   │   │   │   └── page.tsx        # Centros de custo por empresa
│   │   │   │   │   │
│   │   │   │   │   ├── formas-pagamento/
│   │   │   │   │   │   └── page.tsx        # Formas de pagamento
│   │   │   │   │   │
│   │   │   │   │   └── marcadores/
│   │   │   │   │       └── page.tsx        # Marcadores/tags (ex: CLAUDE)
│   │   │   │   │
│   │   │   │   ├── conciliacao/
│   │   │   │   │   ├── page.tsx            # Tela split-screen principal (extrato vs contas)
│   │   │   │   │   ├── sessoes/
│   │   │   │   │   │   └── page.tsx        # Historico de sessoes de conciliacao
│   │   │   │   │   ├── padroes/
│   │   │   │   │   │   └── page.tsx        # Padroes aprendidos (Pattern Memory Engine)
│   │   │   │   │   ├── regras/
│   │   │   │   │   │   └── page.tsx        # Builder visual de regras de tolerancia
│   │   │   │   │   ├── intercompany/
│   │   │   │   │   │   └── page.tsx        # Conciliacao cross-company (Sankey)
│   │   │   │   │   └── loading.tsx
│   │   │   │   │
│   │   │   │   ├── configuracoes/
│   │   │   │   │   ├── page.tsx            # Hub configuracoes (redirect)
│   │   │   │   │   ├── perfil/
│   │   │   │   │   │   └── page.tsx        # Perfil usuario
│   │   │   │   │   ├── organizacao/
│   │   │   │   │   │   └── page.tsx        # Config org (nome, logo, plano)
│   │   │   │   │   ├── empresas/
│   │   │   │   │   │   ├── page.tsx        # Grid cards empresas do grupo
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       └── page.tsx    # Config empresa (cnpj, cor, credenciais)
│   │   │   │   │   ├── integracoes/
│   │   │   │   │   │   └── page.tsx        # Cards integracao (Tiny, Conta Simples, Pagar.me)
│   │   │   │   │   ├── usuarios/
│   │   │   │   │   │   └── page.tsx        # Gestao usuarios, convites, roles
│   │   │   │   │   ├── categorias-mapeamento/
│   │   │   │   │   │   └── page.tsx        # Mapeamento Conta Simples CC -> Tiny categoria
│   │   │   │   │   └── notificacoes/
│   │   │   │   │       └── page.tsx        # Preferencias de notificacao
│   │   │   │   │
│   │   │   │   ├── auditoria/
│   │   │   │   │   └── page.tsx            # Timeline imutavel, filtros, export
│   │   │   │   │
│   │   │   │   └── ia/
│   │   │   │       ├── sugestoes/
│   │   │   │       │   └── page.tsx        # Lista sugestoes IA, aceitar/rejeitar
│   │   │   │       └── custos/
│   │   │   │           └── page.tsx        # Monitoramento custos IA (tokens, custo/mes)
│   │   │   │
│   │   │   ├── portal/                     # Portal do cliente (auth separada)
│   │   │   │   ├── layout.tsx              # Layout portal (branding do cliente)
│   │   │   │   ├── page.tsx                # Dashboard cliente (faturas, pagamentos)
│   │   │   │   ├── faturas/
│   │   │   │   │   └── page.tsx            # Faturas do cliente
│   │   │   │   └── pagamentos/
│   │   │   │       └── page.tsx            # Historico pagamentos
│   │   │   │
│   │   │   ├── api/                        # API routes Next.js (BFF)
│   │   │   │   ├── auth/
│   │   │   │   │   └── callback/
│   │   │   │   │       └── route.ts        # Supabase auth callback handler
│   │   │   │   └── health/
│   │   │   │       └── route.ts            # Health check
│   │   │   │
│   │   │   ├── layout.tsx                  # Root layout (providers, fonts, metadata)
│   │   │   ├── loading.tsx                 # Global loading
│   │   │   ├── not-found.tsx               # 404 page
│   │   │   ├── error.tsx                   # Error boundary global
│   │   │   └── globals.css                 # Tailwind imports + CSS variables design system
│   │   │
│   │   ├── components/                     # Componentes especificos do app
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx             # Sidebar colapsivel (240px/56px)
│   │   │   │   ├── sidebar-item.tsx        # Item sidebar com badge
│   │   │   │   ├── topbar.tsx              # Topbar (breadcrumb, search, bell, avatar)
│   │   │   │   ├── company-selector.tsx    # Dropdown seletor empresa (cor dot + nome)
│   │   │   │   ├── breadcrumb-nav.tsx      # Breadcrumb automatico
│   │   │   │   └── command-palette.tsx     # cmdk dialog (Ctrl+K)
│   │   │   │
│   │   │   ├── conciliacao/
│   │   │   │   ├── split-screen.tsx        # Container principal ResizablePanel
│   │   │   │   ├── bank-panel.tsx          # Painel esquerdo (extrato bancario)
│   │   │   │   ├── contas-panel.tsx        # Painel direito (CP/CR)
│   │   │   │   ├── transaction-row.tsx     # Linha transacao banco (virtualized)
│   │   │   │   ├── conta-row.tsx           # Linha conta pagar/receber (virtualized)
│   │   │   │   ├── selection-summary.tsx   # Bottom bar (totais, diferenca, botoes)
│   │   │   │   ├── reconcile-button.tsx    # Botao conciliar com animacao
│   │   │   │   ├── reverse-button.tsx      # Botao estornar com confirmacao
│   │   │   │   ├── ai-suggestion-drawer.tsx # Sheet lateral sugestoes IA
│   │   │   │   ├── ai-match-lines.tsx      # SVG lines entre paineis (AI matches)
│   │   │   │   ├── filter-bar.tsx          # Barra filtros (search, amount, status)
│   │   │   │   ├── detail-modal.tsx        # Dialog detalhe (dados, historico, relacionados)
│   │   │   │   └── session-info.tsx        # Info sessao (tempo, count)
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── kpi-card.tsx            # Card KPI (icon, label, valor, trend)
│   │   │   │   ├── company-progress.tsx    # Barra progresso por empresa
│   │   │   │   ├── alerts-card.tsx         # Card alertas (severity icons)
│   │   │   │   ├── activity-timeline.tsx   # Timeline atividade recente
│   │   │   │   ├── quick-actions.tsx       # Grid 2x2 acoes rapidas
│   │   │   │   └── heatmap-chart.tsx       # Heatmap confianca conciliacao
│   │   │   │
│   │   │   ├── financas/
│   │   │   │   ├── conta-form.tsx          # Form criar/editar conta (CP ou CR)
│   │   │   │   ├── import-dropzone.tsx     # Drag-drop zone OFX/CSV
│   │   │   │   ├── import-preview.tsx      # Preview transacoes importadas
│   │   │   │   ├── import-progress.tsx     # Progress bar importacao
│   │   │   │   ├── dre-widget.tsx          # Mini-DRE inline (impacto conciliacao)
│   │   │   │   └── installment-tracker.tsx # Card progresso parcelamento
│   │   │   │
│   │   │   ├── cadastros/
│   │   │   │   ├── contato-form.tsx        # Form contato (cliente/fornecedor)
│   │   │   │   ├── categoria-tree.tsx      # Arvore hierarquica categorias
│   │   │   │   └── conta-bancaria-form.tsx # Form conta bancaria
│   │   │   │
│   │   │   ├── configuracoes/
│   │   │   │   ├── integration-card.tsx    # Card integracao (status, testar, config)
│   │   │   │   ├── user-invite-modal.tsx   # Modal convite usuario
│   │   │   │   ├── role-badge.tsx          # Badge role (admin, supervisor, etc)
│   │   │   │   └── category-mapping.tsx    # Tabela mapeamento categorias
│   │   │   │
│   │   │   ├── auditoria/
│   │   │   │   ├── audit-timeline.tsx      # Timeline imutavel
│   │   │   │   └── audit-detail.tsx        # Expandable JSON diff
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── data-table.tsx          # DataTable generico (sort, filter, pagination)
│   │   │       ├── money-display.tsx       # Formata R$ com JetBrains Mono
│   │   │       ├── date-range-picker.tsx   # Dual calendar com presets
│   │   │       ├── status-badge.tsx        # Badge status (pendente, conciliado, etc)
│   │   │       ├── empty-state.tsx         # Empty state (icon + titulo + CTA)
│   │   │       ├── skeleton-card.tsx       # Skeleton loader generico
│   │   │       ├── confirm-dialog.tsx      # Dialog confirmacao (estorno, delete)
│   │   │       ├── export-button.tsx       # Botao export XLSX/CSV/PDF
│   │   │       ├── sync-status.tsx         # Indicador sync (dot + texto + refresh)
│   │   │       └── cnpj-input.tsx          # Input CNPJ com mascara e validacao
│   │   │
│   │   ├── hooks/
│   │   │   ├── use-auth.ts                 # Hook autenticacao (user, login, logout)
│   │   │   ├── use-company.ts              # Hook empresa selecionada (context)
│   │   │   ├── use-org.ts                  # Hook organizacao atual
│   │   │   ├── use-reconciliation.ts       # Hook estado conciliacao (selecao, totais)
│   │   │   ├── use-keyboard-shortcuts.ts   # Hook atalhos teclado (Space, Ctrl+Enter, etc)
│   │   │   ├── use-realtime.ts             # Hook Supabase Realtime subscriptions
│   │   │   ├── use-debounce.ts             # Debounce generico
│   │   │   ├── use-virtual-list.ts         # Wrapper react-window
│   │   │   ├── use-toast-actions.ts        # Toast com acoes (desfazer, etc)
│   │   │   ├── use-media-query.ts          # Responsive breakpoints
│   │   │   └── use-local-storage.ts        # Persistencia local (filtros, preferencias)
│   │   │
│   │   ├── lib/
│   │   │   ├── api-client.ts               # Axios/fetch wrapper (base URL, auth header, retry)
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts               # Supabase browser client
│   │   │   │   ├── server.ts               # Supabase server client (RSC)
│   │   │   │   └── middleware.ts            # Supabase auth middleware
│   │   │   ├── utils.ts                    # cn(), formatCurrency(), formatDate()
│   │   │   ├── constants.ts                # Constantes UI (page sizes, debounce times)
│   │   │   └── query-keys.ts               # TanStack Query key factory
│   │   │
│   │   ├── services/                       # TanStack Query hooks por dominio
│   │   │   ├── auth.service.ts             # Queries/mutations auth
│   │   │   ├── dashboard.service.ts        # Queries KPIs, heatmap
│   │   │   ├── contas-pagar.service.ts     # CRUD CP
│   │   │   ├── contas-receber.service.ts   # CRUD CR
│   │   │   ├── transacoes.service.ts       # Transacoes bancarias
│   │   │   ├── conciliacao.service.ts      # Reconciliation CRUD
│   │   │   ├── importacao.service.ts       # Import OFX/CSV
│   │   │   ├── integracoes.service.ts      # Sync, test connection
│   │   │   ├── ai-sugestoes.service.ts     # Sugestoes IA
│   │   │   ├── auditoria.service.ts        # Audit log queries
│   │   │   ├── contatos.service.ts         # CRUD contatos
│   │   │   ├── categorias.service.ts       # CRUD categorias
│   │   │   ├── usuarios.service.ts         # Gestao usuarios
│   │   │   └── notificacoes.service.ts     # Notificacoes
│   │   │
│   │   ├── stores/                         # Zustand stores
│   │   │   ├── auth.store.ts               # Estado auth (user, org, session)
│   │   │   ├── company.store.ts            # Empresa selecionada, lista empresas
│   │   │   ├── reconciliation.store.ts     # Estado conciliacao (selecao, filtros, sessao)
│   │   │   ├── sidebar.store.ts            # Estado sidebar (collapsed, active item)
│   │   │   ├── notification.store.ts       # Contadores notificacao, unread
│   │   │   └── theme.store.ts              # Dark/light mode
│   │   │
│   │   ├── types/                          # Tipos locais do frontend
│   │   │   └── index.ts                    # Re-export de @bpo/shared + tipos UI
│   │   │
│   │   ├── middleware.ts                   # Next.js middleware (auth redirect, tenant)
│   │   ├── next.config.ts                  # Config Next.js
│   │   ├── tailwind.config.ts              # Tailwind + design tokens
│   │   ├── postcss.config.mjs              # PostCSS config
│   │   ├── tsconfig.json                   # TypeScript config (extends base)
│   │   ├── package.json                    # Dependencies web
│   │   └── .env.local                      # Env vars frontend (NEXT_PUBLIC_*)
│   │
│   └── api/                                # ===== NESTJS BACKEND =====
│       ├── src/
│       │   ├── main.ts                     # Bootstrap (swagger, cors, validation, helmet)
│       │   ├── app.module.ts               # Root module (imports all modules)
│       │   ├── app.controller.ts           # Health check /api/health
│       │   │
│       │   ├── common/                     # Shared backend infrastructure
│       │   │   ├── guards/
│       │   │   │   ├── auth.guard.ts       # Valida Supabase JWT (JWKS)
│       │   │   │   ├── roles.guard.ts      # RBAC (owner, admin, accountant, viewer)
│       │   │   │   └── throttle.guard.ts   # Rate limiting customizado
│       │   │   │
│       │   │   ├── decorators/
│       │   │   │   ├── current-user.decorator.ts    # @CurrentUser() extrai user do JWT
│       │   │   │   ├── current-org.decorator.ts     # @CurrentOrg() extrai org_id do JWT
│       │   │   │   ├── current-company.decorator.ts # @CurrentCompany() do header
│       │   │   │   ├── roles.decorator.ts           # @Roles('admin', 'accountant')
│       │   │   │   ├── public.decorator.ts          # @Public() skip auth
│       │   │   │   └── api-paginated.decorator.ts   # @ApiPaginated() swagger
│       │   │   │
│       │   │   ├── interceptors/
│       │   │   │   ├── audit.interceptor.ts         # Log automatico de mutacoes (POST/PUT/DELETE)
│       │   │   │   ├── transform.interceptor.ts     # Response envelope { data, meta }
│       │   │   │   ├── timeout.interceptor.ts       # Timeout 30s default
│       │   │   │   └── logging.interceptor.ts       # Request/response logging
│       │   │   │
│       │   │   ├── middleware/
│       │   │   │   ├── tenant.middleware.ts          # Extrai org_id do JWT, seta no request
│       │   │   │   ├── company.middleware.ts         # Extrai company_id do header x-company-id
│       │   │   │   └── correlation-id.middleware.ts  # Gera correlation-id para tracing
│       │   │   │
│       │   │   ├── filters/
│       │   │   │   ├── http-exception.filter.ts     # Formata erros HTTP padronizado
│       │   │   │   └── typeorm-exception.filter.ts  # Trata erros TypeORM (unique, FK)
│       │   │   │
│       │   │   ├── pipes/
│       │   │   │   └── parse-uuid.pipe.ts           # Valida UUID params
│       │   │   │
│       │   │   ├── dto/
│       │   │   │   ├── pagination.dto.ts            # page, limit, sortBy, sortOrder
│       │   │   │   └── api-response.dto.ts          # { data, meta: { total, page, limit } }
│       │   │   │
│       │   │   ├── interfaces/
│       │   │   │   ├── request-with-user.interface.ts   # Express Request + user + orgId
│       │   │   │   └── paginated-result.interface.ts    # PaginatedResult<T>
│       │   │   │
│       │   │   └── utils/
│       │   │       ├── encryption.util.ts           # AES-256-GCM (credenciais API)
│       │   │       ├── hash.util.ts                 # SHA256 (dedup OFX)
│       │   │       ├── date.util.ts                 # Date helpers (business days, etc)
│       │   │       └── money.util.ts                # Numeric(14,2) helpers
│       │   │
│       │   ├── database/                   # TypeORM config e migrations
│       │   │   ├── data-source.ts          # TypeORM DataSource config
│       │   │   ├── migrations/             # Migrations sequenciais
│       │   │   │   ├── 1713000001-create-organizacoes.ts
│       │   │   │   ├── 1713000002-create-usuarios.ts
│       │   │   │   ├── 1713000003-create-org-membros.ts
│       │   │   │   ├── 1713000004-create-empresas.ts
│       │   │   │   ├── 1713000005-create-contatos.ts
│       │   │   │   ├── 1713000006-create-categorias.ts
│       │   │   │   ├── 1713000007-create-centros-custo.ts
│       │   │   │   ├── 1713000008-create-marcadores.ts
│       │   │   │   ├── 1713000009-create-formas-pagamento.ts
│       │   │   │   ├── 1713000010-create-contas-bancarias.ts
│       │   │   │   ├── 1713000011-create-contas-pagar.ts
│       │   │   │   ├── 1713000012-create-contas-receber.ts
│       │   │   │   ├── 1713000013-create-transacoes-bancarias.ts
│       │   │   │   ├── 1713000014-create-extrato-importacoes.ts
│       │   │   │   ├── 1713000015-create-conciliacoes.ts
│       │   │   │   ├── 1713000016-create-cobrancas.ts
│       │   │   │   ├── 1713000017-create-documentos.ts
│       │   │   │   ├── 1713000018-create-audit-log.ts
│       │   │   │   ├── 1713000019-create-notificacoes.ts
│       │   │   │   ├── 1713000020-create-sync-jobs.ts
│       │   │   │   ├── 1713000021-create-ai-sugestoes.ts
│       │   │   │   ├── 1713000022-create-regras-tolerancia.ts
│       │   │   │   ├── 1713000023-create-padroes-conciliacao.ts
│       │   │   │   ├── 1713000024-create-indexes-e-triggers.ts
│       │   │   │   └── 1713000025-seed-categorias-default.ts
│       │   │   │
│       │   │   └── seeds/
│       │   │       ├── categorias.seed.ts           # Categorias padrao receita/despesa
│       │   │       ├── formas-pagamento.seed.ts     # Formas pagamento default
│       │   │       └── roles.seed.ts                # Roles default
│       │   │
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── auth.module.ts               # Imports: JwtModule, HttpModule
│       │   │   │   ├── auth.controller.ts           # GET /me, POST /refresh
│       │   │   │   ├── auth.service.ts              # Valida JWT Supabase, extrai claims
│       │   │   │   ├── strategies/
│       │   │   │   │   └── supabase.strategy.ts     # Passport strategy Supabase JWKS
│       │   │   │   └── dto/
│       │   │   │       └── auth-response.dto.ts     # User + org + permissions
│       │   │   │
│       │   │   ├── tenancy/
│       │   │   │   ├── tenancy.module.ts            # Multi-tenant module
│       │   │   │   ├── tenancy.service.ts           # Resolve org_id, aplica filtros
│       │   │   │   └── tenant-aware.repository.ts   # Base repository com org_id filter
│       │   │   │
│       │   │   ├── organizacoes/
│       │   │   │   ├── organizacoes.module.ts
│       │   │   │   ├── organizacoes.controller.ts   # CRUD org + membros + convites
│       │   │   │   ├── organizacoes.service.ts
│       │   │   │   ├── organizacoes.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   ├── organizacao.entity.ts
│       │   │   │   │   ├── org-membro.entity.ts
│       │   │   │   │   └── org-convite.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-organizacao.dto.ts
│       │   │   │       ├── atualizar-organizacao.dto.ts
│       │   │   │       ├── convidar-membro.dto.ts
│       │   │   │       └── aceitar-convite.dto.ts
│       │   │   │
│       │   │   ├── empresas/
│       │   │   │   ├── empresas.module.ts
│       │   │   │   ├── empresas.controller.ts       # CRUD empresas do grupo
│       │   │   │   ├── empresas.service.ts          # Logica + criptografia credenciais
│       │   │   │   ├── empresas.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── empresa.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-empresa.dto.ts
│       │   │   │       ├── atualizar-empresa.dto.ts
│       │   │   │       └── config-credenciais.dto.ts
│       │   │   │
│       │   │   ├── contatos/
│       │   │   │   ├── contatos.module.ts
│       │   │   │   ├── contatos.controller.ts       # CRUD contatos
│       │   │   │   ├── contatos.service.ts
│       │   │   │   ├── contatos.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── contato.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-contato.dto.ts
│       │   │   │       ├── atualizar-contato.dto.ts
│       │   │   │       └── filtrar-contato.dto.ts
│       │   │   │
│       │   │   ├── categorias/
│       │   │   │   ├── categorias.module.ts
│       │   │   │   ├── categorias.controller.ts     # CRUD arvore categorias
│       │   │   │   ├── categorias.service.ts
│       │   │   │   ├── categorias.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── categoria.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-categoria.dto.ts
│       │   │   │       └── atualizar-categoria.dto.ts
│       │   │   │
│       │   │   ├── contas-pagar/
│       │   │   │   ├── contas-pagar.module.ts
│       │   │   │   ├── contas-pagar.controller.ts   # CRUD CP + bulk actions + baixar
│       │   │   │   ├── contas-pagar.service.ts
│       │   │   │   ├── contas-pagar.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── conta-pagar.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-conta-pagar.dto.ts
│       │   │   │       ├── atualizar-conta-pagar.dto.ts
│       │   │   │       ├── baixar-conta-pagar.dto.ts
│       │   │   │       └── filtrar-conta-pagar.dto.ts
│       │   │   │
│       │   │   ├── contas-receber/
│       │   │   │   ├── contas-receber.module.ts
│       │   │   │   ├── contas-receber.controller.ts # CRUD CR + parcelas + cobranca
│       │   │   │   ├── contas-receber.service.ts
│       │   │   │   ├── contas-receber.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── conta-receber.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-conta-receber.dto.ts
│       │   │   │       ├── atualizar-conta-receber.dto.ts
│       │   │   │       ├── baixar-conta-receber.dto.ts
│       │   │   │       └── filtrar-conta-receber.dto.ts
│       │   │   │
│       │   │   ├── contas-bancarias/
│       │   │   │   ├── contas-bancarias.module.ts
│       │   │   │   ├── contas-bancarias.controller.ts
│       │   │   │   ├── contas-bancarias.service.ts
│       │   │   │   ├── contas-bancarias.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── conta-bancaria.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-conta-bancaria.dto.ts
│       │   │   │       └── atualizar-conta-bancaria.dto.ts
│       │   │   │
│       │   │   ├── extratos/
│       │   │   │   ├── extratos.module.ts
│       │   │   │   ├── extratos.controller.ts       # Import OFX/CSV, list, bulk actions
│       │   │   │   ├── extratos.service.ts          # Logica import + dedup FITID
│       │   │   │   ├── extratos.repository.ts
│       │   │   │   ├── parsers/
│       │   │   │   │   ├── ofx.parser.ts            # Parser OFX (Latin-1/UTF-8)
│       │   │   │   │   ├── csv.parser.ts            # Parser CSV generico
│       │   │   │   │   └── appmax-csv.parser.ts     # Parser CSV AppMax especifico
│       │   │   │   ├── entities/
│       │   │   │   │   ├── transacao-bancaria.entity.ts
│       │   │   │   │   └── extrato-importacao.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── importar-extrato.dto.ts
│       │   │   │       ├── filtrar-transacao.dto.ts
│       │   │   │       └── bulk-action-transacao.dto.ts
│       │   │   │
│       │   │   ├── conciliacao/
│       │   │   │   ├── conciliacao.module.ts
│       │   │   │   ├── conciliacao.controller.ts    # Create, reverse, auto, batch, sessions
│       │   │   │   ├── conciliacao.service.ts       # Engine core: match, validate, atomico
│       │   │   │   ├── conciliacao.repository.ts
│       │   │   │   ├── engines/
│       │   │   │   │   ├── exact-match.engine.ts    # Camada 1: valor exato + data + ref
│       │   │   │   │   ├── fuzzy-match.engine.ts    # Camada 2: valor + data +-5d
│       │   │   │   │   ├── installment.engine.ts    # Camada 3: parcelas
│       │   │   │   │   ├── split.engine.ts          # Subset-sum solver (1:N, N:1)
│       │   │   │   │   └── intercompany.engine.ts   # Cross-company detection
│       │   │   │   ├── entities/
│       │   │   │   │   └── conciliacao.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-conciliacao.dto.ts
│       │   │   │       ├── estornar-conciliacao.dto.ts
│       │   │   │       ├── auto-conciliar.dto.ts
│       │   │   │       └── filtrar-conciliacao.dto.ts
│       │   │   │
│       │   │   ├── cobrancas/
│       │   │   │   ├── cobrancas.module.ts
│       │   │   │   ├── cobrancas.controller.ts      # Gerar cobranca, enviar, historico
│       │   │   │   ├── cobrancas.service.ts
│       │   │   │   ├── cobrancas.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── cobranca.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── criar-cobranca.dto.ts
│       │   │   │       └── filtrar-cobranca.dto.ts
│       │   │   │
│       │   │   ├── relatorios/
│       │   │   │   ├── relatorios.module.ts
│       │   │   │   ├── relatorios.controller.ts     # KPIs, DRE, export XLSX
│       │   │   │   ├── relatorios.service.ts        # Queries agregadas, materialized views
│       │   │   │   └── dto/
│       │   │   │       └── filtrar-relatorio.dto.ts
│       │   │   │
│       │   │   ├── sync/
│       │   │   │   ├── sync.module.ts
│       │   │   │   ├── sync.controller.ts           # Trigger sync manual, status, historico
│       │   │   │   ├── sync.service.ts              # Orchestrador de syncs
│       │   │   │   ├── providers/
│       │   │   │   │   ├── tiny-v2.provider.ts      # Client Tiny API V2 (rate limit 3req/s)
│       │   │   │   │   ├── tiny-v3.provider.ts      # Client Tiny API V3 (OAuth, refresh)
│       │   │   │   │   ├── conta-simples.provider.ts # Client Conta Simples API
│       │   │   │   │   └── pagarme.provider.ts      # Client Pagar.me V5
│       │   │   │   ├── processors/
│       │   │   │   │   ├── tiny-sync.processor.ts   # BullMQ processor: sync CP/CR
│       │   │   │   │   ├── bank-sync.processor.ts   # BullMQ processor: sync bancos/gateways
│       │   │   │   │   └── import.processor.ts      # BullMQ processor: import OFX async
│       │   │   │   ├── entities/
│       │   │   │   │   └── sync-job.entity.ts
│       │   │   │   └── dto/
│       │   │   │       └── trigger-sync.dto.ts
│       │   │   │
│       │   │   ├── ai/
│       │   │   │   ├── ai.module.ts
│       │   │   │   ├── ai.controller.ts             # Suggest, accept, reject, batch, stats
│       │   │   │   ├── ai.service.ts                # Claude API orchestrator
│       │   │   │   ├── prompt-builder.service.ts     # Monta prompt com few-shot
│       │   │   │   ├── learning.service.ts           # Pattern extraction de aceites/rejeicoes
│       │   │   │   ├── entities/
│       │   │   │   │   └── ai-sugestao.entity.ts
│       │   │   │   └── dto/
│       │   │   │       ├── solicitar-sugestao.dto.ts
│       │   │   │       └── responder-sugestao.dto.ts
│       │   │   │
│       │   │   ├── notificacoes/
│       │   │   │   ├── notificacoes.module.ts
│       │   │   │   ├── notificacoes.controller.ts   # List, mark read, unread count
│       │   │   │   ├── notificacoes.service.ts      # Cria + broadcast via Supabase Realtime
│       │   │   │   ├── notificacoes.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── notificacao.entity.ts
│       │   │   │   └── dto/
│       │   │   │       └── criar-notificacao.dto.ts
│       │   │   │
│       │   │   ├── auditoria/
│       │   │   │   ├── auditoria.module.ts
│       │   │   │   ├── auditoria.controller.ts      # List filtrado, export, entity history
│       │   │   │   ├── auditoria.service.ts         # Insert-only, imutavel
│       │   │   │   ├── auditoria.repository.ts
│       │   │   │   ├── entities/
│       │   │   │   │   └── audit-log.entity.ts
│       │   │   │   └── dto/
│       │   │   │       └── filtrar-audit.dto.ts
│       │   │   │
│       │   │   └── documentos/
│       │   │       ├── documentos.module.ts
│       │   │       ├── documentos.controller.ts     # Upload, download, vincular
│       │   │       ├── documentos.service.ts        # Supabase Storage
│       │   │       ├── documentos.repository.ts
│       │   │       ├── entities/
│       │   │       │   └── documento.entity.ts
│       │   │       └── dto/
│       │   │           ├── upload-documento.dto.ts
│       │   │           └── filtrar-documento.dto.ts
│       │   │
│       │   └── config/
│       │       ├── app.config.ts                    # ConfigService typed
│       │       ├── database.config.ts               # TypeORM config from env
│       │       ├── redis.config.ts                  # Redis/BullMQ config
│       │       ├── supabase.config.ts               # Supabase URLs, keys
│       │       ├── swagger.config.ts                # Swagger setup
│       │       └── throttle.config.ts               # Rate limit matrix
│       │
│       ├── test/
│       │   ├── jest-e2e.json                        # Config Jest E2E
│       │   ├── app.e2e-spec.ts                      # E2E health check
│       │   └── fixtures/
│       │       ├── sample.ofx                       # Fixture OFX para testes
│       │       └── sample-appmax.csv                # Fixture CSV AppMax
│       │
│       ├── nest-cli.json                            # NestJS CLI config
│       ├── tsconfig.json                            # TS config API
│       ├── tsconfig.build.json                      # TS build config
│       ├── package.json                             # Dependencies API
│       └── .env                                     # Env vars API (nao commitado)
│
├── packages/
│   ├── shared/                             # ===== TIPOS COMPARTILHADOS =====
│   │   ├── src/
│   │   │   ├── index.ts                    # Re-exports
│   │   │   ├── types/
│   │   │   │   ├── auth.types.ts           # UserRole, Permission, AuthPayload
│   │   │   │   ├── organizacao.types.ts    # Org, OrgMembro, Plano
│   │   │   │   ├── empresa.types.ts        # Empresa, ConfigCredenciais
│   │   │   │   ├── contato.types.ts        # Contato, TipoContato
│   │   │   │   ├── financeiro.types.ts     # ContaPagar, ContaReceber, StatusConta
│   │   │   │   ├── bancario.types.ts       # ContaBancaria, TransacaoBancaria
│   │   │   │   ├── conciliacao.types.ts    # Conciliacao, TipoMatch, StatusConciliacao
│   │   │   │   ├── categoria.types.ts      # Categoria, TipoCategoria
│   │   │   │   ├── auditoria.types.ts      # AuditLog, AuditAction
│   │   │   │   └── api.types.ts            # PaginatedResponse, ApiError, SortOrder
│   │   │   │
│   │   │   ├── enums/
│   │   │   │   ├── roles.enum.ts           # UserRole: OWNER, ADMIN, ACCOUNTANT, VIEWER
│   │   │   │   ├── status-conta.enum.ts    # ABERTO, PAGO, PARCIAL, CANCELADO, VENCIDO
│   │   │   │   ├── status-conciliacao.enum.ts  # PENDING, SUGGESTED, RECONCILED, IGNORED, REVERSED
│   │   │   │   ├── tipo-contato.enum.ts    # CLIENTE, FORNECEDOR, TRANSPORTADOR, VENDEDOR
│   │   │   │   ├── tipo-transacao.enum.ts  # CREDITO, DEBITO
│   │   │   │   ├── tipo-match.enum.ts      # ONE_TO_ONE, ONE_TO_MANY, MANY_TO_ONE, MANY_TO_MANY
│   │   │   │   ├── metodo-match.enum.ts    # MANUAL, AUTO_EXACT, AUTO_FUZZY, AI_SUGGESTION
│   │   │   │   ├── tipo-conta-bancaria.enum.ts  # CORRENTE, POUPANCA, PAGAMENTO, CARTAO_CREDITO
│   │   │   │   ├── fonte-extrato.enum.ts   # OFX, CSV, API_CONTA_SIMPLES, API_PAGARME, MANUAL
│   │   │   │   ├── acao-audit.enum.ts      # CREATE, UPDATE, DELETE, RECONCILE, REVERSE, SYNC, IMPORT
│   │   │   │   └── tipo-categoria.enum.ts  # RECEITA, DESPESA
│   │   │   │
│   │   │   ├── validators/
│   │   │   │   ├── cnpj.validator.ts       # Validacao CNPJ (digitos verificadores)
│   │   │   │   ├── cpf.validator.ts        # Validacao CPF
│   │   │   │   └── money.validator.ts      # Validacao valores monetarios
│   │   │   │
│   │   │   └── constants/
│   │   │       ├── pagination.constants.ts # DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
│   │   │       ├── date-formats.constants.ts # Formatos data BR/ISO
│   │   │       └── tolerance.constants.ts  # Tolerancia padrao conciliacao (R$0.05)
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ui/                                 # ===== COMPONENTES BASE SHADCN =====
│   │   ├── src/
│   │   │   ├── index.ts                    # Re-exports
│   │   │   ├── components/                 # shadcn/ui customizados
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── checkbox.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── sheet.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── command.tsx             # cmdk based
│   │   │   │   ├── table.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── toast.tsx               # Sonner wrapper
│   │   │   │   ├── calendar.tsx
│   │   │   │   ├── popover.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── toggle-group.tsx
│   │   │   │   ├── resizable.tsx           # ResizablePanelGroup
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── progress.tsx
│   │   │   │   ├── tooltip.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── scroll-area.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── form.tsx               # react-hook-form integration
│   │   │   │   ├── label.tsx
│   │   │   │   └── switch.tsx
│   │   │   │
│   │   │   └── lib/
│   │   │       └── utils.ts               # cn() utility
│   │   │
│   │   ├── tailwind.config.ts             # Base tailwind config (shared tokens)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── database/                           # ===== TYPEORM ENTITIES (shared) =====
│       ├── src/
│       │   ├── index.ts                    # Re-exports todas entities
│       │   └── entities/                   # Todas as entities TypeORM
│       │       ├── base.entity.ts          # BaseEntity (id, createdAt, updatedAt, deletedAt)
│       │       ├── tenant-base.entity.ts   # TenantBaseEntity extends Base (orgId)
│       │       ├── organizacao.entity.ts
│       │       ├── usuario.entity.ts
│       │       ├── org-membro.entity.ts
│       │       ├── org-convite.entity.ts
│       │       ├── empresa.entity.ts
│       │       ├── contato.entity.ts
│       │       ├── categoria.entity.ts
│       │       ├── centro-custo.entity.ts
│       │       ├── marcador.entity.ts
│       │       ├── forma-pagamento.entity.ts
│       │       ├── conta-bancaria.entity.ts
│       │       ├── conta-pagar.entity.ts
│       │       ├── conta-receber.entity.ts
│       │       ├── transacao-bancaria.entity.ts
│       │       ├── extrato-importacao.entity.ts
│       │       ├── conciliacao.entity.ts
│       │       ├── cobranca.entity.ts
│       │       ├── documento.entity.ts
│       │       ├── audit-log.entity.ts
│       │       ├── notificacao.entity.ts
│       │       ├── sync-job.entity.ts
│       │       ├── ai-sugestao.entity.ts
│       │       ├── regra-tolerancia.entity.ts
│       │       └── padrao-conciliacao.entity.ts
│       │
│       ├── tsconfig.json
│       └── package.json
│
├── docker-compose.yml                      # PostgreSQL 16 + Redis 7
├── turbo.json                              # Turborepo pipeline config
├── package.json                            # Root workspace
├── pnpm-workspace.yaml                     # pnpm workspaces
├── tsconfig.base.json                      # Base TypeScript config
├── .eslintrc.js                            # ESLint root config
├── .prettierrc                             # Prettier config
├── .env.example                            # Template de env vars
├── .gitignore                              # Git ignore
├── .npmrc                                  # pnpm config
├── commitlint.config.js                    # Conventional commits
└── README.md                               # Documentacao projeto
```

---

## 2. Configuracoes Completas

### 2.1 `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "env": [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_API_URL"
      ]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["db:migrate"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 2.2 `apps/web/next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bpo/ui', '@bpo/shared'],

  experimental: {
    typedRoutes: true,
    optimizePackageImports: ['@bpo/ui', 'lucide-react', 'recharts'],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
```

### 2.3 `apps/web/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';
import sharedConfig from '@bpo/ui/tailwind.config';

const config: Config = {
  presets: [sharedConfig],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background layers (dark-first, financeiro = sessoes longas)
        bg: {
          primary: 'hsl(var(--bg-primary))',       // hsl(220 20% 4%)
          secondary: 'hsl(var(--bg-secondary))',   // hsl(220 18% 7%)
          tertiary: 'hsl(var(--bg-tertiary))',     // hsl(220 16% 10%)
          hover: 'hsl(var(--bg-hover))',           // hsl(220 14% 13%)
        },
        // Accent
        accent: {
          blue: 'hsl(var(--accent-blue))',         // hsl(210 90% 55%)
          green: 'hsl(var(--accent-green))',       // hsl(142 71% 45%)
          red: 'hsl(var(--accent-red))',           // hsl(0 84% 60%)
          yellow: 'hsl(var(--accent-yellow))',     // hsl(45 93% 55%)
          purple: 'hsl(var(--accent-purple))',     // hsl(270 70% 60%)
        },
        // Semantic financial
        credit: 'hsl(var(--accent-green))',
        debit: 'hsl(var(--accent-red))',
        reconciled: 'hsl(var(--accent-green))',
        pending: 'hsl(var(--accent-yellow))',
        divergent: 'hsl(var(--accent-red))',
        ai: 'hsl(var(--accent-purple))',
        // shadcn/ui tokens
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      transitionDuration: {
        fast: '150ms',
        default: '250ms',
        slow: '400ms',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsla(142, 71%, 45%, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px hsla(142, 71%, 45%, 0)' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reconcile-flash': {
          '0%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'hsla(142, 71%, 45%, 0.15)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'pulse-green': 'pulse-green 2s infinite',
        'slide-up-fade': 'slide-up-fade 150ms ease-out',
        'reconcile-flash': 'reconcile-flash 400ms ease-out',
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '56px',
        topbar: '48px',
        'action-bar': '56px',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};

export default config;
```

### 2.4 `apps/api/nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": false,
    "tsConfigPath": "tsconfig.build.json",
    "assets": [
      {
        "include": "**/*.hbs",
        "watchAssets": true
      }
    ],
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true,
          "dtoFileNameSuffix": [".dto.ts", ".entity.ts"]
        }
      }
    ]
  }
}
```

### 2.5 `apps/api/src/app.module.ts`

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

// Config
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import supabaseConfig from './config/supabase.config';
import throttleConfig from './config/throttle.config';

// Common
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { CompanyMiddleware } from './common/middleware/company.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { OrganizacoesModule } from './modules/organizacoes/organizacoes.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { ContatosModule } from './modules/contatos/contatos.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { ContasPagarModule } from './modules/contas-pagar/contas-pagar.module';
import { ContasReceberModule } from './modules/contas-receber/contas-receber.module';
import { ContasBancariasModule } from './modules/contas-bancarias/contas-bancarias.module';
import { ExtratosModule } from './modules/extratos/extratos.module';
import { ConciliacaoModule } from './modules/conciliacao/conciliacao.module';
import { CobrancasModule } from './modules/cobrancas/cobrancas.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { SyncModule } from './modules/sync/sync.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { DocumentosModule } from './modules/documentos/documentos.module';

// App controller
import { AppController } from './app.controller';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, supabaseConfig, throttleConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        autoLoadEntities: true,
        synchronize: false, // NUNCA true em producao
        logging: config.get<string>('app.nodeEnv') === 'development' ? ['query', 'error'] : ['error'],
        ssl: config.get<string>('app.nodeEnv') === 'production' ? { rejectUnauthorized: false } : false,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),

    // Redis / BullMQ
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          tls: config.get<string>('app.nodeEnv') === 'production' ? {} : undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60000 },
        },
      }),
    }),

    // Throttling
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('throttle'),
    }),

    // Scheduled tasks (cron)
    ScheduleModule.forRoot(),

    // Event emitter (audit, notifications)
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // Domain modules
    AuthModule,
    TenancyModule,
    OrganizacoesModule,
    EmpresasModule,
    ContatosModule,
    CategoriasModule,
    ContasPagarModule,
    ContasReceberModule,
    ContasBancariasModule,
    ExtratosModule,
    ConciliacaoModule,
    CobrancasModule,
    RelatoriosModule,
    SyncModule,
    AiModule,
    NotificacoesModule,
    AuditoriaModule,
    DocumentosModule,
  ],
  controllers: [AppController],
  providers: [
    // Global guards (order matters)
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdMiddleware },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    // Global filters
    { provide: APP_FILTER, useClass: TypeOrmExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware, CompanyMiddleware)
      .exclude('api/health', 'api/ready', 'api/auth/callback')
      .forRoutes('*');
  }
}
```

### 2.6 `apps/api/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3001);
  const nodeEnv = config.get<string>('app.nodeEnv', 'development');

  // Security
  app.use(helmet({
    contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: config.get<string>('app.corsOrigins', 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id', 'x-correlation-id'],
    exposedHeaders: ['x-total-count', 'x-correlation-id'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,                // Strip properties without decorators
      forbidNonWhitelisted: true,     // Throw on unknown properties
      transform: true,                // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert string "1" to number 1
      },
      validationError: {
        target: false,                // Dont expose target object in errors
        value: false,                 // Dont expose value in errors
      },
    }),
  );

  // Trust proxy (Render, Vercel)
  app.set('trust proxy', 1);

  // Swagger (dev only ou via feature flag)
  if (nodeEnv !== 'production' || config.get<boolean>('app.enableSwagger')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BPO Financeiro API')
      .setDescription(
        'API do sistema de BPO Financeiro - Conciliacao inteligente, multi-empresa, multi-tenant',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT token',
        },
        'supabase-jwt',
      )
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'x-company-id',
          description: 'ID da empresa selecionada (UUID)',
        },
        'company-id',
      )
      .addTag('Auth', 'Autenticacao e sessao')
      .addTag('Organizacoes', 'Gestao de organizacoes e membros')
      .addTag('Empresas', 'Empresas do grupo economico')
      .addTag('Contatos', 'Clientes, fornecedores, transportadores')
      .addTag('Contas a Pagar', 'Gestao de contas a pagar')
      .addTag('Contas a Receber', 'Gestao de contas a receber')
      .addTag('Extratos', 'Transacoes bancarias e importacao')
      .addTag('Conciliacao', 'Engine de conciliacao financeira')
      .addTag('Cobrancas', 'Gestao de cobrancas')
      .addTag('Relatorios', 'KPIs, DRE, exports')
      .addTag('Sync', 'Sincronizacao com APIs externas')
      .addTag('IA', 'Sugestoes de matching por IA')
      .addTag('Auditoria', 'Log de auditoria imutavel')
      .addTag('Notificacoes', 'Notificacoes in-app')
      .addTag('Documentos', 'Upload e gestao de documentos')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
    logger.log(`Swagger disponivel em http://localhost:${port}/api/docs`);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`BPO Financeiro API rodando na porta ${port} [${nodeEnv}]`);
}

bootstrap();
```

### 2.7 `packages/database/data-source.ts`

```typescript
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, 'src/entities/**/*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '../../apps/api/src/database/migrations/*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error', 'schema'] : ['error'],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  extra: {
    max: 5, // pool menor para migrations
    idleTimeoutMillis: 10000,
  },
  migrationsTableName: 'typeorm_migrations',
  migrationsTransactionMode: 'each',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
```

### 2.8 `docker-compose.yml`

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: bpo-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: bpo_financeiro
      POSTGRES_USER: bpo_user
      POSTGRES_PASSWORD: bpo_local_password_2026
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U bpo_user -d bpo_financeiro']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: bpo-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: bpo-redis-ui
    restart: unless-stopped
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - '8081:8081'
    depends_on:
      redis:
        condition: service_healthy

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

### 2.9 `.env.example`

```bash
# ===== APPLICATION =====
NODE_ENV=development
PORT=3001
CORS_ORIGINS=http://localhost:3000
ENABLE_SWAGGER=true

# ===== DATABASE (PostgreSQL 16 / Supabase) =====
DATABASE_URL=postgresql://bpo_user:bpo_local_password_2026@localhost:5432/bpo_financeiro
DATABASE_POOL_MAX=20
DATABASE_SSL=false

# ===== SUPABASE =====
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_JWKS_URL=https://your-project.supabase.co/auth/v1/.well-known/jwks.json

# ===== REDIS =====
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ===== ENCRYPTION (AES-256-GCM para credenciais API) =====
ENCRYPTION_KEY=your-32-byte-hex-key-here-0123456789abcdef
ENCRYPTION_IV_LENGTH=16

# ===== TINY ERP V2 (por empresa, armazenado encriptado no DB) =====
# Configurado via UI por empresa

# ===== TINY ERP V3 (OAuth) =====
TINY_V3_REDIRECT_URI=http://localhost:3001/api/v1/sync/tiny/callback

# ===== CONTA SIMPLES (por empresa, armazenado encriptado no DB) =====
# Configurado via UI por empresa

# ===== PAGAR.ME (por empresa, armazenado encriptado no DB) =====
# Configurado via UI por empresa

# ===== CLAUDE AI (Anthropic) =====
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ANTHROPIC_MAX_TOKENS=4096
AI_DAILY_COST_CAP_BRL=50.00
AI_AUTO_RECONCILE_THRESHOLD=0.95

# ===== NEXT.JS FRONTEND (prefix NEXT_PUBLIC_) =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=BPO Financeiro
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ===== RATE LIMITING =====
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
THROTTLE_SYNC_LIMIT=5
THROTTLE_IMPORT_LIMIT=10
THROTTLE_AI_LIMIT=20

# ===== BULL MQ QUEUES =====
TINY_SYNC_CRON=0 */4 * * *
BANK_SYNC_CRON=0 */6 * * *
AI_SUGGESTIONS_CRON=0 6 * * *
CLEANUP_CRON=0 3 * * 0

# ===== LOGGING =====
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### 2.10 `tsconfig.base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true,
    "composite": true,
    "paths": {
      "@bpo/shared": ["./packages/shared/src"],
      "@bpo/shared/*": ["./packages/shared/src/*"],
      "@bpo/ui": ["./packages/ui/src"],
      "@bpo/ui/*": ["./packages/ui/src/*"],
      "@bpo/database": ["./packages/database/src"],
      "@bpo/database/*": ["./packages/database/src/*"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
```

### 2.11 `.eslintrc.js`

```javascript
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.base.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    'import/no-duplicates': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  settings: {
    'import/resolver': {
      typescript: { project: ['./tsconfig.base.json'] },
    },
  },
  ignorePatterns: ['dist', '.next', 'node_modules', '*.js', '!.eslintrc.js'],
};
```

### 2.12 `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindConfig": "./apps/web/tailwind.config.ts"
}
```

---

## 3. TypeORM Entities

### 3.1 `base.entity.ts` -- Classe Base

```typescript
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
```

### 3.2 `tenant-base.entity.ts` -- Base Multi-Tenant

```typescript
import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class TenantBaseEntity extends BaseEntity {
  @Column({ name: 'org_id', type: 'uuid' })
  @Index()
  orgId: string;
}
```

### 3.3 `organizacao.entity.ts`

```typescript
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrgMembro } from './org-membro.entity';
import { Empresa } from './empresa.entity';

export enum PlanoOrganizacao {
  TRIAL = 'trial',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

@Entity('organizacoes')
export class Organizacao extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index({ unique: true })
  slug: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'enum', enum: PlanoOrganizacao, default: PlanoOrganizacao.TRIAL })
  plano: PlanoOrganizacao;

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, unknown>;
  // settings: { timezone, currency, default_tolerance, ai_enabled, onboarding_complete }

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @OneToMany(() => OrgMembro, (m) => m.organizacao)
  membros: OrgMembro[];

  @OneToMany(() => Empresa, (e) => e.organizacao)
  empresas: Empresa[];
}
```

### 3.4 `usuario.entity.ts`

```typescript
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OrgMembro } from './org-membro.entity';

@Entity('usuarios')
export class Usuario extends BaseEntity {
  @Column({ name: 'supabase_uid', type: 'uuid', unique: true })
  @Index({ unique: true })
  supabaseUid: string;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index({ unique: true })
  email: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  preferences: Record<string, unknown>;
  // preferences: { theme, locale, notifications_email, notifications_push }

  @OneToMany(() => OrgMembro, (m) => m.usuario)
  orgMembros: OrgMembro[];
}
```

### 3.5 `empresa.entity.ts`

```typescript
import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Organizacao } from './organizacao.entity';
import { ContaBancaria } from './conta-bancaria.entity';

@Entity('empresas')
@Unique(['orgId', 'cnpj'])
@Unique(['orgId', 'slug'])
export class Empresa extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 18 }) // XX.XXX.XXX/XXXX-XX
  cnpj: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  slug: string;

  @Column({ type: 'varchar', length: 7, default: '#3B82F6' }) // hex color
  cor: string;

  @Column({ name: 'razao_social', type: 'varchar', length: 255, nullable: true })
  razaoSocial: string | null;

  @Column({ name: 'inscricao_estadual', type: 'varchar', length: 20, nullable: true })
  inscricaoEstadual: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Credenciais encriptadas AES-256-GCM (stored as base64)
  @Column({ name: 'tiny_v2_token_enc', type: 'text', nullable: true })
  tinyV2TokenEnc: string | null;

  @Column({ name: 'tiny_v3_client_id_enc', type: 'text', nullable: true })
  tinyV3ClientIdEnc: string | null;

  @Column({ name: 'tiny_v3_client_secret_enc', type: 'text', nullable: true })
  tinyV3ClientSecretEnc: string | null;

  @Column({ name: 'tiny_v3_access_token_enc', type: 'text', nullable: true })
  tinyV3AccessTokenEnc: string | null;

  @Column({ name: 'tiny_v3_refresh_token_enc', type: 'text', nullable: true })
  tinyV3RefreshTokenEnc: string | null;

  @Column({ name: 'tiny_v3_token_expires_at', type: 'timestamptz', nullable: true })
  tinyV3TokenExpiresAt: Date | null;

  @Column({ name: 'conta_simples_api_key_enc', type: 'text', nullable: true })
  contaSimplesApiKeyEnc: string | null;

  @Column({ name: 'conta_simples_api_secret_enc', type: 'text', nullable: true })
  contaSimplesApiSecretEnc: string | null;

  @Column({ name: 'pagarme_secret_key_enc', type: 'text', nullable: true })
  pagarmeSecretKeyEnc: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, unknown>;
  // settings: { auto_sync, sync_interval_hours, ai_enabled, default_tolerance }

  @ManyToOne(() => Organizacao, (o) => o.empresas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organizacao: Organizacao;

  @OneToMany(() => ContaBancaria, (cb) => cb.empresa)
  contasBancarias: ContaBancaria[];
}
```

### 3.6 `contato.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';

export enum TipoContato {
  CLIENTE = 'cliente',
  FORNECEDOR = 'fornecedor',
  TRANSPORTADOR = 'transportador',
  VENDEDOR = 'vendedor',
  OUTRO = 'outro',
}

export enum TipoPessoa {
  FISICA = 'F',
  JURIDICA = 'J',
}

@Entity('contatos')
@Index(['orgId', 'cpfCnpj'])
@Index(['orgId', 'tipoContato'])
export class Contato extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  @Index()
  empresaId: string;

  @Column({ name: 'tiny_id', type: 'bigint', nullable: true })
  tinyId: number | null;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ name: 'nome_fantasia', type: 'varchar', length: 255, nullable: true })
  nomeFantasia: string | null;

  @Column({ name: 'tipo_contato', type: 'enum', enum: TipoContato })
  tipoContato: TipoContato;

  @Column({ name: 'tipo_pessoa', type: 'enum', enum: TipoPessoa, default: TipoPessoa.JURIDICA })
  tipoPessoa: TipoPessoa;

  @Column({ name: 'cpf_cnpj', type: 'varchar', length: 18, nullable: true })
  cpfCnpj: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefone: string | null;

  @Column({ type: 'text', nullable: true })
  endereco: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cidade: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  uf: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  cep: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;
}
```

### 3.7 `conta-pagar.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';
import { Categoria } from './categoria.entity';
import { Contato } from './contato.entity';
import { Conciliacao } from './conciliacao.entity';

export enum SituacaoConta {
  ABERTO = 'aberto',
  PAGO = 'pago',
  PARCIAL = 'parcial',
  CANCELADO = 'cancelado',
  DEVOLVIDO = 'devolvido',
}

export enum StatusConciliacaoConta {
  PENDING = 'pending',
  SUGGESTED = 'suggested',
  RECONCILED = 'reconciled',
  IGNORED = 'ignored',
  REVERSED = 'reversed',
}

@Entity('contas_pagar')
@Unique(['empresaId', 'tinyId'])
@Index(['orgId', 'empresaId', 'situacao'])
@Index(['orgId', 'empresaId', 'dataVencimento'])
@Index(['orgId', 'statusConciliacao'])
export class ContaPagar extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  @Index()
  empresaId: string;

  @Column({ name: 'tiny_id', type: 'bigint', nullable: true })
  tinyId: number | null;

  // Fornecedor
  @Column({ name: 'contato_id', type: 'uuid', nullable: true })
  contatoId: string | null;

  @Column({ name: 'fornecedor_nome', type: 'varchar', length: 255 })
  fornecedorNome: string;

  @Column({ name: 'fornecedor_cpf_cnpj', type: 'varchar', length: 18, nullable: true })
  fornecedorCpfCnpj: string | null;

  // Dados financeiros
  @Column({ type: 'text', nullable: true })
  historico: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor: number;

  @Column({ name: 'valor_pago', type: 'numeric', precision: 14, scale: 2, nullable: true })
  valorPago: number | null;

  @Column({ name: 'data_emissao', type: 'date', nullable: true })
  dataEmissao: Date | null;

  @Column({ name: 'data_vencimento', type: 'date' })
  dataVencimento: Date;

  @Column({ name: 'data_pagamento', type: 'date', nullable: true })
  dataPagamento: Date | null;

  @Column({ type: 'enum', enum: SituacaoConta, default: SituacaoConta.ABERTO })
  situacao: SituacaoConta;

  // Classificacao
  @Column({ name: 'categoria_id', type: 'uuid', nullable: true })
  categoriaId: string | null;

  @Column({ name: 'categoria_nome', type: 'varchar', length: 255, nullable: true })
  categoriaNome: string | null;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId: string | null;

  @Column({ name: 'conta_origem', type: 'varchar', length: 255, nullable: true })
  contaOrigem: string | null; // Nome exato no Tiny para baixa

  @Column({ name: 'pedido_numero', type: 'varchar', length: 50, nullable: true })
  pedidoNumero: string | null;

  @Column({ name: 'nota_fiscal', type: 'varchar', length: 50, nullable: true })
  notaFiscal: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  marcadores: Array<{ descricao: string }>;

  // Conciliacao
  @Column({
    name: 'status_conciliacao',
    type: 'enum',
    enum: StatusConciliacaoConta,
    default: StatusConciliacaoConta.PENDING,
  })
  statusConciliacao: StatusConciliacaoConta;

  @Column({ name: 'conciliacao_id', type: 'uuid', nullable: true })
  conciliacaoId: string | null;

  // Sync
  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData: Record<string, unknown> | null;

  // Relations
  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @ManyToOne(() => Contato, { nullable: true })
  @JoinColumn({ name: 'contato_id' })
  contato: Contato | null;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria | null;

  @ManyToOne(() => Conciliacao, { nullable: true })
  @JoinColumn({ name: 'conciliacao_id' })
  conciliacao: Conciliacao | null;
}
```

### 3.8 `conta-receber.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';
import { Categoria } from './categoria.entity';
import { Contato } from './contato.entity';
import { Conciliacao } from './conciliacao.entity';
import { SituacaoConta, StatusConciliacaoConta } from './conta-pagar.entity';

@Entity('contas_receber')
@Unique(['empresaId', 'tinyId'])
@Index(['orgId', 'empresaId', 'situacao'])
@Index(['orgId', 'empresaId', 'dataVencimento'])
@Index(['orgId', 'statusConciliacao'])
export class ContaReceber extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  @Index()
  empresaId: string;

  @Column({ name: 'tiny_id', type: 'bigint', nullable: true })
  tinyId: number | null;

  // Cliente
  @Column({ name: 'contato_id', type: 'uuid', nullable: true })
  contatoId: string | null;

  @Column({ name: 'cliente_nome', type: 'varchar', length: 255 })
  clienteNome: string;

  @Column({ name: 'cliente_cpf_cnpj', type: 'varchar', length: 18, nullable: true })
  clienteCpfCnpj: string | null;

  // Dados financeiros
  @Column({ type: 'text', nullable: true })
  historico: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor: number;

  @Column({ name: 'valor_pago', type: 'numeric', precision: 14, scale: 2, nullable: true })
  valorPago: number | null;

  @Column({ name: 'data_emissao', type: 'date', nullable: true })
  dataEmissao: Date | null;

  @Column({ name: 'data_vencimento', type: 'date' })
  dataVencimento: Date;

  @Column({ name: 'data_pagamento', type: 'date', nullable: true })
  dataPagamento: Date | null;

  @Column({ type: 'enum', enum: SituacaoConta, default: SituacaoConta.ABERTO })
  situacao: SituacaoConta;

  // Pagamento
  @Column({ name: 'forma_pagamento', type: 'varchar', length: 100, nullable: true })
  formaPagamento: string | null;

  @Column({ name: 'meio_pagamento', type: 'varchar', length: 100, nullable: true })
  meioPagamento: string | null;

  @Column({ name: 'parcela_info', type: 'varchar', length: 10, nullable: true })
  parcelaInfo: string | null; // "1/3", "2/6", etc

  @Column({ name: 'parcela_numero', type: 'int', nullable: true })
  parcelaNumero: number | null;

  @Column({ name: 'total_parcelas', type: 'int', nullable: true })
  totalParcelas: number | null;

  // Classificacao
  @Column({ name: 'categoria_id', type: 'uuid', nullable: true })
  categoriaId: string | null;

  @Column({ name: 'categoria_nome', type: 'varchar', length: 255, nullable: true })
  categoriaNome: string | null;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId: string | null;

  @Column({ name: 'pedido_numero', type: 'varchar', length: 50, nullable: true })
  pedidoNumero: string | null;

  @Column({ name: 'nota_fiscal', type: 'varchar', length: 50, nullable: true })
  notaFiscal: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  marcadores: Array<{ descricao: string }>;

  // Conciliacao
  @Column({
    name: 'status_conciliacao',
    type: 'enum',
    enum: StatusConciliacaoConta,
    default: StatusConciliacaoConta.PENDING,
  })
  statusConciliacao: StatusConciliacaoConta;

  @Column({ name: 'conciliacao_id', type: 'uuid', nullable: true })
  conciliacaoId: string | null;

  // Sync
  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData: Record<string, unknown> | null;

  // Relations
  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @ManyToOne(() => Contato, { nullable: true })
  @JoinColumn({ name: 'contato_id' })
  contato: Contato | null;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria | null;

  @ManyToOne(() => Conciliacao, { nullable: true })
  @JoinColumn({ name: 'conciliacao_id' })
  conciliacao: Conciliacao | null;
}
```

### 3.9 `conta-bancaria.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';

export enum TipoContaBancaria {
  CORRENTE = 'corrente',
  POUPANCA = 'poupanca',
  PAGAMENTO = 'pagamento',
  CARTAO_CREDITO = 'cartao_credito',
}

export enum FonteExtrato {
  OFX = 'ofx',
  CSV = 'csv',
  API_CONTA_SIMPLES = 'api_conta_simples',
  API_PAGARME = 'api_pagarme',
  MANUAL = 'manual',
}

@Entity('contas_bancarias')
@Unique(['empresaId', 'bancoNome', 'numeroConta'])
export class ContaBancaria extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  @Index()
  empresaId: string;

  @Column({ type: 'varchar', length: 255 })
  nome: string; // "Sicoob - Industrias Neon"

  @Column({ name: 'banco_nome', type: 'varchar', length: 100 })
  bancoNome: string;

  @Column({ name: 'banco_codigo', type: 'varchar', length: 10, nullable: true })
  bancoCodigo: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  agencia: string | null;

  @Column({ name: 'numero_conta', type: 'varchar', length: 30, nullable: true })
  numeroConta: string | null;

  @Column({ name: 'tipo_conta', type: 'enum', enum: TipoContaBancaria, default: TipoContaBancaria.CORRENTE })
  tipoConta: TipoContaBancaria;

  @Column({ name: 'fonte_extrato', type: 'enum', enum: FonteExtrato, default: FonteExtrato.OFX })
  fonteExtrato: FonteExtrato;

  // Nome exato no Tiny para baixa de contas
  @Column({ name: 'tiny_conta_origem', type: 'varchar', length: 255, nullable: true })
  tinyContaOrigem: string | null; // "Conta Simples - BlueLight"

  @Column({ name: 'is_group_account', type: 'boolean', default: false })
  isGroupAccount: boolean; // Flag para intercompany

  @Column({ name: 'saldo_atual', type: 'numeric', precision: 14, scale: 2, default: 0 })
  saldoAtual: number;

  @Column({ name: 'saldo_atualizado_em', type: 'timestamptz', nullable: true })
  saldoAtualizadoEm: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, unknown>;
  // settings: { auto_sync, last_import_date, ofx_bank_id, ofx_acct_id }

  @ManyToOne(() => Empresa, (e) => e.contasBancarias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;
}
```

### 3.10 `transacao-bancaria.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { ContaBancaria } from './conta-bancaria.entity';
import { Empresa } from './empresa.entity';
import { Conciliacao } from './conciliacao.entity';
import { ExtratoImportacao } from './extrato-importacao.entity';

export enum TipoTransacao {
  CREDITO = 'credito',
  DEBITO = 'debito',
}

export enum StatusConciliacaoTransacao {
  PENDING = 'pending',
  SUGGESTED = 'suggested',
  RECONCILED = 'reconciled',
  IGNORED = 'ignored',
  REVERSED = 'reversed',
}

@Entity('transacoes_bancarias')
@Unique(['contaBancariaId', 'externalId'])
@Index(['orgId', 'empresaId', 'dataTransacao'])
@Index(['orgId', 'statusConciliacao'])
@Index(['orgId', 'empresaId', 'valor'])
export class TransacaoBancaria extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  @Index()
  empresaId: string;

  @Column({ name: 'conta_bancaria_id', type: 'uuid' })
  @Index()
  contaBancariaId: string;

  @Column({ name: 'data_transacao', type: 'date' })
  dataTransacao: Date;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor: number;

  @Column({ type: 'text' })
  descricao: string;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  // Dedup key (FITID para OFX, ou hash para CSV)
  @Column({ name: 'external_id', type: 'varchar', length: 255 })
  externalId: string;

  @Column({ name: 'external_type', type: 'varchar', length: 50, nullable: true })
  externalType: string | null; // DEBIT, CREDIT, CHECK, etc

  @Column({ name: 'tipo_transacao', type: 'enum', enum: TipoTransacao })
  tipoTransacao: TipoTransacao;

  @Column({ type: 'varchar', length: 100, nullable: true })
  categoria: string | null;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData: Record<string, unknown> | null;

  // Conciliacao
  @Column({
    name: 'status_conciliacao',
    type: 'enum',
    enum: StatusConciliacaoTransacao,
    default: StatusConciliacaoTransacao.PENDING,
  })
  statusConciliacao: StatusConciliacaoTransacao;

  @Column({ name: 'conciliacao_id', type: 'uuid', nullable: true })
  conciliacaoId: string | null;

  // Import tracking
  @Column({ name: 'import_batch_id', type: 'uuid', nullable: true })
  importBatchId: string | null;

  // Relations
  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @ManyToOne(() => ContaBancaria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conta_bancaria_id' })
  contaBancaria: ContaBancaria;

  @ManyToOne(() => Conciliacao, { nullable: true })
  @JoinColumn({ name: 'conciliacao_id' })
  conciliacao: Conciliacao | null;

  @ManyToOne(() => ExtratoImportacao, { nullable: true })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch: ExtratoImportacao | null;
}
```

### 3.11 `extrato-importacao.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { ContaBancaria } from './conta-bancaria.entity';
import { Empresa } from './empresa.entity';

export enum StatusImportacao {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

@Entity('extrato_importacoes')
@Index(['orgId', 'empresaId'])
export class ExtratoImportacao extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @Column({ name: 'conta_bancaria_id', type: 'uuid' })
  contaBancariaId: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_hash', type: 'varchar', length: 64 }) // SHA256
  fileHash: string;

  @Column({ name: 'file_size_bytes', type: 'int' })
  fileSizeBytes: number;

  @Column({ name: 'file_type', type: 'varchar', length: 10 }) // ofx, csv
  fileType: string;

  @Column({ name: 'storage_path', type: 'varchar', length: 500, nullable: true })
  storagePath: string | null; // Supabase Storage path

  @Column({ type: 'enum', enum: StatusImportacao, default: StatusImportacao.PROCESSING })
  status: StatusImportacao;

  @Column({ name: 'total_records', type: 'int', default: 0 })
  totalRecords: number;

  @Column({ name: 'imported_records', type: 'int', default: 0 })
  importedRecords: number;

  @Column({ name: 'skipped_records', type: 'int', default: 0 })
  skippedRecords: number;

  @Column({ name: 'error_records', type: 'int', default: 0 })
  errorRecords: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'date_range_start', type: 'date', nullable: true })
  dateRangeStart: Date | null;

  @Column({ name: 'date_range_end', type: 'date', nullable: true })
  dateRangeEnd: Date | null;

  @Column({ name: 'imported_by', type: 'uuid', nullable: true })
  importedBy: string | null;

  // Relations
  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @ManyToOne(() => ContaBancaria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conta_bancaria_id' })
  contaBancaria: ContaBancaria;
}
```

### 3.12 `conciliacao.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';

export enum TipoMatch {
  ONE_TO_ONE = 'one_to_one',
  ONE_TO_MANY = 'one_to_many',
  MANY_TO_ONE = 'many_to_one',
  MANY_TO_MANY = 'many_to_many',
}

export enum MetodoMatch {
  MANUAL = 'manual',
  AUTO_EXACT = 'auto_exact',
  AUTO_FUZZY = 'auto_fuzzy',
  AI_SUGGESTION = 'ai_suggestion',
}

export enum TipoConta {
  PAGAR = 'pagar',
  RECEBER = 'receber',
}

export enum StatusConciliacao {
  ACTIVE = 'active',
  REVERSED = 'reversed',
  PENDING_REVIEW = 'pending_review',
}

export enum TinyActionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('conciliacoes')
@Index(['orgId', 'empresaId', 'status'])
@Index(['orgId', 'createdAt'])
export class Conciliacao extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  @Index()
  empresaId: string;

  @Column({ name: 'tipo_match', type: 'enum', enum: TipoMatch })
  tipoMatch: TipoMatch;

  // Bank side
  @Column({ name: 'bank_transaction_ids', type: 'uuid', array: true })
  bankTransactionIds: string[];

  @Column({ name: 'bank_total', type: 'numeric', precision: 14, scale: 2 })
  bankTotal: number;

  // Conta side
  @Column({ name: 'tipo_conta', type: 'enum', enum: TipoConta })
  tipoConta: TipoConta;

  @Column({ name: 'conta_ids', type: 'uuid', array: true })
  contaIds: string[];

  @Column({ name: 'conta_tiny_ids', type: 'bigint', array: true, nullable: true })
  contaTinyIds: number[] | null;

  @Column({ name: 'conta_total', type: 'numeric', precision: 14, scale: 2 })
  contaTotal: number;

  // Difference
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  diferenca: number;

  // Method
  @Column({ name: 'metodo_match', type: 'enum', enum: MetodoMatch })
  metodoMatch: MetodoMatch;

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidenceScore: number | null;

  @Column({ name: 'match_criteria', type: 'jsonb', nullable: true })
  matchCriteria: Record<string, unknown> | null;

  // Status
  @Column({ type: 'enum', enum: StatusConciliacao, default: StatusConciliacao.ACTIVE })
  status: StatusConciliacao;

  // Tiny action (baixar)
  @Column({ name: 'tiny_action', type: 'varchar', length: 50, nullable: true })
  tinyAction: string | null; // 'baixar_cp', 'baixar_cr'

  @Column({
    name: 'tiny_action_status',
    type: 'enum',
    enum: TinyActionStatus,
    nullable: true,
  })
  tinyActionStatus: TinyActionStatus | null;

  @Column({ name: 'tiny_action_error', type: 'text', nullable: true })
  tinyActionError: string | null;

  // Actor
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  // Reversal
  @Column({ name: 'reversed_by', type: 'uuid', nullable: true })
  reversedBy: string | null;

  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt: Date | null;

  @Column({ name: 'reversal_reason', type: 'text', nullable: true })
  reversalReason: string | null;

  // Session tracking
  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Relations
  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;
}
```

### 3.13 `categoria.entity.ts`

```typescript
import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Unique, Tree, TreeParent, TreeChildren } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';

export enum TipoCategoria {
  RECEITA = 'receita',
  DESPESA = 'despesa',
}

@Entity('categorias')
@Tree('materialized-path')
@Unique(['orgId', 'nome', 'tipoCategoria', 'parentId'])
@Index(['orgId', 'tipoCategoria'])
export class Categoria extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ name: 'tipo_categoria', type: 'enum', enum: TipoCategoria })
  tipoCategoria: TipoCategoria;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'tiny_nome', type: 'varchar', length: 255, nullable: true })
  tinyNome: string | null; // Nome exato no Tiny para match

  @Column({ type: 'varchar', length: 7, nullable: true })
  cor: string | null; // hex color

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @TreeParent()
  @ManyToOne(() => Categoria, (c) => c.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: Categoria | null;

  @TreeChildren()
  @OneToMany(() => Categoria, (c) => c.parent)
  children: Categoria[];
}
```

### 3.14 `centro-custo.entity.ts`

```typescript
import { Entity, Column, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('centros_custo')
@Unique(['orgId', 'nome'])
export class CentroCusto extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid', nullable: true })
  @Index()
  empresaId: string | null; // null = compartilhado entre empresas

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
```

### 3.15 `marcador.entity.ts`

```typescript
import { Entity, Column, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('marcadores')
@Unique(['orgId', 'descricao'])
export class Marcador extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  descricao: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  cor: string | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean; // CLAUDE = system tag
}
```

### 3.16 `forma-pagamento.entity.ts`

```typescript
import { Entity, Column, Unique } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('formas_pagamento')
@Unique(['orgId', 'nome'])
export class FormaPagamento extends TenantBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nome: string;

  @Column({ name: 'tiny_nome', type: 'varchar', length: 100, nullable: true })
  tinyNome: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
```

### 3.17 `cobranca.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';
import { Contato } from './contato.entity';

export enum StatusCobranca {
  PENDENTE = 'pendente',
  ENVIADA = 'enviada',
  PAGA = 'paga',
  CANCELADA = 'cancelada',
}

export enum CanalCobranca {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
}

@Entity('cobrancas')
@Index(['orgId', 'empresaId', 'status'])
export class Cobranca extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @Column({ name: 'contato_id', type: 'uuid' })
  contatoId: string;

  @Column({ name: 'conta_receber_ids', type: 'uuid', array: true })
  contaReceberIds: string[];

  @Column({ name: 'valor_total', type: 'numeric', precision: 14, scale: 2 })
  valorTotal: number;

  @Column({ type: 'enum', enum: StatusCobranca, default: StatusCobranca.PENDENTE })
  status: StatusCobranca;

  @Column({ type: 'enum', enum: CanalCobranca })
  canal: CanalCobranca;

  @Column({ type: 'text', nullable: true })
  mensagem: string | null;

  @Column({ name: 'enviada_em', type: 'timestamptz', nullable: true })
  enviadaEm: Date | null;

  @Column({ name: 'enviada_por', type: 'uuid', nullable: true })
  enviadaPor: string | null;

  // Relations
  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @ManyToOne(() => Contato)
  @JoinColumn({ name: 'contato_id' })
  contato: Contato;
}
```

### 3.18 `documento.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';

@Entity('documentos')
@Index(['orgId', 'entityType', 'entityId'])
export class Documento extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: string; // 'conta_pagar', 'conta_receber', 'conciliacao'

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_type', type: 'varchar', length: 50 })
  fileType: string; // pdf, png, jpg, xml

  @Column({ name: 'file_size_bytes', type: 'int' })
  fileSizeBytes: number;

  @Column({ name: 'storage_path', type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;
}
```

### 3.19 `audit-log.entity.ts`

```typescript
import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// IMUTAVEL: Insert-only. Sem UpdateDateColumn, sem DeleteDateColumn.
// NAO extende BaseEntity nem TenantBaseEntity (sem soft delete)

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  RECONCILE = 'reconcile',
  REVERSE = 'reverse',
  SYNC = 'sync',
  IMPORT = 'import',
  EXPORT = 'export',
  LOGIN = 'login',
  AI_SUGGEST = 'ai_suggest',
  AI_ACCEPT = 'ai_accept',
  AI_REJECT = 'ai_reject',
  BAIXA = 'baixa',
}

export enum ActorType {
  USER = 'user',
  SYSTEM = 'system',
  AI = 'ai',
  CRON = 'cron',
}

@Entity('audit_log')
@Index(['orgId', 'createdAt'])
@Index(['orgId', 'entityType', 'entityId'])
@Index(['orgId', 'action'])
@Index(['actorId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'empresa_id', type: 'uuid', nullable: true })
  empresaId: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_type', type: 'enum', enum: ActorType, default: ActorType.USER })
  actorType: ActorType;

  @Column({ type: 'jsonb', nullable: true })
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
  // metadata: { ip, user_agent, correlation_id, duration_ms }

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // ZERO UpdateDateColumn e DeleteDateColumn -- IMUTAVEL
}
```

### 3.20 `ai-sugestao.entity.ts`

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { Empresa } from './empresa.entity';
import { Conciliacao } from './conciliacao.entity';

export enum StatusAiSugestao {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('ai_sugestoes')
@Index(['orgId', 'empresaId', 'status'])
export class AiSugestao extends TenantBaseEntity {
  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId: string;

  @Column({ name: 'bank_transaction_ids', type: 'uuid', array: true })
  bankTransactionIds: string[];

  @Column({ name: 'tipo_conta', type: 'varchar', length: 10 }) // 'pagar' | 'receber'
  tipoConta: string;

  @Column({ name: 'conta_ids', type: 'uuid', array: true })
  contaIds: string[];

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 2 })
  confidenceScore: number;

  @Column({ name: 'match_reasons', type: 'jsonb' })
  matchReasons: Array<{ reason: string; weight: number }>;

  @Column({ name: 'ai_explanation', type: 'text' })
  aiExplanation: string;

  @Column({ type: 'enum', enum: StatusAiSugestao, default: StatusAiSugestao.PENDING })
  status: StatusAiSugestao;

  @Column({ name: 'conciliacao_id', type: 'uuid', nullable: true })
  conciliacaoId: string | null;

  // Token tracking
  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens: number;

  @Column({ name: 'model_used', type: 'varchar', length: 100 })
  modelUsed: string;

  // Review
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  // Relations
  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa: Empresa;

  @ManyToOne(() => Conciliacao, { nullable: true })
  @JoinColumn({ name: 'conciliacao_id' })
  conciliacao: Conciliacao | null;
}
```

Entidades restantes seguem o mesmo padrao. Incluindo `OrgMembro`, `OrgConvite`, `SyncJob`, `Notificacao`, `RegraTollerancia`, `PadraoConciliacao`. Todas com TenantBaseEntity, soft delete, timestamps, e orgId indexado.

---

## 4. Middleware e Guards NestJS

### 4.1 `tenant.middleware.ts`

```typescript
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    // O AuthGuard ja popula req.user com o JWT decoded
    // Este middleware extrai org_id e seta no request
    const user = (req as any).user;
    if (!user?.org_id) {
      // Rotas publicas nao tem user, next() sem setar tenant
      return next();
    }
    (req as any).orgId = user.org_id;
    (req as any).tenantFilter = { orgId: user.org_id };
    next();
  }
}
```

### 4.2 `auth.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private jwks: jwksClient.JwksClient;

  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {
    this.jwks = jwksClient({
      jwksUri: this.config.get<string>('supabase.jwksUrl')!,
      cache: true,
      cacheMaxAge: 600000, // 10min
      rateLimit: true,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Token ausente');

    try {
      const decoded = await this.verifyToken(token);
      request.user = decoded;
      request.orgId = decoded.org_id;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido ou expirado');
    }
  }

  private extractToken(request: any): string | null {
    const auth = request.headers.authorization;
    if (!auth) return null;
    const [type, token] = auth.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private async verifyToken(token: string): Promise<any> {
    const getKey = (header: any, callback: any) => {
      this.jwks.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key?.getPublicKey());
      });
    };

    return new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        algorithms: ['RS256'],
        issuer: this.config.get<string>('supabase.url') + '/auth/v1',
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
  }
}
```

### 4.3 `roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.role) throw new ForbiddenException('Role nao encontrada no token');

    // Hierarchy: owner > admin > supervisor > accountant > viewer
    const hierarchy: Record<string, number> = {
      owner: 100,
      admin: 80,
      supervisor: 60,
      accountant: 40,
      viewer: 20,
    };

    const userLevel = hierarchy[user.role] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => hierarchy[r] ?? 0));

    if (userLevel < minRequired) {
      throw new ForbiddenException(`Role '${user.role}' nao tem permissao. Requerido: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
```

### 4.4 `audit.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private eventEmitter: EventEmitter2) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // So audita mutacoes
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap((responseData) => {
        const duration = Date.now() - startTime;
        this.eventEmitter.emit('audit.log', {
          orgId: request.orgId,
          empresaId: request.headers['x-company-id'],
          actorId: request.user?.sub,
          actorType: 'user',
          action: this.mapMethodToAction(method),
          entityType: this.extractEntityType(request.route?.path),
          entityId: responseData?.data?.id ?? request.params?.id ?? 'unknown',
          changes: {
            before: null, // Populated by service layer via @OnEvent
            after: this.sanitize(request.body),
          },
          metadata: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            correlationId: request.headers['x-correlation-id'],
            durationMs: duration,
            path: request.originalUrl,
            method,
          },
        });
      }),
    );
  }

  private mapMethodToAction(method: string): string {
    switch (method) {
      case 'POST': return 'create';
      case 'PUT':
      case 'PATCH': return 'update';
      case 'DELETE': return 'delete';
      default: return method.toLowerCase();
    }
  }

  private extractEntityType(path: string): string {
    // /api/v1/contas-pagar/xxx -> contas_pagar
    const segments = (path ?? '').split('/').filter(Boolean);
    const entity = segments.find((s) => !['api', 'v1'].includes(s) && !s.startsWith(':'));
    return (entity ?? 'unknown').replace(/-/g, '_');
  }

  private sanitize(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    // Remove campos sensiveis
    const sensitive = ['password', 'token', 'secret', 'key', 'enc'];
    for (const key of Object.keys(sanitized)) {
      if (sensitive.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
```

---

## 5. Database Migrations (Ordem de Execucao)

Lista das 25 migrations na ordem correta. Cada migration cria a tabela, indexes, e constraints necessarios.

| # | Migration | Dependencias | Descricao |
|---|-----------|-------------|-----------|
| 001 | `create-organizacoes` | nenhuma | Tabela `organizacoes` (nome, slug, plano, settings) |
| 002 | `create-usuarios` | nenhuma | Tabela `usuarios` (supabase_uid, nome, email) |
| 003 | `create-org-membros` | 001, 002 | Tabela `org_membros` (org_id FK, user_id FK, role). UNIQUE(org_id, user_id) |
| 004 | `create-empresas` | 001 | Tabela `empresas` (org_id FK, nome, cnpj, credenciais _enc). UNIQUE(org_id, cnpj) |
| 005 | `create-contatos` | 001, 004 | Tabela `contatos` (empresa_id FK, tipo, cpf_cnpj) |
| 006 | `create-categorias` | 001 | Tabela `categorias` (materialized path tree, tipo receita/despesa) |
| 007 | `create-centros-custo` | 001 | Tabela `centros_custo` |
| 008 | `create-marcadores` | 001 | Tabela `marcadores` (descricao, is_system) |
| 009 | `create-formas-pagamento` | 001 | Tabela `formas_pagamento` |
| 010 | `create-contas-bancarias` | 001, 004 | Tabela `contas_bancarias` (empresa_id FK, banco, tipo, fonte) |
| 011 | `create-contas-pagar` | 001, 004, 005, 006 | Tabela `contas_pagar` com todos os campos. UNIQUE(empresa_id, tiny_id) |
| 012 | `create-contas-receber` | 001, 004, 005, 006 | Tabela `contas_receber` idem + parcela_info |
| 013 | `create-transacoes-bancarias` | 001, 004, 010 | Tabela `transacoes_bancarias`. UNIQUE(conta_bancaria_id, external_id) |
| 014 | `create-extrato-importacoes` | 001, 004, 010 | Tabela `extrato_importacoes` (file_hash, stats) |
| 015 | `create-conciliacoes` | 001, 004 | Tabela `conciliacoes` (arrays de IDs, tipo_match, metodo) |
| 016 | `create-cobrancas` | 001, 004, 005 | Tabela `cobrancas` |
| 017 | `create-documentos` | 001, 004 | Tabela `documentos` (entity_type, entity_id, storage_path) |
| 018 | `create-audit-log` | nenhuma | Tabela `audit_log` (IMUTAVEL, sem soft delete). Particionada por mes |
| 019 | `create-notificacoes` | 001, 002 | Tabela `notificacoes` (user_id, type, is_read) |
| 020 | `create-sync-jobs` | 001, 004 | Tabela `sync_jobs` (provider, status, records_fetched) |
| 021 | `create-ai-sugestoes` | 001, 004, 015 | Tabela `ai_sugestoes` (confidence, tokens, model) |
| 022 | `create-regras-tolerancia` | 001, 004 | Tabela `regras_tolerancia` (conditions jsonb, action) |
| 023 | `create-padroes-conciliacao` | 001, 004, 010 | Tabela `padroes_conciliacao` (pattern_hash, frequency) |
| 024 | `create-indexes-e-triggers` | todas | Indexes compostos adicionais, trigram index em descricao, trigger audit_log imutavel |
| 025 | `seed-categorias-default` | 006 | Seed de categorias padrao receita/despesa |

A migration 024 contem os SQL criticos:

```sql
-- Trigram extension para busca fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index trigram na descricao de transacoes bancarias
CREATE INDEX idx_transacoes_descricao_trgm
  ON transacoes_bancarias USING gin (descricao gin_trgm_ops);

-- Trigger que impede UPDATE/DELETE no audit_log
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Particionamento do audit_log por mes (range on created_at)
-- Implementado via pg_partman ou manual CREATE TABLE ... PARTITION BY RANGE
```

---

## 6. Scripts npm

### Root `package.json`

```json
{
  "name": "bpo-financeiro",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "test:e2e": "turbo test:e2e",
    "clean": "turbo clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "db:migrate": "turbo db:migrate --filter=api",
    "db:migrate:create": "cd apps/api && npx typeorm migration:create",
    "db:migrate:revert": "cd apps/api && npx typeorm migration:revert -d src/database/data-source.ts",
    "db:seed": "turbo db:seed --filter=api",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:reset": "docker-compose down -v && docker-compose up -d",
    "prepare": "husky install",
    "postinstall": "turbo build --filter=@bpo/shared --filter=@bpo/ui --filter=@bpo/database"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.2.0",
    "prettier-plugin-tailwindcss": "^0.5.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  },
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=20.0.0" }
}
```

### `apps/web/package.json`

```json
{
  "name": "@bpo/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf .next .turbo node_modules"
  },
  "dependencies": {
    "@bpo/shared": "workspace:*",
    "@bpo/ui": "workspace:*",
    "@supabase/ssr": "^0.3.0",
    "@supabase/supabase-js": "^2.42.0",
    "@tanstack/react-query": "^5.28.0",
    "@tanstack/react-query-devtools": "^5.28.0",
    "axios": "^1.6.0",
    "cmdk": "^1.0.0",
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.0.0",
    "lucide-react": "^0.365.0",
    "next": "14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.51.0",
    "react-window": "^1.8.10",
    "recharts": "^2.12.0",
    "sonner": "^1.4.0",
    "zod": "^3.22.0",
    "zustand": "^4.5.0",
    "@hookform/resolvers": "^3.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/react-window": "^1.8.8",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "tailwindcss-animate": "^1.0.7",
    "@tailwindcss/typography": "^0.5.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

### `apps/api/package.json`

```json
{
  "name": "@bpo/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "db:migrate": "typeorm migration:run -d src/database/data-source.ts",
    "db:migrate:revert": "typeorm migration:revert -d src/database/data-source.ts",
    "db:seed": "ts-node src/database/seeds/run.ts",
    "clean": "rm -rf dist .turbo node_modules"
  },
  "dependencies": {
    "@bpo/shared": "workspace:*",
    "@bpo/database": "workspace:*",
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/event-emitter": "^2.0.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/schedule": "^4.0.0",
    "@nestjs/swagger": "^7.3.0",
    "@nestjs/throttler": "^5.1.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/bullmq": "^10.1.0",
    "@supabase/supabase-js": "^2.42.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "bullmq": "^5.4.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "compression": "^1.7.0",
    "helmet": "^7.1.0",
    "ioredis": "^5.3.0",
    "jsonwebtoken": "^9.0.0",
    "jwks-rsa": "^3.1.0",
    "pg": "^8.11.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0",
    "typeorm": "^0.3.20",
    "xlsx": "^0.18.5",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/compression": "^1.7.0",
    "@types/express": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.12.0",
    "@types/uuid": "^9.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.4.0"
  }
}
```

### `packages/shared/package.json`

```json
{
  "name": "@bpo/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src --fix",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### `packages/database/package.json`

```json
{
  "name": "@bpo/database",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src --fix",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## 7. Decisoes Arquiteturais e Trade-offs

### Por que Turborepo e nao Nx?
Turborepo tem configuracao minima, caching nativo com hash de inputs, e nao exige rewrite do projeto. Para um time que opera 4+ empresas e precisa de velocity, a simplicidade do Turbo e decisiva.

### Por que entities no `packages/database` separado?
As entities TypeORM sao a unica fonte de verdade do schema. Separar em package permite que tanto o `apps/api` importe para queries, quanto ferramentas de migration/seed acessem sem depender de NestJS.

### Por que Zustand e nao Redux?
O estado global neste app e limitado: empresa selecionada, user, sidebar state, selecao na tela de conciliacao. Zustand resolve isso com 20% do boilerplate do Redux. Server state fica com TanStack Query.

### Por que TypeORM e nao Prisma?
O PRD existente ja define entities com decorators TypeORM. Alem disso, o sistema precisa de queries SQL raw para o reconciliation engine (SERIALIZABLE transactions, FOR UPDATE locks, subset-sum). TypeORM oferece mais controle nesse nivel.

### Multi-tenant via org_id em todas as tabelas
Approach row-level: todas as queries filtram por `orgId`. Nao usa schema-per-tenant (complexidade de migration) nem database-per-tenant (custo Supabase). A `TenantBaseEntity` garante que todo entity tenha o campo. O `TenantMiddleware` injeta o filtro automaticamente.

---

### Critical Files for Implementation
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PRD_BPO_FINANCEIRO.md` -- PRD completo com 17 tabelas, 80 endpoints, 11 modulos, 10 sprints
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/PROCESSOS_FINANCEIRO.md` -- Regras de negocio Tiny V2/V3, Conta Simples, Pagar.me, limitacoes API
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliacao_titulos.js` -- Logica de matching existente (referencia para engines)
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/conciliar_cp_indneon_ofx.js` -- Parser OFX funcional (referencia para ofx.parser.ts)
- `C:/CLAUDECODE/CONCILIADOR FINANCEIRO/.env` -- Tokens e credenciais de todas as APIs (nao commitar, usar como referencia para .env.example)


---

# PARTE III — INFRAESTRUTURA, SEGURANÇA E OBSERVABILIDADE

> 24 módulos NestJS em 4 camadas, segurança em 6 camadas, Queue Topology (BullMQ), Caching Strategy, Deployment, CI/CD, Observabilidade.

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

# PARTE IV — MCP SERVERS E INTEGRAÇÕES

> 8 MCP Servers (Tiny ERP, Bancos, Gateways, Comunicação, AI/Claude, Documentos/OCR, Compliance, Contabilidade). Orquestração, Circuit Breaker, Rate Limiting, Saga Pattern.

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
