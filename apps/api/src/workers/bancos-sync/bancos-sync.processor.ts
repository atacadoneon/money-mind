import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BancosMcpService } from '../../mcps/bancos/bancos-mcp.service';

@Processor('bancos-sync')
export class BancosSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(BancosSyncProcessor.name);

  constructor(private readonly bancosMcp: BancosMcpService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing bancos-sync job ${job.id} name=${job.name}`);

    switch (job.name) {
      case 'sync-extrato': {
        const { contaBancariaId, from, to } = job.data as { contaBancariaId: string; from: string; to: string };
        const linhas = await this.bancosMcp.fetchExtrato(contaBancariaId, { from, to });
        this.logger.log(`sync-extrato ${contaBancariaId}: ${linhas.length} linhas`);
        return { linhas: linhas.length };
      }

      case 'sync-saldo': {
        const { contaBancariaId } = job.data as { contaBancariaId: string };
        const saldo = await this.bancosMcp.fetchSaldo(contaBancariaId);
        this.logger.log(`sync-saldo ${contaBancariaId}: ${saldo.saldo}`);
        return saldo;
      }

      case 'sync-all': {
        const { companyId, from, to } = job.data as { companyId: string; from: string; to: string };
        const results = await this.bancosMcp.fetchExtratoAll(companyId, { from, to });
        const total = results.reduce((acc, r) => acc + r.linhas.length, 0);
        this.logger.log(`sync-all company=${companyId}: ${total} linhas em ${results.length} contas`);
        return { contas: results.length, totalLinhas: total };
      }

      default:
        this.logger.warn(`bancos-sync: job name '${job.name}' não reconhecido`);
        return {};
    }
  }
}
