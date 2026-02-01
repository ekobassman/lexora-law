// Display prices per currency (UI only, does not affect Stripe billing)

import { Currency } from './currency';

export type PaidPlanKey = 'starter' | 'pro' | 'unlimited';

/**
 * Display prices per plan per currency (monthly)
 * These are for UI display only and do not affect actual Stripe prices
 */
export const PRICING_DISPLAY: Record<Currency, Record<PaidPlanKey, number>> = {
  EUR: {
    starter: 3.99,
    pro: 9.99,
    unlimited: 19.99,
  },
  USD: {
    starter: 4.49,
    pro: 10.99,
    unlimited: 21.99,
  },
  GBP: {
    starter: 3.49,
    pro: 8.99,
    unlimited: 17.99,
  },
} as const;

/**
 * Get display price for a plan in a specific currency
 */
export function getDisplayPrice(planKey: PaidPlanKey, currency: Currency): number {
  return PRICING_DISPLAY[currency]?.[planKey] ?? PRICING_DISPLAY.EUR[planKey];
}
