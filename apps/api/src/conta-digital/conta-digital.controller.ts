import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ContaDigitalService } from './conta-digital.service';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';

@ApiTags('conta-digital')
@ApiBearerAuth()
@Controller('conta-digital')
export class ContaDigitalController {
  constructor(private readonly svc: ContaDigitalService) {}

  @Get('contas')
  @ApiOperation({ summary: 'Lista contas bancárias com saldo calculado' })
  @ApiQuery({ name: 'company_id', required: true })
  getContas(@CurrentOrg() org: OrgContext, @Query('company_id') companyId: string) {
    return this.svc.getContas(org.orgId, companyId);
  }

  @Get('transacoes')
  @ApiOperation({ summary: 'Últimas transações de uma conta bancária' })
  @ApiQuery({ name: 'conta_id', required: true })
  @ApiQuery({ name: 'limit', required: false })
  getTransacoes(
    @CurrentOrg() org: OrgContext,
    @Query('conta_id') contaId: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getTransacoes(org.orgId, contaId, limit ? Number(limit) : 30);
  }

  @Get('saldo-consolidado')
  @ApiOperation({ summary: 'Saldo consolidado de todas as contas da empresa' })
  @ApiQuery({ name: 'company_id', required: true })
  getSaldoConsolidado(@CurrentOrg() org: OrgContext, @Query('company_id') companyId: string) {
    return this.svc.getSaldoConsolidado(org.orgId, companyId);
  }
}
