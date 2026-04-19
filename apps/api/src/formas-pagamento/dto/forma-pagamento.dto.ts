import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateFormaPagamentoDto {
  @ApiProperty() @IsString() @Length(2, 120) nome!: string;
  @ApiProperty() @IsString() tipo!: string;
}
export class UpdateFormaPagamentoDto extends PartialType(CreateFormaPagamentoDto) {}
