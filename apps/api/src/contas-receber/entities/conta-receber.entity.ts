import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type SituacaoCR = 'aberto' | 'recebido' | 'parcial' | 'atrasado' | 'cancelado';

@Entity({ name: 'contas_receber' })
@Index(['orgId', 'companyId', 'situacao'])
@Index(['orgId', 'companyId', 'dataVencimento'])
export class ContaReceber extends CompanyScopedEntity {
  @Column({ name: 'numero_documento', type: 'varchar', length: 60, nullable: true })
  numeroDocumento?: string;

  @Column({ name: 'historico', length: 500, nullable: true })
  historico?: string;

  @Column({ name: 'contato_id', type: 'uuid', nullable: true })
  contatoId?: string | null;

  @Column({ name: 'cliente_nome', length: 200, nullable: true })
  clienteNome?: string;

  @Column({ name: 'categoria_id', type: 'uuid', nullable: true })
  categoriaId?: string | null;

  @Column({ name: 'forma_pagamento_id', type: 'uuid', nullable: true })
  formaPagamentoId?: string | null;

  @Column({ name: 'conta_bancaria_id', type: 'uuid', nullable: true })
  contaBancariaId?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ name: 'valor_recebido', type: 'numeric', precision: 14, scale: 2, default: 0 })
  valorRecebido!: string;

  @Column({ name: 'data_vencimento', type: 'date' })
  dataVencimento!: string;

  @Column({ name: 'data_emissao', type: 'date', nullable: true })
  dataEmissao?: string;

  @Column({ name: 'data_recebimento', type: 'date', nullable: true })
  dataRecebimento?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'aberto' })
  situacao!: SituacaoCR;

  @Column({ type: 'text', nullable: true })
  observacoes?: string;

  @Column({ name: 'marcadores', type: 'jsonb', default: () => "'[]'" })
  marcadores!: string[];

  @Column({ name: 'tiny_id', type: 'bigint', nullable: true })
  tinyId?: string;

  @Column({ name: 'raw_data', type: 'jsonb', default: () => "'{}'" })
  rawData!: Record<string, unknown>;
}
