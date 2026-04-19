import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface ParsedOfxTx {
  fitid: string;
  fitidHash: string; // SHA-256(contaBancariaId + fitid)
  dataMovimento: string; // yyyy-mm-dd
  tipo: 'credito' | 'debito';
  valor: number;
  descricao: string;
  historico?: string;
  checknum?: string;
  bankId?: string;
  isPix?: boolean;
}

export interface ParsedOfx {
  periodoInicio: string;
  periodoFim: string;
  bankId?: string;
  bancoSlug?: string;
  contaCorrente?: string;
  transactions: ParsedOfxTx[];
}

export interface ContaSimplesTx {
  id?: string;
  type: string;
  transactionDate?: string;
  date?: string;
  amountBrl?: number;
  amount?: number;
  merchant?: string;
  description?: string;
  costCenter?: { name?: string };
}

// BANKID → slug interno
const BANKID_MAP: Record<string, string> = {
  '756': 'sicoob',
  '341': 'itau',
  '237': 'bradesco',
  '1': 'bb',
  '001': 'bb',
  '0': 'bb',
  '33': 'santander',
  '033': 'santander',
  '748': 'sicredi',
  '104': 'caixa',
  '260': 'nub',
  '290': 'olist',
  '403': 'cora',
  '336': 'c6',
};

@Injectable()
export class OfxParserService {
  private readonly logger = new Logger('OfxParserService');

  // ─── Encoding detection (sem iconv-lite, Node built-ins only) ───────────────

  private detectAndDecode(buf: Buffer): string {
    // UTF-8 BOM
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      return buf.slice(3).toString('utf8');
    }
    // Tenta UTF-8; se não houver replacement chars, ok
    const utf8 = buf.toString('utf8');
    if (!utf8.includes('\uFFFD')) return utf8;
    // Fallback latin1 (ISO-8859-1 / cp1252 — suficiente para bancos BR)
    return buf.toString('latin1');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private isXml(text: string): boolean {
    const start = text.trimStart();
    return start.startsWith('<?xml') || start.startsWith('<OFX>') || start.startsWith('<ofx>');
  }

  private getTag(block: string, tag: string): string {
    const r = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
    return r ? r[1].trim() : '';
  }

  /** YYYYMMDD[HHmmss[.000][-TZ:offset]] → yyyy-mm-dd */
  private parseOfxDate(raw: string): string {
    const clean = raw.replace(/\[.*$/, '').trim();
    if (clean.length >= 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
    return new Date().toISOString().slice(0, 10);
  }

  /** Gera FITID estável para PIX sem FITID real */
  private generatePixFitid(contaBancariaId: string, data: string, valor: number, memo: string): string {
    const raw = `PIX|${contaBancariaId}|${data}|${valor.toFixed(2)}|${memo.slice(0, 40)}`;
    return 'PIX_' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }

  /** SHA-256(contaBancariaId|fitid) para deduplicação */
  fitidHash(contaBancariaId: string, fitid: string): string {
    return crypto.createHash('sha256').update(`${contaBancariaId}|${fitid}`).digest('hex');
  }

  private detectBanco(bankId: string, text: string): string {
    const normalized = bankId.replace(/^0+/, '') || bankId;
    if (BANKID_MAP[normalized]) return BANKID_MAP[normalized];
    if (BANKID_MAP[bankId]) return BANKID_MAP[bankId];
    if (/SICOOB|UNICOOP/i.test(text)) return 'sicoob';
    if (/ITAU/i.test(text)) return 'itau';
    if (/BRADESCO/i.test(text)) return 'bradesco';
    if (/BANCO DO BRASIL/i.test(text)) return 'bb';
    if (/SANTANDER/i.test(text)) return 'santander';
    if (/OLIST|CONTA SIMPLES/i.test(text)) return 'olist';
    return 'outro';
  }

  // ─── SGML / XML parser ───────────────────────────────────────────────────────

  private parseSgmlOrXml(text: string, contaBancariaId: string): ParsedOfx {
    const bankIdRaw = this.getTag(text, 'BANKID') || '';
    const bankId = bankIdRaw.trim();
    const bancoSlug = this.detectBanco(bankId, text);
    const contaCorrente = this.getTag(text, 'ACCTID') || undefined;

    const dtStart = this.getTag(text, 'DTSTART');
    const dtEnd = this.getTag(text, 'DTEND');

    const rxTx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    const transactions: ParsedOfxTx[] = [];
    let m: RegExpExecArray | null;

    while ((m = rxTx.exec(text))) {
      const block = m[1];
      const get = (tag: string) => this.getTag(block, tag);

      const trntype = get('TRNTYPE').toUpperCase();
      const dtposted = get('DTPOSTED');
      const trnamt = get('TRNAMT');
      const fitidRaw = get('FITID').trim();
      const memo = get('MEMO');
      const name = get('NAME');
      const checknum = get('CHECKNUM') || undefined;

      const dataMovimento = dtposted
        ? this.parseOfxDate(dtposted)
        : new Date().toISOString().slice(0, 10);
      const valorRaw = parseFloat(trnamt || '0');
      const valor = Math.abs(valorRaw);

      const debitTypes = new Set(['DEBIT', 'PAYMENT', 'CHECK', 'ATM', 'POS', 'FEE', 'SRVCHG']);
      const tipo: 'credito' | 'debito' =
        debitTypes.has(trntype) || valorRaw < 0 ? 'debito' : 'credito';

      const descricao = (memo || name || trntype).slice(0, 400);
      const isPix = /pix/i.test(descricao) || /^PIX/i.test(fitidRaw);

      let fitid = fitidRaw;
      if (!fitid) {
        fitid = this.generatePixFitid(contaBancariaId, dataMovimento, valor, descricao);
      }

      transactions.push({
        fitid,
        fitidHash: this.fitidHash(contaBancariaId, fitid),
        dataMovimento,
        tipo,
        valor,
        descricao,
        historico: name || undefined,
        checknum,
        bankId: bankId || undefined,
        isPix,
      });
    }

    const dates = transactions.map((t) => t.dataMovimento).sort();
    const periodoInicio = dtStart
      ? this.parseOfxDate(dtStart)
      : (dates[0] ?? new Date().toISOString().slice(0, 10));
    const periodoFim = dtEnd
      ? this.parseOfxDate(dtEnd)
      : (dates[dates.length - 1] ?? periodoInicio);

    this.logger.log(`[OFX] banco=${bancoSlug} | ${transactions.length} txs | ${periodoInicio} → ${periodoFim}`);
    return { periodoInicio, periodoFim, bankId: bankId || undefined, bancoSlug, contaCorrente, transactions };
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  parse(buf: Buffer, contaBancariaId: string): ParsedOfx {
    const text = this.detectAndDecode(buf);
    return this.parseSgmlOrXml(text, contaBancariaId);
  }

  parseText(text: string, contaBancariaId: string): ParsedOfx {
    return this.parseSgmlOrXml(text, contaBancariaId);
  }

  /** Para integração com API JSON da Conta Simples */
  parseContaSimples(transactions: ContaSimplesTx[], contaBancariaId: string): ParsedOfx {
    const debitTypes = new Set(['PURCHASE', 'PURCHASE_INTERNATIONAL', 'IOF', 'WITHDRAWAL', 'FEE']);
    const creditTypes = new Set(['LIMIT', 'REFUND', 'CREDIT', 'CASHBACK']);

    const txs: ParsedOfxTx[] = transactions
      .filter((t) => debitTypes.has(t.type) || creditTypes.has(t.type))
      .map((t) => {
        const tipo: 'credito' | 'debito' = creditTypes.has(t.type) ? 'credito' : 'debito';
        const dataMovimento = (t.transactionDate || t.date || '').slice(0, 10);
        const valor = Math.abs(t.amountBrl ?? t.amount ?? 0);
        const descricao = (t.merchant || t.description || t.type).slice(0, 400);
        const fitid = t.id || this.generatePixFitid(contaBancariaId, dataMovimento, valor, descricao);
        return {
          fitid,
          fitidHash: this.fitidHash(contaBancariaId, fitid),
          dataMovimento,
          tipo,
          valor,
          descricao,
          historico: t.costCenter?.name ?? undefined,
          bankId: 'contasimples',
          isPix: false,
        };
      });

    const dates = txs.map((t) => t.dataMovimento).sort();
    const periodoInicio = dates[0] ?? new Date().toISOString().slice(0, 10);
    const periodoFim = dates[dates.length - 1] ?? periodoInicio;

    this.logger.log(`[ContaSimples] ${txs.length} txs`);
    return { periodoInicio, periodoFim, bancoSlug: 'conta_simples', transactions: txs };
  }
}
