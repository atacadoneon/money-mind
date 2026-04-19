import type {
  ReconciliationMetodo,
  ReconciliationTipoMatch,
} from '../enums/reconciliation-status.enum';
import type { BaseEntity, CompanyScoped } from './base.entity';

export type ReconciliationLifecycleStatus = 'pending' | 'suggested' | 'confirmed' | 'reversed';

export interface Reconciliation extends BaseEntity, CompanyScoped {
  tipo_match: ReconciliationTipoMatch;
  metodo: ReconciliationMetodo;
  valor_extrato: number;
  valor_contas: number;
  diferenca: number;
  extrato_ids: string[];
  conta_pagar_ids: string[];
  conta_receber_ids: string[];
  status: ReconciliationLifecycleStatus;
  confidence?: number | null;
  ai_suggestion_id?: string | null;
  rule_id?: string | null;
  observacoes?: string | null;
  reversal_reason?: string | null;
  created_by?: string | null;
  reversed_by?: string | null;
  reversed_at?: string | null;
}
