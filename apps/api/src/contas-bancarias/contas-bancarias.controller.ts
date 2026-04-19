import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContasBancariasService } from './contas-bancarias.service';
import { CreateContaBancariaDto, UpdateContaBancariaDto } from './dto/conta-bancaria.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('contas-bancarias') @ApiBearerAuth()
@Controller('contas-bancarias')
export class ContasBancariasController {
  constructor(private readonly svc: ContasBancariasService) {}
  @Get() list(@CurrentOrg() o: OrgContext, @Query() q: PaginationDto, @Query('companyId') companyId?: string) {
    return this.svc.list(o.orgId, { ...q, companyId });
  }
  @Get(':id') async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return { data: await this.svc.get(o.orgId, id) }; }
  @Post() @Roles('owner', 'admin')
  async create(@CurrentOrg() o: OrgContext, @Body() dto: CreateContaBancariaDto) { return { data: await this.svc.create(o.orgId, dto) }; }
  @Patch(':id') @Roles('owner', 'admin')
  async update(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContaBancariaDto) { return { data: await this.svc.update(o.orgId, id, dto) }; }
  @Delete(':id') @Roles('owner', 'admin')
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(o.orgId, id); }
}
