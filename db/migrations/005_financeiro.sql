-- =============================================================================
-- MIGRATION 005: Financeiro (contas_pagar, contas_receber, movimentacoes_caixa,
-- pagamentos, recebimentos)
-- =============================================================================

-- 5.1 contas_pagar
CREATE TABLE IF NOT EXISTS contas_pagar (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  tiny_id                   BIGINT,
  numero_documento          TEXT,
  pedido_numero             TEXT,

  contato_id                UUID REFERENCES contatos(id) ON DELETE SET NULL,
  fornecedor_nome           TEXT NOT NULL,
  fornecedor_nome_fantasia  TEXT,
  fornecedor_cpf_cnpj       VARCHAR(18),

  historico                 TEXT,
  categoria_id              UUID REFERENCES categorias(id) ON DELETE SET NULL,
  categoria_nome            TEXT,
  valor                     NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo                     NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_pago                NUMERIC(14,2) NOT NULL DEFAULT 0,

  data_emissao              DATE,
  data_vencimento           DATE NOT NULL,
  data_pagamento            DATE,
  data_competencia          DATE,

  situacao                  TEXT NOT NULL DEFAULT 'aberto'
                              CHECK (situacao IN ('aberto','emitido','pago','parcial','atrasado','cancelado')),
  forma_pagamento_id        UUID REFERENCES formas_pagamento(id),
  forma_pagamento_nome      TEXT,
  conta_bancaria_id         UUID REFERENCES contas_bancarias(id),
  conta_origem              TEXT,

  buscador                  TEXT,
  buscador_status           TEXT CHECK (buscador_status IN ('pendente','liberado','bloqueado')),

  marcadores                JSONB DEFAULT '[]',

  reconciliation_status     TEXT DEFAULT 'pending'
                              CHECK (reconciliation_status IN ('pending','suggested','reconciled','ignored','reversed')),
  reconciliation_id         UUID,

  parcela_numero            INTEGER,
  parcela_total             INTEGER,
  parcela_grupo_id          UUID,

  observacoes               TEXT,
  anexos                    JSONB DEFAULT '[]',

  raw_data                  JSONB,
  last_synced_at            TIMESTAMPTZ,
  sync_source               TEXT CHECK (sync_source IN ('tiny_v2','tiny_v3','manual','import')),

  created_by                UUID REFERENCES profiles(id),
  updated_by                UUID REFERENCES profiles(id),
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cp_company_tiny
  ON contas_pagar(company_id, tiny_id) WHERE tiny_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cp_org ON contas_pagar(org_id);
CREATE INDEX IF NOT EXISTS idx_cp_company ON contas_pagar(company_id);
CREATE INDEX IF NOT EXISTS idx_cp_situacao ON contas_pagar(situacao);
CREATE INDEX IF NOT EXISTS idx_cp_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cp_fornecedor ON contas_pagar(fornecedor_nome);
CREATE INDEX IF NOT EXISTS idx_cp_valor ON contas_pagar(valor);
CREATE INDEX IF NOT EXISTS idx_cp_reconciliation ON contas_pagar(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_cp_categoria ON contas_pagar(categoria_id);
CREATE INDEX IF NOT EXISTS idx_cp_contato ON contas_pagar(contato_id);
CREATE INDEX IF NOT EXISTS idx_cp_tiny_id ON contas_pagar(tiny_id);
CREATE INDEX IF NOT EXISTS idx_cp_deleted ON contas_pagar(deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_cp_updated_at ON contas_pagar;
CREATE TRIGGER trg_cp_updated_at
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.2 contas_receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  tiny_id               BIGINT,
  numero_documento      TEXT,
  documento_origem      TEXT,
  pedido_numero         TEXT,
  nota_fiscal           TEXT,

  contato_id            UUID REFERENCES contatos(id) ON DELETE SET NULL,
  cliente_nome          TEXT NOT NULL,
  cliente_nome_fantasia TEXT,
  cliente_cpf_cnpj      VARCHAR(18),
  cliente_fone          VARCHAR(20),
  cliente_email         TEXT,

  historico             TEXT,
  categoria_id          UUID REFERENCES categorias(id) ON DELETE SET NULL,
  categoria_nome        TEXT,
  valor                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_liquido         NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_recebido        NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxa_gateway          NUMERIC(14,2) DEFAULT 0,

  data_emissao          DATE,
  data_vencimento       DATE NOT NULL,
  data_recebimento      DATE,
  data_competencia      DATE,
  data_prevista         DATE,

  situacao              TEXT NOT NULL DEFAULT 'aberto'
                          CHECK (situacao IN ('aberto','emitido','previsto','recebido','parcial','atrasado','cancelado')),
  forma_pagamento_id    UUID REFERENCES formas_pagamento(id),
  forma_pagamento_nome  TEXT,
  meio_pagamento        TEXT,
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),

  parcela_numero        INTEGER,
  parcela_total         INTEGER,
  parcela_grupo_id      UUID,

  marcadores            JSONB DEFAULT '[]',
  integracoes           JSONB DEFAULT '[]',

  reconciliation_status TEXT DEFAULT 'pending'
                          CHECK (reconciliation_status IN ('pending','suggested','reconciled','ignored','reversed')),
  reconciliation_id     UUID,

  observacoes           TEXT,
  anexos                JSONB DEFAULT '[]',

  raw_data              JSONB,
  last_synced_at        TIMESTAMPTZ,
  sync_source           TEXT CHECK (sync_source IN ('tiny_v2','tiny_v3','manual','import','pedido')),

  created_by            UUID REFERENCES profiles(id),
  updated_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cr_company_tiny
  ON contas_receber(company_id, tiny_id) WHERE tiny_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cr_org ON contas_receber(org_id);
CREATE INDEX IF NOT EXISTS idx_cr_company ON contas_receber(company_id);
CREATE INDEX IF NOT EXISTS idx_cr_situacao ON contas_receber(situacao);
CREATE INDEX IF NOT EXISTS idx_cr_vencimento ON contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_cliente ON contas_receber(cliente_nome);
CREATE INDEX IF NOT EXISTS idx_cr_valor ON contas_receber(valor);
CREATE INDEX IF NOT EXISTS idx_cr_reconciliation ON contas_receber(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_cr_pedido ON contas_receber(pedido_numero);
CREATE INDEX IF NOT EXISTS idx_cr_contato ON contas_receber(contato_id);
CREATE INDEX IF NOT EXISTS idx_cr_tiny_id ON contas_receber(tiny_id);
CREATE INDEX IF NOT EXISTS idx_cr_documento_origem ON contas_receber(documento_origem);
CREATE INDEX IF NOT EXISTS idx_cr_deleted ON contas_receber(deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_cr_updated_at ON contas_receber;
CREATE TRIGGER trg_cr_updated_at
  BEFORE UPDATE ON contas_receber
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.3 movimentacoes_caixa
CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id                  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  tipo                        TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia')),
  natureza                    TEXT NOT NULL CHECK (natureza IN ('receita', 'despesa', 'transferencia', 'emprestimo', 'investimento', 'ajuste')),

  valor                       NUMERIC(14,2) NOT NULL,
  descricao                   TEXT NOT NULL,
  historico                   TEXT,

  conta_bancaria_id           UUID REFERENCES contas_bancarias(id),
  conta_bancaria_destino_id   UUID REFERENCES contas_bancarias(id),
  categoria_id                UUID REFERENCES categorias(id),
  contato_id                  UUID REFERENCES contatos(id),
  conta_pagar_id              UUID REFERENCES contas_pagar(id),
  conta_receber_id            UUID REFERENCES contas_receber(id),

  data_movimentacao           DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia            DATE,
  numero_documento            TEXT,

  reconciliation_status       TEXT DEFAULT 'pending',
  bank_transaction_id         UUID,

  saldo_anterior              NUMERIC(14,2),
  saldo_posterior             NUMERIC(14,2),

  observacoes                 TEXT,
  created_by                  UUID REFERENCES profiles(id),
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now(),
  deleted_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_caixa_org ON movimentacoes_caixa(org_id);
CREATE INDEX IF NOT EXISTS idx_caixa_company ON movimentacoes_caixa(company_id);
CREATE INDEX IF NOT EXISTS idx_caixa_data ON movimentacoes_caixa(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_caixa_tipo ON movimentacoes_caixa(tipo);
CREATE INDEX IF NOT EXISTS idx_caixa_conta ON movimentacoes_caixa(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_caixa_categoria ON movimentacoes_caixa(categoria_id);

DROP TRIGGER IF EXISTS trg_caixa_updated_at ON movimentacoes_caixa;
CREATE TRIGGER trg_caixa_updated_at
  BEFORE UPDATE ON movimentacoes_caixa
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.4 pagamentos (baixas de CP, histórico)
CREATE TABLE IF NOT EXISTS pagamentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conta_pagar_id        UUID NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,

  data_pagamento        DATE NOT NULL,
  valor_pago            NUMERIC(14,2) NOT NULL,
  forma_pagamento_id    UUID REFERENCES formas_pagamento(id),
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),
  conta_origem          TEXT,

  observacoes           TEXT,
  is_reversed           BOOLEAN DEFAULT false,
  reversed_at           TIMESTAMPTZ,
  reversed_by           UUID REFERENCES profiles(id),
  reversal_reason       TEXT,

  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_org ON pagamentos(org_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_cp ON pagamentos(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_pagamento);

DROP TRIGGER IF EXISTS trg_pagamentos_updated_at ON pagamentos;
CREATE TRIGGER trg_pagamentos_updated_at
  BEFORE UPDATE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.5 recebimentos (baixas de CR, histórico)
CREATE TABLE IF NOT EXISTS recebimentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conta_receber_id      UUID NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,

  data_recebimento      DATE NOT NULL,
  valor_recebido        NUMERIC(14,2) NOT NULL,
  taxa_gateway          NUMERIC(14,2) DEFAULT 0,
  forma_pagamento_id    UUID REFERENCES formas_pagamento(id),
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),

  observacoes           TEXT,
  is_reversed           BOOLEAN DEFAULT false,
  reversed_at           TIMESTAMPTZ,
  reversed_by           UUID REFERENCES profiles(id),
  reversal_reason       TEXT,

  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recebimentos_org ON recebimentos(org_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_cr ON recebimentos(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_data ON recebimentos(data_recebimento);

DROP TRIGGER IF EXISTS trg_recebimentos_updated_at ON recebimentos;
CREATE TRIGGER trg_recebimentos_updated_at
  BEFORE UPDATE ON recebimentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5.6 cobrancas_bancarias
CREATE TABLE IF NOT EXISTS cobrancas_bancarias (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  nosso_numero              TEXT,
  numero_documento          TEXT,
  linha_digitavel           TEXT,
  codigo_barras             TEXT,

  contato_id                UUID REFERENCES contatos(id),
  sacado_nome               TEXT NOT NULL,
  sacado_cpf_cnpj           VARCHAR(18),
  sacado_endereco           TEXT,

  valor_nominal             NUMERIC(14,2) NOT NULL,
  valor_desconto            NUMERIC(14,2) DEFAULT 0,
  valor_juros               NUMERIC(14,2) DEFAULT 0,
  valor_multa               NUMERIC(14,2) DEFAULT 0,
  valor_pago                NUMERIC(14,2) DEFAULT 0,

  data_emissao              DATE NOT NULL,
  data_vencimento           DATE NOT NULL,
  data_pagamento            DATE,
  data_credito              DATE,
  data_limite_desconto      DATE,

  situacao                  TEXT DEFAULT 'registrado'
                              CHECK (situacao IN ('rascunho','registrado','enviado','pago','vencido','protestado',
                                                  'baixado','cancelado','rejeitado')),

  conta_bancaria_id         UUID REFERENCES contas_bancarias(id),
  banco_codigo              VARCHAR(3),
  carteira                  TEXT,

  conta_receber_id          UUID REFERENCES contas_receber(id),

  dda_id                    TEXT,
  is_dda                    BOOLEAN DEFAULT false,

  remessa_id                UUID,
  retorno_id                UUID,

  instrucao_protesto_dias   INTEGER,
  instrucao_baixa_dias      INTEGER,
  mensagem_1                TEXT,
  mensagem_2                TEXT,

  raw_data                  JSONB,
  created_by                UUID REFERENCES profiles(id),
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cobranca_org ON cobrancas_bancarias(org_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_company ON cobrancas_bancarias(company_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_situacao ON cobrancas_bancarias(situacao);
CREATE INDEX IF NOT EXISTS idx_cobranca_vencimento ON cobrancas_bancarias(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cobranca_sacado ON cobrancas_bancarias(sacado_nome);
CREATE INDEX IF NOT EXISTS idx_cobranca_nosso_num ON cobrancas_bancarias(nosso_numero);
CREATE INDEX IF NOT EXISTS idx_cobranca_cr ON cobrancas_bancarias(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_conta ON cobrancas_bancarias(conta_bancaria_id);

DROP TRIGGER IF EXISTS trg_cobranca_updated_at ON cobrancas_bancarias;
CREATE TRIGGER trg_cobranca_updated_at
  BEFORE UPDATE ON cobrancas_bancarias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
