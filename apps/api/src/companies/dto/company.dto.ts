import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty() @IsString() @Length(2, 160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tradeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cnpj?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ie?: string;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
