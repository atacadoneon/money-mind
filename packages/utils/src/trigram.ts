/**
 * Normaliza texto para busca fuzzy (trigram compatível com pg_trgm).
 * - Remove acentos
 * - Lowercase
 * - Colapsa espaços
 * - Remove pontuação comum
 */
export function trigramNormalize(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula similaridade trigram client-side (aproximação do pg_trgm similarity()).
 * Retorna valor entre 0 e 1.
 */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(trigramNormalize(a));
  const tb = trigrams(trigramNormalize(b));
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
}
