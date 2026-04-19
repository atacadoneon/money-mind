-- =============================================================================
-- MIGRATION 009: Indexes GIN trigram, indexes compostos e foreign key crosslinks
-- =============================================================================

-- Trigram indexes para busca fuzzy
CREATE INDEX IF NOT EXISTS idx_cp_historico_trgm
  ON contas_pagar USING gin(historico gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cp_fornecedor_trgm
  ON contas_pagar USING gin(fornecedor_nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cr_historico_trgm
  ON contas_receber USING gin(historico gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cr_cliente_trgm
  ON contas_receber USING gin(cliente_nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contatos_nome_trgm
  ON contatos USING gin(nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contatos_fantasia_trgm
  ON contatos USING gin(nome_fantasia gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_extrato_descricao_trgm
  ON extratos_bancarios USING gin(descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_extrato_memo_trgm
  ON extratos_bancarios USING gin(memo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cat_nome_trgm
  ON categorias USING gin(nome gin_trgm_ops);

-- Indexes compostos adicionais (hot paths)
CREATE INDEX IF NOT EXISTS idx_cp_org_venc_situacao
  ON contas_pagar(org_id, data_vencimento, situacao)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cr_org_venc_situacao
  ON contas_receber(org_id, data_vencimento, situacao)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_extrato_conta_data_status
  ON extratos_bancarios(conta_bancaria_id, data_transacao, reconciliation_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_caixa_company_data
  ON movimentacoes_caixa(company_id, data_movimentacao)
  WHERE deleted_at IS NULL;

-- FKs cruzados criados após as tabelas existirem
ALTER TABLE extratos_bancarios
  DROP CONSTRAINT IF EXISTS fk_extrato_cp;
ALTER TABLE extratos_bancarios
  ADD CONSTRAINT fk_extrato_cp FOREIGN KEY (conta_pagar_id)
  REFERENCES contas_pagar(id) ON DELETE SET NULL;

ALTER TABLE extratos_bancarios
  DROP CONSTRAINT IF EXISTS fk_extrato_cr;
ALTER TABLE extratos_bancarios
  ADD CONSTRAINT fk_extrato_cr FOREIGN KEY (conta_receber_id)
  REFERENCES contas_receber(id) ON DELETE SET NULL;

ALTER TABLE extratos_bancarios
  DROP CONSTRAINT IF EXISTS fk_extrato_rec;
ALTER TABLE extratos_bancarios
  ADD CONSTRAINT fk_extrato_rec FOREIGN KEY (reconciliation_id)
  REFERENCES reconciliations(id) ON DELETE SET NULL;

ALTER TABLE contas_pagar
  DROP CONSTRAINT IF EXISTS fk_cp_rec;
ALTER TABLE contas_pagar
  ADD CONSTRAINT fk_cp_rec FOREIGN KEY (reconciliation_id)
  REFERENCES reconciliations(id) ON DELETE SET NULL;

ALTER TABLE contas_receber
  DROP CONSTRAINT IF EXISTS fk_cr_rec;
ALTER TABLE contas_receber
  ADD CONSTRAINT fk_cr_rec FOREIGN KEY (reconciliation_id)
  REFERENCES reconciliations(id) ON DELETE SET NULL;

-- Trigger de saldo em movimentacoes_caixa (do spec)
CREATE OR REPLACE FUNCTION calcular_saldo_caixa()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_saldo NUMERIC(14,2);
BEGIN
  IF NEW.conta_bancaria_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(SUM(
    CASE WHEN tipo = 'entrada' THEN valor
         WHEN tipo = 'saida' THEN -valor
         ELSE 0 END
  ), 0) INTO v_saldo
  FROM movimentacoes_caixa
  WHERE conta_bancaria_id = NEW.conta_bancaria_id
    AND data_movimentacao <= NEW.data_movimentacao
    AND id != NEW.id
    AND deleted_at IS NULL;

  NEW.saldo_anterior := v_saldo;
  NEW.saldo_posterior := v_saldo +
    CASE WHEN NEW.tipo = 'entrada' THEN NEW.valor
         WHEN NEW.tipo = 'saida' THEN -NEW.valor
         ELSE 0 END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_saldo_caixa ON movimentacoes_caixa;
CREATE TRIGGER trg_saldo_caixa
  BEFORE INSERT ON movimentacoes_caixa
  FOR EACH ROW EXECUTE FUNCTION calcular_saldo_caixa();
