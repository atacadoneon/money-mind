import { Column, Entity, Index, OneToMany } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';
import { ExtratoLinha } from './extrato-linha.entity';

@Entity({ name: 'extratos_bancarios' })
@Index(['orgId', 'contaBancariaId'])
export class ExtratoBancario extends CompanyScopedEntity {
  @Column({ type: 'uuid' }) contaBancariaId!: string;
  @Column({ length: 160 }) nomeArquivo!: string;
  @Column({ type: 'date' }) periodoInicio!: string;
  @Column({ type: 'date' }) periodoFim!: string;
  @Column({ type: 'varchar', length: 20, default: 'pendente' }) status!: 'pendente' | 'processado' | 'erro';
  @Column({ type: 'integer', default: 0 }) totalLinhas!: number;
  @Column({ type: 'jsonb', default: () => "'{}'" }) metadata!: Record<string, unknown>;

  @OneToMany(() => ExtratoLinha, (l) => l.extrato)
  linhas?: ExtratoLinha[];
}
