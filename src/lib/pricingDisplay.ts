// Display prices per currency (UI only, does not affect Stripe billing)

import { Currency } from './currency';

export type PaidPlanKey = 'starter' | 'plus' | 'pro';

/**
 * Display prices per plan per currency (monthly)
 * These are for UI display only and do not affect actual Stripe prices
 */
export const PRICING_DISPLAY: Record<Currency, Record<PaidPlanKey, number>> = {
  EUR: {
    starter: 3.99,
    plus: 9.99,
    pro: 19.99,
  },
  USD: {
    starter: 4.49,
    plus: 10.99,
    pro: 21.99,
  },
  GBP: {
    starter: 3.49,
    plus: 8.99,
    pro: 17.99,
  },
} as const;

/**
 * Get display price for a plan in a specific currency
 */
export function getDisplayPrice(planKey: PaidPlanKey, currency: Currency): number {
  return PRICING_DISPLAY[currency]?.[planKey] ?? PRICING_DISPLAY.EUR[planKey];
}
