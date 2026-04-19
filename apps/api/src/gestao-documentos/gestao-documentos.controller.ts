import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GestaoDocumentosService } from './gestao-documentos.service';
import {
  ListDocumentosQuery, RejeitarDocumentoDto, UpdateDocumentoDto,
  UploadDocumentoDto, ValidarDocumentoDto, VincularDocumentoDto,
} from './dto/gestao-documentos.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('gestao-documentos')
@ApiBearerAuth()
@Controller('gestao-documentos')
export class GestaoDocumentosController {
  constructor(private readonly svc: GestaoDocumentosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar documentos com filtros' })
  list(@CurrentOrg() o: OrgContext, @Query() q: ListDocumentosQuery) {
    return this.svc.list(o.orgId, q);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de documentos' })
  stats(@CurrentOrg() o: OrgContext, @Query('companyId') companyId?: string) {
    return this.svc.stats(o.orgId, companyId);
  }

  @Get('entidade/:tipo/:entidadeId')
  @ApiOperation({ summary: 'Listar documentos por entidade' })
  porEntidade(
    @CurrentOrg() o: OrgContext,
    @Param('tipo') tipo: string,
    @Param('entidadeId', ParseUUIDPipe) entidadeId: string,
  ) {
    return this.svc.porEntidade(o.orgId, tipo, entidadeId);
  }

  @Get(':id')
  async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(o.orgId, id) };
  }

  @Post()
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Registrar upload de documento (metadata)' })
  async upload(@CurrentOrg() o: OrgContext, @Body() dto: UploadDocumentoDto) {
    return { data: await this.svc.upload(o.orgId, o.userId, dto) };
  }

  @Patch(':id')
  @Roles('owner', 'admin', 'accountant')
  async update(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentoDto,
  ) {
    return { data: await this.svc.update(o.orgId, id, dto) };
  }

  @Post(':id/validar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Validar documento' })
  async validar(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidarDocumentoDto,
  ) {
    return { data: await this.svc.validar(o.orgId, id, o.userId, dto) };
  }

  @Post(':id/rejeitar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Rejeitar documento (motivo obrigatório)' })
  async rejeitar(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejeitarDocumentoDto,
  ) {
    return { data: await this.svc.rejeitar(o.orgId, id, o.userId, dto) };
  }

  @Patch(':id/vincular')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Vincular documento a outra entidade' })
  async vincular(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VincularDocumentoDto,
  ) {
    return { data: await this.svc.vincular(o.orgId, id, dto) };
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(o.orgId, id);
  }
}
