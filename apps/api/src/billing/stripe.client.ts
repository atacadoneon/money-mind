import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeClient {
  private readonly logger = new Logger(StripeClient.name);
  readonly stripe: Stripe;
  readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY', '');
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET', '');

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}
