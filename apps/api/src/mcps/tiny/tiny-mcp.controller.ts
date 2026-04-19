import { Body, Controller, Logger, Param, Post, Query } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { TinySyncService } from './tiny-sync.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { Company } from '../../companies/entities/company.entity';

export class SyncQueryDto {
  @ApiPropertyOptional({ enum: ['cp', 'cr', 'contatos'] })
  @IsOptional()
  @IsEnum(['cp', 'cr', 'contatos'])
  dominio?: 'cp' | 'cr' | 'contatos';

  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class SetTokenDto {
  @ApiProperty() @IsString() token!: string;
}

@ApiTags('mcps-tiny')
@ApiBearerAuth()
@Controller('mcps/tiny')
export class TinyMcpController {
  private readonly logger = new Logger('TinyMcpController');

  constructor(
    @InjectQueue('tiny-sync') private readonly queue: Queue,
    private readonly tinySync: TinySyncService,
    private readonly encryption: EncryptionService,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
  ) {}

  @Post('sync/:companyId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Enfileira job de sync Tiny para a empresa' })
  async syncCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() q: SyncQueryDto,
  ) {
    const jobId = `tiny-sync:${companyId}:${q.dominio ?? 'all'}:${Date.now()}`;
    await this.queue.add(
      'sync',
      { companyId, dominio: q.dominio ?? 'cp', from: q.from, to: q.to },
      { jobId, attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
    );
    return { data: { queued: true, jobId, companyId, dominio: q.dominio ?? 'cp' } };
  }

  @Post('set-token/:companyId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Salva token Tiny criptografado na empresa' })
  async setToken(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: SetTokenDto,
  ) {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) return { error: 'Company not found' };
    const encrypted = this.encryption.encrypt(dto.token);
    company.settings = { ...company.settings, tinyTokenEncrypted: encrypted };
    await this.companyRepo.save(company);
    this.logger.log(`Token Tiny salvo para empresa ${companyId}`);
    return { data: { saved: true, companyId } };
  }

  @Post('sync-direct/:companyId')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Executa sync Tiny direto (sem fila/Redis)' })
  async syncDirect(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() q: SyncQueryDto,
  ) {
    const dominio = q.dominio ?? 'cp';
    this.logger.log(`Sync direto ${dominio} para empresa ${companyId}`);

    const results: Record<string, unknown> = {};

    if (dominio === 'cp' || !q.dominio) {
      results.cp = await this.tinySync.syncCP(companyId, { from: q.from, to: q.to });
    }
    if (dominio === 'cr' || !q.dominio) {
      results.cr = await this.tinySync.syncCR(companyId, { from: q.from, to: q.to });
    }
    if (dominio === 'contatos' || !q.dominio) {
      results.contatos = await this.tinySync.syncContatos(companyId);
    }

    return { data: results };
  }

  @Public()
  @Post('dev-sync/:companyId')
  @ApiOperation({ summary: 'DEV: sync direto sem auth (apenas dev)' })
  async devSync(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() q: SyncQueryDto,
  ) {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Disabled in production' };
    }
    return this.syncDirect(companyId, q);
  }

  @Public()
  @Post('dev-set-token/:companyId')
  @ApiOperation({ summary: 'DEV: salva token sem auth (apenas dev)' })
  async devSetToken(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: SetTokenDto,
  ) {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Disabled in production' };
    }
    return this.setToken(companyId, dto);
  }
}
