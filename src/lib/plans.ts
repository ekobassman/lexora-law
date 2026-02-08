/**
 * LEXORA PLANS - Single source of truth (frontend)
 * Free, Starter, Plus, Pro. Limits: practices/month, chat messages/day (null = unlimited).
 * Stripe price IDs are configured in Edge Functions via env (STRIPE_PRICE_STARTER, etc.).
 */

export type PlanKey = 'free' | 'starter' | 'plus' | 'pro';

export interface PlanLimits {
  /** Max practices (cases) per calendar month. null = unlimited */
  max_cases_per_month: number | null;
  /** Max chat messages per calendar day (dashboard chat). null = unlimited */
  max_chat_messages_per_day: number | null;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  /** Monthly price in EUR (0 for free) */
  monthly_price_eur: number;
  price_display: string;
  limits: PlanLimits;
  /** Stripe Price ID - set in backend env, not used in frontend for checkout (create-checkout uses env) */
  stripe_price_id?: string;
}

/** Plan definitions - single source of truth for display and limits */
export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    monthly_price_eur: 0,
    price_display: '€0',
    limits: {
      max_cases_per_month: 1,
      max_chat_messages_per_day: 15,
    },
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    monthly_price_eur: 3.99,
    price_display: '€3,99',
    limits: {
      max_cases_per_month: 5,
      max_chat_messages_per_day: null,
    },
  },
  plus: {
    key: 'plus',
    name: 'Plus',
    monthly_price_eur: 9.99,
    price_display: '€9,99',
    limits: {
      max_cases_per_month: 20,
      max_chat_messages_per_day: null,
    },
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    monthly_price_eur: 19.99,
    price_display: '€19,99',
    limits: {
      max_cases_per_month: null,
      max_chat_messages_per_day: null,
    },
  },
};

export const PLAN_ORDER: PlanKey[] = ['free', 'starter', 'plus', 'pro'];

/** Paid plan keys (have Stripe price) */
export const PAID_PLANS: PlanKey[] = ['starter', 'plus', 'pro'];

/** Normalize legacy plan names to current PlanKey */
export function normalizePlanKey(planKey: string | null | undefined): PlanKey {
  if (!planKey || typeof planKey !== 'string') return 'free';
  const lower = planKey.toLowerCase().trim();
  if (lower === 'unlimited') return 'pro';
  if (lower === 'basic') return 'starter';
  if (lower === 'professional') return 'plus';
  if (PLAN_ORDER.includes(lower as PlanKey)) return lower as PlanKey;
  return 'free';
}

export function getPlanDefinition(planKey: string | null | undefined): PlanDefinition {
  return PLANS[normalizePlanKey(planKey)] ?? PLANS.free;
}

/** Monthly case limit for a plan (number or null for unlimited) */
export function getMaxCasesPerMonth(planKey: string | null | undefined): number | null {
  return getPlanDefinition(planKey).limits.max_cases_per_month;
}

/** Daily chat message limit for a plan (number or null for unlimited) */
export function getMaxChatMessagesPerDay(planKey: string | null | undefined): number | null {
  return getPlanDefinition(planKey).limits.max_chat_messages_per_day;
}
