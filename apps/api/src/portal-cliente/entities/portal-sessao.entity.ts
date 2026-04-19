import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'portal_sessoes' })
@Index(['token'])
@Index(['companyId'])
export class PortalSessao {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { name: 'org_id' }) orgId!: string;
  @Column('uuid', { name: 'company_id' }) companyId!: string;
  @Column({ type: 'text', unique: true }) token!: string;
  @Column({ name: 'email_cliente', type: 'text' }) emailCliente!: string;
  @Column({ name: 'nome_cliente', type: 'text', nullable: true }) nomeCliente?: string | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  @Column({ name: 'last_access', type: 'timestamptz', nullable: true }) lastAccess?: Date | null;
  @Column({ name: 'ip_address', type: 'text', nullable: true }) ipAddress?: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
