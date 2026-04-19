import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

@Entity({ name: 'companies' })
@Index(['orgId', 'cnpj'])
export class Company extends TenantEntity {
  @Column({ length: 160 })
  name!: string;

  @Column({ name: 'nome_fantasia', length: 160, nullable: true })
  tradeName?: string;

  @Column({ length: 20, nullable: true })
  cnpj?: string;

  @Column({ name: 'slug', length: 60, nullable: true })
  slug?: string;

  @Column({ name: 'color', length: 10, nullable: true })
  color?: string;

  @Column({ name: 'inscricao_estadual', length: 20, nullable: true })
  ie?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings!: Record<string, unknown>;
}
