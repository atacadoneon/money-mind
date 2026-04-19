export interface CompanySeed {
  name: string;
  nome_fantasia: string;
  cnpj: string | null;
  slug: string;
  color: string;
}

export const COMPANIES_SEED: CompanySeed[] = [
  {
    name: 'BlueLight',
    nome_fantasia: 'BlueLight',
    cnpj: null,
    slug: 'bluelight',
    color: '#3B82F6',
  },
  {
    name: 'Industrias Neon',
    nome_fantasia: 'Industrias Neon',
    cnpj: null,
    slug: 'industrias-neon',
    color: '#8B5CF6',
  },
  {
    name: 'Atacado Neon',
    nome_fantasia: 'Atacado Neon',
    cnpj: null,
    slug: 'atacado-neon',
    color: '#EC4899',
  },
  {
    name: 'Engagge Placas',
    nome_fantasia: 'Engagge',
    cnpj: null,
    slug: 'engagge-placas',
    color: '#F59E0B',
  },
  {
    name: 'RYU Biotech',
    nome_fantasia: 'RYU',
    cnpj: null,
    slug: 'ryu-biotech',
    color: '#10B981',
  },
];
