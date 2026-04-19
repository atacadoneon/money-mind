/**
 * Integration test: OFX parse → reconciliation engine
 * Testa o fluxo completo: parse arquivo OFX → linha de extrato → match com CP/CR
 */
import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OfxParserService } from './ofx-parser.service';
import { ReconciliationEngine } from '../../reconciliation/engine/reconciliation.engine';
import { ContaPagar } from '../../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../../contas-receber/entities/conta-receber.entity';
import { ExtratoLinha } from '../entities/extrato-linha.entity';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/ofx');
const CONTA_ID = '00000000-0000-0000-0000-000000000001';

const cpExato = {
  id: 'cp-exact', valor: '1500.00', dataVencimento: '2026-04-01',
  descricao: 'PAG FORNECEDOR', fornecedorId: 'f1',
};

describe('OFX Parse + ReconciliationEngine (Integration)', () => {
  let ofxParser: OfxParserService;
  let engine: ReconciliationEngine;

  const mkQbHit = (rows: unknown[]) => ({
    where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    const cpQb = jest.fn(() => mkQbHit([cpExato]));
    const crQb = jest.fn(() => mkQbHit([]));
    const linhasRepo = {
      find: jest.fn(async () => []),
      save: jest.fn(async (x) => x),
    };

    const mod = await Test.createTestingModule({
      providers: [
        OfxParserService,
        ReconciliationEngine,
        { provide: getRepositoryToken(ContaPagar), useValue: { createQueryBuilder: cpQb } },
        { provide: getRepositoryToken(ContaReceber), useValue: { createQueryBuilder: crQb } },
        { provide: getRepositoryToken(ExtratoLinha), useValue: linhasRepo },
      ],
    }).compile();

    ofxParser = mod.get(OfxParserService);
    engine = mod.get(ReconciliationEngine);
  });

  it('parse Sicoob OFX → match exato com conta a pagar', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'sicoob.ofx'));

    // 1. Parse OFX
    const parsed = ofxParser.parse(buf, CONTA_ID);
    expect(parsed.bancoSlug).toBe('sicoob');
    expect(parsed.transactions.length).toBeGreaterThan(0);

    // 2. Primeira transação é débito de R$1500
    const tx = parsed.transactions[0];
    expect(tx.tipo).toBe('debito');
    expect(tx.valor).toBe(1500);

    // 3. Simula extrato linha
    const linha = {
      id: 'l-int-1', orgId: 'org-1', extratoId: 'ext-1', contaBancariaId: CONTA_ID,
      tipo: tx.tipo, valor: String(tx.valor), dataMovimento: tx.dataMovimento,
      descricao: tx.descricao, fitid: tx.fitid, status: 'pendente', metadata: {},
      createdAt: new Date(), updatedAt: new Date(),
    } as ExtratoLinha;

    // 4. Match via engine
    const result = await engine.matchLinha('org-1', linha);

    expect(result.best).toBeDefined();
    expect(result.best?.kind).toBe('contaPagar');
    expect(result.best?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('parse Itaú OFX → transações com fitidHash únicos', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'itau.ofx'));
    const parsed = ofxParser.parse(buf, CONTA_ID);

    const hashes = parsed.transactions.map((t) => t.fitidHash);
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(parsed.transactions.length);
  });

  it('parse Bradesco OFX → datas com timezone tratadas corretamente', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'bradesco.ofx'));
    const parsed = ofxParser.parse(buf, CONTA_ID);

    // Todas as datas devem estar no formato YYYY-MM-DD
    for (const tx of parsed.transactions) {
      expect(tx.dataMovimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('parse BB OFX → bankId correto para deduplicação', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'bb.ofx'));
    const parsed = ofxParser.parse(buf, CONTA_ID);

    expect(parsed.bancoSlug).toBe('bb');
    // Todos fitids devem ser únicos
    const fitids = new Set(parsed.transactions.map((t) => t.fitid));
    expect(fitids.size).toBe(parsed.transactions.length);
  });

  it('parse Santander OFX → parse correto com bankId 033', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'santander.ofx'));
    const parsed = ofxParser.parse(buf, CONTA_ID);

    expect(parsed.bancoSlug).toBe('santander');
    expect(parsed.transactions.length).toBe(2);
  });
});
