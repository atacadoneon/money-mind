import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export type NivelEscalacao = 'L0' | 'L1' | 'L2' | 'L3';

@Entity({ name: 'cobranca_templates' })
@Index(['orgId'])
export class CobrancaTemplate extends TenantEntity {
  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'varchar', length: 20 })
  canal!: string; // 'whatsapp' | 'email' | 'sms'

  @Column({ type: 'text', nullable: true })
  assunto?: string | null;

  @Column({ type: 'text' })
  conteudo!: string;

  @Column({ name: 'nivel_escalacao', type: 'varchar', length: 10, default: 'L0' })
  nivelEscalacao!: NivelEscalacao;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  variaveis!: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
