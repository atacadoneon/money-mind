import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn, Unique } from 'typeorm';

@Entity({ name: 'saneamento_scores' })
@Unique(['companyId', 'dataCalculo'])
@Index(['companyId'])
export class SaneamentoScore {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { name: 'org_id' }) orgId!: string;
  @Column('uuid', { name: 'company_id' }) companyId!: string;
  @Column({ name: 'data_calculo', type: 'date' }) dataCalculo!: string;
  @Column({ name: 'score_total', type: 'int' }) scoreTotal!: number;
  @Column({ type: 'jsonb', default: () => "'{}'" }) componentes!: Record<string, number>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
