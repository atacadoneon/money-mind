-- =============================================================================
-- MIGRATION 003: Cadastros (contatos, categorias, formas_pagamento, marcadores)
-- =============================================================================

-- 3.1 categorias (hierárquico, materialized path)
CREATE TABLE IF NOT EXISTS categorias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id           UUID REFERENCES categorias(id) ON DELETE CASCADE,
  nivel               INTEGER NOT NULL DEFAULT 1,
  path                TEXT NOT NULL,
  codigo              TEXT NOT NULL,
  nome                TEXT NOT NULL,
  descricao           TEXT,
  tipo                TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia')),
  natureza            TEXT CHECK (natureza IN ('operacional', 'nao_operacional', 'financeira', 'tributaria')),
  dre_grupo           TEXT,
  is_active           BOOLEAN DEFAULT true,
  is_system           BOOLEAN DEFAULT false,
  tiny_id             BIGINT,
  tiny_nome_exato     TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE(org_id, codigo)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_org_tiny
  ON categorias(org_id, tiny_id) WHERE tiny_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cat_org ON categorias(org_id);
CREATE INDEX IF NOT EXISTS idx_cat_parent ON categorias(parent_id);
CREATE INDEX IF NOT EXISTS idx_cat_tipo ON categorias(tipo);
CREATE INDEX IF NOT EXISTS idx_cat_path ON categorias(path);
CREATE INDEX IF NOT EXISTS idx_cat_active ON categorias(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_cat_updated_at ON categorias;
CREATE TRIGGER trg_cat_updated_at
  BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.2 marcadores
CREATE TABLE IF NOT EXISTS marcadores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  cor             TEXT NOT NULL DEFAULT '#E91E63',
  count_cp        INTEGER DEFAULT 0,
  count_cr        INTEGER DEFAULT 0,
  is_system       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(org_id, descricao)
);

CREATE INDEX IF NOT EXISTS idx_marcadores_org ON marcadores(org_id);
CREATE INDEX IF NOT EXISTS idx_marcadores_desc ON marcadores(descricao);

DROP TRIGGER IF EXISTS trg_marcadores_updated_at ON marcadores;
CREATE TRIGGER trg_marcadores_updated_at
  BEFORE UPDATE ON marcadores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.3 formas_pagamento
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome                    TEXT NOT NULL,
  codigo                  TEXT,
  tipo                    TEXT NOT NULL
                            CHECK (tipo IN ('dinheiro','pix','boleto','cartao_credito','cartao_debito',
                                            'ted','doc','cheque','deposito','transferencia','gateway','outro')),
  icone                   TEXT DEFAULT 'credit-card',
  cor                     TEXT DEFAULT '#6B7280',
  taxa_percentual         NUMERIC(5,2) DEFAULT 0,
  taxa_fixa               NUMERIC(14,2) DEFAULT 0,
  prazo_recebimento_dias  INTEGER DEFAULT 0,
  tiny_id                 BIGINT,
  tiny_nome_exato         TEXT,
  is_active               BOOLEAN DEFAULT true,
  is_system               BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  deleted_at              TIMESTAMPTZ,
  UNIQUE(org_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_forma_org ON formas_pagamento(org_id);
CREATE INDEX IF NOT EXISTS idx_forma_tipo ON formas_pagamento(tipo);
CREATE INDEX IF NOT EXISTS idx_forma_active ON formas_pagamento(is_active);

DROP TRIGGER IF EXISTS trg_forma_updated_at ON formas_pagamento;
CREATE TRIGGER trg_forma_updated_at
  BEFORE UPDATE ON formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.4 contatos (clientes/fornecedores)
CREATE TABLE IF NOT EXISTS contatos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,

  codigo                SERIAL,
  tiny_id               BIGINT,
  nome                  TEXT NOT NULL,
  nome_fantasia         TEXT,

  tipo_pessoa           TEXT NOT NULL DEFAULT 'J'
                          CHECK (tipo_pessoa IN ('F', 'J')),
  cpf_cnpj              VARCHAR(18),
  contribuinte          TEXT DEFAULT '0'
                          CHECK (contribuinte IN ('0', '1', '2')),
  inscricao_estadual    TEXT,
  inscricao_municipal   TEXT,

  tipos                 TEXT[] NOT NULL DEFAULT '{}',
  tipo_subtipo          TEXT,

  cep                   VARCHAR(9),
  municipio             TEXT,
  uf                    VARCHAR(2),
  endereco              TEXT,
  bairro                TEXT,
  numero                TEXT,
  complemento           TEXT,
  pais                  TEXT DEFAULT 'Brasil',
  ibge_code             VARCHAR(7),

  email                 TEXT,
  email_nfe             TEXT,
  telefone              VARCHAR(20),
  celular               VARCHAR(20),
  fax                   VARCHAR(20),
  website               TEXT,

  data_nascimento       DATE,
  limite_credito        NUMERIC(14,2),
  vendedor_id           UUID REFERENCES contatos(id),
  tabela_preco          TEXT,
  condicao_pagamento    TEXT,

  banco_nome            TEXT,
  banco_agencia         TEXT,
  banco_conta           TEXT,
  banco_pix             TEXT,

  situacao              TEXT DEFAULT 'ativo'
                          CHECK (situacao IN ('ativo', 'inativo')),

  observacoes           TEXT,
  anexos                JSONB DEFAULT '[]',
  dados_complementares  JSONB DEFAULT '{}',

  raw_data              JSONB,
  last_synced_at        TIMESTAMPTZ,

  created_by            UUID REFERENCES profiles(id),
  updated_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contatos_org ON contatos(org_id);
CREATE INDEX IF NOT EXISTS idx_contatos_company ON contatos(company_id);
CREATE INDEX IF NOT EXISTS idx_contatos_nome ON contatos(nome);
CREATE INDEX IF NOT EXISTS idx_contatos_cpf_cnpj ON contatos(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_contatos_tipos ON contatos USING gin(tipos);
CREATE INDEX IF NOT EXISTS idx_contatos_tipo_subtipo ON contatos(tipo_subtipo);
CREATE INDEX IF NOT EXISTS idx_contatos_situacao ON contatos(situacao);
CREATE INDEX IF NOT EXISTS idx_contatos_municipio ON contatos(municipio, uf);
CREATE INDEX IF NOT EXISTS idx_contatos_email ON contatos(email);
CREATE INDEX IF NOT EXISTS idx_contatos_deleted ON contatos(deleted_at) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contatos_org_tiny
  ON contatos(org_id, tiny_id) WHERE tiny_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contatos_org_cpf
  ON contatos(org_id, cpf_cnpj) WHERE cpf_cnpj IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_contatos_updated_at ON contatos;
CREATE TRIGGER trg_contatos_updated_at
  BEFORE UPDATE ON contatos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
