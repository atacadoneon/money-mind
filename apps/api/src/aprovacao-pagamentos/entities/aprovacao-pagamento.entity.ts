import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type StatusAprovacao = 'pendente' | 'aprovada' | 'rejeitada' | 'expirada' | 'cancelada';

@Entity({ name: 'aprovacoes_pagamento' })
@Index(['orgId'])
@Index(['contaPagarId'])
@Index(['status'])
@Index(['aprovadorId'])
export class AprovacaoPagamento extends CompanyScopedEntity {
  @Column('uuid', { name: 'conta_pagar_id' })
  contaPagarId!: string;

  @Column('uuid', { name: 'alcada_id', nullable: true })
  alcadaId?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status!: StatusAprovacao;

  @Column('uuid', { name: 'solicitado_por' })
  solicitadoPor!: string;

  @Column({ name: 'solicitado_em', type: 'timestamptz', default: () => 'now()' })
  solicitadoEm!: Date;

  @Column('uuid', { name: 'aprovador_id', nullable: true })
  aprovadorId?: string | null;

  @Column({ name: 'aprovado_em', type: 'timestamptz', nullable: true })
  aprovadoEm?: Date | null;

  @Column({ name: 'motivo_rejeicao', type: 'text', nullable: true })
  motivoRejeicao?: string | null;

  @Column({ name: 'risco_duplicata_score', type: 'int', default: 0 })
  riscoDuplicataScore!: number;

  @Column('uuid', { name: 'duplicata_detectada_id', nullable: true })
  duplicataDetectadaId?: string | null;

  @Column({ name: 'data_agendada', type: 'date', nullable: true })
  dataAgendada?: string | null;

  @Column('uuid', { name: 'conta_bancaria_id', nullable: true })
  contaBancariaId?: string | null;

  @Column({ name: 'meio_pagamento', type: 'varchar', length: 20, nullable: true })
  meioPagamento?: string | null;

  @Column({ name: 'comprovante_url', type: 'text', nullable: true })
  comprovanteUrl?: string | null;

  @Column({ name: 'comprovante_enviado_em', type: 'timestamptz', nullable: true })
  comprovanteEnviadoEm?: Date | null;

  @Column({ type: 'text', nullable: true })
  observacoes?: string | null;
}
