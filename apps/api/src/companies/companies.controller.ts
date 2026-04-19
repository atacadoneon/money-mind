import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly svc: CompaniesService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext, @Query() q: PaginationDto) { return this.svc.list(org.orgId, q); }

  @Get(':id')
  async get(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(org.orgId, id) };
  }

  @Post() @Roles('owner', 'admin')
  async create(@CurrentOrg() org: OrgContext, @Body() dto: CreateCompanyDto) {
    return { data: await this.svc.create(org.orgId, dto) };
  }

  @Patch(':id') @Roles('owner', 'admin')
  async update(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
    return { data: await this.svc.update(org.orgId, id, dto) };
  }

  @Delete(':id') @Roles('owner', 'admin')
  remove(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(org.orgId, id);
  }
}
