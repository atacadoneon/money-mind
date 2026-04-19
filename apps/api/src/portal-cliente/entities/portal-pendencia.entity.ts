import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type TipoPendencia = 'enviar_comprovante' | 'aprovar_pagamento' | 'classificar_lancamento' | 'enviar_documento' | 'responder_pergunta' | 'assinar_fechamento';
export type StatusPendencia = 'pendente' | 'resolvida' | 'expirada' | 'cancelada';

@Entity({ name: 'portal_pendencias' })
@Index(['orgId'])
@Index(['companyId'])
@Index(['status'])
export class PortalPendencia {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { name: 'org_id' }) orgId!: string;
  @Column('uuid', { name: 'company_id' }) companyId!: string;
  @Column({ type: 'text' }) titulo!: string;
  @Column({ type: 'text', nullable: true }) descricao?: string | null;
  @Column({ type: 'varchar', length: 30 }) tipo!: TipoPendencia;
  @Column({ type: 'varchar', length: 20, default: 'pendente' }) status!: StatusPendencia;
  @Column({ name: 'entidade_tipo', type: 'varchar', length: 30, nullable: true }) entidadeTipo?: string | null;
  @Column({ name: 'entidade_id', type: 'uuid', nullable: true }) entidadeId?: string | null;
  @Column({ name: 'resolvida_em', type: 'timestamptz', nullable: true }) resolvidaEm?: Date | null;
  @Column({ type: 'jsonb', nullable: true }) resposta?: Record<string, unknown> | null;
  @Column({ type: 'timestamptz', nullable: true }) prazo?: Date | null;
  @Column({ type: 'boolean', default: false }) notificada!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
