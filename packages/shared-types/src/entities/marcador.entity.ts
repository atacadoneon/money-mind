import type { BaseEntity, OrgScoped } from './base.entity';

export interface MarcadorEntity extends BaseEntity, OrgScoped {
  descricao: string;
  cor: string;
  count_cp: number;
  count_cr: number;
  is_system: boolean;
}
