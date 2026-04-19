import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ExtratoBancario } from './entities/extrato.entity';
import { ExtratoLinha } from './entities/extrato-linha.entity';
import { ExtratosBancariosService } from './extratos-bancarios.service';
import { ExtratosBancariosController } from './extratos-bancarios.controller';
import { OfxParserService } from './ofx/ofx-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExtratoBancario, ExtratoLinha]),
    BullModule.registerQueue({ name: 'extrato-parse' }),
  ],
  controllers: [ExtratosBancariosController],
  providers: [ExtratosBancariosService, OfxParserService],
  exports: [ExtratosBancariosService, TypeOrmModule, OfxParserService],
})
export class ExtratosBancariosModule {}
