import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeClient } from './stripe.client';
import { Subscription, SubscriptionStatus, PlanSlug } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { PlansService } from './plans.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    private readonly stripeClient: StripeClient,
    private readonly plansService: PlansService,
    private readonly config: ConfigService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.stripe;
  }

  private get appUrl(): string {
    return this.config.get<string>('APP_URL', 'https://app.moneymind.com.br');
  }

  // ─── Ensure Stripe customer exists for org ───────────────────────────────

  async ensureStripeCustomer(orgId: string, email?: string, name?: string): Promise<string> {
    let sub = await this.getOrCreateLocalSubscription(orgId);

    if (sub.stripeCustomerId) return sub.stripeCustomerId;

    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: { orgId },
      });
      sub.stripeCustomerId = customer.id;
      await this.subRepo.save(sub);
      return customer.id;
    } catch (err) {
      this.logger.error(`Failed to create Stripe customer for org ${orgId}: ${err}`);
      throw new BadRequestException('Não foi possível criar cliente no Stripe');
    }
  }

  // ─── Checkout Session ────────────────────────────────────────────────────

  async createCheckoutSession(orgId: string, plan: PlanSlug, cycle: 'monthly' | 'yearly' = 'monthly'): Promise<{ url: string }> {
    const planEntity = await this.plansService.getPlanBySlug(plan);
    if (!planEntity) throw new NotFoundException(`Plano '${plan}' não encontrado`);

    const sub = await this.getOrCreateLocalSubscription(orgId);
    const customerId = sub.stripeCustomerId ?? undefined;

    const priceId = planEntity.stripePriceId;

    // If no Stripe price configured, return a mock checkout URL for dev
    if (!priceId) {
      this.logger.warn(`Plan ${plan} has no stripePriceId configured — returning mock URL`);
      return { url: `${this.appUrl}/configuracoes/billing?mock_checkout=1&plan=${plan}` };
    }

    const trialDays = planEntity.trialDays > 0 && sub.status === 'trialing' ? planEntity.trialDays : undefined;

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: trialDays,
          metadata: { orgId, plan },
        },
        metadata: { orgId, plan },
        success_url: `${this.appUrl}/configuracoes/billing?checkout=success`,
        cancel_url: `${this.appUrl}/planos?checkout=canceled`,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        locale: 'pt-BR',
      });

      return { url: session.url! };
    } catch (err) {
      this.logger.error(`Checkout session error for org ${orgId}: ${err}`);
      throw new BadRequestException('Erro ao criar sessão de checkout');
    }
  }

  // ─── Customer Portal ─────────────────────────────────────────────────────

  async createCustomerPortalSession(orgId: string): Promise<{ url: string }> {
    const sub = await this.subRepo.findOne({ where: { orgId } });
    if (!sub?.stripeCustomerId) {
      throw new NotFoundException('Assinatura Stripe não encontrada para esta organização');
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${this.appUrl}/configuracoes/billing`,
      });
      return { url: session.url };
    } catch (err) {
      this.logger.error(`Portal session error for org ${orgId}: ${err}`);
      throw new BadRequestException('Erro ao criar sessão do portal de cobrança');
    }
  }

  // ─── Get Current Subscription ────────────────────────────────────────────

  async getCurrentSubscription(orgId: string) {
    const sub = await this.subRepo.findOne({ where: { orgId } });
    if (!sub) {
      return {
        plan: 'free' as PlanSlug,
        status: 'trialing' as SubscriptionStatus,
        trialEnd: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    const planDetails = await this.plansService.getPlanBySlug(sub.plan);
    const invoices = await this.invoiceRepo.find({
      where: { subscriptionId: sub.id },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      plan: sub.plan,
      planDetails,
      status: sub.status,
      trialEnd: sub.trialEnd,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      quantity: sub.quantity,
      stripeCustomerId: sub.stripeCustomerId,
      hasStripeSubscription: !!sub.stripeSubscriptionId,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        status: inv.status,
        paidAt: inv.paidAt,
        dueAt: inv.dueAt,
        hostedInvoiceUrl: inv.hostedInvoiceUrl,
        pdfUrl: inv.pdfUrl,
        createdAt: inv.createdAt,
      })),
    };
  }

  // ─── Cancel Subscription ─────────────────────────────────────────────────

  async cancelSubscription(orgId: string): Promise<{ message: string }> {
    const sub = await this.subRepo.findOne({ where: { orgId } });
    if (!sub?.stripeSubscriptionId) {
      throw new NotFoundException('Assinatura ativa não encontrada');
    }

    try {
      await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      sub.cancelAtPeriodEnd = true;
      await this.subRepo.save(sub);

      return { message: 'Assinatura cancelada ao final do período atual.' };
    } catch (err) {
      this.logger.error(`Cancel subscription error for org ${orgId}: ${err}`);
      throw new BadRequestException('Erro ao cancelar assinatura');
    }
  }

  // ─── Apply Coupon ────────────────────────────────────────────────────────

  async applyCoupon(orgId: string, code: string): Promise<{ message: string }> {
    const sub = await this.subRepo.findOne({ where: { orgId } });
    if (!sub?.stripeSubscriptionId) {
      throw new NotFoundException('Assinatura ativa não encontrada');
    }

    try {
      await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
        coupon: code,
      });
      return { message: `Cupom '${code}' aplicado com sucesso.` };
    } catch (err) {
      this.logger.error(`Apply coupon error for org ${orgId}: ${err}`);
      throw new BadRequestException('Cupom inválido ou expirado');
    }
  }

  // ─── Webhook Handler ─────────────────────────────────────────────────────

  async handleWebhook(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  // ─── Private Webhook Handlers ────────────────────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const orgId = session.metadata?.orgId;
    const plan = session.metadata?.plan as PlanSlug;
    if (!orgId) return;

    const sub = await this.getOrCreateLocalSubscription(orgId);
    if (session.customer) sub.stripeCustomerId = session.customer as string;
    if (plan) sub.plan = plan;
    await this.subRepo.save(sub);
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    const orgId = stripeSub.metadata?.orgId;
    if (!orgId) {
      // Try to find by customer ID
      const existingSub = await this.subRepo.findOne({ where: { stripeCustomerId: stripeSub.customer as string } });
      if (!existingSub) return;
      await this.syncStripeSubscription(existingSub, stripeSub);
      return;
    }

    const sub = await this.getOrCreateLocalSubscription(orgId);
    await this.syncStripeSubscription(sub, stripeSub);
  }

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
    const sub = await this.subRepo.findOne({
      where: { stripeSubscriptionId: stripeSub.id },
    }) ?? await this.subRepo.findOne({
      where: { stripeCustomerId: stripeSub.customer as string },
    });
    if (!sub) return;

    sub.status = 'canceled';
    sub.plan = 'free';
    await this.subRepo.save(sub);
  }

  private async handleInvoicePaid(stripeInv: Stripe.Invoice): Promise<void> {
    if (!stripeInv.subscription) return;

    const sub = await this.subRepo.findOne({ where: { stripeSubscriptionId: stripeInv.subscription as string } });
    if (!sub) return;

    const existingInv = await this.invoiceRepo.findOne({ where: { stripeInvoiceId: stripeInv.id } });
    if (existingInv) {
      existingInv.status = 'paid';
      existingInv.paidAt = new Date();
      await this.invoiceRepo.save(existingInv);
      return;
    }

    await this.invoiceRepo.save(
      this.invoiceRepo.create({
        subscriptionId: sub.id,
        stripeInvoiceId: stripeInv.id,
        amount: (stripeInv.amount_paid ?? 0) / 100,
        status: 'paid',
        paidAt: new Date(),
        dueAt: stripeInv.due_date ? new Date(stripeInv.due_date * 1000) : undefined,
        hostedInvoiceUrl: stripeInv.hosted_invoice_url ?? undefined,
        pdfUrl: stripeInv.invoice_pdf ?? undefined,
      }),
    );

    // Update subscription status to active
    sub.status = 'active';
    await this.subRepo.save(sub);
  }

  private async handleInvoicePaymentFailed(stripeInv: Stripe.Invoice): Promise<void> {
    if (!stripeInv.subscription) return;

    const sub = await this.subRepo.findOne({ where: { stripeSubscriptionId: stripeInv.subscription as string } });
    if (!sub) return;

    sub.status = 'past_due';
    await this.subRepo.save(sub);

    this.logger.warn(`Payment failed for org subscription ${sub.orgId}`);
  }

  private async handleTrialWillEnd(stripeSub: Stripe.Subscription): Promise<void> {
    const orgId = stripeSub.metadata?.orgId;
    this.logger.log(`Trial will end for ${orgId ?? stripeSub.id} in 3 days`);
    // Email notification is handled by the cron job
  }

  // ─── Helper Methods ──────────────────────────────────────────────────────

  private async getOrCreateLocalSubscription(orgId: string): Promise<Subscription> {
    let sub = await this.subRepo.findOne({ where: { orgId } });
    if (!sub) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      sub = this.subRepo.create({
        orgId,
        plan: 'starter',
        status: 'trialing',
        trialEnd,
        cancelAtPeriodEnd: false,
        quantity: 1,
        metadata: {},
      });
      await this.subRepo.save(sub);
    }
    return sub;
  }

  private async syncStripeSubscription(sub: Subscription, stripeSub: Stripe.Subscription): Promise<void> {
    sub.stripeSubscriptionId = stripeSub.id;
    sub.stripeCustomerId = stripeSub.customer as string;
    sub.status = stripeSub.status as SubscriptionStatus;
    sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
    sub.quantity = stripeSub.items.data[0]?.quantity ?? 1;

    if (stripeSub.trial_end) {
      sub.trialEnd = new Date(stripeSub.trial_end * 1000);
    }
    if (stripeSub.current_period_start) {
      sub.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
    }
    if (stripeSub.current_period_end) {
      sub.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
    }

    // Extract plan from price metadata or subscription metadata
    const planSlug = (stripeSub.metadata?.plan as PlanSlug) ?? sub.plan;
    sub.plan = planSlug;

    await this.subRepo.save(sub);
  }

  // ─── Init trial for new org ──────────────────────────────────────────────

  async initTrialForOrg(orgId: string): Promise<Subscription> {
    const existing = await this.subRepo.findOne({ where: { orgId } });
    if (existing) return existing;

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const sub = this.subRepo.create({
      orgId,
      plan: 'starter',
      status: 'trialing',
      trialEnd,
      cancelAtPeriodEnd: false,
      quantity: 1,
      metadata: {},
    });
    return this.subRepo.save(sub);
  }
}
