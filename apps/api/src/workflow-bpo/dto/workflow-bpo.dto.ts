import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ─── Carteira ────────────────────────────────────────────────────────────────

export class CreateCarteiraDto {
  @ApiProperty() @IsUUID() analistaId!: string;
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ default: 10 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) slaFechamentoDia?: number;
  @ApiPropertyOptional({ default: 'diaria', enum: ['diaria', 'semanal', 'quinzenal', 'mensal'] })
  @IsOptional() @IsString() slaConciliacao?: string;
  @ApiPropertyOptional({ default: 'semanal', enum: ['diaria', 'semanal', 'quinzenal', 'mensal'] })
  @IsOptional() @IsString() slaCobranca?: string;
}

export class UpdateCarteiraDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) slaFechamentoDia?: number;
  @ApiPropertyOptional({ enum: ['diaria', 'semanal', 'quinzenal', 'mensal'] })
  @IsOptional() @IsString() slaConciliacao?: string;
  @ApiPropertyOptional({ enum: ['diaria', 'semanal', 'quinzenal', 'mensal'] })
  @IsOptional() @IsString() slaCobranca?: string;
}

// ─── Tarefa ──────────────────────────────────────────────────────────────────

const TIPOS_TAREFA = ['conciliacao', 'classificacao', 'documento', 'cobranca', 'fechamento', 'aprovacao', 'revisao', 'outro'] as const;
const PRIORIDADES = ['critica', 'alta', 'media', 'baixa'] as const;
const STATUS_TAREFA = ['backlog', 'a_fazer', 'em_andamento', 'revisao', 'concluida', 'cancelada'] as const;

export class CreateTarefaDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsString() @MaxLength(500) titulo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiProperty({ enum: TIPOS_TAREFA }) @IsEnum(TIPOS_TAREFA) tipo!: string;
  @ApiPropertyOptional({ enum: PRIORIDADES, default: 'media' }) @IsOptional() @IsEnum(PRIORIDADES) prioridade?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() analistaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supervisorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prazo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entidadeTipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entidadeId?: string;
}

export class UpdateTarefaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) titulo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional({ enum: TIPOS_TAREFA }) @IsOptional() @IsEnum(TIPOS_TAREFA) tipo?: string;
  @ApiPropertyOptional({ enum: PRIORIDADES }) @IsOptional() @IsEnum(PRIORIDADES) prioridade?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() analistaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supervisorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prazo?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) tempoGastoMin?: number;
}

export class MoverTarefaDto {
  @ApiProperty({ enum: STATUS_TAREFA }) @IsEnum(STATUS_TAREFA) status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}

export class AtribuirTarefaDto {
  @ApiProperty() @IsUUID() analistaId!: string;
}

export class ListTarefasQuery extends PaginationDto {
  @ApiPropertyOptional({ enum: STATUS_TAREFA }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ enum: TIPOS_TAREFA }) @IsOptional() @IsString() tipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() analistaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
}
