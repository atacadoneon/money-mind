import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export type WebhookEvent =
  | 'conta.criada'
  | 'conta.baixada'
  | 'conta.atrasada'
  | 'extrato.conciliado'
  | 'cobranca.paga';

@Entity({ name: 'webhooks_subscriptions' })
@Index(['orgId', 'active'])
export class WebhookSubscription extends TenantEntity {
  @Column({ type: 'text' }) url!: string;
  @Column({ type: 'text', array: true, default: () => "'{}'" }) events!: WebhookEvent[];
  @Column({ length: 100 }) secret!: string;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ type: 'jsonb', default: () => "'{}'" }) metadata!: Record<string, unknown>;
}
