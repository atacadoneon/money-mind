import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const FORMATOS = ['csv', 'xlsx', 'dominio', 'alterdata', 'fortes', 'prosoft', 'omie', 'conta_azul'] as const;
const TIPOS_IMPOSTO = ['simples', 'iss', 'pis', 'cofins', 'irpj', 'csll', 'icms', 'ipi', 'inss', 'fgts'] as const;

export class GerarExportacaoDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty({ example: '2026-04' }) @IsString() competencia!: string;
  @ApiProperty({ enum: FORMATOS }) @IsEnum(FORMATOS) formato!: string;
  @ApiPropertyOptional({ enum: ['competencia', 'caixa'] }) @IsOptional() @IsString() regime?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() configuracao?: Record<string, unknown>;
}

export class ListExportacoesQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() competencia?: string;
  @ApiPropertyOptional({ enum: FORMATOS }) @IsOptional() @IsString() formato?: string;
  @ApiPropertyOptional({ enum: ['gerando', 'pronto', 'enviado', 'falhou'] })
  @IsOptional() @IsString() status?: string;
}

export class CreateProvisaoDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty({ example: '2026-04' }) @IsString() competencia!: string;
  @ApiProperty({ enum: TIPOS_IMPOSTO }) @IsEnum(TIPOS_IMPOSTO) tipoImposto!: string;
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) baseCalculo!: number;
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(100) aliquota!: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataVencimento?: string;
}

export class UpdateProvisaoDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) baseCalculo?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) aliquota?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) valorPago?: number;
  @ApiPropertyOptional({ enum: ['provisionado', 'pago', 'atrasado', 'cancelado'] })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guiaUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataVencimento?: string;
}

export class ListProvisoesQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() competencia?: string;
  @ApiPropertyOptional({ enum: TIPOS_IMPOSTO }) @IsOptional() @IsString() tipoImposto?: string;
  @ApiPropertyOptional({ enum: ['provisionado', 'pago', 'atrasado', 'cancelado'] })
  @IsOptional() @IsString() status?: string;
}

export class CalendarioFiscalQuery {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() competencia?: string;
}
