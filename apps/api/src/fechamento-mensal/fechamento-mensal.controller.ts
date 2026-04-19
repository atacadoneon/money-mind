import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FechamentoMensalService } from './fechamento-mensal.service';
import {
  AprovarFechamentoDto, CreateChecklistItemDto, CreateFechamentoDto,
  ListFechamentosQuery, ReabrirFechamentoDto, UpdateChecklistItemDto, UpdateFechamentoDto,
} from './dto/fechamento-mensal.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('fechamento-mensal')
@ApiBearerAuth()
@Controller('fechamento-mensal')
export class FechamentoMensalController {
  constructor(private readonly svc: FechamentoMensalService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar fechamentos mensais com filtros' })
  list(@CurrentOrg() o: OrgContext, @Query() q: ListFechamentosQuery) {
    return this.svc.list(o.orgId, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar fechamento mensal com checklist' })
  async get(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.get(o.orgId, id) };
  }

  @Post()
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Criar fechamento mensal com checklist padrão' })
  async create(@CurrentOrg() o: OrgContext, @Body() dto: CreateFechamentoDto) {
    return { data: await this.svc.create(o.orgId, dto) };
  }

  @Patch(':id')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Atualizar fechamento mensal' })
  async update(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFechamentoDto,
  ) {
    return { data: await this.svc.update(o.orgId, id, dto) };
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Excluir fechamento mensal (soft delete)' })
  remove(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(o.orgId, id);
  }

  // ─── Workflow ──────────────────────────────────────────────────────────────────

  @Post(':id/iniciar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Iniciar fechamento (aberto → em_progresso)' })
  async iniciar(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.iniciar(o.orgId, id, o.userId) };
  }

  @Post(':id/revisao')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Enviar para revisão (em_progresso → revisao)' })
  async enviarRevisao(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.enviarRevisao(o.orgId, id, o.userId) };
  }

  @Post(':id/aprovar')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Aprovar fechamento (revisao → aprovado)' })
  async aprovar(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AprovarFechamentoDto,
  ) {
    return { data: await this.svc.aprovar(o.orgId, id, o.userId, dto) };
  }

  @Post(':id/fechar')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Fechar definitivamente (aprovado → fechado). Exige checklist completo.' })
  async fechar(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.fechar(o.orgId, id, o.userId) };
  }

  @Post(':id/reabrir')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Reabrir fechamento (fechado/aprovado → reaberto)' })
  async reabrir(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReabrirFechamentoDto,
  ) {
    return { data: await this.svc.reabrir(o.orgId, id, o.userId, dto) };
  }

  // ─── Checklist ─────────────────────────────────────────────────────────────────

  @Get(':id/checklist')
  @ApiOperation({ summary: 'Listar itens do checklist de um fechamento' })
  async getChecklist(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getChecklist(o.orgId, id);
  }

  @Post(':id/checklist')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Adicionar item ao checklist' })
  async addChecklistItem(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return { data: await this.svc.addChecklistItem(o.orgId, id, dto) };
  }

  @Patch('checklist/:itemId')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Atualizar item do checklist (status, observações)' })
  async updateChecklistItem(
    @CurrentOrg() o: OrgContext,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return { data: await this.svc.updateChecklistItem(o.orgId, itemId, dto) };
  }

  @Delete('checklist/:itemId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Remover item do checklist (soft delete)' })
  removeChecklistItem(
    @CurrentOrg() o: OrgContext,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.svc.removeChecklistItem(o.orgId, itemId);
  }

  // ─── Auto Checks ──────────────────────────────────────────────────────────────

  @Post(':id/auto-checks')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Executar verificações automáticas do checklist' })
  async runAutoChecks(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.runAutoChecks(o.orgId, id);
  }
}
