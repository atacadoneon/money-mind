import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrancaCadencia } from './entities/cobranca-cadencia.entity';
import { CobrancaExecucao } from './entities/cobranca-execucao.entity';
import { CobrancaAcao } from './entities/cobranca-acao.entity';
import { CobrancaTemplate } from './entities/cobranca-template.entity';
import { CobrancaAutomatizadaService } from './cobranca-automatizada.service';
import { CobrancaAutomatizadaController } from './cobranca-automatizada.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CobrancaCadencia, CobrancaExecucao, CobrancaAcao, CobrancaTemplate])],
  controllers: [CobrancaAutomatizadaController],
  providers: [CobrancaAutomatizadaService],
  exports: [CobrancaAutomatizadaService, TypeOrmModule],
})
export class CobrancaAutomatizadaModule {}
