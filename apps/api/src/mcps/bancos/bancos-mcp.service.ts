import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaBancaria } from '../../contas-bancarias/entities/conta-bancaria.entity';
import { ExtratoLinha } from '../../extratos-bancarios/entities/extrato-linha.entity';
import { ExtratoBancario } from '../../extratos-bancarios/entities/extrato.entity';
import { SicoobClient } from './sicoob/sicoob.client';
import { ItauClient } from './itau/itau.client';
import { BbClient } from './bb/bb.client';
import { OlistClient } from './olist/olist.client';
import { ContaSimplesClient } from './conta-simples/conta-simples.client';

export interface ExtratoLinhaNormalizada {
  fitid: string;
  dataMovimento: string;
  tipo: 'credito' | 'debito';
  valor: number;
  descricao: string;
  historico?: string;
}

@Injectable()
export class BancosMcpService {
  private readonly logger = new Logger(BancosMcpService.name);

  constructor(
    @InjectRepository(ContaBancaria)
    private readonly contasRepo: Repository<ContaBancaria>,
    @InjectRepository(ExtratoLinha)
    private readonly linhasRepo: Repository<ExtratoLinha>,
    @InjectRepository(ExtratoBancario)
    private readonly extratosRepo: Repository<ExtratoBancario>,
    private readonly sicoob: SicoobClient,
    private readonly itau: ItauClient,
    private readonly bb: BbClient,
    private readonly olist: OlistClient,
    private readonly contaSimples: ContaSimplesClient,
  ) {}

  private async getConta(contaBancariaId: string): Promise<ContaBancaria> {
    const conta = await this.contasRepo.findOne({ where: { id: contaBancariaId } });
    if (!conta) throw new NotFoundException(`Conta bancaria ${contaBancariaId} not found`);
    return conta;
  }

  private getCredentials(_conta: ContaBancaria): Record<string, string> {
    return {};
  }

  async fetchSaldo(contaBancariaId: string): Promise<{ saldo: number; dataReferencia: string }> {
    const conta = await this.getConta(contaBancariaId);
    const creds = this.getCredentials(conta);

    const codigo = conta.bancoCodigo ?? '';
    if (codigo === '756') return this.sicoob.getSaldo(creds, conta.agencia ?? '', conta.contaNumero ?? '');
    if (codigo === '341') return this.itau.getSaldo(creds, conta.agencia ?? '', conta.contaNumero ?? '');
    if (codigo === '001') return this.bb.getSaldo(creds, conta.contaNumero ?? '');
    if (conta.gatewayProvider === 'olist') return this.olist.getSaldo(creds);
    if (conta.gatewayProvider === 'conta_simples') return this.contaSimples.getSaldo(creds);
    this.logger.warn(`fetchSaldo: banco '${codigo}' sem client — retornando saldo inicial`);
    return { saldo: Number(conta.saldoAtual), dataReferencia: new Date().toISOString().split('T')[0] };
  }

  async fetchExtrato(
    contaBancariaId: string,
    params: { from: string; to: string },
  ): Promise<ExtratoLinhaNormalizada[]> {
    const conta = await this.getConta(contaBancariaId);
    const creds = this.getCredentials(conta);
    const { from, to } = params;

    let rawLinhas: unknown[] = [];
    const codigo = conta.bancoCodigo ?? '';

    if (codigo === '756') {
      rawLinhas = await this.sicoob.getExtrato(creds, conta.agencia ?? '', conta.contaNumero ?? '', from, to);
    } else if (codigo === '341') {
      rawLinhas = await this.itau.getExtrato(creds, conta.agencia ?? '', conta.contaNumero ?? '', from, to);
    } else if (codigo === '001') {
      rawLinhas = await this.bb.getExtrato(creds, conta.contaNumero ?? '', from, to);
    } else if (conta.gatewayProvider === 'olist') {
      rawLinhas = await this.olist.getExtrato(creds, from, to);
    } else if (conta.gatewayProvider === 'conta_simples') {
      rawLinhas = await this.contaSimples.getAllTransactions(creds, from, to);
    } else {
      this.logger.warn(`fetchExtrato: banco '${codigo}' sem client`);
      return [];
    }

    const normalized = this.normalizeLinhas(rawLinhas, conta.bancoCodigo ?? 'unknown');
    await this.persistLinhas(conta, normalized);
    return normalized;
  }

  async fetchExtratoAll(
    companyId: string,
    params: { from: string; to: string },
  ): Promise<{ contaId: string; linhas: ExtratoLinhaNormalizada[]; error?: string }[]> {
    const contas = await this.contasRepo.find({ where: { companyId } });
    const results = await Promise.allSettled(
      contas.map((c) =>
        this.fetchExtrato(c.id, params).then((linhas) => ({ contaId: c.id, linhas })),
      ),
    );

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { contaId: contas[i].id, linhas: [], error: String((r as PromiseRejectedResult).reason) };
    });
  }

  private normalizeLinhas(raw: unknown[], bankCode: string): ExtratoLinhaNormalizada[] {
    return raw.map((item, idx) => {
      const r = item as Record<string, unknown>;

      // Normalização multi-banco
      const valor = Number(r['amount'] ?? r['valor'] ?? r['valorLancamento'] ?? 0);
      const sinal = String(r['type'] ?? r['tipoLancamento'] ?? r['indicadorDebitoCredito'] ?? 'C');
      const tipo: 'credito' | 'debito' = (sinal === 'D' || sinal === 'DEBITO' || valor < 0) ? 'debito' : 'credito';
      const absValor = Math.abs(valor);
      const fitid = String(r['id'] ?? r['fitid'] ?? r['idLancamento'] ?? `${bankCode}-${Date.now()}-${idx}`);
      const data = String(r['date'] ?? r['dataLancamento'] ?? r['dataMovimento'] ?? new Date().toISOString().split('T')[0]);
      const descricao = String(r['description'] ?? r['descricao'] ?? r['historico'] ?? '');

      return { fitid, dataMovimento: data.substring(0, 10), tipo, valor: absValor, descricao };
    });
  }

  private async persistLinhas(conta: ContaBancaria, linhas: ExtratoLinhaNormalizada[]): Promise<void> {
    if (!linhas.length) return;

    // Busca ou cria extrato "api" para este dia
    const hoje = new Date().toISOString().split('T')[0];
    let extrato = await this.extratosRepo.findOne({
      where: { contaBancariaId: conta.id, orgId: conta.orgId },
    });

    if (!extrato) {
      extrato = await this.extratosRepo.save(
        this.extratosRepo.create({
          orgId: conta.orgId,
          companyId: conta.companyId,
          contaBancariaId: conta.id,
          nomeArquivo: `api-${conta.bancoCodigo ?? 'manual'}-${hoje}.json`,
          periodoInicio: hoje,
          periodoFim: hoje,
          totalLinhas: 0,
          status: 'processado',
          metadata: {},
        }),
      );
    }

    // Dedup por fitid
    const fitids = linhas.map((l) => l.fitid).filter(Boolean);
    const existing = fitids.length
      ? await this.linhasRepo
          .createQueryBuilder('l')
          .select('l.fitid')
          .where('l.org_id = :orgId AND l.fitid IN (:...fitids)', { orgId: conta.orgId, fitids })
          .getMany()
      : [];
    const existingFitids = new Set(existing.map((e) => e.fitid));

    const novas = linhas.filter((l) => !existingFitids.has(l.fitid));
    if (!novas.length) return;

    await this.linhasRepo.save(
      novas.map((l) =>
        this.linhasRepo.create({
          orgId: conta.orgId,
          extratoId: extrato!.id,
          contaBancariaId: conta.id,
          fitid: l.fitid,
          dataMovimento: l.dataMovimento,
          tipo: l.tipo,
          valor: String(l.valor),
          descricao: l.descricao,
          status: 'pendente',
          metadata: {},
        }),
      ),
    );

    this.logger.log(`Persistidas ${novas.length} novas linhas para conta ${conta.id}`);
  }
}
