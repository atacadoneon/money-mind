import { Column, Entity, Index } from 'typeorm';
import { CompanyScopedEntity } from '../../common/entities/base.entity';

export type SituacaoCobranca =
  | 'rascunho' | 'registrado' | 'enviado' | 'pago' | 'vencido'
  | 'protestado' | 'baixado' | 'cancelado' | 'rejeitado';

@Entity({ name: 'cobrancas_bancarias' })
@Index(['orgId', 'companyId', 'situacao'])
@Index(['orgId', 'nossoNumero'])
export class CobrancaBancaria extends CompanyScopedEntity {
  @Column({ type: 'text', nullable: true }) nossoNumero?: string;
  @Column({ type: 'text', nullable: true }) numeroDocumento?: string;
  @Column({ type: 'text', nullable: true }) linhaDigitavel?: string;
  @Column({ type: 'text', nullable: true }) codigoBarras?: string;

  @Column({ type: 'uuid', nullable: true }) contatoId?: string;
  @Column({ type: 'text' }) sacadoNome!: string;
  @Column({ type: 'varchar', length: 18, nullable: true }) sacadoCpfCnpj?: string;
  @Column({ type: 'text', nullable: true }) sacadoEndereco?: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 }) valorNominal!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) valorDesconto!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) valorJuros!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) valorMulta!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) valorPago!: string;

  @Column({ type: 'date' }) dataEmissao!: string;
  @Column({ type: 'date' }) dataVencimento!: string;
  @Column({ type: 'date', nullable: true }) dataPagamento?: string | null;
  @Column({ type: 'date', nullable: true }) dataCredito?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'rascunho' }) situacao!: SituacaoCobranca;

  @Column({ type: 'uuid', nullable: true }) contaBancariaId?: string;
  @Column({ type: 'varchar', length: 3, nullable: true }) bancoCodigo?: string;

  @Column({ type: 'uuid', nullable: true }) contaReceberId?: string;

  @Column({ type: 'text', nullable: true }) qrCodePix?: string;
  @Column({ type: 'jsonb', nullable: true }) rawData?: Record<string, unknown>;
}
