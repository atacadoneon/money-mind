-- Migration 012: webhooks_subscriptions
-- Assinaturas de webhook outbound para clientes SaaS

CREATE TABLE IF NOT EXISTS webhooks_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  url        TEXT NOT NULL,
  events     TEXT[] NOT NULL DEFAULT '{}',
  secret     VARCHAR(100) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhooks_subs_org ON webhooks_subscriptions (org_id, active);

ALTER TABLE webhooks_subscriptions ENABLE ROW LEVEL SECURITY;
