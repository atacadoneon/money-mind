import type { Contribuinte, TipoContato, TipoPessoa } from '../enums/tipo-pessoa.enum';
import type { SituacaoContato } from '../enums/situacao.enum';
import type { BaseEntity, OrgScoped } from './base.entity';

export interface Contato extends BaseEntity, OrgScoped {
  company_id?: string | null;
  codigo?: number | null;
  tiny_id?: number | null;
  nome: string;
  nome_fantasia?: string | null;

  tipo_pessoa: TipoPessoa;
  cpf_cnpj?: string | null;
  contribuinte?: Contribuinte | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;

  tipos: TipoContato[];
  tipo_subtipo?: string | null;

  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  pais?: string | null;
  ibge_code?: string | null;

  email?: string | null;
  email_nfe?: string | null;
  telefone?: string | null;
  celular?: string | null;

  data_nascimento?: string | null;
  limite_credito?: number | null;
  vendedor_id?: string | null;
  tabela_preco?: string | null;
  condicao_pagamento?: string | null;

  banco_nome?: string | null;
  banco_agencia?: string | null;
  banco_conta?: string | null;
  banco_pix?: string | null;

  situacao: SituacaoContato;
  observacoes?: string | null;
  anexos: unknown[];
  dados_complementares: Record<string, unknown>;
  last_synced_at?: string | null;
}
