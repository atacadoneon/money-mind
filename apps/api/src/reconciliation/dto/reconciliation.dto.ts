import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ConfirmMatchDto {
  @ApiProperty() @IsUUID() linhaId!: string;
  @ApiProperty({ enum: ['contaPagar', 'contaReceber'] })
  @IsEnum(['contaPagar', 'contaReceber']) kind!: 'contaPagar' | 'contaReceber';
  @ApiProperty() @IsUUID() targetId!: string;
}

export class IgnoreLinhaDto {
  @ApiProperty() @IsUUID() linhaId!: string;
  @IsOptional() motivo?: string;
}

export class RunBatchDto {
  @ApiProperty() @IsUUID() extratoId!: string;
}
