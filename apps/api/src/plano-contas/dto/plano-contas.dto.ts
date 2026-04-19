import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ─── Centro de Custo ────────────────────────────────────────────────────────

export class CreateCentroCustoDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiProperty() @IsString() @MaxLength(20) codigo!: string;
  @ApiProperty() @IsString() @MaxLength(200) nome!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCentroCustoDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCentrosCustoQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @Type(() => Boolean) apenasAtivos?: boolean;
}

// ─── Regra de Rateio ────────────────────────────────────────────────────────

class RateioItemDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() centroCustoId?: string;
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) @Max(100) percentual!: number;
}

export class CreateRegraRateioDto {
  @ApiProperty() @IsString() @MaxLength(100) nome!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional({ enum: ['percentual', 'receita', 'headcount', 'area', 'volume', 'manual'] })
  @IsOptional() @IsString() criterio?: string;
  @ApiProperty({ type: [RateioItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => RateioItemDto) itens!: RateioItemDto[];
}

export class UpdateRegraRateioDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: [RateioItemDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RateioItemDto) itens?: RateioItemDto[];
}

export class AplicarRateioDto {
  @ApiProperty() @IsUUID() regraId!: string;
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valor!: number;
}

// ─── Regra de Categorização ─────────────────────────────────────────────────

export class CreateRegraCategorizacaoDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiProperty({ enum: ['cnpj', 'nome_contato', 'historico', 'valor_range'] })
  @IsEnum(['cnpj', 'nome_contato', 'historico', 'valor_range']) campoMatch!: string;
  @ApiProperty() @IsString() valorMatch!: string;
  @ApiPropertyOptional({ enum: ['igual', 'contem', 'regex', 'maior_que', 'menor_que'] })
  @IsOptional() @IsString() operador?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() centroCustoId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) confidence?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() prioridade?: number;
}

export class UpdateRegraCategorizacaoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() valorMatch?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() operador?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() centroCustoId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() confidence?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() prioridade?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Sugestão Input ─────────────────────────────────────────────────────────

export class SugerirCategoriaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nomeContato?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() historico?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() valor?: number;
}
