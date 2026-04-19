import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type TipoConta = 'corrente' | 'poupanca' | 'pagamento' | 'gateway' | 'carteira';

@Entity({ name: 'contas_bancarias' })
@Index(['orgId', 'companyId'])
export class ContaBancaria extends CompanyScopedEntity {
  @Column({ length: 120 }) nome!: string;
  @Column({ type: 'varchar', length: 30, default: 'corrente' }) tipo!: TipoConta;

  @Column({ name: 'banco_codigo', length: 10, nullable: true })
  bancoCodigo?: string;

  @Column({ name: 'banco_nome', length: 60, nullable: true })
  bancoNome?: string;

  @Column({ length: 10, nullable: true }) agencia?: string;

  @Column({ name: 'conta_numero', length: 30, nullable: true })
  contaNumero?: string;

  @Column({ name: 'saldo_inicial', type: 'numeric', precision: 14, scale: 2, default: 0 })
  saldoInicial!: string;

  @Column({ name: 'saldo_atual', type: 'numeric', precision: 14, scale: 2, default: 0 })
  saldoAtual!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'source_type', type: 'varchar', length: 30, default: 'manual' })
  sourceType!: string;

  @Column({ name: 'gateway_provider', length: 30, nullable: true })
  gatewayProvider?: string;

  @Column({ length: 10, nullable: true }) cor?: string;
}
