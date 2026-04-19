import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty() @IsString() @Length(2, 160) name!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9-]+$/) @Length(2, 60) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plan?: string;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
