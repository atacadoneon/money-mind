import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CaixaService } from './caixa.service';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';

@ApiTags('caixa')
@ApiBearerAuth()
@Controller('caixa')
export class CaixaController {
  constructor(private readonly svc: CaixaService) {}

  @Get('saldo')
  @ApiOperation({ summary: 'Retorna saldo atual do caixa da empresa' })
  @ApiQuery({ name: 'company_id', required: true })
  getSaldo(@CurrentOrg() org: OrgContext, @Query('company_id') companyId: string) {
    return this.svc.getSaldo(org.orgId, companyId);
  }

  @Get('lancamentos')
  @ApiOperation({ summary: 'Lista lançamentos do caixa (entradas e saídas)' })
  @ApiQuery({ name: 'company_id', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tipo', required: false, enum: ['entrada', 'saida'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getLancamentos(
    @CurrentOrg() org: OrgContext,
    @Query('company_id') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipo') tipo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getLancamentos(org.orgId, companyId, {
      from, to, tipo,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }
}
