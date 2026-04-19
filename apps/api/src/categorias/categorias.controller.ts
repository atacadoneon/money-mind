import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto, UpdateCategoriaDto } from './dto/categoria.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('categorias')
@ApiBearerAuth()
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly svc: CategoriasService) {}

  @Get() list(@CurrentOrg() o: OrgContext, @Query() q: PaginationDto, @Query('tipo') tipo?: string) {
    return this.svc.list(o.orgId, { ...q, tipo });
  }

  @Get('tree') tree(@CurrentOrg() o: OrgContext, @Query('tipo') tipo?: 'receita' | 'despesa') {
    return this.svc.tree(o.orgId, tipo);
  }

  @Get(':id') async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(o.orgId, id) };
  }

  @Post() @Roles('owner', 'admin', 'accountant')
  async create(@CurrentOrg() o: OrgContext, @Body() dto: CreateCategoriaDto) {
    return { data: await this.svc.create(o.orgId, dto) };
  }

  @Patch(':id') @Roles('owner', 'admin', 'accountant')
  async update(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoriaDto) {
    return { data: await this.svc.update(o.orgId, id, dto) };
  }

  @Delete(':id') @Roles('owner', 'admin')
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(o.orgId, id); }
}
