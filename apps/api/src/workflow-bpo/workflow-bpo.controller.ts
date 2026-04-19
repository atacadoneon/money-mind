import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkflowBpoService } from './workflow-bpo.service';
import {
  AtribuirTarefaDto, CreateCarteiraDto, CreateTarefaDto,
  ListTarefasQuery, MoverTarefaDto, UpdateCarteiraDto, UpdateTarefaDto,
} from './dto/workflow-bpo.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('workflow-bpo')
@ApiBearerAuth()
@Controller('workflow-bpo')
export class WorkflowBpoController {
  constructor(private readonly svc: WorkflowBpoService) {}

  // ─── Carteiras ──────────────────────────────────────────────────────────────

  @Get('carteiras')
  @ApiOperation({ summary: 'Listar carteiras de analistas' })
  listCarteiras(@CurrentOrg() o: OrgContext) {
    return this.svc.listCarteiras(o.orgId);
  }

  @Get('carteiras/:id')
  @ApiOperation({ summary: 'Buscar carteira por ID' })
  async getCarteira(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.getCarteira(o.orgId, id) };
  }

  @Post('carteiras')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Criar carteira de analista' })
  async createCarteira(@CurrentOrg() o: OrgContext, @Body() dto: CreateCarteiraDto) {
    return { data: await this.svc.createCarteira(o.orgId, dto) };
  }

  @Patch('carteiras/:id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Atualizar carteira' })
  async updateCarteira(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCarteiraDto,
  ) {
    return { data: await this.svc.updateCarteira(o.orgId, id, dto) };
  }

  @Delete('carteiras/:id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Remover carteira (soft delete)' })
  removeCarteira(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeCarteira(o.orgId, id);
  }

  @Get('carteiras/analista/:analistaId')
  @ApiOperation({ summary: 'Listar empresas de um analista' })
  listEmpresasAnalista(
    @CurrentOrg() o: OrgContext,
    @Param('analistaId', ParseUUIDPipe) analistaId: string,
  ) {
    return this.svc.listEmpresasAnalista(o.orgId, analistaId);
  }

  // ─── Tarefas ────────────────────────────────────────────────────────────────

  @Get('tarefas')
  @ApiOperation({ summary: 'Listar tarefas com filtros' })
  listTarefas(@CurrentOrg() o: OrgContext, @Query() q: ListTarefasQuery) {
    return this.svc.listTarefas(o.orgId, q);
  }

  @Get('tarefas/fila')
  @ApiOperation({ summary: 'Fila de trabalho priorizada' })
  filaTrabalho(@CurrentOrg() o: OrgContext, @Query('analistaId') analistaId?: string) {
    return this.svc.filaTrabalho(o.orgId, analistaId);
  }

  @Get('tarefas/:id')
  @ApiOperation({ summary: 'Buscar tarefa por ID' })
  async getTarefa(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.getTarefa(o.orgId, id) };
  }

  @Post('tarefas')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Criar tarefa' })
  async createTarefa(@CurrentOrg() o: OrgContext, @Body() dto: CreateTarefaDto) {
    return { data: await this.svc.createTarefa(o.orgId, dto) };
  }

  @Patch('tarefas/:id')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Atualizar tarefa' })
  async updateTarefa(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTarefaDto,
  ) {
    return { data: await this.svc.updateTarefa(o.orgId, id, dto) };
  }

  @Delete('tarefas/:id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Remover tarefa (soft delete)' })
  removeTarefa(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeTarefa(o.orgId, id);
  }

  @Post('tarefas/:id/mover')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Mover tarefa de status (transição validada)' })
  async moverTarefa(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoverTarefaDto,
  ) {
    return { data: await this.svc.moverTarefa(o.orgId, id, dto) };
  }

  @Post('tarefas/:id/atribuir')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Atribuir tarefa a analista (valida carteira)' })
  async atribuirTarefa(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtribuirTarefaDto,
  ) {
    return { data: await this.svc.atribuirTarefa(o.orgId, id, dto) };
  }

  // ─── Métricas ───────────────────────────────────────────────────────────────

  @Get('metricas')
  @ApiOperation({ summary: 'Métricas de produtividade por analista' })
  metricas(@CurrentOrg() o: OrgContext, @Query('companyId') companyId?: string) {
    return this.svc.metricas(o.orgId, companyId);
  }
}
