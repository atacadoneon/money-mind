import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export type CampoMatch = 'cnpj' | 'nome_contato' | 'historico' | 'valor_range';
export type Operador = 'igual' | 'contem' | 'regex' | 'maior_que' | 'menor_que';

@Entity({ name: 'regras_categorizacao' })
@Index(['orgId'])
@Index(['campoMatch', 'valorMatch'])
export class RegraCategorizacao extends TenantEntity {
  @Column('uuid', { name: 'company_id', nullable: true })
  companyId?: string | null;

  @Column({ name: 'campo_match', type: 'varchar', length: 30 })
  campoMatch!: CampoMatch;

  @Column({ name: 'valor_match', type: 'text' })
  valorMatch!: string;

  @Column({ type: 'varchar', length: 10, default: 'igual' })
  operador!: Operador;

  @Column('uuid', { name: 'categoria_id', nullable: true })
  categoriaId?: string | null;

  @Column('uuid', { name: 'centro_custo_id', nullable: true })
  centroCustoId?: string | null;

  @Column({ type: 'int', default: 100 })
  confidence!: number;

  @Column({ type: 'int', default: 50 })
  prioridade!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'vezes_aplicada', type: 'int', default: 0 })
  vezesAplicada!: number;
}
