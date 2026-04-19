import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export type BillingCycle = 'monthly' | 'yearly';

export interface PlanFeatures {
  max_empresas: number;
  max_transacoes_mes: number;
  mcps_ativos: string[];
  ai_enabled: boolean;
  relatorios_avancados: boolean;
  suporte_prioritario: boolean;
  api_access: boolean;
  trial_days: number;
}

@Entity({ name: 'plans' })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 60, unique: true })
  slug!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  priceBrl!: number;

  @Column({ length: 20, default: 'monthly' })
  billingCycle!: BillingCycle;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  features!: PlanFeatures;

  @Column({ length: 120, nullable: true })
  stripePriceId?: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ default: 14 })
  trialDays!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
