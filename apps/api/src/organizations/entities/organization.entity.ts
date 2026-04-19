import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity({ name: 'organizations' })
export class Organization extends BaseEntity {
  @Column({ length: 160 })
  name!: string;

  @Column({ length: 60, unique: true })
  slug!: string;

  @Column({ length: 30, default: 'starter' })
  plan!: string;

  @Column({ name: 'primary_color', length: 10, nullable: true })
  primaryColor?: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings!: Record<string, unknown>;
}
