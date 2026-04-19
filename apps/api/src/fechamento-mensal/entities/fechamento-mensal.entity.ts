import { Column, Entity, Index, OneToMany, Unique } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';
import { FechamentoChecklistItem } from './fechamento-checklist-item.entity';

export type StatusFechamento =
  | 'aberto'
  | 'em_progresso'
  | 'revisao'
  | 'aprovado'
  | 'fechado'
  | 'reaberto';

@Entity({ name: 'fechamentos_mensais' })
@Unique(['companyId', 'competencia'])
@Index(['orgId'])
@Index(['companyId'])
@Index(['status'])
@Index(['competencia'])
export class FechamentoMensal extends CompanyScopedEntity {
  @Column({ type: 'varchar', length: 7 })
  competencia!: string; // '2026-04'

  @Column({ type: 'varchar', length: 20, default: 'aberto' })
  status!: StatusFechamento;

  @Column({ name: 'progresso_percentual', type: 'int', default: 0 })
  progressoPercentual!: number;

  @Column({ name: 'total_pendencias', type: 'int', default: 0 })
  totalPendencias!: number;

  @Column({ name: 'pendencias_bloqueantes', type: 'int', default: 0 })
  pendenciasBloqueantes!: number;

  // Responsaveis
  @Column({ name: 'analista_id', type: 'uuid', nullable: true })
  analistaId?: string | null;

  @Column({ name: 'supervisor_id', type: 'uuid', nullable: true })
  supervisorId?: string | null;

  @Column({ name: 'aprovado_por', type: 'uuid', nullable: true })
  aprovadoPor?: string | null;

  @Column({ name: 'aprovado_em', type: 'timestamptz', nullable: true })
  aprovadoEm?: Date | null;

  @Column({ name: 'fechado_por', type: 'uuid', nullable: true })
  fechadoPor?: string | null;

  @Column({ name: 'fechado_em', type: 'timestamptz', nullable: true })
  fechadoEm?: Date | null;

  // Reabertura
  @Column({ name: 'reaberto_por', type: 'uuid', nullable: true })
  reabertoPor?: string | null;

  @Column({ name: 'reaberto_em', type: 'timestamptz', nullable: true })
  reabertoEm?: Date | null;

  @Column({ name: 'motivo_reabertura', type: 'text', nullable: true })
  motivoReabertura?: string | null;

  @Column({ type: 'text', nullable: true })
  observacoes?: string | null;

  @Column({ name: 'relatorio_url', type: 'text', nullable: true })
  relatorioUrl?: string | null;

  @OneToMany(() => FechamentoChecklistItem, (item) => item.fechamento)
  checklistItens?: FechamentoChecklistItem[];
}
