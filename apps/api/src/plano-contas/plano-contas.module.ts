import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CentroCusto } from './entities/centro-custo.entity';
import { RegraRateio } from './entities/regra-rateio.entity';
import { RateioItem } from './entities/rateio-item.entity';
import { RegraCategorizacao } from './entities/regra-categorizacao.entity';
import { PlanoContasService } from './plano-contas.service';
import { PlanoContasController } from './plano-contas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CentroCusto, RegraRateio, RateioItem, RegraCategorizacao])],
  controllers: [PlanoContasController],
  providers: [PlanoContasService],
  exports: [PlanoContasService, TypeOrmModule],
})
export class PlanoContasModule {}
