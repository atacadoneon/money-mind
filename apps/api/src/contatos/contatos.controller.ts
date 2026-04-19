import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ContatosService } from './contatos.service';
import { CreateContatoDto, UpdateContatoDto } from './dto/contato.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('contatos')
@ApiBearerAuth()
@Controller('contatos')
export class ContatosController {
  constructor(private readonly svc: ContatosService) {}

  @Get()
  @ApiQuery({ name: 'tipo', required: false, enum: ['cliente', 'fornecedor', 'ambos'] })
  list(@CurrentOrg() org: OrgContext, @Query() q: PaginationDto, @Query('tipo') tipo?: string) {
    return this.svc.list(org.orgId, { ...q, tipo });
  }

  @Get(':id')
  async get(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(org.orgId, id) };
  }

  @Post() @Roles('owner', 'admin', 'accountant')
  async create(@CurrentOrg() org: OrgContext, @Body() dto: CreateContatoDto) {
    return { data: await this.svc.create(org.orgId, dto) };
  }

  @Patch(':id') @Roles('owner', 'admin', 'accountant')
  async update(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContatoDto) {
    return { data: await this.svc.update(org.orgId, id, dto) };
  }

  @Delete(':id') @Roles('owner', 'admin')
  remove(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(org.orgId, id);
  }
}
