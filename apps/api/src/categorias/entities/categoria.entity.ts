import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export type CategoriaTipo = 'receita' | 'despesa';

@Entity({ name: 'categorias' })
@Index(['orgId', 'tipo'])
export class Categoria extends TenantEntity {
  @Column({ length: 160 })
  nome!: string;

  @Column({ type: 'varchar', length: 20 })
  tipo!: CategoriaTipo;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string | null;

  @Column({ type: 'int', default: 1 })
  nivel!: number;

  @Column({ length: 60, nullable: true })
  path?: string;

  @Column({ length: 20, nullable: true })
  codigo?: string;

  @Column({ length: 20, nullable: true })
  natureza?: string;

  @Column({ name: 'dre_grupo', length: 60, nullable: true })
  dreGrupo?: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
