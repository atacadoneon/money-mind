import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type StatusExecucao = 'ativa' | 'pausada' | 'concluida' | 'cancelada' | 'negociando';

@Entity({ name: 'cobranca_execucoes' })
@Index(['orgId'])
@Index(['contaReceberId'])
@Index(['status'])
export class CobrancaExecucao extends CompanyScopedEntity {
  @Column({ name: 'conta_receber_id', type: 'uuid' })
  contaReceberId!: string;

  @Column({ name: 'cadencia_id', type: 'uuid' })
  cadenciaId!: string;

  @Column({ name: 'etapa_atual', type: 'int', default: 0 })
  etapaAtual!: number;

  @Column({ type: 'varchar', length: 20, default: 'ativa' })
  status!: StatusExecucao;

  @Column({ name: 'iniciada_em', type: 'timestamptz', default: () => 'now()' })
  iniciadaEm!: Date;

  @Column({ name: 'pausada_em', type: 'timestamptz', nullable: true })
  pausadaEm?: Date | null;

  @Column({ name: 'concluida_em', type: 'timestamptz', nullable: true })
  concluidaEm?: Date | null;

  @Column({ name: 'motivo_pausa', type: 'text', nullable: true })
  motivoPausa?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}
