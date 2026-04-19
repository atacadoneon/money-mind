import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendgridSendResult {
  messageId?: string;
  status: 'sent' | 'error';
  error?: string;
}

/**
 * SendGrid transactional email client.
 */
@Injectable()
export class SendgridClient {
  private readonly logger = new Logger(SendgridClient.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly baseUrl = 'https://api.sendgrid.com/v3';

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('SENDGRID_API_KEY', '');
    this.fromEmail = config.get<string>('SENDGRID_FROM_EMAIL', 'noreply@moneymind.com.br');
    this.fromName = config.get<string>('SENDGRID_FROM_NAME', 'Money Mind BPO');
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<SendgridSendResult> {
    if (!this.apiKey) {
      this.logger.warn('SendGrid apiKey not configured');
      return { status: 'error', error: 'credentials missing' };
    }

    const payload = {
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: this.fromEmail, name: this.fromName },
      subject: params.subject,
      content: [
        { type: 'text/html', value: params.html },
        ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
      ],
    };

    const res = await fetch(`${this.baseUrl}/mail/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`SendGrid error: ${res.status} ${text}`);
      return { status: 'error', error: `${res.status}: ${text}` };
    }

    const msgId = res.headers.get('X-Message-Id') ?? undefined;
    return { messageId: msgId, status: 'sent' };
  }
}
