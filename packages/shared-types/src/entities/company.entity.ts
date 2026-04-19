import type { BaseEntity, OrgScoped } from './base.entity';

export interface Company extends BaseEntity, OrgScoped {
  name: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  slug: string;
  color: string;
  is_active: boolean;
  settings: Record<string, unknown>;
}
