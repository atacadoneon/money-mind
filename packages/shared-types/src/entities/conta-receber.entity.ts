import type { ReconciliationStatus } from '../enums/reconciliation-status.enum';
import type { SituacaoCR } from '../enums/situacao.enum';
import type { BaseEntity, CompanyScoped, Marcador } from './base.entity';

export interface ContaReceber extends BaseEntity, CompanyScoped {
  tiny_id?: number | null;
  numero_documento?: string | null;
  documento_origem?: string | null;
  pedido_numero?: string | null;
  nota_fiscal?: string | null;

  contato_id?: string | null;
  cliente_nome: string;
  cliente_nome_fantasia?: string | null;
  cliente_cpf_cnpj?: string | null;
  cliente_fone?: string | null;
  cliente_email?: string | null;

  historico?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  valor: number;
  saldo: number;
  valor_liquido: number;
  valor_recebido: number;
  taxa_gateway: number;

  data_emissao?: string | null;
  data_vencimento: string;
  data_recebimento?: string | null;
  data_competencia?: string | null;
  data_prevista?: string | null;

  situacao: SituacaoCR;
  forma_pagamento_id?: string | null;
  forma_pagamento_nome?: string | null;
  meio_pagamento?: string | null;
  conta_bancaria_id?: string | null;

  parcela_numero?: number | null;
  parcela_total?: number | null;
  parcela_grupo_id?: string | null;

  marcadores: Marcador[];
  integracoes: Array<{ tipo: string; numero?: string; id?: string }>;

  reconciliation_status: ReconciliationStatus;
  reconciliation_id?: string | null;

  observacoes?: string | null;
  anexos: unknown[];

  last_synced_at?: string | null;
  sync_source?: 'tiny_v2' | 'tiny_v3' | 'manual' | 'import' | 'pedido' | null;
}
