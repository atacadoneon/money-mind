-- =============================================================================
-- MIGRATION 002: Core (organizations, profiles, org_members, companies)
-- =============================================================================

-- 2.1 organizations
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#2563EB',
  plan            TEXT NOT NULL DEFAULT 'starter'
                    CHECK (plan IN ('starter','pro','business','enterprise')),
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_deleted ON organizations(deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_org_updated_at ON organizations;
CREATE TRIGGER trg_org_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.2 profiles (extende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL,
  avatar_url      TEXT,
  phone           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.3 org_members
CREATE TABLE IF NOT EXISTS org_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('owner','admin','accountant','viewer')),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON org_members(role);

DROP TRIGGER IF EXISTS trg_org_members_updated_at ON org_members;
CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON org_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.4 companies
CREATE TABLE IF NOT EXISTS companies (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  nome_fantasia             TEXT,
  cnpj                      VARCHAR(18),
  inscricao_estadual        TEXT,
  inscricao_municipal       TEXT,
  slug                      TEXT NOT NULL,
  color                     TEXT DEFAULT '#3B82F6',
  is_active                 BOOLEAN DEFAULT true,
  -- Credenciais encriptadas AES-256-GCM
  tiny_v2_token_enc         BYTEA,
  tiny_v3_client_id_enc     BYTEA,
  tiny_v3_client_secret_enc BYTEA,
  tiny_v3_access_token_enc  BYTEA,
  tiny_v3_refresh_token_enc BYTEA,
  conta_simples_key_enc     BYTEA,
  conta_simples_secret_enc  BYTEA,
  pagarme_sk_enc            BYTEA,
  settings                  JSONB DEFAULT '{}',
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  deleted_at                TIMESTAMPTZ,
  UNIQUE(org_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_org_cnpj
  ON companies(org_id, cnpj) WHERE cnpj IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(org_id);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_companies_deleted ON companies(deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
