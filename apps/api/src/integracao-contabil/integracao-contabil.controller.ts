import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegracaoContabilService } from './integracao-contabil.service';
import {
  CalendarioFiscalQuery, CreateProvisaoDto, GerarExportacaoDto,
  ListExportacoesQuery, ListProvisoesQuery, UpdateProvisaoDto,
} from './dto/integracao-contabil.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('integracao-contabil')
@ApiBearerAuth()
@Controller('integracao-contabil')
export class IntegracaoContabilController {
  constructor(private readonly svc: IntegracaoContabilService) {}

  // ─── Exportações ──────────────────────────────────────────────────────────

  @Get('exportacoes')
  @ApiOperation({ summary: 'Listar exportações contábeis' })
  listExportacoes(@CurrentOrg() o: OrgContext, @Query() q: ListExportacoesQuery) {
    return this.svc.listExportacoes(o.orgId, q);
  }

  @Get('exportacoes/:id')
  async getExportacao(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.getExportacao(o.orgId, id) };
  }

  @Post('exportacoes')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Gerar exportação contábil (CSV/formato específico)' })
  async gerarExportacao(@CurrentOrg() o: OrgContext, @Body() dto: GerarExportacaoDto) {
    return { data: await this.svc.gerarExportacao(o.orgId, o.userId, dto) };
  }

  // ─── Provisões ────────────────────────────────────────────────────────────

  @Get('provisoes')
  @ApiOperation({ summary: 'Listar provisões de impostos' })
  listProvisoes(@CurrentOrg() o: OrgContext, @Query() q: ListProvisoesQuery) {
    return this.svc.listProvisoes(o.orgId, q);
  }

  @Post('provisoes')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Criar provisão de imposto (calcula valor automaticamente)' })
  async createProvisao(@CurrentOrg() o: OrgContext, @Body() dto: CreateProvisaoDto) {
    return { data: await this.svc.createProvisao(o.orgId, dto) };
  }

  @Patch('provisoes/:id')
  @Roles('owner', 'admin', 'accountant')
  async updateProvisao(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProvisaoDto,
  ) {
    return { data: await this.svc.updateProvisao(o.orgId, id, dto) };
  }

  @Delete('provisoes/:id')
  @Roles('owner', 'admin')
  removeProvisao(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeProvisao(o.orgId, id);
  }

  // ─── Calendário Fiscal ────────────────────────────────────────────────────

  @Get('calendario-fiscal')
  @ApiOperation({ summary: 'Calendário fiscal com datas de vencimento' })
  calendarioFiscal(@CurrentOrg() o: OrgContext, @Query() q: CalendarioFiscalQuery) {
    return this.svc.calendarioFiscal(o.orgId, q);
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────

  @Get('resumo-impostos/:companyId')
  @ApiOperation({ summary: 'Resumo de impostos por tipo (provisionado vs pago)' })
  resumoImpostos(
    @CurrentOrg() o: OrgContext,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('competencia') competencia?: string,
  ) {
    return this.svc.resumoImpostos(o.orgId, companyId, competencia);
  }
}
