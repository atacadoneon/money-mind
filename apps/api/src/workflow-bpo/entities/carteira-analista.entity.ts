import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

@Entity({ name: 'carteiras_analistas' })
@Unique(['orgId', 'analistaId', 'companyId'])
@Index(['analistaId'])
@Index(['companyId'])
export class CarteiraAnalista extends TenantEntity {
  @Column('uuid', { name: 'analista_id' })
  analistaId!: string;

  @Column('uuid', { name: 'company_id' })
  companyId!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sla_fechamento_dia', type: 'int', default: 10 })
  slaFechamentoDia!: number;

  @Column({ name: 'sla_conciliacao', type: 'varchar', length: 20, default: 'diaria' })
  slaConciliacao!: string;

  @Column({ name: 'sla_cobranca', type: 'varchar', length: 20, default: 'semanal' })
  slaCobranca!: string;
}
