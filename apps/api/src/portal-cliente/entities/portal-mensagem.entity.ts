import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'portal_mensagens' })
@Index(['companyId'])
export class PortalMensagem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { name: 'org_id' }) orgId!: string;
  @Column('uuid', { name: 'company_id' }) companyId!: string;
  @Column({ name: 'remetente_tipo', type: 'varchar', length: 10 }) remetenteTipo!: 'analista' | 'cliente';
  @Column('uuid', { name: 'remetente_id', nullable: true }) remetenteId?: string | null;
  @Column({ type: 'text' }) conteudo!: string;
  @Column({ type: 'boolean', default: false }) lida!: boolean;
  @Column({ name: 'lida_em', type: 'timestamptz', nullable: true }) lidaEm?: Date | null;
  @Column({ type: 'varchar', length: 7, nullable: true }) competencia?: string | null;
  @Column({ name: 'entidade_tipo', type: 'varchar', length: 30, nullable: true }) entidadeTipo?: string | null;
  @Column({ name: 'entidade_id', type: 'uuid', nullable: true }) entidadeId?: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'" }) anexos!: unknown[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
