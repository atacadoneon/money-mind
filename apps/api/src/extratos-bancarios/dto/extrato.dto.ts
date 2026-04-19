import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class UploadOfxQueryDto {
  @ApiProperty() @IsUUID() contaBancariaId!: string;
  @ApiProperty() @IsUUID() companyId!: string;
}

export class ListExtratosQuery extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() contaBancariaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() companyId?: string;
}
