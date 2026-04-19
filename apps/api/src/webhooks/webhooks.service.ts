import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { WebhookSubscription, WebhookEvent } from './entities/webhook-subscription.entity';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subsRepo: Repository<WebhookSubscription>,
  ) {}

  async emit(event: WebhookEvent, payload: Record<string, unknown>, orgId: string): Promise<void> {
    const subs = await this.subsRepo.find({
      where: { orgId, active: true },
    });

    const matching = subs.filter((s) => s.events.includes(event));
    if (!matching.length) return;

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

    await Promise.allSettled(
      matching.map(async (sub) => {
        const sig = createHmac('sha256', sub.secret).update(body).digest('hex');
        try {
          const res = await fetch(sub.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-MoneyMind-Signature': `sha256=${sig}`,
              'X-MoneyMind-Event': event,
            },
            body,
          });
          if (!res.ok) {
            this.logger.warn(`Webhook delivery failed: ${sub.url} status=${res.status}`);
          }
        } catch (err) {
          this.logger.error(`Webhook delivery error: ${sub.url} err=${err}`);
        }
      }),
    );
  }

  verifySignature(rawBody: string, signature: string, secret: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    return signature === expected;
  }
}
