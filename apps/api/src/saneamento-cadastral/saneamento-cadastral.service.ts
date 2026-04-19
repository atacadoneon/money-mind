import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SaneamentoDuplicata, StatusDuplicata } from './entities/saneamento-duplicata.entity';
import { SaneamentoScore } from './entities/saneamento-score.entity';
import {
  ConfirmarDuplicataDto, DescartarDuplicataDto, ListDuplicatasQuery,
  MergeDuplicataDto, ScanearDto,
} from './dto/saneamento-cadastral.dto';
import { buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class SaneamentoCadastralService {
  constructor(
    @InjectRepository(SaneamentoDuplicata) private readonly dupRepo: Repository<SaneamentoDuplicata>,
    @InjectRepository(SaneamentoScore) private readonly scoreRepo: Repository<SaneamentoScore>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ─── Duplicatas ───────────────────────────────────────────────────────────

  async listDuplicatas(orgId: string, q: ListDuplicatasQuery) {
    const qb = this.dupRepo.createQueryBuilder('d')
      .where('d.org_id = :orgId', { orgId })
      .orderBy('d.score_similaridade', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.entidadeTipo) qb.andWhere('d.entidade_tipo = :et', { et: q.entidadeTipo });
    if (q.status) qb.andWhere('d.status = :status', { status: q.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async scanear(orgId: string, userId: string, dto: ScanearDto) {
    const tipos = dto.entidadeTipo ? [dto.entidadeTipo] : ['contato', 'categoria'];
    let totalDetectadas = 0;

    for (const tipo of tipos) {
      if (tipo === 'contato') {
        totalDetectadas += await this.scanearContatos(orgId, dto.companyId);
      } else if (tipo === 'categoria') {
        totalDetectadas += await this.scanearCategorias(orgId);
      }
    }

    return { totalDetectadas, tipos };
  }

  private async scanearContatos(orgId: string, companyId: string): Promise<number> {
    try {
      // Usar pg_trgm para similaridade de nomes
      const duplicatas = await this.dataSource.query(`
        SELECT a.id as a_id, b.id as b_id,
               similarity(a.nome, b.nome) * 100 as score,
               CASE
                 WHEN a.documento = b.documento AND a.documento IS NOT NULL THEN 'documento'
                 WHEN similarity(a.nome, b.nome) > 0.7 THEN 'nome_similar'
                 WHEN a.email = b.email AND a.email IS NOT NULL THEN 'email'
                 ELSE 'nome_similar'
               END as campo
        FROM contatos a
        JOIN contatos b ON a.id < b.id AND a.org_id = b.org_id
        WHERE a.org_id = $1 AND a.deleted_at IS NULL AND b.deleted_at IS NULL
          AND (
            (a.documento = b.documento AND a.documento IS NOT NULL AND a.documento != '')
            OR similarity(a.nome, b.nome) > 0.7
            OR (a.email = b.email AND a.email IS NOT NULL AND a.email != '')
          )
        LIMIT 100
      `, [orgId]);

      let count = 0;
      for (const dup of duplicatas) {
        const exists = await this.dupRepo.findOne({
          where: { orgId, entidadeAId: dup.a_id, entidadeBId: dup.b_id },
        });
        if (!exists) {
          await this.dupRepo.save(this.dupRepo.create({
            orgId,
            entidadeTipo: 'contato',
            entidadeAId: dup.a_id,
            entidadeBId: dup.b_id,
            scoreSimilaridade: Math.round(Number(dup.score)),
            campoMatch: dup.campo,
            status: 'detectada',
          }));
          count++;
        }
      }
      return count;
    } catch {
      return 0; // pg_trgm may not be available
    }
  }

  private async scanearCategorias(orgId: string): Promise<number> {
    try {
      const duplicatas = await this.dataSource.query(`
        SELECT a.id as a_id, b.id as b_id,
               similarity(a.nome, b.nome) * 100 as score
        FROM categorias a
        JOIN categorias b ON a.id < b.id AND a.org_id = b.org_id
        WHERE a.org_id = $1 AND a.deleted_at IS NULL AND b.deleted_at IS NULL
          AND similarity(a.nome, b.nome) > 0.8
        LIMIT 50
      `, [orgId]);

      let count = 0;
      for (const dup of duplicatas) {
        const exists = await this.dupRepo.findOne({
          where: { orgId, entidadeAId: dup.a_id, entidadeBId: dup.b_id },
        });
        if (!exists) {
          await this.dupRepo.save(this.dupRepo.create({
            orgId,
            entidadeTipo: 'categoria',
            entidadeAId: dup.a_id,
            entidadeBId: dup.b_id,
            scoreSimilaridade: Math.round(Number(dup.score)),
            campoMatch: 'nome_similar',
            status: 'detectada',
          }));
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  async confirmar(orgId: string, id: string, userId: string, _dto: ConfirmarDuplicataDto) {
    const d = await this.getDuplicata(orgId, id);
    d.status = 'confirmada';
    d.resolvidoPor = userId;
    d.resolvidoEm = new Date();
    return this.dupRepo.save(d);
  }

  async descartar(orgId: string, id: string, userId: string, _dto: DescartarDuplicataDto) {
    const d = await this.getDuplicata(orgId, id);
    d.status = 'descartada';
    d.resolvidoPor = userId;
    d.resolvidoEm = new Date();
    return this.dupRepo.save(d);
  }

  async merge(orgId: string, id: string, userId: string, dto: MergeDuplicataDto) {
    const d = await this.getDuplicata(orgId, id);
    if (d.status === 'mergeada') throw new BadRequestException('Duplicata já foi mergeada');

    const vencedorId = dto.vencedorId;
    const perdedorId = vencedorId === d.entidadeAId ? d.entidadeBId : d.entidadeAId;

    if (vencedorId !== d.entidadeAId && vencedorId !== d.entidadeBId) {
      throw new BadRequestException('vencedorId deve ser um dos IDs da duplicata');
    }

    await this.dataSource.transaction(async (em) => {
      if (d.entidadeTipo === 'contato') {
        // Reatribuir referências do perdedor para o vencedor
        await em.query(`UPDATE contas_pagar SET contato_id = $1 WHERE contato_id = $2 AND org_id = $3 AND deleted_at IS NULL`, [vencedorId, perdedorId, orgId]);
        await em.query(`UPDATE contas_receber SET contato_id = $1 WHERE contato_id = $2 AND org_id = $3 AND deleted_at IS NULL`, [vencedorId, perdedorId, orgId]);
        // Soft delete do perdedor
        await em.query(`UPDATE contatos SET deleted_at = NOW() WHERE id = $1 AND org_id = $2`, [perdedorId, orgId]);
      } else if (d.entidadeTipo === 'categoria') {
        await em.query(`UPDATE contas_pagar SET categoria_id = $1 WHERE categoria_id = $2 AND org_id = $3 AND deleted_at IS NULL`, [vencedorId, perdedorId, orgId]);
        await em.query(`UPDATE contas_receber SET categoria_id = $1 WHERE categoria_id = $2 AND org_id = $3 AND deleted_at IS NULL`, [vencedorId, perdedorId, orgId]);
        await em.query(`UPDATE categorias SET deleted_at = NOW() WHERE id = $1 AND org_id = $2`, [perdedorId, orgId]);
      }

      d.status = 'mergeada';
      d.mergeVencedorId = vencedorId;
      d.resolvidoPor = userId;
      d.resolvidoEm = new Date();
      await em.save(SaneamentoDuplicata, d);
    });

    return d;
  }

  private async getDuplicata(orgId: string, id: string) {
    const d = await this.dupRepo.findOne({ where: { id, orgId } });
    if (!d) throw new NotFoundException('Duplicata não encontrada');
    return d;
  }

  // ─── Score ────────────────────────────────────────────────────────────────

  async calcularScore(orgId: string, companyId: string) {
    const hoje = new Date().toISOString().slice(0, 10);

    try {
      const [contatos] = await this.dataSource.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE documento IS NOT NULL AND documento != '') as com_doc,
                COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') as com_email
         FROM contatos WHERE org_id = $1 AND deleted_at IS NULL`, [orgId],
      );

      const [categorias] = await this.dataSource.query(
        `SELECT COUNT(*) as total FROM categorias WHERE org_id = $1 AND deleted_at IS NULL`, [orgId],
      );

      const totalContatos = Number(contatos?.total ?? 0);
      const comDoc = Number(contatos?.com_doc ?? 0);
      const comEmail = Number(contatos?.com_email ?? 0);

      const scoreCadastros = totalContatos > 0
        ? Math.round(((comDoc + comEmail) / (totalContatos * 2)) * 100)
        : 100;

      const dupsAbertas = await this.dupRepo.count({
        where: { orgId, status: 'detectada' as StatusDuplicata },
      });
      const scoreDuplicatas = Math.max(0, 100 - dupsAbertas * 5);

      const scoreTotal = Math.round((scoreCadastros * 0.6 + scoreDuplicatas * 0.4));

      const componentes = {
        cadastros_validos: scoreCadastros,
        duplicatas_resolvidas: scoreDuplicatas,
        total_contatos: totalContatos,
        total_categorias: Number(categorias?.total ?? 0),
        duplicatas_abertas: dupsAbertas,
      };

      // Upsert score
      const existing = await this.scoreRepo.findOne({ where: { companyId, dataCalculo: hoje } });
      if (existing) {
        existing.scoreTotal = scoreTotal;
        existing.componentes = componentes;
        return this.scoreRepo.save(existing);
      }

      return this.scoreRepo.save(this.scoreRepo.create({
        orgId, companyId, dataCalculo: hoje, scoreTotal, componentes,
      }));
    } catch {
      return { scoreTotal: 0, componentes: {}, error: 'Falha ao calcular score' };
    }
  }

  async getScore(orgId: string, companyId: string) {
    const score = await this.scoreRepo.findOne({
      where: { orgId, companyId },
      order: { dataCalculo: 'DESC' },
    });
    return score ?? { scoreTotal: 0, componentes: {}, dataCalculo: null };
  }

  async historicoScores(orgId: string, companyId: string) {
    const data = await this.scoreRepo.find({
      where: { orgId, companyId },
      order: { dataCalculo: 'ASC' },
      take: 30,
    });
    return { data };
  }
}
