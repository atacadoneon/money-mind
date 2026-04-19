import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_log' })
@Index(['orgId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ name: 'org_id', type: 'uuid' }) orgId!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true }) actorId?: string | null;

  @Column({ length: 30 }) action!: string;

  @Column({ name: 'entity_type', length: 60 }) entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true }) entityId?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" }) changes!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'" }) metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
