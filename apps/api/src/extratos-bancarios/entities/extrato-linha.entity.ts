import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';
import { ExtratoBancario } from './extrato.entity';

export type TipoMov = 'credito' | 'debito';
export type ConciliacaoStatus = 'pendente' | 'conciliado' | 'ignorado' | 'sugerido';

@Entity({ name: 'extrato_linhas' })
@Index(['orgId', 'extratoId'])
@Index(['orgId', 'status'])
export class ExtratoLinha extends TenantEntity {
  @Column({ type: 'uuid' }) extratoId!: string;

  @ManyToOne(() => ExtratoBancario, (e) => e.linhas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'extrato_id' })
  extrato?: ExtratoBancario;

  @Column({ type: 'uuid' }) contaBancariaId!: string;
  @Column({ type: 'date' }) dataMovimento!: string;
  @Column({ type: 'varchar', length: 10 }) tipo!: TipoMov;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) valor!: string;
  @Column({ length: 400 }) descricao!: string;
  @Column({ length: 120, nullable: true }) historico?: string;
  @Column({ length: 60, nullable: true }) fitid?: string;
  @Column({ type: 'varchar', length: 20, default: 'pendente' }) status!: ConciliacaoStatus;
  @Column({ type: 'uuid', nullable: true }) matchContaPagarId?: string | null;
  @Column({ type: 'uuid', nullable: true }) matchContaReceberId?: string | null;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) matchConfidence?: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) matchStrategy?: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'" }) metadata!: Record<string, unknown>;
}
