import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../../common/entities/base.entity';

export type CanalComunicacao = 'whatsapp' | 'email' | 'sms';
export type StatusComunicacao = 'enviado' | 'falha' | 'entregue' | 'lido';

@Entity({ name: 'comunicacoes_log' })
@Index(['orgId', 'canal', 'createdAt'])
@Index(['orgId', 'contaReceberId'])
export class ComunicacaoLog extends TenantEntity {
  @Column({ type: 'uuid', nullable: true }) companyId?: string;
  @Column({ type: 'uuid', nullable: true }) contaReceberId?: string;
  @Column({ type: 'varchar', length: 20 }) canal!: CanalComunicacao;
  @Column({ length: 60 }) template!: string;
  @Column({ length: 200 }) destinatario!: string;
  @Column({ type: 'varchar', length: 20, default: 'enviado' }) status!: StatusComunicacao;
  @Column({ length: 200, nullable: true }) providerId?: string;
  @Column({ type: 'jsonb', default: () => "'{}'" }) rawResponse!: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) sentAt?: Date;
  @Column({ type: 'timestamptz', nullable: true }) deliveredAt?: Date;
}
