import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GupshupSendResult {
  messageId?: string;
  status: 'sent' | 'error';
  error?: string;
}

/**
 * Gupshup WhatsApp Business API client.
 * Envio via template aprovado no WABA.
 */
@Injectable()
export class GupshupClient {
  private readonly logger = new Logger(GupshupClient.name);
  private readonly apiKey: string;
  private readonly appName: string;
  private readonly baseUrl = 'https://api.gupshup.io/sm/api/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('GUPSHUP_API_KEY', '');
    this.appName = config.get<string>('GUPSHUP_APP_NAME', '');
  }

  async sendTemplate(
    to: string,
    templateId: string,
    params: string[],
  ): Promise<GupshupSendResult> {
    if (!this.apiKey || !this.appName) {
      this.logger.warn('Gupshup credentials not configured');
      return { status: 'error', error: 'credentials missing' };
    }

    const message = {
      type: 'template',
      template: {
        id: templateId,
        params,
      },
    };

    const body = new URLSearchParams({
      channel: 'whatsapp',
      source: this.appName,
      destination: to.replace(/\D/g, ''),
      message: JSON.stringify(message),
      'src.name': this.appName,
    });

    const res = await fetch(`${this.baseUrl}/msg`, {
      method: 'POST',
      headers: { apikey: this.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Gupshup send error: ${res.status} ${text}`);
      return { status: 'error', error: `${res.status}: ${text}` };
    }

    const data = await res.json() as { messageId?: string; status?: string };
    return { messageId: data.messageId, status: 'sent' };
  }

  async sendText(to: string, text: string): Promise<GupshupSendResult> {
    if (!this.apiKey) return { status: 'error', error: 'credentials missing' };

    const body = new URLSearchParams({
      channel: 'whatsapp',
      source: this.appName,
      destination: to.replace(/\D/g, ''),
      message: JSON.stringify({ type: 'text', text }),
      'src.name': this.appName,
    });

    const res = await fetch(`${this.baseUrl}/msg`, {
      method: 'POST',
      headers: { apikey: this.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return { status: 'error', error: `${res.status}` };
    const data = await res.json() as { messageId?: string };
    return { messageId: data.messageId, status: 'sent' };
  }
}
