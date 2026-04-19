import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ExtratosBancariosService } from './extratos-bancarios.service';
import { ExtratoBancario } from './entities/extrato.entity';
import { ExtratoLinha } from './entities/extrato-linha.entity';
import { OfxParserService } from './ofx/ofx-parser.service';

const makeExtrato = (o: Partial<ExtratoBancario> = {}): ExtratoBancario =>
  ({ id: 'e-1', orgId: 'org-1', companyId: 'co-1', contaBancariaId: 'cb-1', status: 'processado', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...o } as ExtratoBancario);

const makeLinha = (o: Partial<ExtratoLinha> = {}): ExtratoLinha =>
  ({ id: 'l-1', orgId: 'org-1', extratoId: 'e-1', tipo: 'debito', valor: '100', dataMovimento: '2026-01-01', descricao: 'Test', status: 'pendente', ...o } as ExtratoLinha);

const makeQb = (rows: unknown[] = [], count = 0) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, count]),
});

describe('ExtratosBancariosService', () => {
  let svc: ExtratosBancariosService;
  const extratos = {
    createQueryBuilder: jest.fn(() => makeQb([makeExtrato()], 1)),
    findOne: jest.fn().mockResolvedValue(makeExtrato()),
    create: jest.fn((x) => ({ id: 'e-new', ...x })),
    save: jest.fn(async (x) => x),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };
  const linhas = {
    createQueryBuilder: jest.fn(() => makeQb([makeLinha()], 1)),
    find: jest.fn().mockResolvedValue([makeLinha()]),
    save: jest.fn(async (x) => x),
  };
  const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
  const ofxParser = { parse: jest.fn().mockResolvedValue({ transactions: [] }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    extratos.createQueryBuilder.mockImplementation(() => makeQb([makeExtrato()], 1));
    extratos.findOne.mockResolvedValue(makeExtrato());
    linhas.createQueryBuilder.mockImplementation(() => makeQb([makeLinha()], 1));
    const mod = await Test.createTestingModule({
      providers: [
        ExtratosBancariosService,
        { provide: getRepositoryToken(ExtratoBancario), useValue: extratos },
        { provide: getRepositoryToken(ExtratoLinha), useValue: linhas },
        { provide: getQueueToken('extrato-parse'), useValue: queue },
        { provide: OfxParserService, useValue: ofxParser },
      ],
    }).compile();
    svc = mod.get(ExtratosBancariosService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('listExtratos returns paginated', async () => {
    const res = await svc.listExtratos('org-1', { page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
  });

  it('listExtratos filters by contaBancariaId', async () => {
    const mockQb = makeQb([], 0);
    extratos.createQueryBuilder.mockReturnValue(mockQb);
    await svc.listExtratos('org-1', { page: 1, limit: 25, contaBancariaId: 'cb-1' } as never);
    expect(mockQb.andWhere).toHaveBeenCalledWith('e.conta_bancaria_id = :cb', { cb: 'cb-1' });
  });

  it('getExtrato returns extrato', async () => {
    const e = await svc.getExtrato('org-1', 'e-1');
    expect(e.id).toBe('e-1');
  });

  it('getExtrato throws NotFoundException', async () => {
    extratos.findOne.mockResolvedValueOnce(null);
    await expect(svc.getExtrato('org-1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('listLinhas returns paginated', async () => {
    const res = await svc.listLinhas('org-1', 'e-1', { page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
  });
});
