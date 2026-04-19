import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { FechamentoMensal } from './fechamento-mensal.entity';

export type TipoChecklist = 'automatico' | 'manual';
export type CategoriaChecklist = 'conciliacao' | 'categoria' | 'documento' | 'bancario' | 'imposto' | 'folha' | 'geral';
export type StatusChecklist = 'ok' | 'pendente' | 'bloqueante' | 'ignorado';

@Entity({ name: 'fechamento_checklist_itens' })
@Index(['fechamentoId'])
@Index(['status'])
export class FechamentoChecklistItem extends TenantEntity {
  @Column({ name: 'fechamento_id', type: 'uuid' })
  fechamentoId!: string;

  @Column({ type: 'text' })
  titulo!: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'automatico' })
  tipo!: TipoChecklist;

  @Column({ type: 'varchar', length: 30, default: 'geral' })
  categoria!: CategoriaChecklist;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status!: StatusChecklist;

  @Column({ name: 'is_bloqueante', type: 'boolean', default: false })
  isBloqueante!: boolean;

  @Column({ name: 'valor_referencia', type: 'numeric', precision: 14, scale: 2, nullable: true })
  valorReferencia?: string | null;

  @Column({ name: 'resolvido_por', type: 'uuid', nullable: true })
  resolvidoPor?: string | null;

  @Column({ name: 'resolvido_em', type: 'timestamptz', nullable: true })
  resolvidoEm?: Date | null;

  @Column({ name: 'atribuido_a', type: 'varchar', length: 20, nullable: true })
  atribuidoA?: string | null; // 'analista' | 'cliente' | 'contador'

  @Column({ type: 'timestamptz', nullable: true })
  prazo?: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @ManyToOne(() => FechamentoMensal, (f) => f.checklistItens)
  @JoinColumn({ name: 'fechamento_id' })
  fechamento?: FechamentoMensal;
}
