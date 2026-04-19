-- =============================================================================
-- MIGRATION 007: Operacional (audit_log, anexos, relatorios_saved, notificacoes,
-- sync_jobs)
-- =============================================================================

-- 7.1 audit_log (IMUTÁVEL — partitioned by created_at month)
CREATE TABLE IF NOT EXISTS audit_log (
  id                    UUID NOT NULL DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,

  action                TEXT NOT NULL,
  entity_type           TEXT NOT NULL,
  entity_id             UUID NOT NULL,

  actor_id              UUID,
  actor_type            TEXT CHECK (actor_type IN ('user', 'system', 'ai', 'sync')),
  actor_name            TEXT,

  changes               JSONB,
  metadata              JSONB,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partições mensais 2026 (idempotente)
DO $$
DECLARE
  yr INT;
  mo INT;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  FOR yr IN 2026..2027 LOOP
    FOR mo IN 1..12 LOOP
      partition_name := format('audit_log_%s_%s', yr, lpad(mo::text, 2, '0'));
      start_date := make_date(yr, mo, 1);
      end_date := start_date + INTERVAL '1 month';
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
    END LOOP;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);

-- Trigger imutabilidade
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable. UPDATE and DELETE are forbidden.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- 7.2 anexos (documentos genéricos)
CREATE TABLE IF NOT EXISTS anexos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,

  entity_type           TEXT NOT NULL,
  entity_id             UUID NOT NULL,

  file_name             TEXT NOT NULL,
  file_size             INTEGER,
  file_type             TEXT,
  mime_type             TEXT,
  storage_path          TEXT NOT NULL,
  storage_bucket        TEXT NOT NULL DEFAULT 'anexos',
  file_hash             VARCHAR(64),

  metadata              JSONB DEFAULT '{}',

  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_anexos_org ON anexos(org_id);
CREATE INDEX IF NOT EXISTS idx_anexos_entity ON anexos(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_anexos_deleted ON anexos(deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_anexos_updated_at ON anexos;
CREATE TRIGGER trg_anexos_updated_at
  BEFORE UPDATE ON anexos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7.3 relatorios_saved (relatórios salvos pelo usuário)
CREATE TABLE IF NOT EXISTS relatorios_saved (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES profiles(id) ON DELETE CASCADE,

  nome                  TEXT NOT NULL,
  tipo                  TEXT NOT NULL
                          CHECK (tipo IN ('dre','fluxo_caixa','aging','balancete','conciliacao','custom')),
  filtros               JSONB NOT NULL DEFAULT '{}',
  colunas               JSONB DEFAULT '[]',
  agrupamento           TEXT,

  is_shared             BOOLEAN DEFAULT false,
  is_favorito           BOOLEAN DEFAULT false,

  last_run_at           TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_relatorios_org ON relatorios_saved(org_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_user ON relatorios_saved(user_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_tipo ON relatorios_saved(tipo);

DROP TRIGGER IF EXISTS trg_relatorios_updated_at ON relatorios_saved;
CREATE TRIGGER trg_relatorios_updated_at
  BEFORE UPDATE ON relatorios_saved
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7.4 notificacoes
CREATE TABLE IF NOT EXISTS notificacoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  tipo                  TEXT NOT NULL,
  titulo                TEXT NOT NULL,
  mensagem              TEXT,
  link                  TEXT,
  metadata              JSONB DEFAULT '{}',

  is_read               BOOLEAN DEFAULT false,
  read_at               TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_org ON notificacoes(org_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notificacoes(user_id, is_read) WHERE is_read = false;

-- 7.5 sync_jobs (trabalhos de sincronização com APIs externas)
CREATE TABLE IF NOT EXISTS sync_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  provider              TEXT NOT NULL
                          CHECK (provider IN ('tiny_v2','tiny_v3','conta_simples','pagarme','appmax','manual')),
  tipo                  TEXT NOT NULL,

  status                TEXT NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued','running','completed','failed','cancelled')),

  records_fetched       INTEGER DEFAULT 0,
  records_created       INTEGER DEFAULT 0,
  records_updated       INTEGER DEFAULT 0,
  records_errored       INTEGER DEFAULT 0,

  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  duration_ms           INTEGER,

  params                JSONB DEFAULT '{}',
  error_message         TEXT,
  error_stack           TEXT,

  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_org ON sync_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_sync_company ON sync_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_provider ON sync_jobs(provider);
CREATE INDEX IF NOT EXISTS idx_sync_created ON sync_jobs(created_at DESC);

DROP TRIGGER IF EXISTS trg_sync_updated_at ON sync_jobs;
CREATE TRIGGER trg_sync_updated_at
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
