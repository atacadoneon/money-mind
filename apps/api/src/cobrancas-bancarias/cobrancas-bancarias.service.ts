import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CobrancaBancaria } from './entities/cobranca-bancaria.entity';
import { ContaBancaria } from '../contas-bancarias/entities/conta-bancaria.entity';
import { SicoobClient } from '../mcps/bancos/sicoob/sicoob.client';
import { buildMeta, PaginationDto } from '../common/dto/pagination.dto';

export interface CriarCobrancaDto {
  contaBancariaId?: string;
  contaReceberId?: string;
  contatoId?: string;
  valor: number;
  vencimento: string;
  sacadoNome: string;
  sacadoCpfCnpj?: string;
  descricao?: string;
}

@Injectable()
export class CobrancasBancariasService {
  private readonly logger = new Logger(CobrancasBancariasService.name);

  constructor(
    @InjectRepository(CobrancaBancaria) private readonly repo: Repository<CobrancaBancaria>,
    @InjectRepository(ContaBancaria) private readonly contasRepo: Repository<ContaBancaria>,
    private readonly sicoob: SicoobClient,
  ) {}

  async list(orgId: string, companyId: string, q: PaginationDto & { status?: string }) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.org_id = :orgId AND c.company_id = :cid AND c.deleted_at IS NULL', { orgId, cid: companyId })
      .orderBy('c.data_vencimento', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.status) qb.andWhere('c.situacao = :status', { status: q.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta(total, q.page, q.limit) };
  }

  async getById(orgId: string, id: string) {
    const c = await this.repo.findOne({ where: { id, orgId } });
    if (!c) throw new NotFoundException(`Cobrança ${id} não encontrada`);
    return c;
  }

  async criar(orgId: string, companyId: string, dto: CriarCobrancaDto): Promise<CobrancaBancaria> {
    let nossoNumero: string | undefined;
    let linhaDigitavel: string | undefined;
    let codigoBarras: string | undefined;
    let qrCodePix: string | undefined;
    let situacao: CobrancaBancaria['situacao'] = 'rascunho';
    let bancoCodigo: string | undefined;

    if (dto.contaBancariaId) {
      const conta = await this.contasRepo.findOne({ where: { id: dto.contaBancariaId, orgId } });
      if (conta?.bancoCodigo === '756') {
        try {
          const creds = ((conta as unknown as Record<string, unknown>).settings ?? {}) as Record<string, string>;
          const boleto = await this.sicoob.emitirBoleto(creds, {
            valor: dto.valor,
            vencimento: dto.vencimento,
            sacadoNome: dto.sacadoNome,
            sacadoCpfCnpj: dto.sacadoCpfCnpj ?? '',
            descricao: dto.descricao,
          });
          nossoNumero = boleto.nossoNumero;
          linhaDigitavel = boleto.linhaDigitavel;
          codigoBarras = boleto.codigoBarras;
          qrCodePix = boleto.qrCodePix;
          situacao = boleto.nossoNumero.startsWith('STUB') ? 'rascunho' : 'registrado';
          bancoCodigo = '756'; // Sicoob
        } catch (err) {
          this.logger.error(`Falha ao emitir boleto Sicoob: ${err}`);
          situacao = 'rascunho';
        }
      }
    }

    return this.repo.save(
      this.repo.create({
        orgId,
        companyId,
        contaBancariaId: dto.contaBancariaId,
        contaReceberId: dto.contaReceberId,
        contatoId: dto.contatoId,
        valorNominal: String(dto.valor),
        valorDesconto: '0',
        valorJuros: '0',
        valorMulta: '0',
        valorPago: '0',
        dataEmissao: new Date().toISOString().split('T')[0],
        dataVencimento: dto.vencimento,
        sacadoNome: dto.sacadoNome,
        sacadoCpfCnpj: dto.sacadoCpfCnpj,
        nossoNumero,
        linhaDigitavel,
        codigoBarras,
        qrCodePix,
        situacao,
        bancoCodigo,
        rawData: { descricao: dto.descricao },
      }),
    );
  }

  async cancelar(orgId: string, id: string) {
    const cobranca = await this.getById(orgId, id);

    if (cobranca.bancoCodigo === '756' && cobranca.nossoNumero) {
      const conta = cobranca.contaBancariaId
        ? await this.contasRepo.findOne({ where: { id: cobranca.contaBancariaId, orgId } })
        : null;

      if (conta) {
        const creds = {} as Record<string, string>;
        await this.sicoob.cancelarBoleto(creds, cobranca.nossoNumero);
      }
    }

    await this.repo.update(id, { situacao: 'cancelado' });
    return { success: true };
  }

  async getPdf(orgId: string, id: string) {
    const cobranca = await this.getById(orgId, id);
    // PDF URL não existe na DB schema atual — retornar stub
    return {
      id: cobranca.id,
      linhaDigitavel: cobranca.linhaDigitavel,
      codigoBarras: cobranca.codigoBarras,
      qrCodePix: cobranca.qrCodePix,
      message: 'PDF geração não disponível — use linha digitável ou QR Code Pix',
    };
  }
}
