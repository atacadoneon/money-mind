-- =============================================================================
-- MIGRATION 004: Bancario (contas_bancarias, import_batches, extratos_bancarios)
-- =============================================================================

-- 4.1 contas_bancarias
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  banco_codigo          VARCHAR(3),
  banco_nome            TEXT NOT NULL,
  agencia               TEXT,
  agencia_digito        VARCHAR(1),
  conta_numero          TEXT,
  conta_digito          VARCHAR(1),

  tipo                  TEXT NOT NULL
                          CHECK (tipo IN ('corrente', 'poupanca', 'pagamento', 'cartao_credito', 'gateway', 'caixa')),

  nome                  TEXT NOT NULL,
  tiny_conta_origem     TEXT,

  saldo_inicial         NUMERIC(14,2) DEFAULT 0,
  saldo_atual           NUMERIC(14,2) DEFAULT 0,
  data_saldo            DATE,

  source_type           TEXT CHECK (source_type IN ('ofx', 'api', 'csv', 'manual')),
  gateway_provider      TEXT,

  is_active             BOOLEAN DEFAULT true,
  is_group_account      BOOLEAN DEFAULT false,

  pix_tipo              TEXT CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_chave             TEXT,

  cor                   TEXT DEFAULT '#6B7280',
  icone                 TEXT DEFAULT 'building-2',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conta_bancaria_org ON contas_bancarias(org_id);
CREATE INDEX IF NOT EXISTS idx_conta_bancaria_company ON contas_bancarias(company_id);
CREATE INDEX IF NOT EXISTS idx_conta_bancaria_tipo ON contas_bancarias(tipo);
CREATE INDEX IF NOT EXISTS idx_conta_bancaria_active ON contas_bancarias(is_active);

DROP TRIGGER IF EXISTS trg_conta_bancaria_updated_at ON contas_bancarias;
CREATE TRIGGER trg_conta_bancaria_updated_at
  BEFORE UPDATE ON contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4.2 import_batches (extratos)
CREATE TABLE IF NOT EXISTS import_batches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id),
  conta_bancaria_id     UUID NOT NULL REFERENCES contas_bancarias(id),

  file_name             TEXT NOT NULL,
  file_hash             VARCHAR(64) NOT NULL,
  file_size             INTEGER,
  file_type             TEXT CHECK (file_type IN ('ofx', 'csv', 'xlsx')),
  storage_path          TEXT,

  total_records         INTEGER DEFAULT 0,
  imported_records      INTEGER DEFAULT 0,
  skipped_records       INTEGER DEFAULT 0,
  error_records         INTEGER DEFAULT 0,

  date_start            DATE,
  date_end              DATE,

  status                TEXT DEFAULT 'processing'
                          CHECK (status IN ('processing', 'completed', 'failed', 'rolled_back')),
  error_message         TEXT,

  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,

  UNIQUE(conta_bancaria_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_batch_org ON import_batches(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_conta ON import_batches(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_batch_status ON import_batches(status);

DROP TRIGGER IF EXISTS trg_batch_updated_at ON import_batches;
CREATE TRIGGER trg_batch_updated_at
  BEFORE UPDATE ON import_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4.3 extratos_bancarios (linhas do extrato)
CREATE TABLE IF NOT EXISTS extratos_bancarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conta_bancaria_id     UUID NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,

  data_transacao        DATE NOT NULL,
  data_compensacao      DATE,
  valor                 NUMERIC(14,2) NOT NULL,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  descricao             TEXT NOT NULL,
  memo                  TEXT,

  external_id           TEXT,
  external_type         TEXT CHECK (external_type IN ('ofx','csv','api','manual')),
  check_number          TEXT,
  reference_number      TEXT,

  categoria_id          UUID REFERENCES categorias(id),
  categoria_auto        BOOLEAN DEFAULT false,
  contato_id            UUID REFERENCES contatos(id),

  reconciliation_status TEXT DEFAULT 'pending'
                          CHECK (reconciliation_status IN ('pending','suggested','reconciled','ignored','reversed','transfer')),
  reconciliation_id     UUID,
  conta_pagar_id        UUID,
  conta_receber_id      UUID,

  import_batch_id       UUID REFERENCES import_batches(id),

  raw_data              JSONB,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,

  UNIQUE(conta_bancaria_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_extrato_org ON extratos_bancarios(org_id);
CREATE INDEX IF NOT EXISTS idx_extrato_company ON extratos_bancarios(company_id);
CREATE INDEX IF NOT EXISTS idx_extrato_conta ON extratos_bancarios(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_extrato_data ON extratos_bancarios(data_transacao);
CREATE INDEX IF NOT EXISTS idx_extrato_valor ON extratos_bancarios(valor);
CREATE INDEX IF NOT EXISTS idx_extrato_tipo ON extratos_bancarios(tipo);
CREATE INDEX IF NOT EXISTS idx_extrato_status ON extratos_bancarios(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_extrato_batch ON extratos_bancarios(import_batch_id);

DROP TRIGGER IF EXISTS trg_extrato_updated_at ON extratos_bancarios;
CREATE TRIGGER trg_extrato_updated_at
  BEFORE UPDATE ON extratos_bancarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
