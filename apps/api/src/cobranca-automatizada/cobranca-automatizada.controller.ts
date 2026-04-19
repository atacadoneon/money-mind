import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CobrancaAutomatizadaService } from './cobranca-automatizada.service';
import {
  CreateCadenciaDto, CreateTemplateDto, IniciarCobrancaDto, ListExecucoesQuery,
  ListTemplatesQuery, PausarCobrancaDto, UpdateCadenciaDto, UpdateTemplateDto,
} from './dto/cobranca-automatizada.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('cobranca-automatizada')
@ApiBearerAuth()
@Controller('cobranca-automatizada')
export class CobrancaAutomatizadaController {
  constructor(private readonly svc: CobrancaAutomatizadaService) {}

  // ─── Cadências ──────────────────────────────────────────────────────────────

  @Get('cadencias')
  @ApiOperation({ summary: 'Listar cadências de cobrança' })
  listCadencias(@CurrentOrg() o: OrgContext) {
    return this.svc.listCadencias(o.orgId);
  }

  @Get('cadencias/:id')
  async getCadencia(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.getCadencia(o.orgId, id) };
  }

  @Post('cadencias')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Criar cadência de cobrança' })
  async createCadencia(@CurrentOrg() o: OrgContext, @Body() dto: CreateCadenciaDto) {
    return { data: await this.svc.createCadencia(o.orgId, dto) };
  }

  @Patch('cadencias/:id')
  @Roles('owner', 'admin')
  async updateCadencia(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCadenciaDto,
  ) {
    return { data: await this.svc.updateCadencia(o.orgId, id, dto) };
  }

  @Delete('cadencias/:id')
  @Roles('owner', 'admin')
  removeCadencia(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeCadencia(o.orgId, id);
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates de mensagens' })
  listTemplates(@CurrentOrg() o: OrgContext, @Query() q: ListTemplatesQuery) {
    return this.svc.listTemplates(o.orgId, q);
  }

  @Post('templates')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Criar template de mensagem' })
  async createTemplate(@CurrentOrg() o: OrgContext, @Body() dto: CreateTemplateDto) {
    return { data: await this.svc.createTemplate(o.orgId, dto) };
  }

  @Patch('templates/:id')
  @Roles('owner', 'admin', 'accountant')
  async updateTemplate(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return { data: await this.svc.updateTemplate(o.orgId, id, dto) };
  }

  @Delete('templates/:id')
  @Roles('owner', 'admin')
  removeTemplate(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeTemplate(o.orgId, id);
  }

  // ─── Execuções ──────────────────────────────────────────────────────────────

  @Get('execucoes')
  @ApiOperation({ summary: 'Listar execuções de cobrança' })
  listExecucoes(@CurrentOrg() o: OrgContext, @Query() q: ListExecucoesQuery) {
    return this.svc.listExecucoes(o.orgId, q);
  }

  @Get('execucoes/:id')
  async getExecucao(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.getExecucao(o.orgId, id) };
  }

  @Get('execucoes/:id/acoes')
  @ApiOperation({ summary: 'Listar ações de uma execução' })
  getAcoes(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getAcoes(o.orgId, id);
  }

  @Post('execucoes/iniciar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Iniciar cobrança para uma conta a receber' })
  async iniciar(@CurrentOrg() o: OrgContext, @Body() dto: IniciarCobrancaDto) {
    return { data: await this.svc.iniciar(o.orgId, dto) };
  }

  @Post('execucoes/:id/pausar')
  @Roles('owner', 'admin', 'accountant')
  async pausar(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PausarCobrancaDto,
  ) {
    return { data: await this.svc.pausar(o.orgId, id, dto) };
  }

  @Post('execucoes/:id/retomar')
  @Roles('owner', 'admin', 'accountant')
  async retomar(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.retomar(o.orgId, id) };
  }

  @Post('execucoes/:id/cancelar')
  @Roles('owner', 'admin')
  async cancelar(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.cancelar(o.orgId, id) };
  }

  @Post('execucoes/:id/proxima-etapa')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Executar próxima etapa da cadência' })
  executarProximaEtapa(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.executarProximaEtapa(o.orgId, id);
  }

  @Post('processar-fila')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Processar fila de cobranças pendentes (bulk)' })
  processarFila(@CurrentOrg() o: OrgContext) {
    return this.svc.processarFila(o.orgId);
  }
}
