import type {
  ContaBancariaSource,
  ContaBancariaTipo,
} from '../enums/conta-bancaria-tipo.enum';
import type { BaseEntity, CompanyScoped } from './base.entity';

export interface ContaBancaria extends BaseEntity, CompanyScoped {
  banco_codigo?: string | null;
  banco_nome: string;
  agencia?: string | null;
  agencia_digito?: string | null;
  conta_numero?: string | null;
  conta_digito?: string | null;
  tipo: ContaBancariaTipo;
  nome: string;
  tiny_conta_origem?: string | null;
  saldo_inicial: number;
  saldo_atual: number;
  data_saldo?: string | null;
  source_type?: ContaBancariaSource | null;
  gateway_provider?: string | null;
  is_active: boolean;
  is_group_account: boolean;
  pix_tipo?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  pix_chave?: string | null;
  cor: string;
  icone: string;
}
