import {
  Controller, Get, Post, Param, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentOrg, OrgContext } from '../../auth/decorators/current-org.decorator';
import { GatewaysMcpService } from './gateways-mcp.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('mcps/gateways')
@ApiBearerAuth()
@Controller('mcps/gateways')
export class GatewaysMcpController {
  constructor(
    private readonly svc: GatewaysMcpService,
    @InjectQueue('gateways-sync') private readonly gatewaysQueue: Queue,
  ) {}

  @Get('/transacoes-vendas')
  @ApiOperation({ summary: 'Lista transações de gateways de pagamento' })
  list(
    @CurrentOrg() org: OrgContext,
    @Query() q: PaginationDto,
    @Query('gateway') gateway?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('company_id') companyId?: string,
  ) {
    return this.svc.listTransacoes(org.orgId, { ...q, gateway, status, from, to, companyId });
  }

  @Post('sync/:companyId/:gateway')
  @ApiOperation({ summary: 'Enfileira sincronização de gateway para a empresa' })
  async syncGateway(
    @Param('companyId') companyId: string,
    @Param('gateway') gateway: string,
    @Query('created_since') createdSince?: string,
    @CurrentOrg() org?: OrgContext,
  ) {
    const job = await this.gatewaysQueue.add(
      'sync-gateway',
      { companyId, gateway, createdSince, orgId: org?.orgId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return { jobId: job.id, message: `Sincronização ${gateway} enfileirada` };
  }

  @Post('sync/:companyId/appmax/upload-csv')
  @ApiOperation({ summary: 'Importa CSV do Appmax' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAppmaxCsv(
    @Param('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentOrg() org?: OrgContext,
  ) {
    return this.svc.syncAppmaxCSV(companyId, org!.orgId, file.buffer);
  }
}
