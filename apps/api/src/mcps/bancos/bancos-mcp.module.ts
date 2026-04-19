import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { SicoobClient } from './sicoob/sicoob.client';
import { ItauClient } from './itau/itau.client';
import { BbClient } from './bb/bb.client';
import { OlistClient } from './olist/olist.client';
import { ContaSimplesClient } from './conta-simples/conta-simples.client';
import { BancosMcpService } from './bancos-mcp.service';
import { BancosMcpController } from './bancos-mcp.controller';
import { ContaBancaria } from '../../contas-bancarias/entities/conta-bancaria.entity';
import { ExtratoLinha } from '../../extratos-bancarios/entities/extrato-linha.entity';
import { ExtratoBancario } from '../../extratos-bancarios/entities/extrato.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContaBancaria, ExtratoLinha, ExtratoBancario]),
    BullModule.registerQueue({ name: 'bancos-sync' }),
  ],
  controllers: [BancosMcpController],
  providers: [SicoobClient, ItauClient, BbClient, OlistClient, ContaSimplesClient, BancosMcpService],
  exports: [BancosMcpService, SicoobClient],
})
export class BancosMcpModule {}
