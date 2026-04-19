import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlanoContasService } from './plano-contas.service';
import {
  AplicarRateioDto, CreateCentroCustoDto, CreateRegraCategorizacaoDto,
  CreateRegraRateioDto, ListCentrosCustoQuery, SugerirCategoriaDto,
  UpdateCentroCustoDto, UpdateRegraCategorizacaoDto, UpdateRegraRateioDto,
} from './dto/plano-contas.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('plano-contas')
@ApiBearerAuth()
@Controller('plano-contas')
export class PlanoContasController {
  constructor(private readonly svc: PlanoContasService) {}

  // ─── Centros de Custo ─────────────────────────────────────────────────────

  @Get('centros')
  @ApiOperation({ summary: 'Listar centros de custo' })
  listCentros(@CurrentOrg() o: OrgContext, @Query() q: ListCentrosCustoQuery) {
    return this.svc.listCentros(o.orgId, q);
  }

  @Get('centros/arvore')
  @ApiOperation({ summary: 'Árvore hierárquica de centros de custo' })
  arvore(@CurrentOrg() o: OrgContext, @Query('companyId') companyId?: string) {
    return this.svc.arvore(o.orgId, companyId);
  }

  @Get('centros/:id')
  async getCentro(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.getCentro(o.orgId, id) };
  }

  @Post('centros')
  @Roles('owner', 'admin', 'accountant')
  async createCentro(@CurrentOrg() o: OrgContext, @Body() dto: CreateCentroCustoDto) {
    return { data: await this.svc.createCentro(o.orgId, dto) };
  }

  @Patch('centros/:id')
  @Roles('owner', 'admin', 'accountant')
  async updateCentro(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCentroCustoDto,
  ) {
    return { data: await this.svc.updateCentro(o.orgId, id, dto) };
  }

  @Delete('centros/:id')
  @Roles('owner', 'admin')
  removeCentro(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeCentro(o.orgId, id);
  }

  // ─── Regras de Rateio ─────────────────────────────────────────────────────

  @Get('rateios')
  @ApiOperation({ summary: 'Listar regras de rateio' })
  listRateios(@CurrentOrg() o: OrgContext) {
    return this.svc.listRateios(o.orgId);
  }

  @Get('rateios/:id')
  async getRateio(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.getRateio(o.orgId, id) };
  }

  @Post('rateios')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Criar regra de rateio (soma itens deve ser 100%)' })
  async createRateio(@CurrentOrg() o: OrgContext, @Body() dto: CreateRegraRateioDto) {
    return { data: await this.svc.createRateio(o.orgId, dto) };
  }

  @Patch('rateios/:id')
  @Roles('owner', 'admin', 'accountant')
  async updateRateio(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegraRateioDto,
  ) {
    return { data: await this.svc.updateRateio(o.orgId, id, dto) };
  }

  @Delete('rateios/:id')
  @Roles('owner', 'admin')
  removeRateio(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeRateio(o.orgId, id);
  }

  @Post('rateios/aplicar')
  @ApiOperation({ summary: 'Aplicar rateio: distribui valor pelos centros de custo' })
  aplicarRateio(@CurrentOrg() o: OrgContext, @Body() dto: AplicarRateioDto) {
    return this.svc.aplicarRateio(o.orgId, dto);
  }

  // ─── Regras de Categorização ──────────────────────────────────────────────

  @Get('regras-categorizacao')
  @ApiOperation({ summary: 'Listar regras de categorização automática' })
  listRegras(@CurrentOrg() o: OrgContext) {
    return this.svc.listRegras(o.orgId);
  }

  @Post('regras-categorizacao')
  @Roles('owner', 'admin', 'accountant')
  async createRegra(@CurrentOrg() o: OrgContext, @Body() dto: CreateRegraCategorizacaoDto) {
    return { data: await this.svc.createRegra(o.orgId, dto) };
  }

  @Patch('regras-categorizacao/:id')
  @Roles('owner', 'admin', 'accountant')
  async updateRegra(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegraCategorizacaoDto,
  ) {
    return { data: await this.svc.updateRegra(o.orgId, id, dto) };
  }

  @Delete('regras-categorizacao/:id')
  @Roles('owner', 'admin')
  removeRegra(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeRegra(o.orgId, id);
  }

  @Post('sugerir-categoria')
  @ApiOperation({ summary: 'Sugerir categoria/centro de custo baseado em regras' })
  sugerirCategoria(@CurrentOrg() o: OrgContext, @Body() dto: SugerirCategoriaDto) {
    return this.svc.sugerirCategoria(o.orgId, dto);
  }
}
