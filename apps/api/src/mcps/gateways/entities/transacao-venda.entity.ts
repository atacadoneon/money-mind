import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../../common/entities/base.entity';

export type GatewaySlug = 'pagarme' | 'appmax' | 'stripe' | 'mp';

@Entity({ name: 'transacoes_vendas' })
@Index(['orgId', 'companyId', 'gateway'])
@Index(['orgId', 'companyId', 'dataTransacao'])
@Index(['orgId', 'externalId', 'gateway'])
export class TransacaoVenda extends CompanyScopedEntity {
  @Column({ type: 'varchar', length: 20 }) gateway!: GatewaySlug;
  @Column({ length: 120 }) externalId!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) valorBruto!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) valorTaxa!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) valorLiquido!: string;
  @Column({ length: 30, default: 'capturado' }) status!: string;
  @Column({ length: 120, nullable: true }) pedidoRef?: string;
  @Column({ length: 200, nullable: true }) clienteNome?: string;
  @Column({ type: 'int', default: 1 }) parcelas!: number;
  @Column({ type: 'date' }) dataTransacao!: string;
  @Column({ type: 'date', nullable: true }) dataLiquidacao?: string | null;
  @Column({ type: 'uuid', nullable: true }) reconciliationId?: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'" }) rawData!: object;
}
