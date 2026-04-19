import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OrgRole = 'owner' | 'admin' | 'accountant' | 'viewer';

@Entity({ name: 'org_members' })
@Index(['userId', 'orgId'], { unique: true })
export class OrgMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  orgId!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'varchar', length: 20, default: 'viewer' })
  role!: OrgRole;

  @CreateDateColumn()
  createdAt!: Date;
}
