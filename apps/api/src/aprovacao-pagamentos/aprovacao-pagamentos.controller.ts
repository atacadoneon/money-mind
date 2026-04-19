import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AprovacaoPagamentosService } from './aprovacao-pagamentos.service';
import {
  AprovarDto, CreateAlcadaDto, ListAprovacoesQuery,
  RejeitarDto, SolicitarAprovacaoDto, UpdateAlcadaDto,
} from './dto/aprovacao-pagamentos.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('aprovacao-pagamentos')
@ApiBearerAuth()
@Controller('aprovacao-pagamentos')
export class AprovacaoPagamentosController {
  constructor(private readonly svc: AprovacaoPagamentosService) {}

  // ─── Alçadas ────────────────────────────────────────────────────────────────

  @Get('alcadas')
  @ApiOperation({ summary: 'Listar alçadas de aprovação' })
  listAlcadas(@CurrentOrg() o: OrgContext, @Query('companyId') companyId?: string) {
    return this.svc.listAlcadas(o.orgId, companyId);
  }

  @Post('alcadas')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Criar alçada de aprovação' })
  async createAlcada(@CurrentOrg() o: OrgContext, @Body() dto: CreateAlcadaDto) {
    return { data: await this.svc.createAlcada(o.orgId, dto) };
  }

  @Patch('alcadas/:id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Atualizar alçada' })
  async updateAlcada(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlcadaDto,
  ) {
    return { data: await this.svc.updateAlcada(o.orgId, id, dto) };
  }

  @Delete('alcadas/:id')
  @Roles('owner', 'admin')
  removeAlcada(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeAlcada(o.orgId, id);
  }

  // ─── Aprovações ─────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar aprovações com filtros' })
  list(@CurrentOrg() o: OrgContext, @Query() q: ListAprovacoesQuery) {
    return this.svc.listAprovacoes(o.orgId, q);
  }

  @Get('pendentes')
  @ApiOperation({ summary: 'Listar aprovações pendentes (ordenadas por valor DESC)' })
  pendentes(@CurrentOrg() o: OrgContext, @Query('companyId') companyId?: string) {
    return this.svc.listarPendentes(o.orgId, companyId);
  }

  @Post('solicitar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Solicitar aprovação de pagamento (encontra alçada automática)' })
  async solicitar(@CurrentOrg() o: OrgContext, @Body() dto: SolicitarAprovacaoDto) {
    return { data: await this.svc.solicitar(o.orgId, o.userId, dto) };
  }

  @Post(':id/aprovar')
  @ApiOperation({ summary: 'Aprovar pagamento (valida nível de acesso vs alçada)' })
  async aprovar(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AprovarDto,
  ) {
    return { data: await this.svc.aprovar(o.orgId, id, o.userId, o.role, dto) };
  }

  @Post(':id/rejeitar')
  @ApiOperation({ summary: 'Rejeitar pagamento (motivo obrigatório)' })
  async rejeitar(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejeitarDto,
  ) {
    return { data: await this.svc.rejeitar(o.orgId, id, o.userId, dto) };
  }

  @Post('expirar')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Expirar aprovações pendentes há mais de 48h' })
  expirar(@CurrentOrg() o: OrgContext) {
    return this.svc.expirarVencidas(o.orgId);
  }
}
