import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalClienteService } from './portal-cliente.service';
import {
  CriarMensagemDto, CriarPendenciaDto, CriarSessaoDto,
  ListMensagensQuery, ListPendenciasQuery, ResolverPendenciaDto,
} from './dto/portal-cliente.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('portal-cliente')
@ApiBearerAuth()
@Controller('portal-cliente')
export class PortalClienteController {
  constructor(private readonly svc: PortalClienteService) {}

  // ─── Sessões ──────────────────────────────────────────────────────────────

  @Post('sessoes')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Criar sessão de portal para cliente' })
  async criarSessao(@CurrentOrg() o: OrgContext, @Body() dto: CriarSessaoDto) {
    return { data: await this.svc.criarSessao(o.orgId, dto) };
  }

  @Post('sessoes/validar')
  @ApiOperation({ summary: 'Validar token de sessão do portal' })
  async validarSessao(@Body('token') token: string) {
    const sessao = await this.svc.validarSessao(token);
    return { data: sessao, valid: !!sessao };
  }

  @Delete('sessoes/:id')
  @Roles('owner', 'admin')
  expirarSessao(@CurrentOrg() _o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.expirarSessao(id);
  }

  // ─── Pendências ───────────────────────────────────────────────────────────

  @Get('pendencias')
  @ApiOperation({ summary: 'Listar pendências do portal' })
  listPendencias(@CurrentOrg() o: OrgContext, @Query() q: ListPendenciasQuery) {
    return this.svc.listPendencias(o.orgId, q);
  }

  @Post('pendencias')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Criar pendência para cliente resolver' })
  async criarPendencia(@CurrentOrg() o: OrgContext, @Body() dto: CriarPendenciaDto) {
    return { data: await this.svc.criarPendencia(o.orgId, dto) };
  }

  @Post('pendencias/:id/resolver')
  @ApiOperation({ summary: 'Resolver pendência' })
  async resolverPendencia(
    @CurrentOrg() o: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverPendenciaDto,
  ) {
    return { data: await this.svc.resolverPendencia(o.orgId, id, dto) };
  }

  @Post('pendencias/:id/cancelar')
  @Roles('owner', 'admin')
  async cancelarPendencia(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.cancelarPendencia(o.orgId, id) };
  }

  // ─── Mensagens ────────────────────────────────────────────────────────────

  @Get('mensagens')
  @ApiOperation({ summary: 'Listar mensagens do portal' })
  listMensagens(@CurrentOrg() o: OrgContext, @Query() q: ListMensagensQuery) {
    return this.svc.listMensagens(o.orgId, q);
  }

  @Post('mensagens')
  @ApiOperation({ summary: 'Enviar mensagem no portal' })
  async enviarMensagem(@CurrentOrg() o: OrgContext, @Body() dto: CriarMensagemDto) {
    return { data: await this.svc.enviarMensagem(o.orgId, dto) };
  }

  @Patch('mensagens/:id/lida')
  @ApiOperation({ summary: 'Marcar mensagem como lida' })
  async marcarLida(@CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.svc.marcarLida(o.orgId, id) };
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard/:companyId')
  @ApiOperation({ summary: 'Dashboard resumo do cliente' })
  dashboard(@CurrentOrg() o: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.svc.dashboard(o.orgId, companyId);
  }
}
