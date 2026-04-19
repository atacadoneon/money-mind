import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FormasPagamentoService } from './formas-pagamento.service';
import { CreateFormaPagamentoDto, UpdateFormaPagamentoDto } from './dto/forma-pagamento.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('formas-pagamento') @ApiBearerAuth()
@Controller('formas-pagamento')
export class FormasPagamentoController {
  constructor(private readonly svc: FormasPagamentoService) {}
  @Get() list(@CurrentOrg() o: OrgContext, @Query() q: PaginationDto) { return this.svc.list(o.orgId, q); }
  @Get(':id') async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return { data: await this.svc.get(o.orgId, id) }; }
  @Post() @Roles('owner', 'admin', 'accountant')
  async create(@CurrentOrg() o: OrgContext, @Body() dto: CreateFormaPagamentoDto) { return { data: await this.svc.create(o.orgId, dto) }; }
  @Patch(':id') @Roles('owner', 'admin', 'accountant')
  async update(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFormaPagamentoDto) { return { data: await this.svc.update(o.orgId, id, dto) }; }
  @Delete(':id') @Roles('owner', 'admin')
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(o.orgId, id); }
}
