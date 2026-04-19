import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListDuplicatasQuery extends PaginationDto {
  @ApiPropertyOptional({ enum: ['contato', 'categoria'] }) @IsOptional() @IsString() entidadeTipo?: string;
  @ApiPropertyOptional({ enum: ['detectada', 'confirmada', 'descartada', 'mergeada'] })
  @IsOptional() @IsString() status?: string;
}

export class ScanearDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiPropertyOptional({ enum: ['contato', 'categoria'] }) @IsOptional() @IsString() entidadeTipo?: string;
}

export class ConfirmarDuplicataDto {
  @ApiPropertyOptional() @IsOptional() @IsString() observacoes?: string;
}

export class MergeDuplicataDto {
  @ApiProperty({ description: 'ID do registro que sobrevive' }) @IsUUID() vencedorId!: string;
}

export class DescartarDuplicataDto {
  @ApiPropertyOptional() @IsOptional() @IsString() motivo?: string;
}
