import {
  Body, Controller, Get, Param, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SaneamentoCadastralService } from './saneamento-cadastral.service';
import {
  ConfirmarDuplicataDto, DescartarDuplicataDto,
  ListDuplicatasQuery, MergeDuplicataDto, ScanearDto,
} from './dto/saneamento-cadastral.dto';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('saneamento-cadastral')
@ApiBearerAuth()
@Controller('saneamento-cadastral')
export class SaneamentoCadastralController {
  constructor(private readonly svc: SaneamentoCadastralService) {}

  @Get('duplicatas')
  @ApiOperation({ summary: 'Listar duplicatas detectadas' })
  listDuplicatas(@CurrentOrg() o: OrgContext, @Query() q: ListDuplicatasQuery) {
    return this.svc.listDuplicatas(o.orgId, q);
  }

  @Post('scanear')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Escanear base para encontrar duplicatas (pg_trgm)' })
  scanear(@CurrentOrg() o: OrgContext, @Body() dto: ScanearDto) {
    return this.svc.scanear(o.orgId, o.userId, dto);
  }

  @Post('duplicatas/:id/confirmar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Confirmar que é duplicata real' })
  async confirmar(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarDuplicataDto,
  ) {
    return { data: await this.svc.confirmar(o.orgId, id, o.userId, dto) };
  }

  @Post('duplicatas/:id/descartar')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Descartar detecção (falso positivo)' })
  async descartar(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DescartarDuplicataDto,
  ) {
    return { data: await this.svc.descartar(o.orgId, id, o.userId, dto) };
  }

  @Post('duplicatas/:id/merge')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Merge: mantém vencedor, reatribui referências, soft-delete perdedor' })
  async merge(
    @CurrentOrg() o: OrgContext, @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergeDuplicataDto,
  ) {
    return { data: await this.svc.merge(o.orgId, id, o.userId, dto) };
  }

  @Get('score/:companyId')
  @ApiOperation({ summary: 'Score de qualidade da base (0-100)' })
  getScore(@CurrentOrg() o: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.svc.getScore(o.orgId, companyId);
  }

  @Post('score/:companyId/calcular')
  @Roles('owner', 'admin', 'accountant')
  @ApiOperation({ summary: 'Recalcular score de qualidade' })
  calcularScore(@CurrentOrg() o: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.svc.calcularScore(o.orgId, companyId);
  }

  @Get('score/:companyId/historico')
  @ApiOperation({ summary: 'Histórico de scores (evolução)' })
  historicoScores(@CurrentOrg() o: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.svc.historicoScores(o.orgId, companyId);
  }
}
