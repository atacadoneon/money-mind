import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FormasPagamentoService } from './formas-pagamento.service';
import { FormaPagamento } from './entities/forma-pagamento.entity';

const makeForma = (o: Partial<FormaPagamento> = {}): FormaPagamento =>
  ({ id: 'fp-1', orgId: 'org-1', nome: 'Boleto', tipo: 'boleto', deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...o } as FormaPagamento);

describe('FormasPagamentoService', () => {
  let svc: FormasPagamentoService;
  const repo = {
    findAndCount: jest.fn().mockResolvedValue([[makeForma()], 1]),
    findOne: jest.fn().mockResolvedValue(makeForma()),
    create: jest.fn((x) => ({ id: 'fp-new', ...x })),
    save: jest.fn(async (x) => x),
    softRemove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.findOne.mockResolvedValue(makeForma());
    repo.findAndCount.mockResolvedValue([[makeForma()], 1]);
    const mod = await Test.createTestingModule({
      providers: [
        FormasPagamentoService,
        { provide: getRepositoryToken(FormaPagamento), useValue: repo },
      ],
    }).compile();
    svc = mod.get(FormasPagamentoService);
  });

  it('should be defined', () => expect(svc).toBeDefined());

  it('list returns paginated', async () => {
    const res = await svc.list('org-1', { page: 1, limit: 25 } as never);
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('get returns forma', async () => {
    const f = await svc.get('org-1', 'fp-1');
    expect(f.id).toBe('fp-1');
  });

  it('get throws NotFoundException', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.get('org-1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('create saves', async () => {
    await svc.create('org-1', { nome: 'PIX', tipo: 'pix' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('update applies changes', async () => {
    await svc.update('org-1', 'fp-1', { nome: 'Updated' } as never);
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove soft deletes', async () => {
    const res = await svc.remove('org-1', 'fp-1');
    expect(res.deleted).toBe(true);
  });
});
