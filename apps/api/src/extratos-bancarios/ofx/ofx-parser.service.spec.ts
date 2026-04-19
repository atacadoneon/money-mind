import * as fs from 'fs';
import * as path from 'path';
import { OfxParserService, ContaSimplesTx } from './ofx-parser.service';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/ofx');

describe('OfxParserService', () => {
  let svc: OfxParserService;

  beforeEach(() => {
    svc = new OfxParserService();
  });

  const CONTA_ID = '00000000-0000-0000-0000-000000000001';

  // ─── Sicoob ────────────────────────────────────────────────────────────────

  describe('Sicoob (BANKID 756)', () => {
    it('detecta banco como sicoob', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.bancoSlug).toBe('sicoob');
    });

    it('parseia 3 transações', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions).toHaveLength(3);
    });

    it('tipo debito/credito correto', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions[0].tipo).toBe('debito');
      expect(result.transactions[1].tipo).toBe('credito');
    });

    it('valores absolutos (sem sinal)', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions[0].valor).toBe(1500.00);
      expect(result.transactions[1].valor).toBe(2500.00);
    });

    it('FITID preservado', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions[0].fitid).toBe('SICOOB20260401001');
    });

    it('fitidHash é SHA-256 de contaBancariaId+fitid', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      const expected = svc.fitidHash(CONTA_ID, 'SICOOB20260401001');
      expect(result.transactions[0].fitidHash).toBe(expected);
    });

    it('periodo inicio/fim correto', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.periodoInicio).toBe('2026-04-01');
      expect(result.periodoFim).toBe('2026-04-10');
    });
  });

  // ─── Itaú ──────────────────────────────────────────────────────────────────

  describe('Itaú (BANKID 341)', () => {
    it('detecta banco como itau', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'itau.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.bancoSlug).toBe('itau');
    });

    it('parseia 2 transações', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'itau.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions).toHaveLength(2);
    });
  });

  // ─── Bradesco ──────────────────────────────────────────────────────────────

  describe('Bradesco (BANKID 237)', () => {
    it('detecta banco como bradesco', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'bradesco.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.bancoSlug).toBe('bradesco');
    });

    it('trata timezone no DTPOSTED sem falhar', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'bradesco.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions[0].dataMovimento).toBe('2026-04-03');
    });

    it('PIX recebido identificado como credito', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'bradesco.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions[1].tipo).toBe('credito');
    });
  });

  // ─── Banco do Brasil ───────────────────────────────────────────────────────

  describe('Banco do Brasil (BANKID 001)', () => {
    it('detecta banco como bb', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'bb.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.bancoSlug).toBe('bb');
    });

    it('parseia 3 transações', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'bb.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions).toHaveLength(3);
    });
  });

  // ─── Santander ─────────────────────────────────────────────────────────────

  describe('Santander (BANKID 033)', () => {
    it('detecta banco como santander', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'santander.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.bancoSlug).toBe('santander');
    });

    it('parseia 2 transações', () => {
      const buf = fs.readFileSync(path.join(FIXTURES, 'santander.ofx'));
      const result = svc.parse(buf, CONTA_ID);
      expect(result.transactions).toHaveLength(2);
    });
  });

  // ─── PIX sem FITID ────────────────────────────────────────────────────────

  describe('PIX sem FITID — geração automática', () => {
    it('gera FITID estável para transação sem FITID', () => {
      const ofxSemFitid = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>756</BANKID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260401000000</DTPOSTED>
<TRNAMT>100.00</TRNAMT>
<FITID></FITID>
<MEMO>PIX RECEBIDO</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;
      const result = svc.parseText(ofxSemFitid, CONTA_ID);
      expect(result.transactions[0].fitid).toMatch(/^PIX_/);
      expect(result.transactions[0].fitidHash).toBeTruthy();
    });
  });

  // ─── Conta Simples JSON ────────────────────────────────────────────────────

  describe('ContaSimples (JSON API)', () => {
    it('parseia transações Conta Simples', () => {
      const txs: ContaSimplesTx[] = [
        { id: 'cs-001', type: 'PURCHASE', transactionDate: '2026-04-01', amountBrl: 250, merchant: 'FACEBOOK' },
        { id: 'cs-002', type: 'LIMIT', transactionDate: '2026-04-02', amountBrl: 1000, description: 'Recarga' },
        { id: 'cs-003', type: 'IOF', transactionDate: '2026-04-03', amountBrl: 5, description: 'IOF' },
      ];
      const result = svc.parseContaSimples(txs, CONTA_ID);
      expect(result.bancoSlug).toBe('conta_simples');
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].tipo).toBe('debito');
      expect(result.transactions[1].tipo).toBe('credito');
    });

    it('ignora tipos desconhecidos', () => {
      const txs: ContaSimplesTx[] = [
        { id: 'cs-x', type: 'UNKNOWN_TYPE', transactionDate: '2026-04-01', amountBrl: 100 },
      ];
      const result = svc.parseContaSimples(txs, CONTA_ID);
      expect(result.transactions).toHaveLength(0);
    });
  });

  // ─── Deduplicação de fitidHash ─────────────────────────────────────────────

  describe('fitidHash', () => {
    it('mesmo fitid + contaBancariaId gera mesmo hash', () => {
      const h1 = svc.fitidHash('conta-1', 'fitid-abc');
      const h2 = svc.fitidHash('conta-1', 'fitid-abc');
      expect(h1).toBe(h2);
    });

    it('fitid diferente gera hash diferente', () => {
      const h1 = svc.fitidHash('conta-1', 'fitid-abc');
      const h2 = svc.fitidHash('conta-1', 'fitid-xyz');
      expect(h1).not.toBe(h2);
    });

    it('conta diferente gera hash diferente', () => {
      const h1 = svc.fitidHash('conta-1', 'fitid-abc');
      const h2 = svc.fitidHash('conta-2', 'fitid-abc');
      expect(h1).not.toBe(h2);
    });
  });
});
