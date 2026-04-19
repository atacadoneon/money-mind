-- Migration 015: Audit Log WORM (Write Once, Read Many)
-- Garante imutabilidade absoluta da audit_log via trigger Postgres.
-- UPDATE e DELETE são bloqueados a nível de banco, independente de aplicação.
--
-- IMPORTANTE: esta migration deve rodar APÓS a criação da tabela audit_log (migration 007).

-- ─── Trigger function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_log_immutable()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable: UPDATE and DELETE are not allowed. (table=%, operation=%)',
    TG_TABLE_NAME, TG_OP;
  RETURN NULL; -- unreachable, but required
END;
$$;

-- ─── Trigger: block UPDATE ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_immutable();

-- ─── Trigger: block DELETE ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON audit_log;
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_immutable();

-- ─── Revoke direct table access from application role (defense in depth) ────
-- Uncomment and adjust role name if using row-level permissions:
-- REVOKE UPDATE, DELETE ON audit_log FROM money_mind_app;

-- ─── Verification (run after migration to confirm) ──────────────────────────
-- INSERT INTO audit_log (org_id, action, entity, created_at) VALUES ('test-org', 'test', 'test', NOW());
-- UPDATE audit_log SET action = 'tampered'; -- must raise exception
-- DELETE FROM audit_log WHERE action = 'test'; -- must raise exception

COMMENT ON TRIGGER trg_audit_log_no_update ON audit_log
  IS 'WORM protection: prevents UPDATE on audit_log for compliance / tamper detection.';

COMMENT ON TRIGGER trg_audit_log_no_delete ON audit_log
  IS 'WORM protection: prevents DELETE on audit_log for compliance / tamper detection.';
