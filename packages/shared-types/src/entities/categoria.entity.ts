import type { BaseEntity, OrgScoped } from './base.entity';

export type CategoriaTipo = 'receita' | 'despesa' | 'transferencia';
export type CategoriaNatureza = 'operacional' | 'nao_operacional' | 'financeira' | 'tributaria';

export interface Categoria extends BaseEntity, OrgScoped {
  parent_id?: string | null;
  nivel: number;
  path: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  tipo: CategoriaTipo;
  natureza?: CategoriaNatureza | null;
  dre_grupo?: string | null;
  is_active: boolean;
  is_system: boolean;
  tiny_id?: number | null;
  tiny_nome_exato?: string | null;
}

export interface CategoriaNode extends Categoria {
  children?: CategoriaNode[];
}
