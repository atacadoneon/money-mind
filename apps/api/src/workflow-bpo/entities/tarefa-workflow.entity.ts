import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type TipoTarefa = 'conciliacao' | 'classificacao' | 'documento' | 'cobranca' | 'fechamento' | 'aprovacao' | 'revisao' | 'outro';
export type PrioridadeTarefa = 'critica' | 'alta' | 'media' | 'baixa';
export type StatusTarefa = 'backlog' | 'a_fazer' | 'em_andamento' | 'revisao' | 'concluida' | 'cancelada';

@Entity({ name: 'tarefas_workflow' })
@Index(['orgId'])
@Index(['analistaId'])
@Index(['companyId'])
@Index(['status'])
@Index(['tipo'])
@Index(['prazo'])
@Index(['entidadeTipo', 'entidadeId'])
export class TarefaWorkflow extends CompanyScopedEntity {
  @Column('uuid', { name: 'analista_id', nullable: true })
  analistaId?: string | null;

  @Column('uuid', { name: 'supervisor_id', nullable: true })
  supervisorId?: string | null;

  @Column({ type: 'text' })
  titulo!: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string | null;

  @Column({ type: 'varchar', length: 30 })
  tipo!: TipoTarefa;

  @Column({ type: 'varchar', length: 10, default: 'media' })
  prioridade!: PrioridadeTarefa;

  @Column({ type: 'varchar', length: 20, default: 'backlog' })
  status!: StatusTarefa;

  @Column({ type: 'timestamptz', nullable: true })
  prazo?: Date | null;

  @Column({ name: 'concluida_em', type: 'timestamptz', nullable: true })
  concluidaEm?: Date | null;

  @Column({ name: 'entidade_tipo', type: 'varchar', length: 30, nullable: true })
  entidadeTipo?: string | null;

  @Column({ name: 'entidade_id', type: 'uuid', nullable: true })
  entidadeId?: string | null;

  @Column({ name: 'comentario_revisao', type: 'text', nullable: true })
  comentarioRevisao?: string | null;

  @Column({ name: 'revisado_por', type: 'uuid', nullable: true })
  revisadoPor?: string | null;

  @Column({ name: 'revisado_em', type: 'timestamptz', nullable: true })
  revisadoEm?: Date | null;

  @Column({ name: 'tempo_gasto_min', type: 'int', default: 0 })
  tempoGastoMin!: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;
}
