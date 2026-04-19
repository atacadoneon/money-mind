-- Migration 010: transacoes_vendas
-- Armazena transações de gateways de pagamento normalizadas

CREATE TABLE IF NOT EXISTS transacoes_vendas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  company_id    UUID NOT NULL,
  gateway       VARCHAR(20) NOT NULL CHECK (gateway IN ('pagarme','appmax','stripe','mp')),
  external_id   VARCHAR(120) NOT NULL,
  valor_bruto   NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_taxa    NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(14,2) NOT NULL DEFAULT 0,
  status        VARCHAR(30) NOT NULL DEFAULT 'capturado',
  pedido_ref    VARCHAR(120),
  cliente_nome  VARCHAR(200),
  parcelas      INTEGER NOT NULL DEFAULT 1,
  data_transacao DATE NOT NULL,
  data_liquidacao DATE,
  reconciliation_id UUID,
  raw_data      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (org_id, gateway, external_id)
);

CREATE INDEX IF NOT EXISTS idx_transacoes_vendas_org_gateway   ON transacoes_vendas (org_id, company_id, gateway);
CREATE INDEX IF NOT EXISTS idx_transacoes_vendas_data          ON transacoes_vendas (org_id, company_id, data_transacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_vendas_status        ON transacoes_vendas (org_id, status);

ALTER TABLE transacoes_vendas ENABLE ROW LEVEL SECURITY;
-- RLS policies to be added per tenant pattern
