-- =============================================================================
-- MIGRATION 016: Módulos Avançados
-- Fechamento Mensal, Workflow BPO, Aprovação Pagamentos, Cobrança Automatizada,
-- Gestão de Documentos, Plano de Contas com Rateio, Portal do Cliente,
-- Saneamento Cadastral, Integração Contábil
-- =============================================================================

-- =============================================================================
-- 16.1 FECHAMENTO MENSAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS fechamentos_mensais (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  competencia           VARCHAR(7) NOT NULL, -- '2026-04'
  status                VARCHAR(20) NOT NULL DEFAULT 'aberto'
                          CHECK (status IN ('aberto','em_progresso','revisao','aprovado','fechado','reaberto')),
  progresso_percentual  INTEGER DEFAULT 0 CHECK (progresso_percentual BETWEEN 0 AND 100),
  total_pendencias      INTEGER DEFAULT 0,
  pendencias_bloqueantes INTEGER DEFAULT 0,

  -- Responsáveis
  analista_id           UUID REFERENCES profiles(id),
  supervisor_id         UUID REFERENCES profiles(id),
  aprovado_por          UUID REFERENCES profiles(id),
  aprovado_em           TIMESTAMPTZ,
  fechado_por           UUID REFERENCES profiles(id),
  fechado_em            TIMESTAMPTZ,

  -- Reabertura
  reaberto_por          UUID REFERENCES profiles(id),
  reaberto_em           TIMESTAMPTZ,
  motivo_reabertura     TEXT,

  observacoes           TEXT,
  relatorio_url         TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,

  UNIQUE(company_id, competencia)
);

CREATE INDEX idx_fechamento_org ON fechamentos_mensais(org_id);
CREATE INDEX idx_fechamento_company ON fechamentos_mensais(company_id);
CREATE INDEX idx_fechamento_status ON fechamentos_mensais(status);
CREATE INDEX idx_fechamento_competencia ON fechamentos_mensais(competencia);

DROP TRIGGER IF EXISTS trg_fechamento_updated_at ON fechamentos_mensais;
CREATE TRIGGER trg_fechamento_updated_at
  BEFORE UPDATE ON fechamentos_mensais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Itens do checklist de fechamento
CREATE TABLE IF NOT EXISTS fechamento_checklist_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fechamento_id         UUID NOT NULL REFERENCES fechamentos_mensais(id) ON DELETE CASCADE,
  titulo                TEXT NOT NULL,
  descricao             TEXT,
  tipo                  VARCHAR(20) NOT NULL DEFAULT 'automatico'
                          CHECK (tipo IN ('automatico','manual')),
  categoria             VARCHAR(30) DEFAULT 'geral'
                          CHECK (categoria IN ('conciliacao','categoria','documento','bancario','imposto','folha','geral')),
  status                VARCHAR(20) NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('ok','pendente','bloqueante','ignorado')),
  is_bloqueante         BOOLEAN DEFAULT false,
  valor_referencia      NUMERIC(14,2),
  resolvido_por         UUID REFERENCES profiles(id),
  resolvido_em          TIMESTAMPTZ,
  atribuido_a           VARCHAR(20) CHECK (atribuido_a IN ('analista','cliente','contador')),
  prazo                 TIMESTAMPTZ,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_checklist_fechamento ON fechamento_checklist_itens(fechamento_id);
CREATE INDEX idx_checklist_status ON fechamento_checklist_itens(status);

DROP TRIGGER IF EXISTS trg_checklist_updated_at ON fechamento_checklist_itens;
CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON fechamento_checklist_itens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 16.2 WORKFLOW BPO
-- =============================================================================

-- Carteira: vincula empresas a analistas
CREATE TABLE IF NOT EXISTS carteiras_analistas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  analista_id           UUID NOT NULL REFERENCES profiles(id),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_active             BOOLEAN DEFAULT true,

  -- SLA
  sla_fechamento_dia    INTEGER DEFAULT 10, -- dia do mês para fechar
  sla_conciliacao       VARCHAR(20) DEFAULT 'diaria'
                          CHECK (sla_conciliacao IN ('diaria','semanal','quinzenal','mensal')),
  sla_cobranca          VARCHAR(20) DEFAULT 'semanal'
                          CHECK (sla_cobranca IN ('diaria','semanal','quinzenal','mensal')),

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(org_id, analista_id, company_id)
);

CREATE INDEX idx_carteira_analista ON carteiras_analistas(analista_id);
CREATE INDEX idx_carteira_company ON carteiras_analistas(company_id);

DROP TRIGGER IF EXISTS trg_carteira_updated_at ON carteiras_analistas;
CREATE TRIGGER trg_carteira_updated_at
  BEFORE UPDATE ON carteiras_analistas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tarefas do workflow
CREATE TABLE IF NOT EXISTS tarefas_workflow (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  analista_id           UUID REFERENCES profiles(id),
  supervisor_id         UUID REFERENCES profiles(id),

  titulo                TEXT NOT NULL,
  descricao             TEXT,
  tipo                  VARCHAR(30) NOT NULL
                          CHECK (tipo IN ('conciliacao','classificacao','documento','cobranca','fechamento','aprovacao','revisao','outro')),
  prioridade            VARCHAR(10) DEFAULT 'media'
                          CHECK (prioridade IN ('critica','alta','media','baixa')),
  status                VARCHAR(20) NOT NULL DEFAULT 'backlog'
                          CHECK (status IN ('backlog','a_fazer','em_andamento','revisao','concluida','cancelada')),
  prazo                 TIMESTAMPTZ,
  concluida_em          TIMESTAMPTZ,

  -- Referências
  entidade_tipo         VARCHAR(30), -- 'conta_pagar', 'conta_receber', 'fechamento', etc.
  entidade_id           UUID,

  -- Revisão
  comentario_revisao    TEXT,
  revisado_por          UUID REFERENCES profiles(id),
  revisado_em           TIMESTAMPTZ,

  tempo_gasto_min       INTEGER DEFAULT 0,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_tarefa_org ON tarefas_workflow(org_id);
CREATE INDEX idx_tarefa_analista ON tarefas_workflow(analista_id);
CREATE INDEX idx_tarefa_company ON tarefas_workflow(company_id);
CREATE INDEX idx_tarefa_status ON tarefas_workflow(status);
CREATE INDEX idx_tarefa_tipo ON tarefas_workflow(tipo);
CREATE INDEX idx_tarefa_prazo ON tarefas_workflow(prazo);
CREATE INDEX idx_tarefa_entidade ON tarefas_workflow(entidade_tipo, entidade_id);

DROP TRIGGER IF EXISTS trg_tarefa_updated_at ON tarefas_workflow;
CREATE TRIGGER trg_tarefa_updated_at
  BEFORE UPDATE ON tarefas_workflow
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 16.3 APROVAÇÃO DE PAGAMENTOS
-- =============================================================================

-- Configuração de alçadas por empresa
CREATE TABLE IF NOT EXISTS alcadas_aprovacao (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE, -- null = padrão org
  nome                  TEXT NOT NULL,
  valor_minimo          NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_maximo          NUMERIC(14,2), -- null = sem limite
  aprovador_role        VARCHAR(20) NOT NULL
                          CHECK (aprovador_role IN ('analista','supervisor','admin','owner')),
  is_active             BOOLEAN DEFAULT true,
  ordem                 INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alcada_org ON alcadas_aprovacao(org_id);
CREATE INDEX idx_alcada_company ON alcadas_aprovacao(company_id);

DROP TRIGGER IF EXISTS trg_alcada_updated_at ON alcadas_aprovacao;
CREATE TRIGGER trg_alcada_updated_at
  BEFORE UPDATE ON alcadas_aprovacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Solicitações de aprovação
CREATE TABLE IF NOT EXISTS aprovacoes_pagamento (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conta_pagar_id        UUID NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,
  alcada_id             UUID REFERENCES alcadas_aprovacao(id),

  valor                 NUMERIC(14,2) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','aprovada','rejeitada','expirada','cancelada')),

  solicitado_por        UUID NOT NULL REFERENCES profiles(id),
  solicitado_em         TIMESTAMPTZ DEFAULT now(),
  aprovador_id          UUID REFERENCES profiles(id),
  aprovado_em           TIMESTAMPTZ,
  motivo_rejeicao       TEXT,

  -- Detecção de duplicata
  risco_duplicata_score INTEGER DEFAULT 0 CHECK (risco_duplicata_score BETWEEN 0 AND 100),
  duplicata_detectada_id UUID REFERENCES contas_pagar(id),

  -- Agendamento
  data_agendada         DATE,
  conta_bancaria_id     UUID REFERENCES contas_bancarias(id),
  meio_pagamento        VARCHAR(20) CHECK (meio_pagamento IN ('pix','boleto','ted','debito','cartao')),

  -- Comprovante
  comprovante_url       TEXT,
  comprovante_enviado_em TIMESTAMPTZ,

  observacoes           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_aprovacao_org ON aprovacoes_pagamento(org_id);
CREATE INDEX idx_aprovacao_cp ON aprovacoes_pagamento(conta_pagar_id);
CREATE INDEX idx_aprovacao_status ON aprovacoes_pagamento(status);
CREATE INDEX idx_aprovacao_aprovador ON aprovacoes_pagamento(aprovador_id);

DROP TRIGGER IF EXISTS trg_aprovacao_updated_at ON aprovacoes_pagamento;
CREATE TRIGGER trg_aprovacao_updated_at
  BEFORE UPDATE ON aprovacoes_pagamento
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 16.4 COBRANÇA AUTOMATIZADA
-- =============================================================================

-- Cadências de cobrança
CREATE TABLE IF NOT EXISTS cobranca_cadencias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  descricao             TEXT,
  is_default            BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  segmento_alvo         VARCHAR(30) DEFAULT 'todos'
                          CHECK (segmento_alvo IN ('todos','premium','novos','inadimplentes','alto_valor')),
  etapas                JSONB NOT NULL DEFAULT '[]',
  -- Cada etapa: { ordem, dias_offset, canal, template_id, janela_horario, cooldown_horas, nivel_escalacao }
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cadencia_org ON cobranca_cadencias(org_id);

DROP TRIGGER IF EXISTS trg_cadencia_updated_at ON cobranca_cadencias;
CREATE TRIGGER trg_cadencia_updated_at
  BEFORE UPDATE ON cobranca_cadencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Execuções de cobrança (por título)
CREATE TABLE IF NOT EXISTS cobranca_execucoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conta_receber_id      UUID NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
  cadencia_id           UUID NOT NULL REFERENCES cobranca_cadencias(id),
  etapa_atual           INTEGER DEFAULT 0,
  status                VARCHAR(20) NOT NULL DEFAULT 'ativa'
                          CHECK (status IN ('ativa','pausada','concluida','cancelada','negociando')),
  iniciada_em           TIMESTAMPTZ DEFAULT now(),
  pausada_em            TIMESTAMPTZ,
  concluida_em          TIMESTAMPTZ,
  motivo_pausa          TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exec_org ON cobranca_execucoes(org_id);
CREATE INDEX idx_exec_cr ON cobranca_execucoes(conta_receber_id);
CREATE INDEX idx_exec_status ON cobranca_execucoes(status);

DROP TRIGGER IF EXISTS trg_exec_updated_at ON cobranca_execucoes;
CREATE TRIGGER trg_exec_updated_at
  BEFORE UPDATE ON cobranca_execucoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ações individuais de cobrança
CREATE TABLE IF NOT EXISTS cobranca_acoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id           UUID NOT NULL REFERENCES cobranca_execucoes(id) ON DELETE CASCADE,
  etapa_index           INTEGER NOT NULL,
  canal                 VARCHAR(20) NOT NULL
                          CHECK (canal IN ('whatsapp','email','sms','telefone','portal')),
  template_id           UUID,
  agendada_para         TIMESTAMPTZ NOT NULL,
  enviada_em            TIMESTAMPTZ,
  entregue_em           TIMESTAMPTZ,
  lida_em               TIMESTAMPTZ,
  respondida_em         TIMESTAMPTZ,
  status                VARCHAR(20) DEFAULT 'agendada'
                          CHECK (status IN ('agendada','enviada','entregue','lida','respondida','falhou','ignorada','cancelada')),
  mensagem_externa_id   TEXT, -- ID no WhatsApp/email provider
  conteudo_resposta     TEXT,
  erro_detalhes         JSONB,
  custo                 NUMERIC(8,4) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_acao_execucao ON cobranca_acoes(execucao_id);
CREATE INDEX idx_acao_status ON cobranca_acoes(status);
CREATE INDEX idx_acao_agendada ON cobranca_acoes(agendada_para);

-- Templates de mensagem
CREATE TABLE IF NOT EXISTS cobranca_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  canal                 VARCHAR(20) NOT NULL
                          CHECK (canal IN ('whatsapp','email','sms')),
  assunto               TEXT, -- para email
  conteudo              TEXT NOT NULL,
  nivel_escalacao       VARCHAR(10) DEFAULT 'L0'
                          CHECK (nivel_escalacao IN ('L0','L1','L2','L3')),
  variaveis             JSONB DEFAULT '[]', -- ['{cliente_nome}', '{valor}', '{vencimento}', ...]
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_template_org ON cobranca_templates(org_id);

DROP TRIGGER IF EXISTS trg_template_updated_at ON cobranca_templates;
CREATE TRIGGER trg_template_updated_at
  BEFORE UPDATE ON cobranca_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 16.5 GESTÃO DE DOCUMENTOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS documentos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Vínculo com lançamento
  entidade_tipo         VARCHAR(30) NOT NULL
                          CHECK (entidade_tipo IN ('conta_pagar','conta_receber','transacao_bancaria','conciliacao','contato')),
  entidade_id           UUID NOT NULL,

  -- Arquivo
  nome_arquivo          TEXT NOT NULL,
  tipo_arquivo          VARCHAR(10) NOT NULL
                          CHECK (tipo_arquivo IN ('pdf','xml','jpg','png','xlsx','csv','ofx','outro')),
  mime_type             TEXT,
  tamanho_bytes         BIGINT,
  storage_path          TEXT NOT NULL, -- Supabase Storage path
  storage_bucket        TEXT DEFAULT 'documentos',

  -- Classificação
  tipo_documento        VARCHAR(30) DEFAULT 'outro'
                          CHECK (tipo_documento IN ('nota_fiscal','boleto','comprovante','contrato','recibo','guia_imposto','outro')),
  competencia           VARCHAR(7), -- '2026-04'

  -- OCR / extração
  ocr_processado        BOOLEAN DEFAULT false,
  ocr_dados             JSONB, -- dados extraídos pelo OCR

  -- Status
  status                VARCHAR(20) DEFAULT 'pendente'
                          CHECK (status IN ('pendente','recebido','validado','rejeitado','arquivado')),
  validado_por          UUID REFERENCES profiles(id),
  validado_em           TIMESTAMPTZ,
  motivo_rejeicao       TEXT,

  -- Versionamento
  versao                INTEGER DEFAULT 1,
  documento_anterior_id UUID REFERENCES documentos(id),

  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_doc_org ON documentos(org_id);
CREATE INDEX idx_doc_company ON documentos(company_id);
CREATE INDEX idx_doc_entidade ON documentos(entidade_tipo, entidade_id);
CREATE INDEX idx_doc_tipo ON documentos(tipo_documento);
CREATE INDEX idx_doc_competencia ON documentos(competencia);
CREATE INDEX idx_doc_status ON documentos(status);

DROP TRIGGER IF EXISTS trg_doc_updated_at ON documentos;
CREATE TRIGGER trg_doc_updated_at
  BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 16.6 PLANO DE CONTAS COM RATEIO
-- =============================================================================

-- Centros de custo
CREATE TABLE IF NOT EXISTS centros_custo (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id) ON DELETE CASCADE,
  parent_id             UUID REFERENCES centros_custo(id),
  codigo                TEXT NOT NULL,
  nome                  TEXT NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  nivel                 INTEGER DEFAULT 1,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  UNIQUE(org_id, codigo)
);

CREATE INDEX idx_cc_org ON centros_custo(org_id);
CREATE INDEX idx_cc_parent ON centros_custo(parent_id);

DROP TRIGGER IF EXISTS trg_cc_updated_at ON centros_custo;
CREATE TRIGGER trg_cc_updated_at
  BEFORE UPDATE ON centros_custo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Regras de rateio
CREATE TABLE IF NOT EXISTS regras_rateio (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome                  TEXT NOT NULL,
  descricao             TEXT,
  criterio              VARCHAR(20) DEFAULT 'percentual'
                          CHECK (criterio IN ('percentual','receita','headcount','area','volume','manual')),
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rateio_org ON regras_rateio(org_id);

DROP TRIGGER IF EXISTS trg_rateio_updated_at ON regras_rateio;
CREATE TRIGGER trg_rateio_updated_at
  BEFORE UPDATE ON regras_rateio
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Itens do rateio (distribuição)
CREATE TABLE IF NOT EXISTS rateio_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id              UUID NOT NULL REFERENCES regras_rateio(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  centro_custo_id       UUID REFERENCES centros_custo(id),
  percentual            NUMERIC(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rateio_item_regra ON rateio_itens(regra_id);

-- Regras de categorização automática
CREATE TABLE IF NOT EXISTS regras_categorizacao (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID REFERENCES companies(id),

  -- Condição
  campo_match           VARCHAR(30) NOT NULL
                          CHECK (campo_match IN ('cnpj','nome_contato','historico','valor_range')),
  valor_match           TEXT NOT NULL,
  operador              VARCHAR(10) DEFAULT 'igual'
                          CHECK (operador IN ('igual','contem','regex','maior_que','menor_que')),

  -- Ação
  categoria_id          UUID REFERENCES categorias(id),
  centro_custo_id       UUID REFERENCES centros_custo(id),

  confidence            INTEGER DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  prioridade            INTEGER DEFAULT 50,
  is_active             BOOLEAN DEFAULT true,
  vezes_aplicada        INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_regra_cat_org ON regras_categorizacao(org_id);
CREATE INDEX idx_regra_cat_campo ON regras_categorizacao(campo_match, valor_match);

DROP TRIGGER IF EXISTS trg_regra_cat_updated_at ON regras_categorizacao;
CREATE TRIGGER trg_regra_cat_updated_at
  BEFORE UPDATE ON regras_categorizacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 16.7 PORTAL DO CLIENTE
-- =============================================================================

CREATE TABLE IF NOT EXISTS portal_sessoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token                 TEXT UNIQUE NOT NULL,
  email_cliente         TEXT NOT NULL,
  nome_cliente          TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN DEFAULT true,
  last_access           TIMESTAMPTZ,
  ip_address            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_portal_token ON portal_sessoes(token);
CREATE INDEX idx_portal_company ON portal_sessoes(company_id);

-- Pendências do cliente
CREATE TABLE IF NOT EXISTS portal_pendencias (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  titulo                TEXT NOT NULL,
  descricao             TEXT,
  tipo                  VARCHAR(30) NOT NULL
                          CHECK (tipo IN ('enviar_comprovante','aprovar_pagamento','classificar_lancamento','enviar_documento','responder_pergunta','assinar_fechamento')),
  status                VARCHAR(20) DEFAULT 'pendente'
                          CHECK (status IN ('pendente','resolvida','expirada','cancelada')),

  -- Referência
  entidade_tipo         VARCHAR(30),
  entidade_id           UUID,

  resolvida_em          TIMESTAMPTZ,
  resposta              JSONB,
  prazo                 TIMESTAMPTZ,
  notificada            BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pendencia_org ON portal_pendencias(org_id);
CREATE INDEX idx_pendencia_company ON portal_pendencias(company_id);
CREATE INDEX idx_pendencia_status ON portal_pendencias(status);

DROP TRIGGER IF EXISTS trg_pendencia_updated_at ON portal_pendencias;
CREATE TRIGGER trg_pendencia_updated_at
  BEFORE UPDATE ON portal_pendencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mensagens portal (chat estruturado)
CREATE TABLE IF NOT EXISTS portal_mensagens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  remetente_tipo        VARCHAR(10) NOT NULL CHECK (remetente_tipo IN ('analista','cliente')),
  remetente_id          UUID, -- profile_id do analista ou null para cliente
  conteudo              TEXT NOT NULL,
  lida                  BOOLEAN DEFAULT false,
  lida_em               TIMESTAMPTZ,
  competencia           VARCHAR(7), -- vincula ao mês se aplicável
  entidade_tipo         VARCHAR(30),
  entidade_id           UUID,
  anexos                JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_msg_company ON portal_mensagens(company_id);
CREATE INDEX idx_msg_lida ON portal_mensagens(lida) WHERE lida = false;

-- =============================================================================
-- 16.8 SANEAMENTO CADASTRAL
-- =============================================================================

-- Duplicatas detectadas
CREATE TABLE IF NOT EXISTS saneamento_duplicatas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entidade_tipo         VARCHAR(20) NOT NULL CHECK (entidade_tipo IN ('contato','categoria')),
  entidade_a_id         UUID NOT NULL,
  entidade_b_id         UUID NOT NULL,
  score_similaridade    INTEGER NOT NULL CHECK (score_similaridade BETWEEN 0 AND 100),
  campo_match           TEXT, -- qual campo bateu: 'cnpj', 'nome_similar', 'email', 'telefone'
  status                VARCHAR(20) DEFAULT 'detectada'
                          CHECK (status IN ('detectada','confirmada','descartada','mergeada')),
  merge_vencedor_id     UUID, -- qual registro sobreviveu no merge
  resolvido_por         UUID REFERENCES profiles(id),
  resolvido_em          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dup_org ON saneamento_duplicatas(org_id);
CREATE INDEX idx_dup_status ON saneamento_duplicatas(status);
CREATE INDEX idx_dup_entidade ON saneamento_duplicatas(entidade_tipo);

DROP TRIGGER IF EXISTS trg_dup_updated_at ON saneamento_duplicatas;
CREATE TRIGGER trg_dup_updated_at
  BEFORE UPDATE ON saneamento_duplicatas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Score de qualidade da base
CREATE TABLE IF NOT EXISTS saneamento_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data_calculo          DATE NOT NULL,
  score_total           INTEGER NOT NULL CHECK (score_total BETWEEN 0 AND 100),
  componentes           JSONB NOT NULL DEFAULT '{}',
  -- { cadastros_validos: 92, lancamentos_categorizados: 87, documentos_anexos: 65, duplicatas_resolvidas: 100 }
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, data_calculo)
);

CREATE INDEX idx_score_company ON saneamento_scores(company_id);

-- =============================================================================
-- 16.9 INTEGRAÇÃO CONTÁBIL
-- =============================================================================

CREATE TABLE IF NOT EXISTS exportacoes_contabeis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  competencia           VARCHAR(7) NOT NULL,
  formato               VARCHAR(20) NOT NULL
                          CHECK (formato IN ('csv','xlsx','dominio','alterdata','fortes','prosoft','omie','conta_azul')),
  status                VARCHAR(20) DEFAULT 'gerando'
                          CHECK (status IN ('gerando','pronto','enviado','falhou')),
  arquivo_url           TEXT,
  total_lancamentos     INTEGER DEFAULT 0,
  total_valor           NUMERIC(14,2) DEFAULT 0,
  regime                VARCHAR(10) DEFAULT 'competencia'
                          CHECK (regime IN ('competencia','caixa')),
  gerado_por            UUID REFERENCES profiles(id),
  enviado_para          TEXT, -- email do contador
  enviado_em            TIMESTAMPTZ,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_export_org ON exportacoes_contabeis(org_id);
CREATE INDEX idx_export_company ON exportacoes_contabeis(company_id);
CREATE INDEX idx_export_competencia ON exportacoes_contabeis(competencia);

DROP TRIGGER IF EXISTS trg_export_updated_at ON exportacoes_contabeis;
CREATE TRIGGER trg_export_updated_at
  BEFORE UPDATE ON exportacoes_contabeis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Provisão de impostos
CREATE TABLE IF NOT EXISTS provisoes_impostos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  competencia           VARCHAR(7) NOT NULL,
  tipo_imposto          VARCHAR(20) NOT NULL
                          CHECK (tipo_imposto IN ('simples','iss','pis','cofins','irpj','csll','icms','ipi','inss','fgts')),
  base_calculo          NUMERIC(14,2) NOT NULL,
  aliquota              NUMERIC(7,4) NOT NULL,
  valor_provisionado    NUMERIC(14,2) NOT NULL,
  valor_pago            NUMERIC(14,2) DEFAULT 0,
  data_vencimento       DATE,
  status                VARCHAR(20) DEFAULT 'provisionado'
                          CHECK (status IN ('provisionado','pago','atrasado','cancelado')),
  guia_url              TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, competencia, tipo_imposto)
);

CREATE INDEX idx_imposto_company ON provisoes_impostos(company_id);
CREATE INDEX idx_imposto_competencia ON provisoes_impostos(competencia);

DROP TRIGGER IF EXISTS trg_imposto_updated_at ON provisoes_impostos;
CREATE TRIGGER trg_imposto_updated_at
  BEFORE UPDATE ON provisoes_impostos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 16.10 RLS POLICIES
-- =============================================================================

ALTER TABLE fechamentos_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY fechamento_org_isolation ON fechamentos_mensais FOR ALL USING (org_id = get_org_id());

ALTER TABLE fechamento_checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_org_isolation ON fechamento_checklist_itens FOR ALL USING (org_id = get_org_id());

ALTER TABLE carteiras_analistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY carteira_org_isolation ON carteiras_analistas FOR ALL USING (org_id = get_org_id());

ALTER TABLE tarefas_workflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY tarefa_org_isolation ON tarefas_workflow FOR ALL USING (org_id = get_org_id());

ALTER TABLE alcadas_aprovacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY alcada_org_isolation ON alcadas_aprovacao FOR ALL USING (org_id = get_org_id());

ALTER TABLE aprovacoes_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY aprovacao_org_isolation ON aprovacoes_pagamento FOR ALL USING (org_id = get_org_id());

ALTER TABLE cobranca_cadencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cadencia_org_isolation ON cobranca_cadencias FOR ALL USING (org_id = get_org_id());

ALTER TABLE cobranca_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY exec_org_isolation ON cobranca_execucoes FOR ALL USING (org_id = get_org_id());

ALTER TABLE cobranca_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_org_isolation ON cobranca_templates FOR ALL USING (org_id = get_org_id());

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY doc_org_isolation ON documentos FOR ALL USING (org_id = get_org_id());

ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_org_isolation ON centros_custo FOR ALL USING (org_id = get_org_id());

ALTER TABLE regras_rateio ENABLE ROW LEVEL SECURITY;
CREATE POLICY rateio_org_isolation ON regras_rateio FOR ALL USING (org_id = get_org_id());

ALTER TABLE regras_categorizacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY regra_cat_org_isolation ON regras_categorizacao FOR ALL USING (org_id = get_org_id());

ALTER TABLE portal_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_org_isolation ON portal_sessoes FOR ALL USING (org_id = get_org_id());

ALTER TABLE portal_pendencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY pendencia_org_isolation ON portal_pendencias FOR ALL USING (org_id = get_org_id());

ALTER TABLE portal_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY msg_org_isolation ON portal_mensagens FOR ALL USING (org_id = get_org_id());

ALTER TABLE saneamento_duplicatas ENABLE ROW LEVEL SECURITY;
CREATE POLICY dup_org_isolation ON saneamento_duplicatas FOR ALL USING (org_id = get_org_id());

ALTER TABLE saneamento_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY score_org_isolation ON saneamento_scores FOR ALL USING (org_id = get_org_id());

ALTER TABLE exportacoes_contabeis ENABLE ROW LEVEL SECURITY;
CREATE POLICY export_org_isolation ON exportacoes_contabeis FOR ALL USING (org_id = get_org_id());

ALTER TABLE provisoes_impostos ENABLE ROW LEVEL SECURITY;
CREATE POLICY imposto_org_isolation ON provisoes_impostos FOR ALL USING (org_id = get_org_id());

-- =============================================================================
-- ADICIONAR centro_custo_id nas tabelas financeiras existentes
-- =============================================================================

ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES centros_custo(id);
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES centros_custo(id);
