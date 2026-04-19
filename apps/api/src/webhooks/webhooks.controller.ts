import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import { Public } from '../auth/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('webhooks')
@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly svc: WebhooksService,
    private readonly config: ConfigService,
  ) {}

  @Post('pagarme')
  @Public()
  @HttpCode(200)
  async pagarmeWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature') signature: string,
  ) {
    const secret = this.config.get<string>('PAGARME_WEBHOOK_SECRET', '');
    if (secret && signature) {
      const valid = this.svc.verifySignature(JSON.stringify(body), signature, secret);
      if (!valid) {
        this.logger.warn('Pagar.me webhook: invalid signature');
        return { status: 'ignored' };
      }
    }
    this.logger.log(`Pagar.me webhook received: event=${body['type'] ?? 'unknown'}`);
    // TODO: process event (pagamento confirmado → baixar CR)
    return { status: 'received' };
  }

  @Post('sicoob/cobranca')
  @Public()
  @HttpCode(200)
  sicoobCobrancaWebhook(@Body() body: Record<string, unknown>) {
    this.logger.log(`Sicoob cobrança webhook: ${JSON.stringify(body).substring(0, 100)}`);
    // TODO: processar pagamento confirmado → atualizar cobranca_bancaria + CR
    return { status: 'received' };
  }

  @Post('gupshup/whatsapp')
  @Public()
  @HttpCode(200)
  gupshupWebhook(@Body() body: Record<string, unknown>) {
    this.logger.log(`Gupshup WhatsApp webhook received`);
    // TODO: atualizar comunicacoes_log com status entregue/lido
    return { status: 'received' };
  }
}
