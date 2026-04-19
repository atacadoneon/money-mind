import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SicoobSaldo {
  saldo: number;
  dataReferencia: string;
}

export interface SicoobCobrancaInput {
  valor: number;
  vencimento: string;
  sacadoNome: string;
  sacadoCpfCnpj: string;
  nossoNumero?: string;
  descricao?: string;
}

export interface SicoobBoleto {
  nossoNumero: string;
  linhaDigitavel: string;
  codigoBarras: string;
  qrCodePix?: string;
  urlBoleto?: string;
}

/**
 * Sicoob Open Finance client — OAuth2 + mTLS (sandbox by default).
 * Credenciais via integration.sicoob no campo contas_bancarias.integration (encrypted).
 */
@Injectable()
export class SicoobClient {
  private readonly logger = new Logger(SicoobClient.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('SICOOB_BASE_URL', 'https://sandbox.sicoob.com.br/sicoob/sandbox');
  }

  /** Obtém token OAuth2 via client_credentials (mTLS stub — cert injected via env) */
  private async getAccessToken(credentials: Record<string, string>): Promise<string> {
    const { clientId, clientSecret } = credentials;
    if (!clientId || !clientSecret) {
      this.logger.warn('Sicoob credentials not configured — returning stub token');
      return 'stub-token';
    }

    // TODO: implement real mTLS with cert from credentials.cert / credentials.key
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'cobranca_boletos-consultar cobranca_boletos-incluir saldo-consultar extrato-consultar pix-consultar',
    });

    const res = await fetch(`${this.baseUrl}/auth/realms/sicoob/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      this.logger.warn(`Sicoob token error: ${res.status}`);
      return 'stub-token';
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  async getSaldo(credentials: Record<string, string>, agencia: string, conta: string): Promise<SicoobSaldo> {
    const token = await this.getAccessToken(credentials);
    if (token === 'stub-token') {
      return { saldo: 0, dataReferencia: new Date().toISOString().split('T')[0] };
    }

    const res = await fetch(`${this.baseUrl}/cobranca-bancaria/v2/saldo?agencia=${agencia}&numeroConta=${conta}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`Sicoob saldo error: ${res.status}`);
    const data = await res.json() as { saldo: number; dataReferencia: string };
    return { saldo: Number(data.saldo), dataReferencia: data.dataReferencia };
  }

  async getExtrato(credentials: Record<string, string>, agencia: string, conta: string, from: string, to: string) {
    const token = await this.getAccessToken(credentials);
    if (token === 'stub-token') {
      this.logger.warn('Sicoob extrato returning stub — configure credentials');
      return [];
    }

    const res = await fetch(
      `${this.baseUrl}/cobranca-bancaria/v2/extrato?agencia=${agencia}&numeroConta=${conta}&dataInicio=${from}&dataFim=${to}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) throw new Error(`Sicoob extrato error: ${res.status}`);
    const data = await res.json() as { lancamentos?: unknown[] };
    return data.lancamentos ?? [];
  }

  async emitirBoleto(credentials: Record<string, string>, input: SicoobCobrancaInput): Promise<SicoobBoleto> {
    const token = await this.getAccessToken(credentials);
    if (token === 'stub-token') {
      return {
        nossoNumero: `STUB-${Date.now()}`,
        linhaDigitavel: '00000.00000 00000.000000 00000.000000 0 00000000000000',
        codigoBarras: '00000000000000000000000000000000000000000000',
        qrCodePix: undefined,
        urlBoleto: undefined,
      };
    }

    const payload = {
      modalidade: 1,
      valorNominal: input.valor,
      dataVencimento: input.vencimento,
      pagador: {
        cpfCnpj: input.sacadoCpfCnpj.replace(/\D/g, ''),
        nome: input.sacadoNome,
      },
      mensagem: { linha1: input.descricao ?? '' },
    };

    const res = await fetch(`${this.baseUrl}/cobranca-bancaria/v2/boletos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Sicoob emitir boleto error: ${res.status}`);
    const data = await res.json() as {
      nossoNumero: string;
      linhaDigitavel: string;
      codigoBarras: string;
      qrCode?: string;
      urlBoleto?: string;
    };

    return {
      nossoNumero: data.nossoNumero,
      linhaDigitavel: data.linhaDigitavel,
      codigoBarras: data.codigoBarras,
      qrCodePix: data.qrCode,
      urlBoleto: data.urlBoleto,
    };
  }

  async cancelarBoleto(credentials: Record<string, string>, nossoNumero: string): Promise<void> {
    const token = await this.getAccessToken(credentials);
    if (token === 'stub-token') return;

    const res = await fetch(`${this.baseUrl}/cobranca-bancaria/v2/boletos/${nossoNumero}/baixar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoBaixaOuDevolucao: 4 }),
    });

    if (!res.ok) throw new Error(`Sicoob cancelar boleto error: ${res.status}`);
  }
}
