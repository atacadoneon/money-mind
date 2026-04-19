import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'rateio_itens' })
@Index(['regraId'])
export class RateioItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'regra_id' })
  regraId!: string;

  @Column('uuid', { name: 'company_id' })
  companyId!: string;

  @Column('uuid', { name: 'centro_custo_id', nullable: true })
  centroCustoId?: string | null;

  @Column({ type: 'numeric', precision: 7, scale: 4 })
  percentual!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
