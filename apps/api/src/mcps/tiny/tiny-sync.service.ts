import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaPagar } from '../../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { Contato } from '../../contatos/entities/contato.entity';
import { Company } from '../../companies/entities/company.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { TinyV2Client, TinyBaixarCP } from './tiny-v2.client';
import { TinyV3Client } from './tiny-v3.client';

export interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class TinySyncService {
  private readonly logger = new Logger('TinySyncService');

  constructor(
    @InjectRepository(ContaPagar) private readonly cpRepo: Repository<ContaPagar>,
    @InjectRepository(ContaReceber) private readonly crRepo: Repository<ContaReceber>,
    @InjectRepository(Contato) private readonly contatoRepo: Repository<Contato>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    private readonly v2: TinyV2Client,
    private readonly v3: TinyV3Client,
    private readonly encryption: EncryptionService,
  ) {}

  private async getTokenV2(companyId: string): Promise<{ token: string; orgId: string }> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);
    const encrypted = (company.settings as Record<string, string>)?.tinyTokenEncrypted;
    if (!encrypted) throw new Error(`Company ${companyId} sem settings.tinyTokenEncrypted configurado`);
    return { token: this.encryption.decrypt(encrypted), orgId: company.orgId };
  }

  private async getTokenV3(companyId: string): Promise<{ token: string; orgId: string }> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);
    const encrypted = (company.settings as Record<string, string>)?.tinyTokenEncrypted;
    if (!encrypted) throw new Error(`Company ${companyId} sem settings.tinyTokenEncrypted configurado`);
    return { token: this.encryption.decrypt(encrypted), orgId: company.orgId };
  }

  /** Sync incremental de CP usando V2 (paginação correta) */
  async syncCP(
    companyId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<SyncStats> {
    const { token, orgId } = await this.getTokenV2(companyId);
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, errors: 0 };

    const situacoes = ['aberto', 'pago', 'parcialmente pago', 'cancelado'];

    for (const situacao of situacoes) {
      let pagina = 1;
      let hasMore = true;

      while (hasMore) {
        const rows = await this.v2.listarCP(token, {
          situacao,
          dataInicial: opts.from || undefined,
          dataFinal: opts.to || undefined,
          pagina,
        });

        this.logger.log(`syncCP situacao=${situacao} pagina=${pagina} rows=${rows.length}`);

        if (rows.length === 0) { hasMore = false; break; }

        for (const r of rows) {
          try {
            const tinyId = String(r.id ?? '');
            if (!tinyId) { stats.skipped++; continue; }

            const existing = await this.cpRepo.findOne({ where: { tinyId, orgId } });
            const vencimento = this.parseDate(r.data_vencimento ?? '');

            if (existing) {
              existing.situacao = this.mapSituacaoCP(r.situacao ?? situacao);
              existing.valorPago = String(r.valor_pago ?? 0);
              existing.dataPagamento = r.data_pagamento ? this.parseDate(r.data_pagamento) : null;
              await this.cpRepo.save(existing);
              stats.updated++;
            } else {
            const cp = this.cpRepo.create({
              orgId,
              companyId,
              tinyId,
              historico: r.historico ?? 'Importado Tiny',
              fornecedorNome: r.nome_cliente ?? r.contato?.nome ?? 'Não informado',
              valor: String(r.valor ?? 0),
              valorPago: String(r.valor_pago ?? 0),
              dataVencimento: vencimento,
              situacao: this.mapSituacaoCP(r.situacao ?? situacao),
              marcadores: [],
            });
              await this.cpRepo.save(cp);
              stats.created++;
            }
          } catch (err) {
            this.logger.error(`syncCP erro: ${(err as Error).message}`);
            stats.errors++;
          }
        }

        if (rows.length < 100) hasMore = false;
        else pagina++;
      }
    }

    this.logger.log(`syncCP ${companyId}: created=${stats.created} updated=${stats.updated} errors=${stats.errors}`);
    return stats;
  }

  /** Sync incremental de CR */
  async syncCR(
    companyId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<SyncStats> {
    const { token, orgId } = await this.getTokenV2(companyId);
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, errors: 0 };

    const situacoes = ['aberto', 'recebido', 'parcialmente recebido', 'cancelado'];

    for (const situacao of situacoes) {
      let pagina = 1;
      let hasMore = true;

      while (hasMore) {
        const rows = await this.v2.listarCR(token, {
          situacao,
          dataInicial: opts.from || undefined,
          dataFinal: opts.to || undefined,
          pagina,
        });

        this.logger.log(`syncCR situacao=${situacao} pagina=${pagina} rows=${rows.length}`);

        if (rows.length === 0) { hasMore = false; break; }

        for (const r of rows) {
          try {
            const tinyId = String(r.id ?? '');
            if (!tinyId) { stats.skipped++; continue; }

            const existing = await this.crRepo.findOne({ where: { tinyId, orgId } });
            const vencimento = this.parseDate(r.data_vencimento ?? '');

            if (existing) {
              existing.situacao = this.mapSituacaoCR(r.situacao ?? situacao);
              existing.valorRecebido = String(r.valor_recebido ?? 0);
              existing.dataRecebimento = r.data_recebimento ? this.parseDate(r.data_recebimento) : null;
              await this.crRepo.save(existing);
              stats.updated++;
            } else {
            const cr = this.crRepo.create({
              orgId,
              companyId,
              tinyId,
              historico: r.historico ?? 'Importado Tiny',
              clienteNome: r.nome_cliente ?? r.contato?.nome ?? 'Não informado',
              valor: String(r.valor ?? 0),
              valorRecebido: String(r.valor_recebido ?? 0),
              dataVencimento: vencimento,
              situacao: this.mapSituacaoCR(r.situacao ?? situacao),
              marcadores: [],
            });
              await this.crRepo.save(cr);
              stats.created++;
            }
          } catch (err) {
            this.logger.error(`syncCR erro: ${(err as Error).message}`);
            stats.errors++;
          }
        }

        if (rows.length < 100) hasMore = false;
        else pagina++;
      }
    }

    this.logger.log(`syncCR ${companyId}: created=${stats.created} updated=${stats.updated} errors=${stats.errors}`);
    return stats;
  }

  /** Sync de contatos */
  async syncContatos(companyId: string): Promise<SyncStats> {
    const { token, orgId } = await this.getTokenV2(companyId);
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, errors: 0 };

    let pagina = 1;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.v2.listarContatos(token, { pagina });
      if (rows.length === 0) { hasMore = false; break; }

      for (const r of rows) {
        try {
          const tinyId = String(r.id ?? '');
          if (!tinyId || !r.nome) { stats.skipped++; continue; }

          const existing = await this.contatoRepo.findOne({ where: { tinyId, orgId } as Record<string, unknown> });
          if (existing) {
            stats.skipped++;
            continue;
          }

          await this.contatoRepo.save(
            this.contatoRepo.create({
              orgId,
              tinyId,
              nome: r.nome,
              tipos: ['cliente', 'fornecedor'],
              cpfCnpj: r.cpf_cnpj ?? undefined,
              email: r.email ?? undefined,
              situacao: 'ativo',
            }),
          );
          stats.created++;
        } catch (err) {
          this.logger.error(`syncContatos erro: ${(err as Error).message}`);
          stats.errors++;
        }
      }

      if (rows.length < 100) hasMore = false;
      else pagina++;
    }

    return stats;
  }

  /**
   * Cria CP no Tiny e adiciona marcador CLAUDE.
   * Estratégia: V2 para criar (com categoria) + V3 para marcador.
   */
  async criarCP(
    companyId: string,
    cp: {
      clienteNome: string;
      vencimento: string; // YYYY-MM-DD
      valor: number;
      historico: string;
      categoria?: string;
    },
    opts: { marcarClaude?: boolean } = {},
  ): Promise<{ tinyId?: string; ok: boolean }> {
    const { token } = await this.getTokenV2(companyId);

    const res = await this.v2.criarCP(token, {
      cliente: { nome: cp.clienteNome, tipo_pessoa: 'J' },
      vencimento: TinyV2Client.formatDate(cp.vencimento),
      valor: cp.valor,
      historico: cp.historico,
      categoria: cp.categoria,
    });

    if (res.retorno?.status !== 'OK') {
      this.logger.error(`criarCP falhou: ${JSON.stringify(res.retorno)}`);
      return { ok: false };
    }

    const registro = (res.retorno?.registros?.[0] as Record<string, unknown>);
    const tinyId = String((registro?.registro as Record<string, unknown>)?.id ?? registro?.id ?? '');

    if (opts.marcarClaude && tinyId) {
      try {
        const { token: tokenV3 } = await this.getTokenV3(companyId).catch(() => ({ token: '' }));
        if (tokenV3) {
          await this.v3.adicionarMarcadorCP(tokenV3, Number(tinyId), 'CLAUDE');
        }
      } catch (err) {
        this.logger.warn(`Marcador CLAUDE falhou para CP ${tinyId}: ${(err as Error).message}`);
      }
    }

    return { tinyId, ok: true };
  }

  /**
   * Baixa CP no Tiny via V2.
   * contaOrigem é obrigatório — nunca "Caixa" genérico.
   */
  async baixarCP(companyId: string, dados: TinyBaixarCP): Promise<{ ok: boolean }> {
    const { token } = await this.getTokenV2(companyId);
    const res = await this.v2.baixarCP(token, dados);
    return { ok: res.retorno?.status === 'OK' };
  }

  /** Baixa CR no Tiny via V2 e adiciona marcador CLAUDE */
  async baixarCR(
    companyId: string,
    dados: { id: string; data: string; valorPago: number },
    opts: { marcarClaude?: boolean } = {},
  ): Promise<{ ok: boolean }> {
    const { token } = await this.getTokenV2(companyId);
    const res = await this.v2.baixarCR(token, dados);
    const ok = res.retorno?.status === 'OK';

    if (ok && opts.marcarClaude) {
      try {
        await this.v2.adicionarMarcadorCR(token, dados.id, 'CLAUDE');
      } catch (err) {
        this.logger.warn(`Marcador CLAUDE falhou para CR ${dados.id}: ${(err as Error).message}`);
      }
    }

    return { ok };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private parseDate(raw: string): string {
    // DD/MM/YYYY → YYYY-MM-DD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split('/');
      return `${y}-${m}-${d}`;
    }
    return raw; // já está em YYYY-MM-DD
  }

  private mapSituacaoCP(tiny: string): 'aberto' | 'pago' | 'parcial' | 'atrasado' | 'cancelado' {
    const map: Record<string, 'aberto' | 'pago' | 'parcial' | 'atrasado' | 'cancelado'> = {
      'em aberto': 'aberto',
      'aberto': 'aberto',
      'pago': 'pago',
      'parcialmente pago': 'parcial',
      'parcial': 'parcial',
      'cancelado': 'cancelado',
      'atrasado': 'atrasado',
    };
    return map[tiny.toLowerCase()] ?? 'aberto';
  }

  private mapSituacaoCR(tiny: string): 'aberto' | 'recebido' | 'parcial' | 'atrasado' | 'cancelado' {
    const map: Record<string, 'aberto' | 'recebido' | 'parcial' | 'atrasado' | 'cancelado'> = {
      'em aberto': 'aberto',
      'aberto': 'aberto',
      'recebido': 'recebido',
      'pago': 'recebido',
      'parcialmente recebido': 'parcial',
      'parcial': 'parcial',
      'cancelado': 'cancelado',
      'atrasado': 'atrasado',
    };
    return map[tiny.toLowerCase()] ?? 'aberto';
  }
}
