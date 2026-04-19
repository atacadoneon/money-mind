import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional,
  IsString, IsUUID, Length, Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateContaReceberDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsString() @Length(1, 300) descricao!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number) valor!: number;
  @ApiProperty() @IsDateString() dataVencimento!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataEmissao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroDocumento?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clienteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() formaPagamentoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaBancariaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true })
  marcadoresIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() tinyId?: string;
}

export class UpdateContaReceberDto extends PartialType(CreateContaReceberDto) {
  @ApiPropertyOptional({ enum: ['aberto', 'recebido', 'parcial', 'atrasado', 'cancelado'] })
  @IsOptional() @IsEnum(['aberto', 'recebido', 'parcial', 'atrasado', 'cancelado'])
  situacao?: 'aberto' | 'recebido' | 'parcial' | 'atrasado' | 'cancelado';
}

export class ListContasReceberQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
  @ApiPropertyOptional({ enum: ['aberto', 'recebido', 'parcial', 'atrasado', 'cancelado'] })
  @IsOptional() @IsEnum(['aberto', 'recebido', 'parcial', 'atrasado', 'cancelado'])
  situacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() vencimentoDe?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() vencimentoAte?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clienteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() marcadorId?: string;
}

export class BaixarReceberDto {
  @ApiProperty() @IsDateString() dataRecebimento!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number) valorRecebido!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) juros?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) multa?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) desconto?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaBancariaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() formaPagamentoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marcarClaude?: boolean;
}

export class BulkCRIdsDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('all', { each: true }) ids!: string[];
}

export class BulkCRUpdateDto extends BulkCRIdsDto {
  @ApiProperty() patch!: Partial<UpdateContaReceberDto>;
}

export class BulkBaixarCRDto extends BulkCRIdsDto {
  @ApiProperty() @IsDateString() dataRecebimento!: string;
  @ApiProperty() @IsUUID() contaBancariaId!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) valorRecebido?: number;
}

export class ImportCRColumnMapDto {
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() valor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dataVencimento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() numeroDocumento?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clienteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoriaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tinyId?: string;
}
