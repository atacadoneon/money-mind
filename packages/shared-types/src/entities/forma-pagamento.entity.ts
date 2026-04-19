import type { FormaPagamentoTipo } from '../enums/forma-pagamento-tipo.enum';
import type { BaseEntity, OrgScoped } from './base.entity';

export interface FormaPagamento extends BaseEntity, OrgScoped {
  nome: string;
  codigo?: string | null;
  tipo: FormaPagamentoTipo;
  icone: string;
  cor: string;
  taxa_percentual: number;
  taxa_fixa: number;
  prazo_recebimento_dias: number;
  tiny_id?: number | null;
  tiny_nome_exato?: string | null;
  is_active: boolean;
  is_system: boolean;
}
