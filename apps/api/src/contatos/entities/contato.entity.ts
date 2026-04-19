import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export type ContatoTipo = 'cliente' | 'fornecedor' | 'ambos';

@Entity({ name: 'contatos' })
@Index(['orgId', 'cpfCnpj'])
export class Contato extends TenantEntity {
  @Column({ length: 180 })
  nome!: string;

  @Column({ name: 'nome_fantasia', length: 180, nullable: true })
  nomeFantasia?: string;

  @Column({ name: 'tipo_pessoa', type: 'varchar', length: 10, default: 'pf' })
  tipoPessoa!: string;

  @Column({ name: 'tipos', type: 'text', array: true, default: () => "'{cliente}'" })
  tipos!: string[];

  @Column({ name: 'cpf_cnpj', length: 20, nullable: true })
  cpfCnpj?: string;

  @Column({ length: 120, nullable: true })
  email?: string;

  @Column({ length: 30, nullable: true })
  telefone?: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  endereco!: Record<string, unknown>;

  @Column({ name: 'dados_complementares', type: 'jsonb', default: () => "'{}'" })
  dadosComplementares!: Record<string, unknown>;

  @Column({ name: 'tiny_id', type: 'bigint', nullable: true })
  tinyId?: string;

  @Column({ name: 'situacao', type: 'varchar', length: 20, default: 'ativo' })
  situacao!: string;
}
