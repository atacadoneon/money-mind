import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrancaBancaria } from './entities/cobranca-bancaria.entity';
import { CobrancasBancariasService } from './cobrancas-bancarias.service';
import { CobrancasBancariasController } from './cobrancas-bancarias.controller';
import { ContaBancaria } from '../contas-bancarias/entities/conta-bancaria.entity';
import { BancosMcpModule } from '../mcps/bancos/bancos-mcp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CobrancaBancaria, ContaBancaria]),
    BancosMcpModule,
  ],
  controllers: [CobrancasBancariasController],
  providers: [CobrancasBancariasService],
  exports: [CobrancasBancariasService],
})
export class CobrancasBancariasModule {}
