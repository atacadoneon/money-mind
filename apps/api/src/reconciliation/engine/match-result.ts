export type MatchStrategy = 'exact' | 'tolerance' | 'pattern' | 'ai';

export interface MatchCandidate {
  kind: 'contaPagar' | 'contaReceber';
  id: string;
  valor: number;
  dataVencimento: string;
  historico: string;
  contatoId?: string | null;
  confidence: number; // 0..1
  strategy: MatchStrategy;
  reason: string;
}

export interface ReconciliationResult {
  linhaId: string;
  candidates: MatchCandidate[];
  best?: MatchCandidate;
}
