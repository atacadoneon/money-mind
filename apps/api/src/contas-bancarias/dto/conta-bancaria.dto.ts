import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateContaBancariaDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsString() @Length(2, 120) nome!: string;
  @ApiProperty({ enum: ['corrente', 'poupanca', 'pagamento', 'gateway', 'carteira'] })
  @IsEnum(['corrente', 'poupanca', 'pagamento', 'gateway', 'carteira'])
  tipo!: 'corrente' | 'poupanca' | 'pagamento' | 'gateway' | 'carteira';
  @ApiPropertyOptional() @IsOptional() @IsString() bancoCodigo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bancoNome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agencia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contaNumero?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Type(() => Number) saldoInicial?: number;
}
export class UpdateContaBancariaDto extends PartialType(CreateContaBancariaDto) {}
