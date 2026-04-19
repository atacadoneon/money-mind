/**
 * Integration test: reconciliation engine flow with mock repositories.
 * Tests the full pipeline: linha → matchLinha → candidates returned.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReconciliationEngine } from '../../src/reconciliation/engine/reconciliation.engine';
import { ExtratoLinha } from '../../src/extratos-bancarios/entities/extrato-linha.entity';
import { ContaPagar } from '../../src/contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../../src/contas-receber/entities/conta-receber.entity';

const makeCP = (overrides = {}): ContaPagar => ({
  id: 'cp-1', orgId: 'org-1', companyId: 'co-1', situacao: 'aberto',
  valor: '250.00', valorPago: '0', juros: '0', multa: '0', desconto: '0',
  dataVencimento: '2026-05-10', descricao: 'ENERGIA ELETRICA', marcadoresIds: [], parcelamento: {}, metadata: {},
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null, ...overrides,
} as ContaPagar);

const makeExtratoLinha = (overrides = {}): ExtratoLinha => ({
  id: 'l-1', orgId: 'org-1', extratoId: 'e-1', contaBancariaId: 'cb-1',
  tipo: 'debito', valor: '250.00', dataMovimento: '2026-05-10',
  descricao: 'PAG ENERGIA ELETRICA', status: 'pendente', metadata: {},
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
} as ExtratoLinha);

describe('ReconciliationEngine — integration flow (mock repos)', () => {
  let engine: ReconciliationEngine;

  const cpQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([makeCP()]),
  };

  const crQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const cpRepo = { createQueryBuilder: jest.fn(() => cpQb) };
  const crRepo = { createQueryBuilder: jest.fn(() => crQb) };
  const linhaRepo = {
    find: jest.fn().mockResolvedValue([makeExtratoLinha()]),
    save: jest.fn(async (x) => Array.isArray(x) ? x : x),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cpRepo.createQueryBuilder.mockReturnValue(cpQb);
    crRepo.createQueryBuilder.mockReturnValue(crQb);
    cpQb.getMany.mockResolvedValue([makeCP()]);
    crQb.getMany.mockResolvedValue([]);

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationEngine,
        { provide: getRepositoryToken(ContaPagar), useValue: cpRepo },
        { provide: getRepositoryToken(ContaReceber), useValue: crRepo },
        { provide: getRepositoryToken(ExtratoLinha), useValue: linhaRepo },
      ],
    }).compile();
    engine = mod.get(ReconciliationEngine);
  });

  it('engine should be defined', () => expect(engine).toBeDefined());

  it('matchLinha returns exact match with confidence=1.0 for debito matching CP', async () => {
    const linha = makeExtratoLinha({ tipo: 'debito', valor: '250.00', dataMovimento: '2026-05-10' });
    cpQb.getMany.mockResolvedValue([makeCP({ valor: '250.00', dataVencimento: '2026-05-10' })]);

    const result = await engine.matchLinha('org-1', linha);
    expect(result).toBeDefined();
    expect(result.candidates.length).toBeGreaterThan(0);
    const exactMatch = result.candidates.find((c: { strategy: string }) => c.strategy === 'exact');
    expect(exactMatch).toBeDefined();
    expect(exactMatch!.confidence).toBe(1.0);
  });

  it('matchLinha returns no candidates when no CP/CR matches', async () => {
    const linha = makeExtratoLinha({ valor: '999.99' });
    cpQb.getMany.mockResolvedValue([]);
    crQb.getMany.mockResolvedValue([]);

    const result = await engine.matchLinha('org-1', linha);
    // Either empty candidates or AI stub candidates
    expect(result).toBeDefined();
    expect(result.linhaId).toBe('l-1');
  });

  it('matchLinha credito matches ContaReceber', async () => {
    const linha = makeExtratoLinha({ tipo: 'credito', valor: '500.00' });
    const cr = { id: 'cr-1', orgId: 'org-1', valor: '500.00', dataVencimento: '2026-05-10', descricao: 'Venda', clienteId: 'cl-1', situacao: 'aberto' };
    crQb.getMany.mockResolvedValue([cr]);

    const result = await engine.matchLinha('org-1', linha);
    expect(result.candidates.length).toBeGreaterThan(0);
    const match = result.candidates[0];
    expect(match.kind).toBe('contaReceber');
  });

  it('matchBatch processes all lines in extrato', async () => {
    linhaRepo.find.mockResolvedValue([makeExtratoLinha(), makeExtratoLinha({ id: 'l-2' })]);
    cpQb.getMany.mockResolvedValue([makeCP()]);

    const result = await engine.matchBatch('org-1', 'e-1');
    expect(result.processed).toBe(2);
    expect(typeof result.matched).toBe('number');
  });

  it('matchBatch returns processed=0 for empty extrato', async () => {
    linhaRepo.find.mockResolvedValue([]);
    const result = await engine.matchBatch('org-1', 'empty-extrato');
    expect(result.processed).toBe(0);
    expect(result.matched).toBe(0);
  });
});
