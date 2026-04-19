-- ─────────────────────────────────────────────────────────────────────────────
-- 014_lgpd.sql — LGPD compliance: consents, DPO requests
-- ─────────────────────────────────────────────────────────────────────────────

-- User consents (granular, versioned)
CREATE TABLE IF NOT EXISTS consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL,
  type        VARCHAR(60)  NOT NULL
                CHECK (type IN ('cookies_essenciais','analytics','marketing','ai_processing')),
  accepted    BOOLEAN      NOT NULL DEFAULT FALSE,
  ip_address  VARCHAR(60),
  user_agent  TEXT,
  version     VARCHAR(20)  NOT NULL DEFAULT '1.0',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_user_type ON consents(user_id, type);

-- DPO requests log
CREATE TABLE IF NOT EXISTS dpo_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_number  VARCHAR(60)  NOT NULL UNIQUE,
  name             VARCHAR(160) NOT NULL,
  email            VARCHAR(254) NOT NULL,
  cpf              VARCHAR(20),
  tipo             VARCHAR(60)  NOT NULL
                     CHECK (tipo IN ('acesso','correcao','anonimizacao','portabilidade','eliminacao','revogacao_consentimento')),
  descricao        TEXT         NOT NULL,
  status           VARCHAR(30)  NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','em_analise','concluido','indeferido')),
  ip_address       VARCHAR(60),
  resolved_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpo_requests_email ON dpo_requests(email);
CREATE INDEX IF NOT EXISTS idx_dpo_requests_status ON dpo_requests(status);

-- Erasure requests tracking
CREATE TABLE IF NOT EXISTS erasure_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL,
  org_id              UUID         NOT NULL REFERENCES organizations(id),
  requested_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  process_after       TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  processed_at        TIMESTAMPTZ,
  reverted_at         TIMESTAMPTZ,
  status              VARCHAR(30)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','completed','reverted')),
  reason              TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erasure_requests_user ON erasure_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_erasure_requests_org ON erasure_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_erasure_requests_status ON erasure_requests(status);

-- RLS
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dpo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE erasure_requests ENABLE ROW LEVEL SECURITY;

-- User can read/insert their own consents
CREATE POLICY "consents_own_user" ON consents
  FOR ALL USING (user_id = auth.uid());

-- Erasure requests: user can read/insert their own
CREATE POLICY "erasure_requests_own" ON erasure_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "erasure_requests_insert" ON erasure_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- DPO requests: public insert (no auth), no public read (admin only)
CREATE POLICY "dpo_requests_insert" ON dpo_requests
  FOR INSERT WITH CHECK (true);
