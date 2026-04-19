import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { ComunicacaoMcpService } from '../../mcps/comunicacao/comunicacao-mcp.service';

/**
 * Régua de cobrança — roda diariamente via cron job.
 * Envia comunicações automáticas baseadas em dias de vencimento/atraso.
 */
@Processor('cobranca-regua')
export class CobrancaReguaProcessor extends WorkerHost {
  private readonly logger = new Logger(CobrancaReguaProcessor.name);

  constructor(
    private readonly comunicacaoSvc: ComunicacaoMcpService,
    @InjectRepository(ContaReceber)
    private readonly crRepo: Repository<ContaReceber>,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing cobranca-regua job ${job.id}`);
    const orgId = job.data.orgId as string;
    const today = new Date().toISOString().split('T')[0];
    const canal = (job.data.canal ?? 'whatsapp') as 'whatsapp' | 'email' | 'sms';

    const d5 = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    const d3ago = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const d7ago = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const d15ago = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0];

    const batches: Array<{ template: string; dataVencimento: string }> = [
      { template: 'cobranca-lembrete', dataVencimento: d5 },
      { template: 'cobranca-vencimento', dataVencimento: today },
      { template: 'cobranca-atraso-3d', dataVencimento: d3ago },
      { template: 'cobranca-atraso-7d', dataVencimento: d7ago },
      { template: 'cobranca-atraso-15d', dataVencimento: d15ago },
    ];

    let sent = 0;
    let errors = 0;

    for (const batch of batches) {
      const contas = await this.crRepo.find({
        where: {
          orgId,
          situacao: 'aberto',
          dataVencimento: batch.dataVencimento,
        },
        take: 200,
      });

      for (const cr of contas) {
        try {
          await this.comunicacaoSvc.enviarCobranca(orgId, cr.id, canal, batch.template);
          sent++;
        } catch (err) {
          this.logger.error(`Falha ao enviar cobrança ${cr.id}: ${err}`);
          errors++;
        }
      }
    }

    this.logger.log(`Régua concluída: ${sent} enviados, ${errors} erros`);
    return { sent, errors };
  }
}
