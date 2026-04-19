import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { SkipOrgContext } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('organizations')
@ApiBearerAuth()
@SkipOrgContext()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  @Get() @ApiOperation({ summary: 'List organizations (for the user)' })
  list(@Query() q: PaginationDto) { return this.svc.list(q); }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(id) };
  }

  @Post() @Roles('owner')
  async create(@Body() dto: CreateOrganizationDto) {
    return { data: await this.svc.create(dto) };
  }

  @Patch(':id') @Roles('owner', 'admin')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationDto) {
    return { data: await this.svc.update(id, dto) };
  }

  @Delete(':id') @Roles('owner')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
