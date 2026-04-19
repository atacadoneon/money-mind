import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaPagar } from '../../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { ExtratoLinha } from '../../extratos-bancarios/entities/extrato-linha.entity';
import { MatchCandidate, ReconciliationResult } from './match-result';

const VALUE_TOLERANCE = 0.5;
const DAYS_TOLERANCE = 3;

@Injectable()
export class ReconciliationEngine {
  private readonly logger = new Logger('ReconciliationEngine');

  constructor(
    @InjectRepository(ContaPagar) private readonly cps: Repository<ContaPagar>,
    @InjectRepository(ContaReceber) private readonly crs: Repository<ContaReceber>,
    @InjectRepository(ExtratoLinha) private readonly linhas: Repository<ExtratoLinha>,
  ) {}

  private addDays(d: string, days: number): string {
    const dt = new Date(`${d}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  /**
   * Run 4-layer matching for a single extrato linha.
   * Layer 1: exact (valor == e data == dataVencimento)
   * Layer 2: tolerance (|valor| <= R$ 0.50, |data| <= 3 dias)
   * Layer 3: pattern (trigram similarity via ILIKE + fornecedor/cliente history)
   * Layer 4: AI suggest (stub)
   */
  async matchLinha(orgId: string, linha: ExtratoLinha): Promise<ReconciliationResult> {
    const isCredito = linha.tipo === 'credito';
    const valor = Number(linha.valor);
    const candidates: MatchCandidate[] = [];

    // Layer 1: exact
    if (isCredito) {
      const rows = await this.crs.createQueryBuilder('cr')
        .where('cr.org_id = :orgId AND cr.deleted_at IS NULL', { orgId })
        .andWhere("cr.situacao IN ('aberto','parcial','atrasado')")
        .andWhere('cr.valor = :v', { v: valor })
        .andWhere('cr.data_vencimento = :d', { d: linha.dataMovimento })
        .limit(5).getMany();
      for (const r of rows) candidates.push({
        kind: 'contaReceber', id: r.id, valor: Number(r.valor),
        dataVencimento: r.dataVencimento, historico: r.historico ?? '', contatoId: r.contatoId,
        confidence: 1.0, strategy: 'exact', reason: 'Valor e data exatos',
      });
    } else {
      const rows = await this.cps.createQueryBuilder('cp')
        .where('cp.org_id = :orgId AND cp.deleted_at IS NULL', { orgId })
        .andWhere("cp.situacao IN ('aberto','parcial','atrasado')")
        .andWhere('cp.valor = :v', { v: valor })
        .andWhere('cp.data_vencimento = :d', { d: linha.dataMovimento })
        .limit(5).getMany();
      for (const r of rows) candidates.push({
        kind: 'contaPagar', id: r.id, valor: Number(r.valor),
        dataVencimento: r.dataVencimento, historico: r.historico ?? '', contatoId: r.contatoId,
        confidence: 1.0, strategy: 'exact', reason: 'Valor e data exatos',
      });
    }
    if (candidates.length > 0) return { linhaId: linha.id, candidates, best: candidates[0] };

    // Layer 2: tolerance
    const dateFrom = this.addDays(linha.dataMovimento, -DAYS_TOLERANCE);
    const dateTo = this.addDays(linha.dataMovimento, DAYS_TOLERANCE);
    if (isCredito) {
      const rows = await this.crs.createQueryBuilder('cr')
        .where('cr.org_id = :orgId AND cr.deleted_at IS NULL', { orgId })
        .andWhere("cr.situacao IN ('aberto','parcial','atrasado')")
        .andWhere('cr.valor BETWEEN :vmin AND :vmax', { vmin: valor - VALUE_TOLERANCE, vmax: valor + VALUE_TOLERANCE })
        .andWhere('cr.data_vencimento BETWEEN :df AND :dt', { df: dateFrom, dt: dateTo })
        .limit(10).getMany();
      for (const r of rows) {
        const dd = Math.abs((Number(r.valor) - valor));
        const conf = 0.95 - dd / VALUE_TOLERANCE * 0.1;
        candidates.push({
          kind: 'contaReceber', id: r.id, valor: Number(r.valor),
          dataVencimento: r.dataVencimento, historico: r.historico ?? '', contatoId: r.contatoId,
          confidence: Math.max(0.7, conf), strategy: 'tolerance',
          reason: `Diferença valor R$${dd.toFixed(2)} dentro da tolerância`,
        });
      }
    } else {
      const rows = await this.cps.createQueryBuilder('cp')
        .where('cp.org_id = :orgId AND cp.deleted_at IS NULL', { orgId })
        .andWhere("cp.situacao IN ('aberto','parcial','atrasado')")
        .andWhere('cp.valor BETWEEN :vmin AND :vmax', { vmin: valor - VALUE_TOLERANCE, vmax: valor + VALUE_TOLERANCE })
        .andWhere('cp.data_vencimento BETWEEN :df AND :dt', { df: dateFrom, dt: dateTo })
        .limit(10).getMany();
      for (const r of rows) {
        const dd = Math.abs((Number(r.valor) - valor));
        const conf = 0.95 - dd / VALUE_TOLERANCE * 0.1;
        candidates.push({
          kind: 'contaPagar', id: r.id, valor: Number(r.valor),
          dataVencimento: r.dataVencimento, historico: r.historico ?? '', contatoId: r.contatoId,
          confidence: Math.max(0.7, conf), strategy: 'tolerance',
          reason: `Diferença valor R$${dd.toFixed(2)} dentro da tolerância`,
        });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      return { linhaId: linha.id, candidates, best: candidates[0] };
    }

    // Layer 3: pattern (trigram on descricao)
    const descricao = linha.descricao ?? '';
    if (descricao.length >= 3) {
      if (isCredito) {
        const rows = await this.crs.createQueryBuilder('cr')
          .where('cr.org_id = :orgId AND cr.deleted_at IS NULL', { orgId })
          .andWhere("cr.situacao IN ('aberto','parcial','atrasado')")
          .andWhere('cr.valor BETWEEN :vmin AND :vmax', { vmin: valor * 0.95, vmax: valor * 1.05 })
          .andWhere('similarity(cr.historico, :d) > 0.3', { d: descricao })
          .limit(10).getMany();
        for (const r of rows) candidates.push({
          kind: 'contaReceber', id: r.id, valor: Number(r.valor),
          dataVencimento: r.dataVencimento, historico: r.historico ?? '', contatoId: r.contatoId,
          confidence: 0.6, strategy: 'pattern', reason: 'Padrão histórico por descrição',
        });
      } else {
        const rows = await this.cps.createQueryBuilder('cp')
          .where('cp.org_id = :orgId AND cp.deleted_at IS NULL', { orgId })
          .andWhere("cp.situacao IN ('aberto','parcial','atrasado')")
          .andWhere('cp.valor BETWEEN :vmin AND :vmax', { vmin: valor * 0.95, vmax: valor * 1.05 })
          .andWhere('similarity(cp.historico, :d) > 0.3', { d: descricao })
          .limit(10).getMany();
        for (const r of rows) candidates.push({
          kind: 'contaPagar', id: r.id, valor: Number(r.valor),
          dataVencimento: r.dataVencimento, historico: r.historico ?? '', contatoId: r.contatoId,
          confidence: 0.6, strategy: 'pattern', reason: 'Padrão histórico por descrição',
        });
      }
    }

    // Layer 4: AI suggest (stub — real impl will queue via ai-suggest)
    // Leave as empty for now; worker may enrich later.

    candidates.sort((a, b) => b.confidence - a.confidence);
    return { linhaId: linha.id, candidates, best: candidates[0] };
  }

  async matchBatch(orgId: string, extratoId: string): Promise<{ processed: number; matched: number }> {
    const linhas = await this.linhas.find({ where: { orgId, extratoId, status: 'pendente' } });
    let matched = 0;
    for (const l of linhas) {
      const res = await this.matchLinha(orgId, l);
      if (res.best && res.best.confidence >= 0.9) {
        if (res.best.kind === 'contaPagar') l.matchContaPagarId = res.best.id;
        else l.matchContaReceberId = res.best.id;
        l.matchConfidence = res.best.confidence.toFixed(2);
        l.matchStrategy = res.best.strategy;
        l.status = 'conciliado';
        matched++;
      } else if (res.best) {
        if (res.best.kind === 'contaPagar') l.matchContaPagarId = res.best.id;
        else l.matchContaReceberId = res.best.id;
        l.matchConfidence = res.best.confidence.toFixed(2);
        l.matchStrategy = res.best.strategy;
        l.status = 'sugerido';
      }
      await this.linhas.save(l);
    }
    this.logger.log(`Extrato ${extratoId}: ${matched}/${linhas.length} conciliados automaticamente`);
    return { processed: linhas.length, matched };
  }
}
