import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional,
  IsString, IsUUID, Length, Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateContaPagarDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsString() @Length(1, 300) descricao!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number) valor!: number;
  @ApiProperty({ example: '2026-05-10' }) @IsDateString() dataVencimento!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataEmissao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroDocumento?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fornecedorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) fornecedorNome?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() formaPagamentoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaBancariaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true })
  marcadoresIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() tinyId?: string;
}

export class UpdateContaPagarDto extends PartialType(CreateContaPagarDto) {
  @ApiPropertyOptional({ enum: ['aberto', 'pago', 'parcial', 'atrasado', 'cancelado'] })
  @IsOptional()
  @IsEnum(['aberto', 'pago', 'parcial', 'atrasado', 'cancelado'])
  situacao?: 'aberto' | 'pago' | 'parcial' | 'atrasado' | 'cancelado';
}

export class ListContasPagarQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ enum: ['aberto', 'pago', 'parcial', 'atrasado', 'cancelado'] })
  @IsOptional() @IsEnum(['aberto', 'pago', 'parcial', 'atrasado', 'cancelado'])
  situacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() vencimentoDe?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() vencimentoAte?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fornecedorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() marcadorId?: string;
}

export class BaixarContaDto {
  @ApiProperty() @IsDateString() dataPagamento!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number) valorPago!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) juros?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) multa?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) desconto?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaBancariaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() formaPagamentoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marcarClaude?: boolean;
}

export class BulkIdsDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('all', { each: true }) ids!: string[];
}

export class BulkUpdateDto extends BulkIdsDto {
  @ApiProperty() patch!: Partial<UpdateContaPagarDto>;
}

export class BulkBaixarDto extends BulkIdsDto {
  @ApiProperty() @IsDateString() dataPagamento!: string;
  @ApiProperty() @IsUUID() contaBancariaId!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) valorPago?: number;
}

export class ImportColumnMapDto {
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() valor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dataVencimento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroDocumento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fornecedorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tinyId?: string;
}
