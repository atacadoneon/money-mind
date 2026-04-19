import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export type ConsentType = 'cookies_essenciais' | 'analytics' | 'marketing' | 'ai_processing';

@Entity({ name: 'consents' })
export class Consent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ length: 60 })
  type!: ConsentType;

  @Column({ default: false })
  accepted!: boolean;

  @Column({ length: 60, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ length: 20, default: '1.0' })
  version!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
