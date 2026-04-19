import type { ExtratoTipo } from '../enums/conta-bancaria-tipo.enum';
import type { ReconciliationStatus } from '../enums/reconciliation-status.enum';
import type { BaseEntity, CompanyScoped } from './base.entity';

export interface ExtratoLinha extends BaseEntity, CompanyScoped {
  conta_bancaria_id: string;
  data_transacao: string;
  data_compensacao?: string | null;
  valor: number;
  tipo: ExtratoTipo;
  descricao: string;
  memo?: string | null;
  external_id?: string | null;
  external_type?: 'ofx' | 'csv' | 'api' | 'manual' | null;
  check_number?: string | null;
  reference_number?: string | null;
  categoria_id?: string | null;
  categoria_auto: boolean;
  contato_id?: string | null;
  reconciliation_status: ReconciliationStatus;
  reconciliation_id?: string | null;
  conta_pagar_id?: string | null;
  conta_receber_id?: string | null;
  import_batch_id?: string | null;
  raw_data?: Record<string, unknown> | null;
}
