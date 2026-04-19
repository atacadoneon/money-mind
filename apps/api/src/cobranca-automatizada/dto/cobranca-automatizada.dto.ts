import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/* ── Cadencia DTOs ── */

class EtapaDto {
  @ApiProperty() @IsInt() @Min(0) ordem!: number;
  @ApiProperty() @IsInt() @Min(0) diasOffset!: number;
  @ApiProperty() @IsIn(['email', 'whatsapp', 'sms', 'telefone', 'portal']) canal!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() janelaHorario?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() cooldownHoras?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() nivelEscalacao?: string;
}

export class CreateCadenciaDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: ['todos', 'premium', 'novos', 'inadimplentes', 'alto_valor'] })
  @IsOptional()
  @IsString()
  segmentoAlvo?: string;

  @ApiPropertyOptional({ type: [EtapaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EtapaDto)
  etapas?: EtapaDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCadenciaDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ enum: ['todos', 'premium', 'novos', 'inadimplentes', 'alto_valor'] })
  @IsOptional()
  @IsString()
  segmentoAlvo?: string;

  @ApiPropertyOptional({ type: [EtapaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EtapaDto)
  etapas?: EtapaDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/* ── Template DTOs ── */

export class CreateTemplateDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  nome!: string;

  @ApiProperty()
  @IsIn(['email', 'whatsapp', 'sms'])
  canal!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assunto?: string;

  @ApiProperty()
  @IsString()
  conteudo!: string;

  @ApiPropertyOptional({ enum: ['L0', 'L1', 'L2', 'L3'] })
  @IsOptional()
  @IsIn(['L0', 'L1', 'L2', 'L3'])
  nivelEscalacao?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variaveis?: string[];
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['email', 'whatsapp', 'sms'])
  canal?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assunto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conteudo?: string;

  @ApiPropertyOptional({ enum: ['L0', 'L1', 'L2', 'L3'] })
  @IsOptional()
  @IsIn(['L0', 'L1', 'L2', 'L3'])
  nivelEscalacao?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variaveis?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/* ── Execucao DTOs ── */

export class IniciarCobrancaDto {
  @ApiProperty()
  @IsUUID()
  contaReceberId!: string;

  @ApiProperty()
  @IsUUID()
  cadenciaId!: string;

  @ApiProperty()
  @IsUUID()
  companyId!: string;
}

export class PausarCobrancaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;
}

/* ── Query DTOs ── */

export class ListExecucoesQuery extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ['ativa', 'pausada', 'concluida', 'cancelada', 'negociando'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cadenciaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contaReceberId?: string;
}

export class ListTemplatesQuery extends PaginationDto {
  @ApiPropertyOptional({ enum: ['email', 'whatsapp', 'sms'] })
  @IsOptional()
  @IsString()
  canal?: string;

  @ApiPropertyOptional({ enum: ['L0', 'L1', 'L2', 'L3'] })
  @IsOptional()
  @IsString()
  nivelEscalacao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
