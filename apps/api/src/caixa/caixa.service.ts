import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';

export interface SaldoCaixa {
  saldoAtual: number;
  entradasDia: number;
  saidasDia: number;
  saldoInicialDia: number;
}

export interface LancamentoCaixa {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  origem: 'conta_receber' | 'conta_pagar' | 'extrato';
  referenciaId?: string;
}

@Injectable()
export class CaixaService {
  constructor(
    @InjectRepository(ContaPagar) private readonly cpRepo: Repository<ContaPagar>,
    @InjectRepository(ContaReceber) private readonly crRepo: Repository<ContaReceber>,
  ) {}

  async getSaldo(orgId: string, companyId: string): Promise<SaldoCaixa> {
    const today = new Date().toISOString().split('T')[0];

    const entradas = await this.crRepo
      .createQueryBuilder('cr')
      .select('COALESCE(SUM(cr.valor_recebido::numeric), 0)', 'total')
      .where('cr.org_id = :orgId AND cr.company_id = :cid AND cr.data_recebimento = :today AND cr.deleted_at IS NULL', {
        orgId, cid: companyId, today,
      })
      .getRawOne<{ total: string }>();

    const saidas = await this.cpRepo
      .createQueryBuilder('cp')
      .select('COALESCE(SUM(cp.valor_pago::numeric), 0)', 'total')
      .where('cp.org_id = :orgId AND cp.company_id = :cid AND cp.data_pagamento = :today AND cp.deleted_at IS NULL', {
        orgId, cid: companyId, today,
      })
      .getRawOne<{ total: string }>();

    const totalCR = await this.crRepo
      .createQueryBuilder('cr')
      .select('COALESCE(SUM(cr.valor_recebido::numeric), 0)', 'total')
      .where('cr.org_id = :orgId AND cr.company_id = :cid AND cr.data_recebimento <= :today AND cr.deleted_at IS NULL', {
        orgId, cid: companyId, today,
      })
      .getRawOne<{ total: string }>();

    const totalCP = await this.cpRepo
      .createQueryBuilder('cp')
      .select('COALESCE(SUM(cp.valor_pago::numeric), 0)', 'total')
      .where('cp.org_id = :orgId AND cp.company_id = :cid AND cp.data_pagamento <= :today AND cp.deleted_at IS NULL', {
        orgId, cid: companyId, today,
      })
      .getRawOne<{ total: string }>();

    const entradasDia = Number(entradas?.total ?? 0);
    const saidasDia = Number(saidas?.total ?? 0);
    const saldoAtual = Number(totalCR?.total ?? 0) - Number(totalCP?.total ?? 0);
    const saldoInicialDia = saldoAtual - entradasDia + saidasDia;

    return { saldoAtual, entradasDia, saidasDia, saldoInicialDia };
  }

  async getLancamentos(
    orgId: string,
    companyId: string,
    filters: { from?: string; to?: string; tipo?: string; page?: number; limit?: number },
  ): Promise<{ data: LancamentoCaixa[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const crQb = this.crRepo
      .createQueryBuilder('cr')
      .select([
        'cr.id as id',
        'cr.data_recebimento as data',
        "'entrada' as tipo",
        'cr.valor_recebido::numeric as valor',
        'cr.historico as descricao',
        "'conta_receber' as origem",
        'cr.id as referencia_id',
      ])
      .where('cr.org_id = :orgId AND cr.company_id = :cid AND cr.deleted_at IS NULL AND cr.situacao = :sit', {
        orgId, cid: companyId, sit: 'recebido',
      });

    const cpQb = this.cpRepo
      .createQueryBuilder('cp')
      .select([
        'cp.id as id',
        'cp.data_pagamento as data',
        "'saida' as tipo",
        'cp.valor_pago::numeric as valor',
        'cp.historico as descricao',
        "'conta_pagar' as origem",
        'cp.id as referencia_id',
      ])
      .where('cp.org_id = :orgId AND cp.company_id = :cid AND cp.deleted_at IS NULL AND cp.situacao = :sit', {
        orgId, cid: companyId, sit: 'pago',
      });

    if (filters.from) {
      crQb.andWhere('cr.data_recebimento >= :from', { from: filters.from });
      cpQb.andWhere('cp.data_pagamento >= :from', { from: filters.from });
    }
    if (filters.to) {
      crQb.andWhere('cr.data_recebimento <= :to', { to: filters.to });
      cpQb.andWhere('cp.data_pagamento <= :to', { to: filters.to });
    }

    const [crRows, cpRows] = await Promise.all([crQb.getRawMany(), cpQb.getRawMany()]);

    const all: LancamentoCaixa[] = [
      ...crRows.map((r) => ({
        id: r.id as string,
        data: r.data as string,
        tipo: 'entrada' as const,
        valor: Number(r.valor),
        descricao: (r.descricao ?? '') as string,
        origem: 'conta_receber' as const,
        referenciaId: r.referencia_id as string,
      })),
      ...cpRows.map((r) => ({
        id: r.id as string,
        data: r.data as string,
        tipo: 'saida' as const,
        valor: Number(r.valor),
        descricao: (r.descricao ?? '') as string,
        origem: 'conta_pagar' as const,
        referenciaId: r.referencia_id as string,
      })),
    ].filter((l) => !filters.tipo || l.tipo === filters.tipo)
      .sort((a, b) => b.data.localeCompare(a.data));

    const total = all.length;
    const data = all.slice((page - 1) * limit, page * limit);
    return { data, total };
  }
}
