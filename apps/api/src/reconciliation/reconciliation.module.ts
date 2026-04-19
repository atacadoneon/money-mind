import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';
import { ReconciliationEngine } from './engine/reconciliation.engine';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExtratoLinha, ContaPagar, ContaReceber]),
    BullModule.registerQueue({ name: 'reconciliation' }, { name: 'ai-suggest' }),
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, ReconciliationEngine],
  exports: [ReconciliationService, ReconciliationEngine],
})
export class ReconciliationModule {}
