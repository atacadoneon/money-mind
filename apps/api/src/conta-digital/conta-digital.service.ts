import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaBancaria } from '../contas-bancarias/entities/conta-bancaria.entity';
import { ExtratoLinha } from '../extratos-bancarios/entities/extrato-linha.entity';
import { ContaPagar } from '../contas-pagar/entities/conta-pagar.entity';
import { ContaReceber } from '../contas-receber/entities/conta-receber.entity';

@Injectable()
export class ContaDigitalService {
  constructor(
    @InjectRepository(ContaBancaria) private readonly contasRepo: Repository<ContaBancaria>,
    @InjectRepository(ExtratoLinha) private readonly linhasRepo: Repository<ExtratoLinha>,
    @InjectRepository(ContaPagar) private readonly cpRepo: Repository<ContaPagar>,
    @InjectRepository(ContaReceber) private readonly crRepo: Repository<ContaReceber>,
  ) {}

  async getContas(orgId: string, companyId: string) {
    const contas = await this.contasRepo.find({
      where: { orgId, companyId, isActive: true },
    });

    const contasComSaldo = await Promise.all(
      contas.map(async (c) => {
        const saldoCalculado = await this.calcularSaldo(orgId, c.id, Number(c.saldoInicial));
        return { ...c, saldoCalculado };
      }),
    );

    return contasComSaldo;
  }

  async getTransacoes(orgId: string, contaId: string, limit = 30) {
    const linhas = await this.linhasRepo
      .createQueryBuilder('l')
      .where('l.org_id = :orgId AND l.conta_bancaria_id = :cid', { orgId, cid: contaId })
      .orderBy('l.data_movimento', 'DESC')
      .take(limit)
      .getMany();

    return linhas;
  }

  async getSaldoConsolidado(orgId: string, companyId: string) {
    const contas = await this.contasRepo.find({ where: { orgId, companyId, isActive: true } });
    let saldoTotal = 0;

    for (const c of contas) {
      const saldo = await this.calcularSaldo(orgId, c.id, Number(c.saldoInicial));
      saldoTotal += saldo;
    }

    return { saldoConsolidado: saldoTotal, quantidadeContas: contas.length };
  }

  private async calcularSaldo(orgId: string, contaBancariaId: string, saldoInicial: number): Promise<number> {
    const result = await this.linhasRepo
      .createQueryBuilder('l')
      .select(
        `COALESCE(SUM(CASE WHEN l.tipo = 'credito' THEN l.valor::numeric ELSE -l.valor::numeric END), 0)`,
        'saldo',
      )
      .where('l.org_id = :orgId AND l.conta_bancaria_id = :cid', { orgId, cid: contaBancariaId })
      .getRawOne<{ saldo: string }>();

    return saldoInicial + Number(result?.saldo ?? 0);
  }
}
