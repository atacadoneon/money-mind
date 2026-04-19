import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

@Entity({ name: 'marcadores' })
export class Marcador extends TenantEntity {
  @Column({ length: 80 }) descricao!: string;
  @Column({ length: 10, default: '#6b7280' }) cor!: string;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
