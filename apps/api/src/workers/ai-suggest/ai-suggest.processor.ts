import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ExtratoLinha } from '../../extratos-bancarios/entities/extrato-linha.entity';
import { ContaPagar } from '../../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';

interface AiSuggestJob {
  orgId: string;
  linhaId: string;
}

interface AiSuggestion {
  contaId: string;
  kind: 'contaPagar' | 'contaReceber';
  confidence: number;
  reasoning: string;
}

/**
 * Worker de AI Suggest — usa Claude API (Anthropic) quando ANTHROPIC_API_KEY estiver configurado.
 * Fallback: heurística por similaridade de texto quando API key ausente.
 */
@Injectable()
@Processor('ai-suggest', { concurrency: 3 })
export class AiSuggestProcessor extends WorkerHost {
  private readonly logger = new Logger('AiSuggestWorker');
  private readonly anthropicApiKey?: string;

  constructor(
    @InjectRepository(ExtratoLinha) private readonly linhas: Repository<ExtratoLinha>,
    @InjectRepository(ContaPagar) private readonly cps: Repository<ContaPagar>,
    @InjectRepository(ContaReceber) private readonly crs: Repository<ContaReceber>,
  ) {
    super();
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  }

  async process(job: Job<AiSuggestJob>): Promise<{ suggestions: AiSuggestion[] }> {
    const { orgId, linhaId } = job.data;
    this.logger.log(`AI suggest para linha=${linhaId}`);

    const linha = await this.linhas.findOne({ where: { id: linhaId, orgId } });
    if (!linha) {
      this.logger.warn(`Linha ${linhaId} não encontrada`);
      return { suggestions: [] };
    }

    // Busca candidatos abertos dentro de 15% do valor
    const valor = Number(linha.valor);
    const isCredito = linha.tipo === 'credito';

    let candidates: Array<{ id: string; descricao: string; valor: string; dataVencimento: string; kind: 'contaPagar' | 'contaReceber' }> = [];

    if (isCredito) {
      const rows = await this.crs.createQueryBuilder('cr')
        .where('cr.org_id = :orgId AND cr.deleted_at IS NULL', { orgId })
        .andWhere("cr.situacao IN ('aberto','parcial','atrasado')")
        .andWhere('cr.valor BETWEEN :vmin AND :vmax', { vmin: valor * 0.85, vmax: valor * 1.15 })
        .orderBy('cr.data_vencimento', 'ASC')
        .limit(10).getMany();
      candidates = rows.map((r) => ({ id: r.id, descricao: r.historico ?? '', valor: r.valor, dataVencimento: r.dataVencimento, kind: 'contaReceber' as const }));
    } else {
      const rows = await this.cps.createQueryBuilder('cp')
        .where('cp.org_id = :orgId AND cp.deleted_at IS NULL', { orgId })
        .andWhere("cp.situacao IN ('aberto','parcial','atrasado')")
        .andWhere('cp.valor BETWEEN :vmin AND :vmax', { vmin: valor * 0.85, vmax: valor * 1.15 })
        .orderBy('cp.data_vencimento', 'ASC')
        .limit(10).getMany();
      candidates = rows.map((r) => ({ id: r.id, descricao: r.historico ?? '', valor: r.valor, dataVencimento: r.dataVencimento, kind: 'contaPagar' as const }));
    }

    if (candidates.length === 0) {
      this.logger.log(`Nenhum candidato para linha ${linhaId}`);
      return { suggestions: [] };
    }

    let suggestions: AiSuggestion[];

    if (this.anthropicApiKey) {
      suggestions = await this.suggestWithClaude(linha, candidates);
    } else {
      suggestions = this.suggestHeuristic(linha, candidates);
    }

    // Persiste a melhor sugestão na linha
    if (suggestions.length > 0) {
      const best = suggestions[0];
      if (best.kind === 'contaPagar') linha.matchContaPagarId = best.contaId;
      else linha.matchContaReceberId = best.contaId;
      linha.matchConfidence = best.confidence.toFixed(2);
      linha.matchStrategy = 'ai';
      if (linha.status === 'pendente') linha.status = 'sugerido';
      await this.linhas.save(linha);
    }

    return { suggestions };
  }

  private async suggestWithClaude(
    linha: ExtratoLinha,
    candidates: Array<{ id: string; descricao: string; valor: string; dataVencimento: string; kind: 'contaPagar' | 'contaReceber' }>,
  ): Promise<AiSuggestion[]> {
    try {
      // Dynamic import — @anthropic-ai/sdk é opcional, fallback para heurística se não disponível
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const module = await import('@anthropic-ai/sdk').catch(() => null) as any;
      if (!module) return this.suggestHeuristic(linha, candidates);
      const Anthropic = module.default ?? module.Anthropic;
      const client = new Anthropic({ apiKey: this.anthropicApiKey });

      const prompt = `Você é um especialista em conciliação financeira.

Extrato bancário:
- Data: ${linha.dataMovimento}
- Tipo: ${linha.tipo}
- Valor: R$ ${Number(linha.valor).toFixed(2)}
- Descrição: ${linha.descricao}
- Histórico: ${linha.historico || 'N/A'}

Candidatos (${linha.tipo === 'credito' ? 'contas a receber' : 'contas a pagar'} abertas):
${candidates.map((c, i) => `${i + 1}. ID=${c.id} | Desc="${c.descricao}" | Valor=R$${Number(c.valor).toFixed(2)} | Venc=${c.dataVencimento}`).join('\n')}

Responda com JSON puro (sem markdown) no formato:
{"matches": [{"id": "uuid", "confidence": 0.0-1.0, "reasoning": "explicação em 1 frase"}]}

Ordene por confidence decrescente. Retorne no máximo 3 matches com confidence >= 0.5.`;

      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = JSON.parse(text) as { matches: Array<{ id: string; confidence: number; reasoning: string }> };

      return parsed.matches
        .filter((m) => m.confidence >= 0.5)
        .map((m) => {
          const cand = candidates.find((c) => c.id === m.id);
          return {
            contaId: m.id,
            kind: cand?.kind ?? candidates[0].kind,
            confidence: m.confidence,
            reasoning: m.reasoning,
          };
        });
    } catch (err) {
      this.logger.warn(`Claude API falhou, usando heurística: ${(err as Error).message}`);
      return this.suggestHeuristic(linha, candidates);
    }
  }

  private suggestHeuristic(
    linha: ExtratoLinha,
    candidates: Array<{ id: string; descricao: string; valor: string; dataVencimento: string; kind: 'contaPagar' | 'contaReceber' }>,
  ): AiSuggestion[] {
    const valor = Number(linha.valor);
    const descLinha = (linha.descricao + ' ' + (linha.historico || '')).toLowerCase();

    return candidates
      .map((c) => {
        const valorCand = Number(c.valor);
        const difValor = Math.abs(valorCand - valor) / valor;
        const descCand = c.descricao.toLowerCase();

        // Score baseado em valor (40%), texto (40%), vencimento relativo (20%)
        let score = 0;
        score += Math.max(0, 0.4 - difValor * 2); // valor próximo = mais score
        score += this.textSimilarity(descLinha, descCand) * 0.4;

        const daysDiff = Math.abs(
          (new Date(c.dataVencimento).getTime() - new Date(linha.dataMovimento).getTime()) / 86400000,
        );
        score += Math.max(0, 0.2 - daysDiff * 0.01);

        return {
          contaId: c.id,
          kind: c.kind,
          confidence: Math.min(0.79, Math.max(0.3, score)), // ai-heurística max 0.79
          reasoning: `Heurística: valor próximo (diff ${(difValor * 100).toFixed(1)}%), textos semelhantes`,
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .filter((s) => s.confidence >= 0.4);
  }

  /** Similaridade de Jaccard em tokens */
  private textSimilarity(a: string, b: string): number {
    const tokA = new Set(a.split(/\s+/).filter((t) => t.length > 2));
    const tokB = new Set(b.split(/\s+/).filter((t) => t.length > 2));
    if (tokA.size === 0 || tokB.size === 0) return 0;
    const intersection = [...tokA].filter((t) => tokB.has(t)).length;
    const union = new Set([...tokA, ...tokB]).size;
    return intersection / union;
  }
}
