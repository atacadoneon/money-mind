import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type StatusDuplicata = 'detectada' | 'confirmada' | 'descartada' | 'mergeada';

@Entity({ name: 'saneamento_duplicatas' })
@Index(['orgId'])
@Index(['status'])
@Index(['entidadeTipo'])
export class SaneamentoDuplicata {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { name: 'org_id' }) orgId!: string;
  @Column({ name: 'entidade_tipo', type: 'varchar', length: 20 }) entidadeTipo!: 'contato' | 'categoria';
  @Column('uuid', { name: 'entidade_a_id' }) entidadeAId!: string;
  @Column('uuid', { name: 'entidade_b_id' }) entidadeBId!: string;
  @Column({ name: 'score_similaridade', type: 'int' }) scoreSimilaridade!: number;
  @Column({ name: 'campo_match', type: 'text', nullable: true }) campoMatch?: string | null;
  @Column({ type: 'varchar', length: 20, default: 'detectada' }) status!: StatusDuplicata;
  @Column('uuid', { name: 'merge_vencedor_id', nullable: true }) mergeVencedorId?: string | null;
  @Column('uuid', { name: 'resolvido_por', nullable: true }) resolvidoPor?: string | null;
  @Column({ name: 'resolvido_em', type: 'timestamptz', nullable: true }) resolvidoEm?: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
