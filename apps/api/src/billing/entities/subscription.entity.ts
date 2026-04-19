import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
export type PlanSlug = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

@Entity({ name: 'subscriptions' })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { unique: true })
  orgId!: string;

  @Column({ length: 120, nullable: true })
  stripeCustomerId?: string;

  @Column({ length: 120, nullable: true })
  stripeSubscriptionId?: string;

  @Column({ length: 30, default: 'starter' })
  plan!: PlanSlug;

  @Column({ length: 30, default: 'trialing' })
  status!: SubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  trialEnd?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodStart?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd?: Date;

  @Column({ default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ default: 1 })
  quantity!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
