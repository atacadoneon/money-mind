import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaneamentoDuplicata } from './entities/saneamento-duplicata.entity';
import { SaneamentoScore } from './entities/saneamento-score.entity';
import { SaneamentoCadastralService } from './saneamento-cadastral.service';
import { SaneamentoCadastralController } from './saneamento-cadastral.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SaneamentoDuplicata, SaneamentoScore])],
  controllers: [SaneamentoCadastralController],
  providers: [SaneamentoCadastralService],
  exports: [SaneamentoCadastralService, TypeOrmModule],
})
export class SaneamentoCadastralModule {}
