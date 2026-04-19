import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';

export interface DreCategoria {
  categoriaId: string | null;
  categoriaNome: string;
  total: number;
}

export interface DreResult {
  periodo: { from: string; to: string };
  receitas: DreCategoria[];
  despesas: DreCategoria[];
  totalReceitas: number;
  totalDespesas: number;
  resultadoOperacional: number;
  resultadoLiquido: number;
  comparativo?: {
    totalReceitas: number;
    totalDespesas: number;
    resultadoLiquido: number;
  };
}

export interface FluxoCaixaLinha {
  data: string;
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

@Injectable()
export class RelatoriosService {
  constructor(
    @InjectRepository(ContaPagar) private readonly cpRepo: Repository<ContaPagar>,
    @InjectRepository(ContaReceber) private readonly crRepo: Repository<ContaReceber>,
  ) {}

  async getDre(
    orgId: string,
    companyId: string,
    from: string,
    to: string,
  ): Promise<DreResult> {
    const crRows = await this.crRepo
      .createQueryBuilder('cr')
      .select(['cr.categoria_id as categoria_id', 'COALESCE(SUM(cr.valor_recebido::numeric), 0) as total'])
      .where(
        'cr.org_id = :orgId AND cr.company_id = :cid AND cr.deleted_at IS NULL AND cr.situacao = :sit AND cr.data_recebimento BETWEEN :from AND :to',
        { orgId, cid: companyId, sit: 'recebido', from, to },
      )
      .groupBy('cr.categoria_id')
      .getRawMany<{ categoria_id: string | null; total: string }>();

    const cpRows = await this.cpRepo
      .createQueryBuilder('cp')
      .select(['cp.categoria_id as categoria_id', 'COALESCE(SUM(cp.valor_pago::numeric), 0) as total'])
      .where(
        'cp.org_id = :orgId AND cp.company_id = :cid AND cp.deleted_at IS NULL AND cp.situacao = :sit AND cp.data_pagamento BETWEEN :from AND :to',
        { orgId, cid: companyId, sit: 'pago', from, to },
      )
      .groupBy('cp.categoria_id')
      .getRawMany<{ categoria_id: string | null; total: string }>();

    const receitas: DreCategoria[] = crRows.map((r) => ({
      categoriaId: r.categoria_id,
      categoriaNome: r.categoria_id ?? 'Sem categoria',
      total: Number(r.total),
    }));

    const despesas: DreCategoria[] = cpRows.map((r) => ({
      categoriaId: r.categoria_id,
      categoriaNome: r.categoria_id ?? 'Sem categoria',
      total: Number(r.total),
    }));

    const totalReceitas = receitas.reduce((acc, r) => acc + r.total, 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + d.total, 0);
    const resultadoOperacional = totalReceitas - totalDespesas;

    return {
      periodo: { from, to },
      receitas,
      despesas,
      totalReceitas,
      totalDespesas,
      resultadoOperacional,
      resultadoLiquido: resultadoOperacional,
    };
  }

  async getFluxoCaixa(
    orgId: string,
    companyId: string,
    dias = 90,
    agrupamento: 'dia' | 'semana' | 'mes' = 'dia',
  ): Promise<FluxoCaixaLinha[]> {
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const to = new Date(today.getTime() + dias * 86400000).toISOString().split('T')[0];

    // CR abertas futuras (entradas projetadas)
    const crRows = await this.crRepo
      .createQueryBuilder('cr')
      .select([
        'cr.data_vencimento as data',
        'SUM(cr.valor::numeric) as valor',
      ])
      .where(
        'cr.org_id = :orgId AND cr.company_id = :cid AND cr.deleted_at IS NULL AND cr.situacao = :sit AND cr.data_vencimento BETWEEN :from AND :to',
        { orgId, cid: companyId, sit: 'aberto', from, to },
      )
      .groupBy('cr.data_vencimento')
      .getRawMany<{ data: string; valor: string }>();

    // CP abertas futuras (saídas projetadas)
    const cpRows = await this.cpRepo
      .createQueryBuilder('cp')
      .select([
        'cp.data_vencimento as data',
        'SUM(cp.valor::numeric) as valor',
      ])
      .where(
        'cp.org_id = :orgId AND cp.company_id = :cid AND cp.deleted_at IS NULL AND cp.situacao = :sit AND cp.data_vencimento BETWEEN :from AND :to',
        { orgId, cid: companyId, sit: 'aberto', from, to },
      )
      .groupBy('cp.data_vencimento')
      .getRawMany<{ data: string; valor: string }>();

    const entradasMap = new Map<string, number>();
    const saidasMap = new Map<string, number>();

    for (const r of crRows) entradasMap.set(r.data, (entradasMap.get(r.data) ?? 0) + Number(r.valor));
    for (const r of cpRows) saidasMap.set(r.data, (saidasMap.get(r.data) ?? 0) + Number(r.valor));

    const allDates = new Set([...entradasMap.keys(), ...saidasMap.keys()]);
    const sorted = Array.from(allDates).sort();

    let saldoAcumulado = 0;
    const linhas: FluxoCaixaLinha[] = sorted.map((data) => {
      const entradas = entradasMap.get(data) ?? 0;
      const saidas = saidasMap.get(data) ?? 0;
      saldoAcumulado += entradas - saidas;
      return { data, entradas, saidas, saldoAcumulado };
    });

    return linhas;
  }

  async getPorCategoria(
    orgId: string,
    companyId: string,
    from: string,
    to: string,
    tipo: 'despesa' | 'receita',
  ) {
    if (tipo === 'receita') {
      const rows = await this.crRepo
        .createQueryBuilder('cr')
        .select(['cr.categoria_id as categoria_id', 'COALESCE(SUM(cr.valor_recebido::numeric), 0) as total'])
        .where(
          'cr.org_id = :orgId AND cr.company_id = :cid AND cr.deleted_at IS NULL AND cr.data_recebimento BETWEEN :from AND :to',
          { orgId, cid: companyId, from, to },
        )
        .groupBy('cr.categoria_id')
        .orderBy('total', 'DESC')
        .getRawMany<{ categoria_id: string | null; total: string }>();
      return rows.map((r) => ({ categoriaId: r.categoria_id, total: Number(r.total) }));
    }

    const rows = await this.cpRepo
      .createQueryBuilder('cp')
      .select(['cp.categoria_id as categoria_id', 'COALESCE(SUM(cp.valor_pago::numeric), 0) as total'])
      .where(
        'cp.org_id = :orgId AND cp.company_id = :cid AND cp.deleted_at IS NULL AND cp.data_pagamento BETWEEN :from AND :to',
        { orgId, cid: companyId, from, to },
      )
      .groupBy('cp.categoria_id')
      .orderBy('total', 'DESC')
      .getRawMany<{ categoria_id: string | null; total: string }>();
    return rows.map((r) => ({ categoriaId: r.categoria_id, total: Number(r.total) }));
  }

  async getTopContatos(
    orgId: string,
    companyId: string,
    from: string,
    to: string,
    tipo: 'fornecedor' | 'cliente',
    limit = 10,
  ) {
    if (tipo === 'cliente') {
      const rows = await this.crRepo
        .createQueryBuilder('cr')
        .select(['cr.contato_id as contato_id', 'COALESCE(SUM(cr.valor::numeric), 0) as total'])
        .where(
          'cr.org_id = :orgId AND cr.company_id = :cid AND cr.deleted_at IS NULL AND cr.data_vencimento BETWEEN :from AND :to',
          { orgId, cid: companyId, from, to },
        )
        .groupBy('cr.contato_id')
        .orderBy('total', 'DESC')
        .limit(limit)
        .getRawMany<{ contato_id: string | null; total: string }>();
      return rows.map((r) => ({ contatoId: r.contato_id, total: Number(r.total) }));
    }

    const rows = await this.cpRepo
      .createQueryBuilder('cp')
        .select(['cp.contato_id as contato_id', 'COALESCE(SUM(cp.valor::numeric), 0) as total'])
      .where(
        'cp.org_id = :orgId AND cp.company_id = :cid AND cp.deleted_at IS NULL AND cp.data_vencimento BETWEEN :from AND :to',
        { orgId, cid: companyId, from, to },
      )
        .groupBy('cp.contato_id')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany<{ contato_id: string | null; total: string }>();
    return rows.map((r) => ({ contatoId: r.contato_id, total: Number(r.total) }));
  }
}
