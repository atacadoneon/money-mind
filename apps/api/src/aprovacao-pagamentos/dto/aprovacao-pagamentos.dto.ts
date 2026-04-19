import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ─── Alçada DTOs ────────────────────────────────────────────────────────────

export class CreateAlcadaDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiProperty() @IsString() @MaxLength(100) nome!: string;
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valorMinimo!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valorMaximo?: number;
  @ApiProperty({ enum: ['analista', 'supervisor', 'admin', 'owner'] })
  @IsEnum(['analista', 'supervisor', 'admin', 'owner']) aprovadorRole!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() ordem?: number;
}

export class UpdateAlcadaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) nome?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) valorMinimo?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) valorMaximo?: number;
  @ApiPropertyOptional({ enum: ['analista', 'supervisor', 'admin', 'owner'] })
  @IsOptional() @IsEnum(['analista', 'supervisor', 'admin', 'owner']) aprovadorRole?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() ordem?: number;
}

// ─── Aprovação DTOs ─────────────────────────────────────────────────────────

export class SolicitarAprovacaoDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() contaPagarId!: string;
  @ApiProperty() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) valor!: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataAgendada?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaBancariaId?: string;
  @ApiPropertyOptional({ enum: ['pix', 'boleto', 'ted', 'debito', 'cartao'] })
  @IsOptional() @IsString() meioPagamento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}

export class AprovarDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) observacoes?: string;
}

export class RejeitarDto {
  @ApiProperty() @IsString() @MaxLength(2000) motivoRejeicao!: string;
}

export class ListAprovacoesQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ enum: ['pendente', 'aprovada', 'rejeitada', 'expirada', 'cancelada'] })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() solicitadoPor?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() aprovadorId?: string;
}
