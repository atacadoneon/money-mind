-- =============================================================================
-- MIGRATION 008: RLS (Row Level Security) e função get_org_id()
-- Multi-tenant isolation per org_id.
-- =============================================================================

-- Função que extrai org_id do JWT do Supabase (ou da session var local).
-- Em Supabase, o JWT é decodificado por auth.jwt() - aqui usamos app.current_org_id.
CREATE OR REPLACE FUNCTION get_org_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- 1) Tenta ler da session var (seta via SET app.current_org_id)
  BEGIN
    v_org_id := current_setting('app.current_org_id', true)::UUID;
    IF v_org_id IS NOT NULL THEN
      RETURN v_org_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 2) Tenta ler do JWT Supabase (claim "org_id")
  BEGIN
    v_org_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::UUID;
    RETURN v_org_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Habilita RLS em todas as tabelas multi-tenant
ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcadores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE formas_pagamento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE extratos_bancarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber         ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_caixa    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE recebimentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobrancas_bancarias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE padroes_conciliacao    ENABLE ROW LEVEL SECURITY;
ALTER TABLE anexos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios_saved       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- Helper para criar política padrão idempotentemente
DO $$
DECLARE
  tbl TEXT;
  pol_name TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'companies','categorias','marcadores','formas_pagamento','contatos',
      'contas_bancarias','import_batches','extratos_bancarios',
      'contas_pagar','contas_receber','movimentacoes_caixa','pagamentos','recebimentos',
      'cobrancas_bancarias','reconciliations','reconciliation_rules',
      'ai_suggestions','padroes_conciliacao','anexos','relatorios_saved','notificacoes',
      'sync_jobs'
    ])
  LOOP
    pol_name := tbl || '_org_isolation';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol_name, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (org_id = get_org_id()) WITH CHECK (org_id = get_org_id())',
      pol_name, tbl
    );
  END LOOP;
END $$;

-- Políticas específicas para tabelas "core"

DROP POLICY IF EXISTS organizations_self_access ON organizations;
CREATE POLICY organizations_self_access ON organizations
  FOR ALL USING (id = get_org_id()) WITH CHECK (id = get_org_id());

DROP POLICY IF EXISTS org_members_self ON org_members;
CREATE POLICY org_members_self ON org_members
  FOR ALL USING (org_id = get_org_id()) WITH CHECK (org_id = get_org_id());

-- audit_log: somente SELECT para users (insert via service role)
DROP POLICY IF EXISTS audit_select ON audit_log;
CREATE POLICY audit_select ON audit_log
  FOR SELECT USING (org_id = get_org_id());

-- profiles: usuário vê só o próprio perfil (+ membros da mesma org é feito via join, fora do RLS)
-- Aqui deixamos permissivo: SELECT para o próprio id (app faz verificação).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles
  FOR ALL USING (true);  -- refinar quando integrar Supabase Auth real
