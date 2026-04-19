import { Column, Entity, Index, Unique } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type TipoImposto = 'simples' | 'iss' | 'pis' | 'cofins' | 'irpj' | 'csll' | 'icms' | 'ipi' | 'inss' | 'fgts';
export type StatusImposto = 'provisionado' | 'pago' | 'atrasado' | 'cancelado';

@Entity({ name: 'provisoes_impostos' })
@Unique(['companyId', 'competencia', 'tipoImposto'])
@Index(['companyId'])
@Index(['competencia'])
export class ProvisaoImposto extends CompanyScopedEntity {
  @Column({ type: 'varchar', length: 7 })
  competencia!: string;

  @Column({ name: 'tipo_imposto', type: 'varchar', length: 20 })
  tipoImposto!: TipoImposto;

  @Column({ name: 'base_calculo', type: 'numeric', precision: 14, scale: 2 })
  baseCalculo!: string;

  @Column({ type: 'numeric', precision: 7, scale: 4 })
  aliquota!: string;

  @Column({ name: 'valor_provisionado', type: 'numeric', precision: 14, scale: 2 })
  valorProvisionado!: string;

  @Column({ name: 'valor_pago', type: 'numeric', precision: 14, scale: 2, default: 0 })
  valorPago!: string;

  @Column({ name: 'data_vencimento', type: 'date', nullable: true })
  dataVencimento?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'provisionado' })
  status!: StatusImposto;

  @Column({ name: 'guia_url', type: 'text', nullable: true })
  guiaUrl?: string | null;
}
