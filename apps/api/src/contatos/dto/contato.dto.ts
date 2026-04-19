import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateContatoDto {
  @ApiProperty() @IsString() @Length(2, 180) nome!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nomeFantasia?: string;
  @ApiPropertyOptional({ enum: ['cliente', 'fornecedor', 'ambos'] })
  @IsOptional()
  @IsEnum(['cliente', 'fornecedor', 'ambos'])
  tipo?: 'cliente' | 'fornecedor' | 'ambos';
  @ApiPropertyOptional() @IsOptional() @IsString() tipoPessoa?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() tipos?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() cpfCnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefone?: string;
}

export class UpdateContatoDto extends PartialType(CreateContatoDto) {}
