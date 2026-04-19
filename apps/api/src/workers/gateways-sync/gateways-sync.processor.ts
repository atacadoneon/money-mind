import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { GatewaysMcpService } from '../../mcps/gateways/gateways-mcp.service';

@Processor('gateways-sync')
export class GatewaysSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GatewaysSyncProcessor.name);

  constructor(
    private readonly gatewaysSvc: GatewaysMcpService,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing gateways-sync job ${job.id} name=${job.name}`);

    switch (job.name) {
      case 'sync-gateway': {
        const { companyId, gateway, createdSince, orgId } = job.data as {
          companyId: string;
          gateway: string;
          createdSince?: string;
          orgId: string;
        };

        const company = await this.companiesRepo.findOne({ where: { id: companyId } });
        if (!company) {
          this.logger.warn(`Company ${companyId} not found`);
          return { error: 'company not found' };
        }

        if (gateway === 'pagarme') {
          const apiKey = (company.settings as Record<string, string>)?.pagarmeSkEncrypted ?? '';
          return this.gatewaysSvc.syncPagarme(companyId, orgId, apiKey, createdSince);
        }

        this.logger.warn(`Gateway '${gateway}' sync not implemented via job — use upload endpoint`);
        return {};
      }

      default:
        this.logger.warn(`gateways-sync: job '${job.name}' não reconhecido`);
        return {};
    }
  }
}
