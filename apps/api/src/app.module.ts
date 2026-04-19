import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { authConfig } from './config/auth.config';

import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { CompaniesModule } from './companies/companies.module';
import { ContatosModule } from './contatos/contatos.module';
import { CategoriasModule } from './categorias/categorias.module';
import { FormasPagamentoModule } from './formas-pagamento/formas-pagamento.module';
import { MarcadoresModule } from './marcadores/marcadores.module';
import { ContasPagarModule } from './contas-pagar/contas-pagar.module';
import { ContasReceberModule } from './contas-receber/contas-receber.module';
import { ContasBancariasModule } from './contas-bancarias/contas-bancarias.module';
import { ExtratosBancariosModule } from './extratos-bancarios/extratos-bancarios.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { WorkersModule } from './workers/workers.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { TinyMcpModule } from './mcps/tiny/tiny-mcp.module';

// New modules
import { BancosMcpModule } from './mcps/bancos/bancos-mcp.module';
import { GatewaysMcpModule } from './mcps/gateways/gateways-mcp.module';
import { ComunicacaoMcpModule } from './mcps/comunicacao/comunicacao-mcp.module';
import { CaixaModule } from './caixa/caixa.module';
import { ContaDigitalModule } from './conta-digital/conta-digital.module';
import { CobrancasBancariasModule } from './cobrancas-bancarias/cobrancas-bancarias.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { LgpdModule } from './lgpd/lgpd.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ObservabilityModule } from './observability/observability.module';
import { BillingModule } from './billing/billing.module';

// Módulos Avançados (Sprint 11+)
import { FechamentoMensalModule } from './fechamento-mensal/fechamento-mensal.module';
import { WorkflowBpoModule } from './workflow-bpo/workflow-bpo.module';
import { AprovacaoPagamentosModule } from './aprovacao-pagamentos/aprovacao-pagamentos.module';
import { CobrancaAutomatizadaModule } from './cobranca-automatizada/cobranca-automatizada.module';
import { GestaoDocumentosModule } from './gestao-documentos/gestao-documentos.module';
import { PlanoContasModule } from './plano-contas/plano-contas.module';
import { PortalClienteModule } from './portal-cliente/portal-cliente.module';
import { SaneamentoCadastralModule } from './saneamento-cadastral/saneamento-cadastral.module';
import { IntegracaoContabilModule } from './integracao-contabil/integracao-contabil.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '../../.env.local', '.env'],
      load: [databaseConfig, redisConfig, authConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        type: 'postgres',
        url: cs.get<string>('DATABASE_URL'),
        ssl: cs.get<string>('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: false,
        logging: cs.get<string>('TYPEORM_LOGGING') === 'true',
        namingStrategy: new SnakeNamingStrategy(),
        extra: {
          max: Number(cs.get('DATABASE_POOL_MAX', 20)),
          idleTimeoutMillis: 30000,
        },
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => {
        try {
          const r = cs.getOrThrow<{ host: string; port: number; password?: string; db: number }>('redis');
          return {
            connection: {
              host: r.host,
              port: r.port,
              password: r.password,
              db: r.db,
              maxRetriesPerRequest: 3,
              retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
            },
          };
        } catch {
          return { connection: { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 } };
        }
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 100 },
    ]),
    CommonModule,
    ObservabilityModule,
    AuthModule,
    OrganizationsModule,
    CompaniesModule,
    ContatosModule,
    CategoriasModule,
    FormasPagamentoModule,
    MarcadoresModule,
    ContasPagarModule,
    ContasReceberModule,
    ContasBancariasModule,
    ExtratosBancariosModule,
    ReconciliationModule,
    AuditLogModule,
    WorkersModule,
    TinyMcpModule,
    HealthModule,
    // New
    BancosMcpModule,
    GatewaysMcpModule,
    ComunicacaoMcpModule,
    CaixaModule,
    ContaDigitalModule,
    CobrancasBancariasModule,
    RelatoriosModule,
    LgpdModule,
    WebhooksModule,
    BillingModule,
    // Módulos Avançados
    FechamentoMensalModule,
    WorkflowBpoModule,
    AprovacaoPagamentosModule,
    CobrancaAutomatizadaModule,
    GestaoDocumentosModule,
    PlanoContasModule,
    PortalClienteModule,
    SaneamentoCadastralModule,
    IntegracaoContabilModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
