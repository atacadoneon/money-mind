import type { ReconciliationStatus } from '../enums/reconciliation-status.enum';
import type { SituacaoCP } from '../enums/situacao.enum';
import type { BaseEntity, CompanyScoped, Marcador } from './base.entity';

export interface ContaPagar extends BaseEntity, CompanyScoped {
  tiny_id?: number | null;
  numero_documento?: string | null;
  pedido_numero?: string | null;

  contato_id?: string | null;
  fornecedor_nome: string;
  fornecedor_nome_fantasia?: string | null;
  fornecedor_cpf_cnpj?: string | null;

  historico?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  valor: number;
  saldo: number;
  valor_pago: number;

  data_emissao?: string | null;
  data_vencimento: string;
  data_pagamento?: string | null;
  data_competencia?: string | null;

  situacao: SituacaoCP;
  forma_pagamento_id?: string | null;
  forma_pagamento_nome?: string | null;
  conta_bancaria_id?: string | null;
  conta_origem?: string | null;

  buscador?: string | null;
  buscador_status?: 'pendente' | 'liberado' | 'bloqueado' | null;

  marcadores: Marcador[];

  reconciliation_status: ReconciliationStatus;
  reconciliation_id?: string | null;

  parcela_numero?: number | null;
  parcela_total?: number | null;
  parcela_grupo_id?: string | null;

  observacoes?: string | null;
  anexos: unknown[];

  last_synced_at?: string | null;
  sync_source?: 'tiny_v2' | 'tiny_v3' | 'manual' | 'import' | null;
}
