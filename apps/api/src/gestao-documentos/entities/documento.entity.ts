import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type TipoDocumento = 'nota_fiscal' | 'boleto' | 'comprovante' | 'contrato' | 'recibo' | 'guia_imposto' | 'outro';
export type StatusDocumento = 'pendente' | 'recebido' | 'validado' | 'rejeitado' | 'arquivado';
export type TipoArquivo = 'pdf' | 'xml' | 'jpg' | 'png' | 'xlsx' | 'csv' | 'ofx' | 'outro';

@Entity({ name: 'documentos' })
@Index(['orgId'])
@Index(['companyId'])
@Index(['entidadeTipo', 'entidadeId'])
@Index(['tipoDocumento'])
@Index(['competencia'])
@Index(['status'])
export class Documento extends CompanyScopedEntity {
  @Column({ name: 'entidade_tipo', type: 'varchar', length: 30 })
  entidadeTipo!: string;

  @Column({ name: 'entidade_id', type: 'uuid' })
  entidadeId!: string;

  @Column({ name: 'nome_arquivo', type: 'text' })
  nomeArquivo!: string;

  @Column({ name: 'tipo_arquivo', type: 'varchar', length: 10 })
  tipoArquivo!: TipoArquivo;

  @Column({ name: 'mime_type', type: 'text', nullable: true })
  mimeType?: string | null;

  @Column({ name: 'tamanho_bytes', type: 'bigint', nullable: true })
  tamanhoBytes?: string | null;

  @Column({ name: 'storage_path', type: 'text' })
  storagePath!: string;

  @Column({ name: 'storage_bucket', type: 'text', default: 'documentos' })
  storageBucket!: string;

  @Column({ name: 'tipo_documento', type: 'varchar', length: 30, default: 'outro' })
  tipoDocumento!: TipoDocumento;

  @Column({ type: 'varchar', length: 7, nullable: true })
  competencia?: string | null;

  @Column({ name: 'ocr_processado', type: 'boolean', default: false })
  ocrProcessado!: boolean;

  @Column({ name: 'ocr_dados', type: 'jsonb', nullable: true })
  ocrDados?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status!: StatusDocumento;

  @Column({ name: 'validado_por', type: 'uuid', nullable: true })
  validadoPor?: string | null;

  @Column({ name: 'validado_em', type: 'timestamptz', nullable: true })
  validadoEm?: Date | null;

  @Column({ name: 'motivo_rejeicao', type: 'text', nullable: true })
  motivoRejeicao?: string | null;

  @Column({ type: 'int', default: 1 })
  versao!: number;

  @Column({ name: 'documento_anterior_id', type: 'uuid', nullable: true })
  documentoAnteriorId?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;
}
