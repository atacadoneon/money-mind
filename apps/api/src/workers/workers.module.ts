import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TinySyncProcessor } from './tiny-sync/tiny-sync.processor';
import { ExtratoParseProcessor } from './extrato-parse/extrato-parse.processor';
import { ReconciliationProcessor } from './reconciliation/reconciliation.processor';
import { AiSuggestProcessor } from './ai-suggest/ai-suggest.processor';
import { BancosSyncProcessor } from './bancos-sync/bancos-sync.processor';
import { GatewaysSyncProcessor } from './gateways-sync/gateways-sync.processor';
import { CobrancaReguaProcessor } from './cobranca-regua/cobranca-regua.processor';
import { LgpdProcessor } from './lgpd/lgpd.processor';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { TinyMcpModule } from '../mcps/tiny/tiny-mcp.module';
import { BancosMcpModule } from '../mcps/bancos/bancos-mcp.module';
import { GatewaysMcpModule } from '../mcps/gateways/gateways-mcp.module';
import { ComunicacaoMcpModule } from '../mcps/comunicacao/comunicacao-mcp.module';
import { LgpdModule } from '../lgpd/lgpd.module';
import { ExtratoBancario } from '../extratos-bancarios/entities/extrato.entity';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';
import { Company } from '../companies/entities/company.entity';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'tiny-sync' },
      { name: 'extrato-parse' },
      { name: 'reconciliation' },
      { name: 'ai-suggest' },
      { name: 'bancos-sync' },
      { name: 'gateways-sync' },
      { name: 'cobranca-regua' },
      { name: 'lgpd' },
    ),
    TypeOrmModule.forFeature([ExtratoBancario, ExtratoLinha, ContaPagar, ContaReceber, Company]),
    ReconciliationModule,
    TinyMcpModule,
    BancosMcpModule,
    GatewaysMcpModule,
    ComunicacaoMcpModule,
    LgpdModule,
  ],
  providers: [
    TinySyncProcessor,
    ExtratoParseProcessor,
    ReconciliationProcessor,
    AiSuggestProcessor,
    BancosSyncProcessor,
    GatewaysSyncProcessor,
    CobrancaReguaProcessor,
    LgpdProcessor,
  ],
  exports: [],
})
export class WorkersModule {}
