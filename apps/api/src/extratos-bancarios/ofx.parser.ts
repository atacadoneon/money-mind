import { Logger } from '@nestjs/common';

export interface ParsedOfxTx {
  fitid?: string;
  dataMovimento: string; // yyyy-mm-dd
  tipo: 'credito' | 'debito';
  valor: number;
  descricao: string;
  historico?: string;
}

export interface ParsedOfx {
  periodoInicio: string;
  periodoFim: string;
  transactions: ParsedOfxTx[];
}

/**
 * Simple regex-based OFX parser (SGML). Avoids heavy deps.
 * Extracts STMTTRN blocks.
 */
export class OfxParser {
  private static readonly logger = new Logger('OfxParser');

  static parse(buf: Buffer | string): ParsedOfx {
    const text = typeof buf === 'string' ? buf : buf.toString('utf8');
    const rxTx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    const txs: ParsedOfxTx[] = [];
    let m: RegExpExecArray | null;
    while ((m = rxTx.exec(text))) {
      const block = m[1];
      const get = (tag: string) => {
        const r = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
        return r ? r[1].trim() : '';
      };
      const trntype = get('TRNTYPE').toUpperCase();
      const dtposted = get('DTPOSTED').slice(0, 8);
      const valor = Number(get('TRNAMT') || '0');
      const fitid = get('FITID');
      const memo = get('MEMO');
      const name = get('NAME');
      const dataMovimento = dtposted
        ? `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`
        : new Date().toISOString().slice(0, 10);
      txs.push({
        fitid: fitid || undefined,
        dataMovimento,
        tipo: valor < 0 || trntype === 'DEBIT' ? 'debito' : 'credito',
        valor: Math.abs(valor),
        descricao: memo || name || trntype,
        historico: name || undefined,
      });
    }
    const dates = txs.map((t) => t.dataMovimento).sort();
    const periodoInicio = dates[0] ?? new Date().toISOString().slice(0, 10);
    const periodoFim = dates[dates.length - 1] ?? periodoInicio;
    this.logger.log(`Parsed ${txs.length} transactions from OFX`);
    return { transactions: txs, periodoInicio, periodoFim };
  }
}
