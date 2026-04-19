import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarteiraAnalista } from './entities/carteira-analista.entity';
import { TarefaWorkflow } from './entities/tarefa-workflow.entity';
import { WorkflowBpoService } from './workflow-bpo.service';
import { WorkflowBpoController } from './workflow-bpo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CarteiraAnalista, TarefaWorkflow])],
  controllers: [WorkflowBpoController],
  providers: [WorkflowBpoService],
  exports: [WorkflowBpoService, TypeOrmModule],
})
export class WorkflowBpoModule {}
