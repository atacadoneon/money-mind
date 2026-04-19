import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsOptional, IsString, IsUUID, Length, Matches,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ─── Fechamento DTOs ─────────────────────────────────────────────────────────

export class CreateFechamentoDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty({ example: '2026-04' })
  @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'Competência deve ser no formato YYYY-MM' })
  competencia!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() analistaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 2000) observacoes?: string;
}

export class UpdateFechamentoDto extends PartialType(CreateFechamentoDto) {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 2000) observacoes?: string;
}

export class ListFechamentosQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ example: '2026-04' }) @IsOptional() @IsString() competencia?: string;
  @ApiPropertyOptional({ enum: ['aberto', 'em_progresso', 'revisao', 'aprovado', 'fechado', 'reaberto'] })
  @IsOptional()
  @IsEnum(['aberto', 'em_progresso', 'revisao', 'aprovado', 'fechado', 'reaberto'])
  status?: string;
}

export class AprovarFechamentoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 2000) observacoes?: string;
}

export class ReabrirFechamentoDto {
  @ApiProperty() @IsString() @Length(1, 2000) motivoReabertura!: string;
}

// ─── Checklist DTOs ──────────────────────────────────────────────────────────

export class CreateChecklistItemDto {
  @ApiProperty() @IsString() @Length(1, 500) titulo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional({ enum: ['automatico', 'manual'] })
  @IsOptional() @IsEnum(['automatico', 'manual'])
  tipo?: 'automatico' | 'manual';
  @ApiPropertyOptional({ enum: ['conciliacao', 'categoria', 'documento', 'bancario', 'imposto', 'folha', 'geral'] })
  @IsOptional() @IsString()
  categoria?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() atribuidoA?: 'analista' | 'cliente' | 'contador';
}

export class UpdateChecklistItemDto {
  @ApiPropertyOptional({ enum: ['ok', 'pendente', 'bloqueante', 'ignorado'] })
  @IsOptional() @IsEnum(['ok', 'pendente', 'bloqueante', 'ignorado'])
  status?: 'ok' | 'pendente' | 'bloqueante' | 'ignorado';
  @ApiPropertyOptional() @IsOptional() @IsString() atribuidoA?: 'analista' | 'cliente' | 'contador';
}
