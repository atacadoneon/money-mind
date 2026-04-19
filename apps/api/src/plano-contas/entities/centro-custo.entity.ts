import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

@Entity({ name: 'centros_custo' })
@Unique(['orgId', 'codigo'])
@Index(['orgId'])
@Index(['parentId'])
export class CentroCusto extends TenantEntity {
  @Column('uuid', { name: 'company_id', nullable: true })
  companyId?: string | null;

  @Column('uuid', { name: 'parent_id', nullable: true })
  parentId?: string | null;

  @Column({ type: 'text' })
  codigo!: string;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 1 })
  nivel!: number;
}
