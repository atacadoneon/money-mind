import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TinyV2Client } from './tiny-v2.client';
import { TinyV3Client } from './tiny-v3.client';
import { TinySyncService } from './tiny-sync.service';
import { TinyMcpController } from './tiny-mcp.controller';
import { ContaPagar } from '../../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { Contato } from '../../contatos/entities/contato.entity';
import { Company } from '../../companies/entities/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContaPagar, ContaReceber, Contato, Company]),
    BullModule.registerQueue({ name: 'tiny-sync' }),
  ],
  controllers: [TinyMcpController],
  providers: [TinyV2Client, TinyV3Client, TinySyncService],
  exports: [TinySyncService, TinyV2Client, TinyV3Client],
})
export class TinyMcpModule {}
