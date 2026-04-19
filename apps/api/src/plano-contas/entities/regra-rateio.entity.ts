import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export type CriterioRateio = 'percentual' | 'receita' | 'headcount' | 'area' | 'volume' | 'manual';

@Entity({ name: 'regras_rateio' })
@Index(['orgId'])
export class RegraRateio extends TenantEntity {
  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'percentual' })
  criterio!: CriterioRateio;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
