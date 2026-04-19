-- =============================================================================
-- MIGRATION 006: Reconciliation (reconciliations, reconciliation_rules,
-- ai_suggestions, padroes_conciliacao)
-- =============================================================================

-- 6.1 reconciliations (sessões / matches confirmados)
CREATE TABLE IF NOT EXISTS reconciliations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Tipo e método
  tipo_match            TEXT NOT NULL
                          CHECK (tipo_match IN ('1:1','1:N','N:1','N:N','manual','transfer')),
  metodo                TEXT NOT NULL
                          CHECK (metodo IN ('auto','ai','manual','rule','pattern')),

  -- Valores agregados
  valor_extrato         NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_contas          NUMERIC(14,2) NOT NULL DEFAULT 0,
  diferenca             NUMERIC(14,2) GENERATED ALWAYS AS (valor_extrato - valor_contas) STORED,

  -- IDs vinculados (arrays)
  extrato_ids           UUID[] NOT NULL DEFAULT '{}',
  conta_pagar_ids       UUID[] NOT NULL DEFAULT '{}',
  conta_receber_ids     UUID[] NOT NULL DEFAULT '{}',

  -- Status
  status                TEXT NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('pending','suggested','confirmed','reversed')),

  -- Confiança / origem
  confidence            NUMERIC(5,2),
  ai_suggestion_id      UUID,
  rule_id               UUID,

  observacoes           TEXT,
  reversal_reason       TEXT,

  created_by            UUID REFERENCES profiles(id),
  reversed_by           UUID REFERENCES profiles(id),
  reversed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_org ON reconciliations(org_id);
CREATE INDEX IF NOT EXISTS idx_rec_company ON reconciliations(company_id);
CREATE INDEX IF NOT EXISTS idx_rec_status ON reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_rec_metodo ON reconciliations(metodo);
CREATE INDEX IF NOT EXISTS idx_rec_extratos ON reconciliations USING gin(extrato_ids);
CREATE INDEX IF NOT EXISTS idx_rec_cp ON reconciliations USING gin(conta_pagar_ids);
CREATE INDEX IF NOT EXISTS idx_rec_cr ON reconciliations USING gin(conta_receber_ids);

DROP TRIGGER IF EXISTS trg_rec_updated_at ON reconciliations;
CREATE TRIGGER trg_rec_updated_at
  BEFORE UPDATE ON reconciliations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6.2 reconciliation_rules (regras de tolerância e matching)
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,

  nome                  TEXT NOT NULL,
  descricao             TEXT,
  prioridade            INTEGER DEFAULT 100,

  -- Condições (jsonb com estrutura { field, operator, value })
  conditions            JSONB NOT NULL DEFAULT '[]',
  -- Ação (jsonb: { type, params })
  action                JSONB NOT NULL DEFAULT '{}',

  -- Tolerâncias
  valor_tolerancia      NUMERIC(14,2) DEFAULT 0,
  valor_tolerancia_pct  NUMERIC(5,2) DEFAULT 0,
  data_tolerancia_dias  INTEGER DEFAULT 0,

  is_active             BOOLEAN DEFAULT true,

  -- Stats
  uses_count            INTEGER DEFAULT 0,
  hits_count            INTEGER DEFAULT 0,
  last_used_at          TIMESTAMPTZ,

  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rule_org ON reconciliation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_rule_company ON reconciliation_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_rule_active ON reconciliation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rule_prioridade ON reconciliation_rules(prioridade);

DROP TRIGGER IF EXISTS trg_rule_updated_at ON reconciliation_rules;
CREATE TRIGGER trg_rule_updated_at
  BEFORE UPDATE ON reconciliation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6.3 ai_suggestions
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  tipo                  TEXT NOT NULL
                          CHECK (tipo IN ('match','categoria','marcador','contato','duplicata','estorno')),

  extrato_id            UUID REFERENCES extratos_bancarios(id) ON DELETE CASCADE,
  conta_pagar_ids       UUID[] DEFAULT '{}',
  conta_receber_ids     UUID[] DEFAULT '{}',

  sugestao              JSONB NOT NULL,
  confidence            NUMERIC(5,2) NOT NULL,
  model                 TEXT,
  tokens_input          INTEGER DEFAULT 0,
  tokens_output         INTEGER DEFAULT 0,
  cost_usd              NUMERIC(10,6) DEFAULT 0,

  status                TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','rejected','expired')),
  decided_by            UUID REFERENCES profiles(id),
  decided_at            TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_org ON ai_suggestions(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_tipo ON ai_suggestions(tipo);
CREATE INDEX IF NOT EXISTS idx_ai_confidence ON ai_suggestions(confidence);
CREATE INDEX IF NOT EXISTS idx_ai_extrato ON ai_suggestions(extrato_id);

DROP TRIGGER IF EXISTS trg_ai_updated_at ON ai_suggestions;
CREATE TRIGGER trg_ai_updated_at
  BEFORE UPDATE ON ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6.4 padroes_conciliacao (Pattern Memory)
CREATE TABLE IF NOT EXISTS padroes_conciliacao (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,

  pattern_hash          VARCHAR(64) NOT NULL,
  pattern_description   TEXT NOT NULL,
  pattern_regex         TEXT,

  -- O que este padrão resolve
  target_categoria_id   UUID REFERENCES categorias(id),
  target_contato_id     UUID REFERENCES contatos(id),
  target_forma_id       UUID REFERENCES formas_pagamento(id),
  target_marcadores     JSONB DEFAULT '[]',

  -- Stats
  frequency             INTEGER DEFAULT 1,
  last_seen_at          TIMESTAMPTZ DEFAULT now(),
  confidence            NUMERIC(5,2) DEFAULT 0,

  is_active             BOOLEAN DEFAULT true,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(org_id, pattern_hash)
);

CREATE INDEX IF NOT EXISTS idx_padrao_org ON padroes_conciliacao(org_id);
CREATE INDEX IF NOT EXISTS idx_padrao_hash ON padroes_conciliacao(pattern_hash);
CREATE INDEX IF NOT EXISTS idx_padrao_freq ON padroes_conciliacao(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_padrao_active ON padroes_conciliacao(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_padrao_updated_at ON padroes_conciliacao;
CREATE TRIGGER trg_padrao_updated_at
  BEFORE UPDATE ON padroes_conciliacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
