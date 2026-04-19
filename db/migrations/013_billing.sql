-- ─────────────────────────────────────────────────────────────────────────────
-- 013_billing.sql — Billing SaaS (Stripe subscriptions, invoices, plans)
-- ─────────────────────────────────────────────────────────────────────────────

-- Plans catalog
CREATE TABLE IF NOT EXISTS plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(60)  NOT NULL UNIQUE,
  name             VARCHAR(120) NOT NULL,
  price_brl        NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle    VARCHAR(20)  NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  features         JSONB        NOT NULL DEFAULT '{}',
  stripe_price_id  VARCHAR(120),
  active           BOOLEAN      NOT NULL DEFAULT TRUE,
  trial_days       INT          NOT NULL DEFAULT 14,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Default plans seed
INSERT INTO plans (slug, name, price_brl, billing_cycle, trial_days, features) VALUES
  ('free',       'Free',       0,   'monthly', 0,  '{"max_empresas":1,"max_transacoes_mes":100,"mcps_ativos":[],"ai_enabled":false,"relatorios_avancados":false,"suporte_prioritario":false,"api_access":false,"trial_days":0}'),
  ('starter',    'Starter',    49,  'monthly', 14, '{"max_empresas":3,"max_transacoes_mes":5000,"mcps_ativos":["tiny"],"ai_enabled":false,"relatorios_avancados":false,"suporte_prioritario":false,"api_access":false,"trial_days":14}'),
  ('pro',        'Pro',        149, 'monthly', 14, '{"max_empresas":10,"max_transacoes_mes":30000,"mcps_ativos":["tiny","bancos"],"ai_enabled":true,"relatorios_avancados":true,"suporte_prioritario":false,"api_access":false,"trial_days":14}'),
  ('business',   'Business',   449, 'monthly', 14, '{"max_empresas":999,"max_transacoes_mes":999999,"mcps_ativos":["tiny","bancos","gateways","comunicacao"],"ai_enabled":true,"relatorios_avancados":true,"suporte_prioritario":true,"api_access":true,"trial_days":14}'),
  ('enterprise', 'Enterprise', 0,   'monthly', 30, '{"max_empresas":999,"max_transacoes_mes":999999,"mcps_ativos":["tiny","bancos","gateways","comunicacao"],"ai_enabled":true,"relatorios_avancados":true,"suporte_prioritario":true,"api_access":true,"trial_days":30}')
ON CONFLICT (slug) DO NOTHING;

-- Subscriptions (one per organization)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID         NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id       VARCHAR(120),
  stripe_subscription_id   VARCHAR(120),
  plan                     VARCHAR(30)  NOT NULL DEFAULT 'starter',
  status                   VARCHAR(30)  NOT NULL DEFAULT 'trialing'
                             CHECK (status IN ('trialing','active','past_due','canceled','unpaid','incomplete')),
  trial_end                TIMESTAMPTZ,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN      NOT NULL DEFAULT FALSE,
  quantity                 INT          NOT NULL DEFAULT 1,
  metadata                 JSONB        NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID         NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id   VARCHAR(120),
  amount              NUMERIC(14,2) NOT NULL DEFAULT 0,
  status              VARCHAR(30)  NOT NULL DEFAULT 'open'
                        CHECK (status IN ('draft','open','paid','void','uncollectible')),
  paid_at             TIMESTAMPTZ,
  due_at              TIMESTAMPTZ,
  hosted_invoice_url  TEXT,
  pdf_url             TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- Feature flags usage (rate limiting per plan)
CREATE TABLE IF NOT EXISTS feature_flags_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_slug  VARCHAR(120) NOT NULL,
  used_count    INT          NOT NULL DEFAULT 0,
  period_start  TIMESTAMPTZ,
  period_end    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_org ON feature_flags_usage(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_org_feature ON feature_flags_usage(org_id, feature_slug);

-- RLS policies
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags_usage ENABLE ROW LEVEL SECURITY;

-- Plans: public read
CREATE POLICY "plans_read_all" ON plans FOR SELECT USING (true);

-- Subscriptions: org members can read their own
CREATE POLICY "subscriptions_org_read" ON subscriptions
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Invoices: org members can read their org's invoices
CREATE POLICY "invoices_org_read" ON invoices
  FOR SELECT USING (
    subscription_id IN (
      SELECT s.id FROM subscriptions s
      JOIN org_members om ON om.org_id = s.org_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Feature flags: org members can read
CREATE POLICY "feature_flags_org_read" ON feature_flags_usage
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();
