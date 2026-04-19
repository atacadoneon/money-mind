import { Controller, Post, Param, Query, Body } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentOrg, OrgContext } from '../../auth/decorators/current-org.decorator';

@ApiTags('mcps/bancos')
@ApiBearerAuth()
@Controller('mcps/bancos')
export class BancosMcpController {
  constructor(
    @InjectQueue('bancos-sync') private readonly bancosQueue: Queue,
  ) {}

  @Post('extrato/:contaId')
  @ApiOperation({ summary: 'Enfileira sincronização de extrato para uma conta bancária' })
  @ApiQuery({ name: 'from', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-01-31' })
  async syncExtrato(
    @Param('contaId') contaId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @CurrentOrg() org?: OrgContext,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];

    const job = await this.bancosQueue.add(
      'sync-extrato',
      { contaBancariaId: contaId, from: from ?? defaultFrom, to: to ?? defaultTo, orgId: org?.orgId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return { jobId: job.id, message: 'Sincronização enfileirada' };
  }

  @Post('saldo/:contaId')
  @ApiOperation({ summary: 'Busca saldo atual de uma conta bancária via API do banco' })
  async syncSaldo(
    @Param('contaId') contaId: string,
    @CurrentOrg() org?: OrgContext,
  ) {
    const job = await this.bancosQueue.add(
      'sync-saldo',
      { contaBancariaId: contaId, orgId: org?.orgId },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
    );

    return { jobId: job.id, message: 'Sincronização saldo enfileirada' };
  }

  @Post('sync-all/:companyId')
  @ApiOperation({ summary: 'Sincroniza extrato de todos os bancos da empresa em paralelo' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async syncAll(
    @Param('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @CurrentOrg() org?: OrgContext,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultTo = now.toISOString().split('T')[0];

    const job = await this.bancosQueue.add(
      'sync-all',
      { companyId, from: from ?? defaultFrom, to: to ?? defaultTo, orgId: org?.orgId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return { jobId: job.id, message: 'Sincronização all bancos enfileirada' };
  }
}
