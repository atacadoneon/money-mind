import { api } from "@/lib/api/client";

export type PlanSlug = "free" | "starter" | "pro" | "business" | "enterprise";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export interface PlanFeatures {
  max_empresas: number;
  max_transacoes_mes: number;
  mcps_ativos: string[];
  ai_enabled: boolean;
  relatorios_avancados: boolean;
  suporte_prioritario: boolean;
  api_access: boolean;
  trial_days: number;
}

export interface PlanDetails {
  id: string;
  slug: PlanSlug;
  name: string;
  priceBrl: number;
  billingCycle: "monthly" | "yearly";
  features: PlanFeatures;
  trialDays: number;
}

export interface Invoice {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  dueAt: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export interface CurrentSubscription {
  plan: PlanSlug;
  planDetails: PlanDetails | null;
  status: SubscriptionStatus;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  quantity: number;
  hasStripeSubscription: boolean;
  invoices: Invoice[];
}

export interface UsageInfo {
  empresas: { used: number; limit: number; allowed: boolean };
  transacoes_mes: { used: number; limit: number; allowed: boolean };
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function fetchSubscription(): Promise<CurrentSubscription | null> {
  try {
    const { data } = await api.get<CurrentSubscription>("/billing/subscription");
    return data;
  } catch {
    return null;
  }
}

export async function fetchPlans(): Promise<PlanDetails[]> {
  const { data } = await api.get<{ plans: PlanDetails[] }>("/billing/plans");
  return data.plans ?? [];
}

export async function createCheckoutSession(
  plan: PlanSlug,
  cycle: "monthly" | "yearly" = "monthly"
): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>("/billing/checkout", { plan, cycle });
  return data;
}

export async function createPortalSession(): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>("/billing/portal");
  return data;
}

export async function cancelSubscription(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/billing/cancel");
  return data;
}

export async function applyCoupon(code: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/billing/apply-coupon", { code });
  return data;
}
