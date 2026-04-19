import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

@Entity({ name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  subscriptionId!: string;

  @Column({ length: 120, nullable: true })
  stripeInvoiceId?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amount!: number;

  @Column({ length: 30, default: 'open' })
  status!: InvoiceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt?: Date;

  @Column({ type: 'text', nullable: true })
  hostedInvoiceUrl?: string;

  @Column({ type: 'text', nullable: true })
  pdfUrl?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
