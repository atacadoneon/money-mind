import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MarcadoresService } from './marcadores.service';
import { CreateMarcadorDto, UpdateMarcadorDto } from './dto/marcador.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('marcadores') @ApiBearerAuth()
@Controller('marcadores')
export class MarcadoresController {
  constructor(private readonly svc: MarcadoresService) {}
  @Get() list(@CurrentOrg() o: OrgContext, @Query() q: PaginationDto) { return this.svc.list(o.orgId, q); }
  @Get(':id') async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return { data: await this.svc.get(o.orgId, id) }; }
  @Post() @Roles('owner', 'admin', 'accountant')
  async create(@CurrentOrg() o: OrgContext, @Body() dto: CreateMarcadorDto) { return { data: await this.svc.create(o.orgId, dto) }; }
  @Patch(':id') @Roles('owner', 'admin', 'accountant')
  async update(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMarcadorDto) { return { data: await this.svc.update(o.orgId, id, dto) }; }
  @Delete(':id') @Roles('owner', 'admin')
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(o.orgId, id); }
}
