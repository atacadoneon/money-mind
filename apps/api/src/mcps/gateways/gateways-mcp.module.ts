import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TransacaoVenda } from './entities/transacao-venda.entity';
import { PagarmeClient } from './pagarme/pagarme.client';
import { AppmaxClient } from './appmax/appmax.client';
import { StripeClient } from './stripe/stripe.client';
import { MercadoPagoClient } from './mp/mp.client';
import { GatewaysMcpService } from './gateways-mcp.service';
import { GatewaysMcpController } from './gateways-mcp.controller';
import { Company } from '../../companies/entities/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransacaoVenda, Company]),
    BullModule.registerQueue({ name: 'gateways-sync' }),
  ],
  controllers: [GatewaysMcpController],
  providers: [PagarmeClient, AppmaxClient, StripeClient, MercadoPagoClient, GatewaysMcpService],
  exports: [GatewaysMcpService],
})
export class GatewaysMcpModule {}
