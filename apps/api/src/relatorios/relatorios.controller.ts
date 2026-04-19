import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RelatoriosService } from './relatorios.service';
import { CurrentOrg, OrgContext } from '../auth/decorators/current-org.decorator';

@ApiTags('relatorios')
@ApiBearerAuth()
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly svc: RelatoriosService) {}

  @Get('dre')
  @ApiOperation({ summary: 'DRE hierárquico com receitas e despesas por categoria' })
  @ApiQuery({ name: 'company_id', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getDre(
    @CurrentOrg() org: OrgContext,
    @Query('company_id') companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getDre(org.orgId, companyId, from, to);
  }

  @Get('fluxo-caixa')
  @ApiOperation({ summary: 'Projeção de fluxo de caixa baseado em CR/CP abertas' })
  @ApiQuery({ name: 'company_id', required: true })
  @ApiQuery({ name: 'dias', required: false, example: 90 })
  @ApiQuery({ name: 'agrupamento', required: false, enum: ['dia', 'semana', 'mes'] })
  getFluxoCaixa(
    @CurrentOrg() org: OrgContext,
    @Query('company_id') companyId: string,
    @Query('dias') dias?: string,
    @Query('agrupamento') agrupamento?: 'dia' | 'semana' | 'mes',
  ) {
    return this.svc.getFluxoCaixa(org.orgId, companyId, dias ? Number(dias) : 90, agrupamento ?? 'dia');
  }

  @Get('por-categoria')
  @ApiOperation({ summary: 'Top categorias por valor agregado' })
  @ApiQuery({ name: 'company_id', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'tipo', required: false, enum: ['despesa', 'receita'] })
  getPorCategoria(
    @CurrentOrg() org: OrgContext,
    @Query('company_id') companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tipo') tipo?: 'despesa' | 'receita',
  ) {
    return this.svc.getPorCategoria(org.orgId, companyId, from, to, tipo ?? 'despesa');
  }

  @Get('top-contatos')
  @ApiOperation({ summary: 'Top contatos por volume financeiro' })
  @ApiQuery({ name: 'company_id', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'tipo', required: false, enum: ['fornecedor', 'cliente'] })
  @ApiQuery({ name: 'limit', required: false })
  getTopContatos(
    @CurrentOrg() org: OrgContext,
    @Query('company_id') companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('tipo') tipo?: 'fornecedor' | 'cliente',
    @Query('limit') limit?: string,
  ) {
    return this.svc.getTopContatos(org.orgId, companyId, from, to, tipo ?? 'cliente', limit ? Number(limit) : 10);
  }

  @Get('dre.pdf')
  @ApiOperation({ summary: 'Download do DRE em PDF (layout básico)' })
  @ApiQuery({ name: 'company_id', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async getDrePdf(
    @CurrentOrg() org: OrgContext,
    @Query('company_id') companyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const dre = await this.svc.getDre(org.orgId, companyId, from, to);

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DRE ${from} - ${to}</title>
<style>body{font-family:Arial,sans-serif;margin:40px}h1{color:#1a1a2e}table{width:100%;border-collapse:collapse}
th,td{padding:8px 12px;border:1px solid #ddd}th{background:#f4f4f4}
.total{font-weight:bold;background:#e8f4f8}.result{font-weight:bold;font-size:1.1em}</style></head>
<body>
<h1>Demonstrativo de Resultado do Exercício</h1>
<p>Período: ${from} a ${to}</p>
<table>
  <tr><th>Descrição</th><th>Valor (R$)</th></tr>
  <tr><td colspan="2"><strong>RECEITAS</strong></td></tr>
  ${dre.receitas.map((r) => `<tr><td>${r.categoriaNome}</td><td>${r.total.toFixed(2)}</td></tr>`).join('')}
  <tr class="total"><td>Total Receitas</td><td>${dre.totalReceitas.toFixed(2)}</td></tr>
  <tr><td colspan="2"><strong>DESPESAS</strong></td></tr>
  ${dre.despesas.map((d) => `<tr><td>${d.categoriaNome}</td><td>${d.total.toFixed(2)}</td></tr>`).join('')}
  <tr class="total"><td>Total Despesas</td><td>${dre.totalDespesas.toFixed(2)}</td></tr>
  <tr class="result"><td>RESULTADO LÍQUIDO</td><td>${dre.resultadoLiquido.toFixed(2)}</td></tr>
</table>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dre-${from}-${to}.html"`);
    res.send(html);
  }
}
