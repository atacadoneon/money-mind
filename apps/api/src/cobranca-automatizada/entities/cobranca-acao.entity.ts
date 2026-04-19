import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export type StatusAcao = 'agendada' | 'enviada' | 'entregue' | 'lida' | 'respondida' | 'falhou' | 'ignorada' | 'cancelada';

@Entity({ name: 'cobranca_acoes' })
@Index(['execucaoId'])
@Index(['status'])
@Index(['agendadaPara'])
export class CobrancaAcao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'execucao_id' })
  execucaoId!: string;

  @Column({ name: 'etapa_index', type: 'int' })
  etapaIndex!: number;

  @Column({ type: 'varchar', length: 20 })
  canal!: string; // 'whatsapp' | 'email' | 'sms' | 'telefone' | 'portal'

  @Column('uuid', { name: 'template_id', nullable: true })
  templateId?: string | null;

  @Column({ name: 'agendada_para', type: 'timestamptz' })
  agendadaPara!: Date;

  @Column({ name: 'enviada_em', type: 'timestamptz', nullable: true })
  enviadaEm?: Date | null;

  @Column({ name: 'entregue_em', type: 'timestamptz', nullable: true })
  entregueEm?: Date | null;

  @Column({ name: 'lida_em', type: 'timestamptz', nullable: true })
  lidaEm?: Date | null;

  @Column({ name: 'respondida_em', type: 'timestamptz', nullable: true })
  respondidaEm?: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'agendada' })
  status!: StatusAcao;

  @Column({ name: 'mensagem_externa_id', type: 'text', nullable: true })
  mensagemExternaId?: string | null;

  @Column({ name: 'conteudo_resposta', type: 'text', nullable: true })
  conteudoResposta?: string | null;

  @Column({ name: 'erro_detalhes', type: 'jsonb', nullable: true })
  erroDetalhes?: Record<string, unknown> | null;

  @Column({ type: 'numeric', precision: 8, scale: 4, default: 0 })
  custo!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
