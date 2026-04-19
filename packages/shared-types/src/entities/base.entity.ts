/** Campos comuns a quase todas as entidades do domínio (multi-tenant). */
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface OrgScoped {
  org_id: string;
}

export interface CompanyScoped extends OrgScoped {
  company_id: string;
}

export interface Marcador {
  descricao: string;
  cor: string;
}
