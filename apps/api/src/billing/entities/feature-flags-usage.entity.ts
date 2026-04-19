import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'feature_flags_usage' })
export class FeatureFlagsUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  orgId!: string;

  @Column({ length: 120 })
  featureSlug!: string;

  @Column({ default: 0 })
  usedCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  periodStart?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  periodEnd?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
