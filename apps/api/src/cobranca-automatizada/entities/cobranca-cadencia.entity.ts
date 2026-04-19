import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/base.entity';

export interface EtapaCadencia {
  ordem: number;
  diasOffset: number;
  canal: 'whatsapp' | 'email' | 'sms' | 'telefone' | 'portal';
  templateId?: string;
  janelaHorario?: string;
  cooldownHoras?: number;
  nivelEscalacao?: string;
}

@Entity({ name: 'cobranca_cadencias' })
@Index(['orgId'])
export class CobrancaCadencia extends TenantEntity {
  @Column('uuid', { name: 'company_id', nullable: true })
  companyId?: string | null;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'segmento_alvo', type: 'varchar', length: 30, default: 'todos' })
  segmentoAlvo!: string; // 'todos' | 'premium' | 'novos' | 'inadimplentes' | 'alto_valor'

  @Column({ type: 'jsonb', default: () => "'[]'" })
  etapas!: EtapaCadencia[];
}
