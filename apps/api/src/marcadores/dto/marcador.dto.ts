import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsHexColor, IsOptional, IsString, Length } from 'class-validator';

export class CreateMarcadorDto {
  @ApiProperty() @IsString() @Length(1, 80) nome!: string;
  @ApiPropertyOptional({ example: '#ff5722' }) @IsOptional() @IsHexColor() cor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
}
export class UpdateMarcadorDto extends PartialType(CreateMarcadorDto) {}
