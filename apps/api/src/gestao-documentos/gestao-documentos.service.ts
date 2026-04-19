import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Documento, StatusDocumento } from './entities/documento.entity';
import {
  ListDocumentosQuery, RejeitarDocumentoDto, UpdateDocumentoDto,
  UploadDocumentoDto, ValidarDocumentoDto, VincularDocumentoDto,
} from './dto/gestao-documentos.dto';
import { buildMeta } from '../common/dto/pagination.dto';

@Injectable()
export class GestaoDocumentosService {
  constructor(
    @InjectRepository(Documento) private readonly repo: Repository<Documento>,
  ) {}

  private baseQb(orgId: string) {
    return this.repo.createQueryBuilder('d').where('d.org_id = :orgId AND d.deleted_at IS NULL', { orgId });
  }

  async list(orgId: string, q: ListDocumentosQuery) {
    const qb = this.baseQb(orgId)
      .orderBy('d.created_at', 'DESC')
      .skip((q.page - 1) * q.limit).take(q.limit);

    if (q.companyId) qb.andWhere('d.company_id = :cid', { cid: q.companyId });
    if (q.entidadeTipo) qb.andWhere('d.entidade_tipo = :et', { et: q.entidadeTipo });
    if (q.entidadeId) qb.andWhere('d.entidade_id = :eid', { eid: q.entidadeId });
    if (q.tipoDocumento) qb.andWhere('d.tipo_documento = :td', { td: q.tipoDocumento });
    if (q.status) qb.andWhere('d.status = :status', { status: q.status });
    if (q.competencia) qb.andWhere('d.competencia = :comp', { comp: q.competencia });
    if (q.search) qb.andWhere('d.nome_arquivo ILIKE :s', { s: `%${q.search}%` });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async get(orgId: string, id: string) {
    const d = await this.repo.findOne({ where: { id, orgId, deletedAt: IsNull() } });
    if (!d) throw new NotFoundException('Documento não encontrado');
    return d;
  }

  async upload(orgId: string, userId: string, dto: UploadDocumentoDto) {
    const entity = this.repo.create({
      orgId,
      companyId: dto.companyId,
      entidadeTipo: dto.entidadeTipo,
      entidadeId: dto.entidadeId,
      nomeArquivo: dto.nomeArquivo,
      tipoArquivo: dto.tipoArquivo as Documento['tipoArquivo'],
      mimeType: dto.mimeType ?? null,
      tamanhoBytes: dto.tamanhoBytes != null ? String(dto.tamanhoBytes) : null,
      storagePath: dto.storagePath,
      tipoDocumento: (dto.tipoDocumento ?? 'outro') as Documento['tipoDocumento'],
      competencia: dto.competencia ?? null,
      status: 'pendente' as StatusDocumento,
      createdBy: userId,
    });
    return this.repo.save(entity);
  }

  async update(orgId: string, id: string, dto: UpdateDocumentoDto) {
    const d = await this.get(orgId, id);
    if (dto.tipoDocumento !== undefined) d.tipoDocumento = dto.tipoDocumento as Documento['tipoDocumento'];
    if (dto.competencia !== undefined) d.competencia = dto.competencia;
    return this.repo.save(d);
  }

  async validar(orgId: string, id: string, userId: string, _dto: ValidarDocumentoDto) {
    const d = await this.get(orgId, id);
    d.status = 'validado';
    d.validadoPor = userId;
    d.validadoEm = new Date();
    return this.repo.save(d);
  }

  async rejeitar(orgId: string, id: string, userId: string, dto: RejeitarDocumentoDto) {
    const d = await this.get(orgId, id);
    d.status = 'rejeitado';
    d.validadoPor = userId;
    d.validadoEm = new Date();
    d.motivoRejeicao = dto.motivoRejeicao;
    return this.repo.save(d);
  }

  async vincular(orgId: string, id: string, dto: VincularDocumentoDto) {
    const d = await this.get(orgId, id);
    d.entidadeTipo = dto.entidadeTipo;
    d.entidadeId = dto.entidadeId;
    return this.repo.save(d);
  }

  async desvincular(orgId: string, id: string) {
    // Não desvincula — documento precisa estar vinculado. Usa update para trocar vínculo.
    throw new BadRequestException('Documento deve estar vinculado a uma entidade');
  }

  async porEntidade(orgId: string, entidadeTipo: string, entidadeId: string) {
    const data = await this.baseQb(orgId)
      .andWhere('d.entidade_tipo = :et AND d.entidade_id = :eid', { et: entidadeTipo, eid: entidadeId })
      .orderBy('d.created_at', 'DESC')
      .getMany();
    return { data };
  }

  async stats(orgId: string, companyId?: string) {
    const qb = this.baseQb(orgId);
    if (companyId) qb.andWhere('d.company_id = :cid', { cid: companyId });

    const byStatus = await qb.clone()
      .select('d.status', 'status').addSelect('COUNT(*)', 'count')
      .groupBy('d.status').getRawMany();

    const byTipo = await qb.clone()
      .select('d.tipo_documento', 'tipoDocumento').addSelect('COUNT(*)', 'count')
      .groupBy('d.tipo_documento').getRawMany();

    return {
      byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {}),
      byTipo: byTipo.reduce((acc, r) => ({ ...acc, [r.tipoDocumento]: Number(r.count) }), {}),
    };
  }

  async remove(orgId: string, id: string) {
    const d = await this.get(orgId, id);
    await this.repo.softRemove(d);
    return { id, deleted: true };
  }
}
