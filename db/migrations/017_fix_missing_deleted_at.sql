-- =============================================================================
-- MIGRATION 017: Adiciona deleted_at e is_active faltantes
-- Corrige tabelas do módulo 016 que foram criadas sem deleted_at mas cujas
-- entities TypeORM herdam BaseEntity com @DeleteDateColumn.
-- Também adiciona is_active faltante na tabela marcadores.
-- =============================================================================

-- 17.1 carteiras_analistas — faltava deleted_at
ALTER TABLE carteiras_analistas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.2 alcadas_aprovacao — faltava deleted_at
ALTER TABLE alcadas_aprovacao ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.3 aprovacoes_pagamento — faltava deleted_at
ALTER TABLE aprovacoes_pagamento ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.4 regras_rateio — faltava deleted_at
ALTER TABLE regras_rateio ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.5 regras_categorizacao — faltava deleted_at
ALTER TABLE regras_categorizacao ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.6 cobranca_cadencias — faltava deleted_at
ALTER TABLE cobranca_cadencias ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.7 cobranca_templates — faltava deleted_at
ALTER TABLE cobranca_templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.8 cobranca_execucoes — faltava deleted_at
ALTER TABLE cobranca_execucoes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.9 exportacoes_contabeis — faltava deleted_at
ALTER TABLE exportacoes_contabeis ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.10 provisoes_impostos — faltava deleted_at
ALTER TABLE provisoes_impostos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 17.11 marcadores — faltava is_active
ALTER TABLE marcadores ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =============================================================================
-- Índices parciais para soft-delete (performance em queries com deleted_at IS NULL)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_carteiras_deleted ON carteiras_analistas(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alcadas_deleted ON alcadas_aprovacao(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aprovacoes_deleted ON aprovacoes_pagamento(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_regras_rateio_deleted ON regras_rateio(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_regras_cat_deleted ON regras_categorizacao(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cadencias_deleted ON cobranca_cadencias(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_templates_deleted ON cobranca_templates(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_execucoes_deleted ON cobranca_execucoes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exportacoes_deleted ON exportacoes_contabeis(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_provisoes_deleted ON provisoes_impostos(deleted_at) WHERE deleted_at IS NULL;
