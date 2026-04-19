import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const ENTIDADE_TIPOS = ['conta_pagar', 'conta_receber', 'transacao_bancaria', 'conciliacao', 'contato'] as const;
const TIPO_DOCUMENTO = ['nota_fiscal', 'boleto', 'comprovante', 'contrato', 'recibo', 'guia_imposto', 'outro'] as const;
const TIPO_ARQUIVO = ['pdf', 'xml', 'jpg', 'png', 'xlsx', 'csv', 'ofx', 'outro'] as const;

export class UploadDocumentoDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty({ enum: ENTIDADE_TIPOS }) @IsEnum(ENTIDADE_TIPOS) entidadeTipo!: string;
  @ApiProperty() @IsUUID() entidadeId!: string;
  @ApiProperty() @IsString() @MaxLength(300) nomeArquivo!: string;
  @ApiProperty({ enum: TIPO_ARQUIVO }) @IsEnum(TIPO_ARQUIVO) tipoArquivo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mimeType?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() tamanhoBytes?: number;
  @ApiProperty() @IsString() storagePath!: string;
  @ApiPropertyOptional({ enum: TIPO_DOCUMENTO }) @IsOptional() @IsEnum(TIPO_DOCUMENTO) tipoDocumento?: string;
  @ApiPropertyOptional({ example: '2026-04' }) @IsOptional() @IsString() competencia?: string;
}

export class UpdateDocumentoDto {
  @ApiPropertyOptional({ enum: TIPO_DOCUMENTO }) @IsOptional() @IsEnum(TIPO_DOCUMENTO) tipoDocumento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() competencia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}

export class ValidarDocumentoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) observacoes?: string;
}

export class RejeitarDocumentoDto {
  @ApiProperty() @IsString() @MaxLength(2000) motivoRejeicao!: string;
}

export class VincularDocumentoDto {
  @ApiProperty({ enum: ENTIDADE_TIPOS }) @IsEnum(ENTIDADE_TIPOS) entidadeTipo!: string;
  @ApiProperty() @IsUUID() entidadeId!: string;
}

export class ListDocumentosQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ enum: ENTIDADE_TIPOS }) @IsOptional() @IsString() entidadeTipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entidadeId?: string;
  @ApiPropertyOptional({ enum: TIPO_DOCUMENTO }) @IsOptional() @IsString() tipoDocumento?: string;
  @ApiPropertyOptional({ enum: ['pendente', 'recebido', 'validado', 'rejeitado', 'arquivado'] })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() competencia?: string;
}
