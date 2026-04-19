/**
 * Parser OFX (stub inicial). Implementação mínima capaz de extrair STMTTRN.
 * Suporta OFX 1.x (SGML) e 2.x (XML) em modo best-effort.
 * A versão production-ready virá no módulo de import do backend.
 */
import { createHash } from 'node:crypto';

export interface OfxTransaction {
  fitid: string;
  trnType: 'CREDIT' | 'DEBIT' | 'OTHER';
  dtPosted: string; // YYYY-MM-DD
  amount: number;
  memo: string;
  name?: string;
  checkNumber?: string;
  refNum?: string;
  raw: string;
}

export interface OfxParsed {
  fileHash: string;
  accountId?: string;
  bankId?: string;
  dateStart?: string;
  dateEnd?: string;
  transactions: OfxTransaction[];
}

/**
 * Gera SHA-256 hex do conteúdo para dedup (file_hash).
 */
export function hashOfxContent(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Parser best-effort. Troque por `node-ofx-parser` no runtime final.
 */
export function parseOfxStub(content: string): OfxParsed {
  const fileHash = hashOfxContent(content);
  const transactions: OfxTransaction[] = [];

  const blocks = content.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const chunk = raw.split(/<\/STMTTRN>/i)[0] ?? '';
    const get = (tag: string): string => {
      const m = chunk.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
      return m?.[1]?.trim() ?? '';
    };
    const trnType = get('TRNTYPE').toUpperCase();
    const amt = parseFloat(get('TRNAMT') || '0');
    const dt = get('DTPOSTED').slice(0, 8);
    const dtIso = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : '';

    transactions.push({
      fitid: get('FITID'),
      trnType: trnType === 'CREDIT' ? 'CREDIT' : trnType === 'DEBIT' ? 'DEBIT' : 'OTHER',
      dtPosted: dtIso,
      amount: amt,
      memo: get('MEMO'),
      name: get('NAME') || undefined,
      checkNumber: get('CHECKNUM') || undefined,
      refNum: get('REFNUM') || undefined,
      raw: chunk.trim(),
    });
  }

  const accountMatch = content.match(/<ACCTID>([^<\r\n]+)/i);
  const bankMatch = content.match(/<BANKID>([^<\r\n]+)/i);

  const datesSorted = transactions
    .map((t) => t.dtPosted)
    .filter(Boolean)
    .sort();

  return {
    fileHash,
    accountId: accountMatch?.[1]?.trim(),
    bankId: bankMatch?.[1]?.trim(),
    dateStart: datesSorted[0],
    dateEnd: datesSorted[datesSorted.length - 1],
    transactions,
  };
}
