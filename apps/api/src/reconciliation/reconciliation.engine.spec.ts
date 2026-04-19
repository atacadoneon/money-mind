import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReconciliationEngine } from './engine/reconciliation.engine';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';

const cpRow = {
  id: 'cp-1', valor: '150.00', dataVencimento: '2026-05-10',
  descricao: 'Energia Elétrica', fornecedorId: 'f1',
};

const crRow = {
  id: 'cr-1', valor: '500.00', dataVencimento: '2026-05-10',
  descricao: 'Venda Online', clienteId: 'c1',
};

const makeLinha = (overrides: Partial<ExtratoLinha>): ExtratoLinha => ({
  id: 'l1', orgId: 'org-1', extratoId: 'ext-1', contaBancariaId: 'cb-1',
  tipo: 'debito', valor: '150.00', dataMovimento: '2026-05-10',
  descricao: 'PAG ENERGIA', status: 'pendente', metadata: {},
  createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
} as ExtratoLinha);

describe('ReconciliationEngine', () => {
  let engine: ReconciliationEngine;

  const mkQbHit = (rows: unknown[]) => ({
    where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue(rows),
  });
  const mkQbEmpty = () => mkQbHit([]);

  const setupEngine = async (cpRows: unknown[] = [], crRows: unknown[] = []) => {
    const cpQb = jest.fn(() => mkQbHit(cpRows));
    const crQb = jest.fn(() => mkQbHit(crRows));

    const cps: Record<string, unknown> = { createQueryBuilder: cpQb };
    const crs: Record<string, unknown> = { createQueryBuilder: crQb };
    const linhas: Record<string, unknown> = {
      find: jest.fn(async () => []),
      save: jest.fn(async (x) => x),
    };

    const mod = await Test.createTestingModule({
      providers: [
        ReconciliationEngine,
        { provide: getRepositoryToken(ContaPagar), useValue: cps },
        { provide: getRepositoryToken(ContaReceber), useValue: crs },
        { provide: getRepositoryToken(ExtratoLinha), useValue: linhas },
      ],
    }).compile();
    return mod.get(ReconciliationEngine);
  };

  // ─── Layer 1: Exact Match ────────────────────────────────────────────────

  describe('Layer 1 — Exact Match', () => {
    it('match débito → contaPagar com confidence=1.0', async () => {
      engine = await setupEngine([cpRow], []);
      const linha = makeLinha({ tipo: 'debito', valor: '150.00', dataMovimento: '2026-05-10' });
      const res = await engine.matchLinha('org-1', linha);
      expect(res.best?.strategy).toBe('exact');
      expect(res.best?.confidence).toBe(1.0);
      expect(res.best?.kind).toBe('contaPagar');
    });

    it('match crédito → contaReceber com confidence=1.0', async () => {
      engine = await setupEngine([], [crRow]);
      const linha = makeLinha({ tipo: 'credito', valor: '500.00', dataMovimento: '2026-05-10' });
      const res = await engine.matchLinha('org-1', linha);
      expect(res.best?.strategy).toBe('exact');
      expect(res.best?.confidence).toBe(1.0);
      expect(res.best?.kind).toBe('contaReceber');
    });
  });

  // ─── Layer 2: Tolerance ──────────────────────────────────────────────────

  describe('Layer 2 — Tolerance', () => {
    it('match com diferença de R$0.30 usa strategy=tolerance', async () => {
      // Layer1 retorna vazio, Layer2 retorna hit
      const cpQbCalls: unknown[][] = [[], [{ ...cpRow, valor: '150.30' }], []];
      let callCount = 0;
      const cpQb = jest.fn(() => mkQbHit(cpQbCalls[callCount++] ?? []));

      const cps: Record<string, unknown> = { createQueryBuilder: cpQb };
      const crs: Record<string, unknown> = { createQueryBuilder: jest.fn(() => mkQbEmpty()) };
      const linhas: Record<string, unknown> = {
        find: jest.fn(async () => []),
        save: jest.fn(async (x) => x),
      };

      const mod = await Test.createTestingModule({
        providers: [
          ReconciliationEngine,
          { provide: getRepositoryToken(ContaPagar), useValue: cps },
          { provide: getRepositoryToken(ContaReceber), useValue: crs },
          { provide: getRepositoryToken(ExtratoLinha), useValue: linhas },
        ],
      }).compile();
      engine = mod.get(ReconciliationEngine);

      const linha = makeLinha({ tipo: 'debito', valor: '150.00', dataMovimento: '2026-05-10' });
      const res = await engine.matchLinha('org-1', linha);
      // Deve encontrar tolerance match
      expect(res.best?.strategy).toBe('tolerance');
      expect(res.best?.confidence).toBeGreaterThan(0.7);
      expect(res.best?.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  // ─── Layer 3: Pattern ────────────────────────────────────────────────────

  describe('Layer 3 — Pattern (similarity)', () => {
    it('sem match nas layers 1 e 2 retorna candidatos com strategy=pattern', async () => {
      let callCount = 0;
      const cpRows = [[], [], [{ ...cpRow, descricao: 'ENERGIA ELETRICA SP' }]];
      const cpQb = jest.fn(() => mkQbHit(cpRows[callCount++] ?? []));

      const cps: Record<string, unknown> = { createQueryBuilder: cpQb };
      const crs: Record<string, unknown> = { createQueryBuilder: jest.fn(() => mkQbEmpty()) };
      const linhas: Record<string, unknown> = {
        find: jest.fn(async () => []),
        save: jest.fn(async (x) => x),
      };

      const mod = await Test.createTestingModule({
        providers: [
          ReconciliationEngine,
          { provide: getRepositoryToken(ContaPagar), useValue: cps },
          { provide: getRepositoryToken(ContaReceber), useValue: crs },
          { provide: getRepositoryToken(ExtratoLinha), useValue: linhas },
        ],
      }).compile();
      engine = mod.get(ReconciliationEngine);

      const linha = makeLinha({
        tipo: 'debito', valor: '150.00', dataMovimento: '2026-05-10',
        descricao: 'ENERGIA ELETRICA',
      });
      const res = await engine.matchLinha('org-1', linha);
      expect(res.best?.strategy).toBe('pattern');
      expect(res.best?.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  // ─── Sem candidatos ──────────────────────────────────────────────────────

  describe('Sem candidatos', () => {
    it('retorna candidates vazio e best undefined', async () => {
      engine = await setupEngine([], []);
      const linha = makeLinha({ tipo: 'debito', valor: '9999.99', dataMovimento: '2026-05-10', descricao: 'XYZ' });
      const res = await engine.matchLinha('org-1', linha);
      expect(res.candidates).toHaveLength(0);
      expect(res.best).toBeUndefined();
    });
  });

  // ─── matchBatch ──────────────────────────────────────────────────────────

  describe('matchBatch', () => {
    it('processa batch e retorna stats', async () => {
      const cpQb = jest.fn(() => mkQbHit([cpRow]));
      const cps: Record<string, unknown> = { createQueryBuilder: cpQb };
      const crQb = jest.fn(() => mkQbEmpty());
      const crs: Record<string, unknown> = { createQueryBuilder: crQb };

      const linhasPendentes = [
        makeLinha({ id: 'l1', tipo: 'debito', valor: '150.00', dataMovimento: '2026-05-10' }),
      ];
      const linhas: Record<string, unknown> = {
        find: jest.fn(async () => linhasPendentes),
        save: jest.fn(async (x) => x),
      };

      const mod = await Test.createTestingModule({
        providers: [
          ReconciliationEngine,
          { provide: getRepositoryToken(ContaPagar), useValue: cps },
          { provide: getRepositoryToken(ContaReceber), useValue: crs },
          { provide: getRepositoryToken(ExtratoLinha), useValue: linhas },
        ],
      }).compile();
      engine = mod.get(ReconciliationEngine);

      const stats = await engine.matchBatch('org-1', 'ext-1');
      expect(stats.processed).toBe(1);
      expect(stats.matched).toBe(1);
    });
  });
});
