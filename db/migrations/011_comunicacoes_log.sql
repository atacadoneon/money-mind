-- Migration 011: comunicacoes_log
-- Log de comunicações enviadas (WhatsApp, Email, SMS)

CREATE TABLE IF NOT EXISTS comunicacoes_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  company_id       UUID,
  conta_receber_id UUID,
  canal            VARCHAR(20) NOT NULL CHECK (canal IN ('whatsapp','email','sms')),
  template         VARCHAR(60) NOT NULL,
  destinatario     VARCHAR(200) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','falha','entregue','lido')),
  provider_id      VARCHAR(200),
  raw_response     JSONB NOT NULL DEFAULT '{}',
  sent_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comunicacoes_log_org_canal ON comunicacoes_log (org_id, canal, created_at);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_log_conta     ON comunicacoes_log (org_id, conta_receber_id);

ALTER TABLE comunicacoes_log ENABLE ROW LEVEL SECURITY;
