import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type FormatoExportacao = 'csv' | 'xlsx' | 'dominio' | 'alterdata' | 'fortes' | 'prosoft' | 'omie' | 'conta_azul';
export type StatusExportacao = 'gerando' | 'pronto' | 'enviado' | 'falhou';
export type RegimeExportacao = 'competencia' | 'caixa';

@Entity({ name: 'exportacoes_contabeis' })
@Index(['orgId'])
@Index(['companyId'])
@Index(['competencia'])
export class ExportacaoContabil extends CompanyScopedEntity {
  @Column({ type: 'varchar', length: 7 })
  competencia!: string;

  @Column({ type: 'varchar', length: 20 })
  formato!: FormatoExportacao;

  @Column({ type: 'varchar', length: 20, default: 'gerando' })
  status!: StatusExportacao;

  @Column({ name: 'arquivo_url', type: 'text', nullable: true })
  arquivoUrl?: string | null;

  @Column({ name: 'total_lancamentos', type: 'int', default: 0 })
  totalLancamentos!: number;

  @Column({ name: 'total_valor', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalValor!: string;

  @Column({ type: 'varchar', length: 10, default: 'competencia' })
  regime!: RegimeExportacao;

  @Column('uuid', { name: 'gerado_por', nullable: true })
  geradoPor?: string | null;

  @Column({ name: 'enviado_para', type: 'text', nullable: true })
  enviadoPara?: string | null;

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;
}
