import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

@Entity({ name: 'formas_pagamento' })
export class FormaPagamento extends TenantEntity {
  @Column({ length: 120 }) nome!: string;
  @Column({ length: 40 }) tipo!: string;

  @Column({ length: 30, nullable: true }) icone?: string;
  @Column({ length: 10, nullable: true }) cor?: string;

  @Column({ name: 'taxa_percentual', type: 'numeric', precision: 5, scale: 2, default: 0 })
  taxaPercentual!: string;

  @Column({ name: 'taxa_fixa', type: 'numeric', precision: 10, scale: 2, default: 0 })
  taxaFixa!: string;

  @Column({ name: 'prazo_recebimento_dias', type: 'int', default: 0 })
  prazoRecebimentoDias!: number;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
