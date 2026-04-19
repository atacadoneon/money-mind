import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const TIPOS_PENDENCIA = ['enviar_comprovante', 'aprovar_pagamento', 'classificar_lancamento', 'enviar_documento', 'responder_pergunta', 'assinar_fechamento'] as const;

export class CriarSessaoDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsString() emailCliente!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nomeCliente?: string;
}

export class CriarPendenciaDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsString() @MaxLength(300) titulo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiProperty({ enum: TIPOS_PENDENCIA }) @IsEnum(TIPOS_PENDENCIA) tipo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entidadeTipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entidadeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prazo?: string;
}

export class ResolverPendenciaDto {
  @ApiPropertyOptional() @IsOptional() @IsObject() resposta?: Record<string, unknown>;
}

export class CriarMensagemDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty({ enum: ['analista', 'cliente'] }) @IsString() remetenteTipo!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remetenteId?: string;
  @ApiProperty() @IsString() @MaxLength(5000) conteudo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() competencia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entidadeTipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entidadeId?: string;
}

export class ListPendenciasQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ enum: ['pendente', 'resolvida', 'expirada', 'cancelada'] })
  @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ enum: TIPOS_PENDENCIA }) @IsOptional() @IsString() tipo?: string;
}

export class ListMensagensQuery extends PaginationDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() competencia?: string;
}
