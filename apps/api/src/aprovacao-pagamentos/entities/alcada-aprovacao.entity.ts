import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export type AprovadorRole = 'analista' | 'supervisor' | 'admin' | 'owner';

@Entity({ name: 'alcadas_aprovacao' })
@Index(['orgId'])
@Index(['companyId'])
export class AlcadaAprovacao extends TenantEntity {
  @Column('uuid', { name: 'company_id', nullable: true })
  companyId?: string | null;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ name: 'valor_minimo', type: 'numeric', precision: 14, scale: 2, default: 0 })
  valorMinimo!: string;

  @Column({ name: 'valor_maximo', type: 'numeric', precision: 14, scale: 2, nullable: true })
  valorMaximo?: string | null;

  @Column({ name: 'aprovador_role', type: 'varchar', length: 20 })
  aprovadorRole!: AprovadorRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  ordem!: number;
}
