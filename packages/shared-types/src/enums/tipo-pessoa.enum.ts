export const TIPOS_PESSOA = ['F', 'J'] as const;
export type TipoPessoa = (typeof TIPOS_PESSOA)[number];

export const TIPOS_CONTATO = ['cliente', 'fornecedor', 'transportador', 'vendedor'] as const;
export type TipoContato = (typeof TIPOS_CONTATO)[number];

export const CONTRIBUINTE_OPTIONS = ['0', '1', '2'] as const;
export type Contribuinte = (typeof CONTRIBUINTE_OPTIONS)[number];
