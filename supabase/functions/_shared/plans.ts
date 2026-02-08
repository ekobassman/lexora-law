/**
 * LEXORA PLANS - Single source of truth (Edge Functions)
 * Free, Starter, Plus, Pro. Stripe price IDs from env: STRIPE_PRICE_STARTER, STRIPE_PRICE_PLUS, STRIPE_PRICE_PRO.
 */

export type PlanKey = "free" | "starter" | "plus" | "pro";

export interface PlanLimits {
  max_cases_per_month: number | null;
  max_chat_messages_per_day: number | null;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: { max_cases_per_month: 1, max_chat_messages_per_day: 15 },
  starter: { max_cases_per_month: 5, max_chat_messages_per_day: null },
  plus: { max_cases_per_month: 20, max_chat_messages_per_day: null },
  pro: { max_cases_per_month: null, max_chat_messages_per_day: null },
};

/** For subscriptions_state.monthly_case_limit (null stored as 999999 for legacy column) */
export function getMonthlyCaseLimitForDb(planKey: string): number {
  const key = normalizePlanKey(planKey);
  const limit = PLAN_LIMITS[key]?.max_cases_per_month ?? 1;
  return limit === null ? 999999 : limit;
}

export function normalizePlanKey(planKey: string | null | undefined): PlanKey {
  if (!planKey || typeof planKey !== "string") return "free";
  const lower = planKey.toLowerCase().trim();
  if (lower === "unlimited") return "pro";
  if (lower === "basic") return "starter";
  if (lower === "professional") return "plus";
  if (["free", "starter", "plus", "pro"].includes(lower)) return lower as PlanKey;
  return "free";
}

/** Get Stripe price ID for a paid plan from env */
export function getStripePriceId(planKey: string, env: { get: (k: string) => string | undefined }): string | null {
  const key = normalizePlanKey(planKey);
  if (key === "free") return null;
  const envKey = `STRIPE_PRICE_${key.toUpperCase()}`;
  return env.get(envKey) ?? null;
}

/** Build PLAN_CONFIG for create-checkout: plan -> { priceId, name } */
export function getPlanConfigForCheckout(env: { get: (k: string) => string | undefined }): Record<string, { priceId: string; name: string }> {
  const starter = env.get("STRIPE_PRICE_STARTER");
  const plus = env.get("STRIPE_PRICE_PLUS");
  const pro = env.get("STRIPE_PRICE_PRO");
  const config: Record<string, { priceId: string; name: string }> = {};
  if (starter) {
    config.starter = { priceId: starter, name: "Starter" };
    config.basic = { priceId: starter, name: "Starter" };
  }
  if (plus) {
    config.plus = { priceId: plus, name: "Plus" };
    config.professional = { priceId: plus, name: "Plus" };
  }
  if (pro) {
    config.pro = { priceId: pro, name: "Pro" };
    config.unlimited = { priceId: pro, name: "Pro" };
  }
  return config;
}

/** Build PRICE_TO_PLAN for webhook/sync: price_id -> plan_key */
export function getPriceToPlanMap(env: { get: (k: string) => string | undefined }): Record<string, PlanKey> {
  const map: Record<string, PlanKey> = {};
  const starter = env.get("STRIPE_PRICE_STARTER");
  const plus = env.get("STRIPE_PRICE_PLUS");
  const pro = env.get("STRIPE_PRICE_PRO");
  if (starter) map[starter] = "starter";
  if (plus) map[plus] = "plus";
  if (pro) map[pro] = "pro";
  return map;
}
