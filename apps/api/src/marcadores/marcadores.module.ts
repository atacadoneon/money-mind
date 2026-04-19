import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marcador } from './entities/marcador.entity';
import { MarcadoresService } from './marcadores.service';
import { MarcadoresController } from './marcadores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Marcador])],
  controllers: [MarcadoresController],
  providers: [MarcadoresService],
  exports: [MarcadoresService, TypeOrmModule],
})
export class MarcadoresModule {}
