import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CentroCusto } from './entities/centro-custo.entity';
import { RegraRateio } from './entities/regra-rateio.entity';
import { RateioItem } from './entities/rateio-item.entity';
import { RegraCategorizacao } from './entities/regra-categorizacao.entity';
import {
  AplicarRateioDto, CreateCentroCustoDto, CreateRegraCategorizacaoDto,
  CreateRegraRateioDto, ListCentrosCustoQuery, SugerirCategoriaDto,
  UpdateCentroCustoDto, UpdateRegraCategorizacaoDto, UpdateRegraRateioDto,
} from './dto/plano-contas.dto';
import { buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class PlanoContasService {
  constructor(
    @InjectRepository(CentroCusto) private readonly ccRepo: Repository<CentroCusto>,
    @InjectRepository(RegraRateio) private readonly rateioRepo: Repository<RegraRateio>,
    @InjectRepository(RateioItem) private readonly rateioItemRepo: Repository<RateioItem>,
    @InjectRepository(RegraCategorizacao) private readonly regraRepo: Repository<RegraCategorizacao>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ─── Centros de Custo ─────────────────────────────────────────────────────

  async listCentros(orgId: string, q: ListCentrosCustoQuery) {
    const qb = this.ccRepo.createQueryBuilder('cc')
      .where('cc.org_id = :orgId AND cc.deleted_at IS NULL', { orgId })
      .orderBy('cc.codigo', 'ASC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.companyId) qb.andWhere('(cc.company_id = :cid OR cc.company_id IS NULL)', { cid: q.companyId });
    if (q.apenasAtivos) qb.andWhere('cc.is_active = true');
    if (q.search) qb.andWhere('(cc.nome ILIKE :s OR cc.codigo ILIKE :s)', { s: `%${q.search}%` });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async getCentro(orgId: string, id: string) {
    const cc = await this.ccRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!cc) throw new NotFoundException('Centro de custo não encontrado');
    return cc;
  }

  async createCentro(orgId: string, dto: CreateCentroCustoDto) {
    let nivel = 1;
    if (dto.parentId) {
      const parent = await this.getCentro(orgId, dto.parentId);
      nivel = parent.nivel + 1;
    }

    const entity = this.ccRepo.create({
      orgId,
      companyId: dto.companyId ?? null,
      parentId: dto.parentId ?? null,
      codigo: dto.codigo,
      nome: dto.nome,
      isActive: dto.isActive ?? true,
      nivel,
    });
    return this.ccRepo.save(entity);
  }

  async updateCentro(orgId: string, id: string, dto: UpdateCentroCustoDto) {
    const cc = await this.getCentro(orgId, id);
    if (dto.nome !== undefined) cc.nome = dto.nome;
    if (dto.isActive !== undefined) cc.isActive = dto.isActive;
    if (dto.parentId !== undefined) {
      cc.parentId = dto.parentId ?? null;
      if (dto.parentId) {
        const parent = await this.getCentro(orgId, dto.parentId);
        cc.nivel = parent.nivel + 1;
      } else {
        cc.nivel = 1;
      }
    }
    return this.ccRepo.save(cc);
  }

  async removeCentro(orgId: string, id: string) {
    const cc = await this.getCentro(orgId, id);
    // Verificar filhos
    const children = await this.ccRepo.count({ where: { parentId: id, orgId, deletedAt: IsNull() } });
    if (children > 0) throw new BadRequestException('Centro de custo possui filhos. Remova-os primeiro.');
    await this.ccRepo.softRemove(cc);
    return { id, deleted: true };
  }

  async arvore(orgId: string, companyId?: string) {
    const qb = this.ccRepo.createQueryBuilder('cc')
      .where('cc.org_id = :orgId AND cc.deleted_at IS NULL AND cc.is_active = true', { orgId })
      .orderBy('cc.codigo', 'ASC');
    if (companyId) qb.andWhere('(cc.company_id = :cid OR cc.company_id IS NULL)', { cid: companyId });

    const all = await qb.getMany();
    return { data: this.buildTree(all) };
  }

  private buildTree(items: CentroCusto[], parentId: string | null = null): Array<CentroCusto & { children: CentroCusto[] }> {
    return items
      .filter((i) => (i.parentId ?? null) === parentId)
      .map((i) => ({ ...i, children: this.buildTree(items, i.id) }));
  }

  // ─── Regras de Rateio ─────────────────────────────────────────────────────

  async listRateios(orgId: string) {
    const data = await this.rateioRepo.find({ where: { orgId, deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
    return { data };
  }

  async getRateio(orgId: string, id: string) {
    const r = await this.rateioRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!r) throw new NotFoundException('Regra de rateio não encontrada');
    const itens = await this.rateioItemRepo.find({ where: { regraId: id }, order: { createdAt: 'ASC' } });
    return { ...r, itens };
  }

  async createRateio(orgId: string, dto: CreateRegraRateioDto) {
    // Validar soma = 100%
    const soma = dto.itens.reduce((acc, i) => acc + i.percentual, 0);
    if (Math.abs(soma - 100) > 0.01) {
      throw new BadRequestException(`Soma dos percentuais deve ser 100%. Atual: ${soma.toFixed(4)}%`);
    }

    let regra!: RegraRateio;
    await this.dataSource.transaction(async (em) => {
      regra = em.getRepository(RegraRateio).create({
        orgId,
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        criterio: (dto.criterio ?? 'percentual') as RegraRateio['criterio'],
        isActive: true,
      });
      regra = await em.save(RegraRateio, regra);

      const itens = dto.itens.map((i) => em.getRepository(RateioItem).create({
        regraId: regra.id,
        companyId: i.companyId,
        centroCustoId: i.centroCustoId ?? null,
        percentual: String(i.percentual),
      }));
      await em.save(RateioItem, itens);
    });

    return this.getRateio(orgId, regra.id);
  }

  async updateRateio(orgId: string, id: string, dto: UpdateRegraRateioDto) {
    const r = await this.rateioRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!r) throw new NotFoundException('Regra de rateio não encontrada');

    await this.dataSource.transaction(async (em) => {
      if (dto.nome !== undefined) r.nome = dto.nome;
      if (dto.descricao !== undefined) r.descricao = dto.descricao;
      if (dto.isActive !== undefined) r.isActive = dto.isActive;
      await em.save(RegraRateio, r);

      if (dto.itens) {
        const soma = dto.itens.reduce((acc, i) => acc + i.percentual, 0);
        if (Math.abs(soma - 100) > 0.01) {
          throw new BadRequestException(`Soma dos percentuais deve ser 100%. Atual: ${soma.toFixed(4)}%`);
        }
        await em.delete(RateioItem, { regraId: id });
        const itens = dto.itens.map((i) => em.getRepository(RateioItem).create({
          regraId: id,
          companyId: i.companyId,
          centroCustoId: i.centroCustoId ?? null,
          percentual: String(i.percentual),
        }));
        await em.save(RateioItem, itens);
      }
    });

    return this.getRateio(orgId, id);
  }

  async removeRateio(orgId: string, id: string) {
    const r = await this.rateioRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!r) throw new NotFoundException('Regra de rateio não encontrada');
    await this.dataSource.transaction(async (em) => {
      await em.delete(RateioItem, { regraId: id });
      await em.softRemove(RegraRateio, r);
    });
    return { id, deleted: true };
  }

  async aplicarRateio(_orgId: string, dto: AplicarRateioDto) {
    const itens = await this.rateioItemRepo.find({ where: { regraId: dto.regraId } });
    if (itens.length === 0) throw new BadRequestException('Regra sem itens de rateio');

    return {
      data: itens.map((i) => ({
        companyId: i.companyId,
        centroCustoId: i.centroCustoId,
        percentual: Number(i.percentual),
        valor: Math.round(dto.valor * Number(i.percentual) / 100 * 100) / 100,
      })),
    };
  }

  // ─── Regras de Categorização ──────────────────────────────────────────────

  async listRegras(orgId: string) {
    const data = await this.regraRepo.find({
      where: { orgId, deletedAt: IsNull() },
      order: { prioridade: 'DESC' },
    });
    return { data };
  }

  async createRegra(orgId: string, dto: CreateRegraCategorizacaoDto) {
    const entity = this.regraRepo.create({
      orgId,
      companyId: dto.companyId ?? null,
      campoMatch: dto.campoMatch as RegraCategorizacao['campoMatch'],
      valorMatch: dto.valorMatch,
      operador: (dto.operador ?? 'igual') as RegraCategorizacao['operador'],
      categoriaId: dto.categoriaId ?? null,
      centroCustoId: dto.centroCustoId ?? null,
      confidence: dto.confidence ?? 100,
      prioridade: dto.prioridade ?? 50,
      isActive: true,
    });
    return this.regraRepo.save(entity);
  }

  async updateRegra(orgId: string, id: string, dto: UpdateRegraCategorizacaoDto) {
    const r = await this.regraRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!r) throw new NotFoundException('Regra de categorização não encontrada');
    if (dto.valorMatch !== undefined) r.valorMatch = dto.valorMatch;
    if (dto.operador !== undefined) r.operador = dto.operador as RegraCategorizacao['operador'];
    if (dto.categoriaId !== undefined) r.categoriaId = dto.categoriaId;
    if (dto.centroCustoId !== undefined) r.centroCustoId = dto.centroCustoId;
    if (dto.confidence !== undefined) r.confidence = dto.confidence;
    if (dto.prioridade !== undefined) r.prioridade = dto.prioridade;
    if (dto.isActive !== undefined) r.isActive = dto.isActive;
    return this.regraRepo.save(r);
  }

  async removeRegra(orgId: string, id: string) {
    const r = await this.regraRepo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!r) throw new NotFoundException('Regra não encontrada');
    await this.regraRepo.softRemove(r);
    return { id, deleted: true };
  }

  async sugerirCategoria(orgId: string, dto: SugerirCategoriaDto) {
    const regras = await this.regraRepo.find({
      where: { orgId, isActive: true, deletedAt: IsNull() },
      order: { prioridade: 'DESC' },
    });

    for (const regra of regras) {
      const match = this.matchRegra(regra, dto);
      if (match) {
        // Increment counter
        regra.vezesAplicada += 1;
        await this.regraRepo.save(regra);

        return {
          categoriaId: regra.categoriaId,
          centroCustoId: regra.centroCustoId,
          confidence: regra.confidence,
          regraId: regra.id,
          match: true,
        };
      }
    }

    return { categoriaId: null, centroCustoId: null, confidence: 0, regraId: null, match: false };
  }

  private matchRegra(regra: RegraCategorizacao, input: SugerirCategoriaDto): boolean {
    let value: string | undefined;
    switch (regra.campoMatch) {
      case 'cnpj': value = input.cnpj; break;
      case 'nome_contato': value = input.nomeContato; break;
      case 'historico': value = input.historico; break;
      case 'valor_range':
        if (input.valor == null) return false;
        if (regra.operador === 'maior_que') return input.valor > Number(regra.valorMatch);
        if (regra.operador === 'menor_que') return input.valor < Number(regra.valorMatch);
        return Math.abs(input.valor - Number(regra.valorMatch)) < 0.01;
      default: return false;
    }

    if (!value) return false;

    switch (regra.operador) {
      case 'igual': return value.toLowerCase() === regra.valorMatch.toLowerCase();
      case 'contem': return value.toLowerCase().includes(regra.valorMatch.toLowerCase());
      case 'regex': try { return new RegExp(regra.valorMatch, 'i').test(value); } catch { return false; }
      default: return false;
    }
  }
}
