import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCategoriaDto {
  @ApiProperty() @IsString() @Length(2, 160) nome!: string;
  @ApiProperty({ enum: ['receita', 'despesa'] }) @IsEnum(['receita', 'despesa']) tipo!: 'receita' | 'despesa';
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codigo?: string;
}

export class UpdateCategoriaDto extends PartialType(CreateCategoriaDto) {}
