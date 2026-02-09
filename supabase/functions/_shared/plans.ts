// Lexora subscription plans - SINGLE SOURCE OF TRUTH
// This file defines the canonical plan configuration used across the entire system
// NO side effects, NO Stripe checks, NO user state - pure configuration only

export type PlanType = 'free' | 'starter' | 'plus' | 'pro';

export interface PlanConfig {
  id: PlanType;
  name: string;
  price: number; // Monthly price in EUR
  priceDisplay: string;
  maxCasesPerMonth: number | null; // null = unlimited
  maxChatMessagesPerDay: number | null; // null = unlimited
  stripePriceId?: string; // For paid plans only
  features: {
    scan_letter: boolean;
    ai_draft: boolean;
    ai_chat: boolean;
    export_pdf: boolean;
    urgent_reply: boolean;
  };
  highlighted?: boolean;
  featureKeys: string[]; // For display in pricing UI
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    id: 'free',
    name: 'FREE',
    price: 0,
    priceDisplay: '€0',
    maxCasesPerMonth: 1,
    maxChatMessagesPerDay: 15,
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: false,
      urgent_reply: false,
    },
    featureKeys: [
      'subscription.features.oneCase',
      'subscription.features.upload',
      'subscription.features.ocr',
      'subscription.features.aiAnalysis',
      'subscription.features.aiDraft',
      'subscription.features.aiChat',
      'subscription.features.fifteenMessagesPerDay',
    ],
  },
  starter: {
    id: 'starter',
    name: 'STARTER',
    price: 3.99,
    priceDisplay: '€3.99',
    maxCasesPerMonth: 5,
    maxChatMessagesPerDay: null, // unlimited
    stripePriceId: 'price_1SivfMKG0eqN9CTOVXhLdPo7',
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: false,
    },
    featureKeys: [
      'subscription.features.fiveCases',
      'subscription.features.multipleDocuments',
      'subscription.features.unlimitedOcr',
      'subscription.features.unlimitedMessages',
      'subscription.features.pdfExport',
      'subscription.features.print',
      'subscription.features.email',
      'subscription.features.caseStatus',
    ],
  },
  plus: {
    id: 'plus',
    name: 'PLUS',
    price: 9.99,
    priceDisplay: '€9.99',
    maxCasesPerMonth: 20,
    maxChatMessagesPerDay: null, // unlimited
    stripePriceId: 'price_1SivfjKG0eqN9CTOXzYLuH7v',
    highlighted: true,
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: false,
    },
    featureKeys: [
      'subscription.features.twentyCases',
      'subscription.features.allBasic',
      'subscription.features.unlimitedMessages',
      'subscription.features.families',
    ],
  },
  pro: {
    id: 'pro',
    name: 'PRO',
    price: 19.99,
    priceDisplay: '€19.99',
    maxCasesPerMonth: null, // unlimited
    maxChatMessagesPerDay: null, // unlimited
    stripePriceId: 'price_1Sivg3KG0eqN9CTORmNvZX1Z',
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: true,
    },
    featureKeys: [
      'subscription.features.unlimitedCases',
      'subscription.features.allPlus',
      'subscription.features.unlimitedDocuments',
      'subscription.features.unlimitedMessages',
      'subscription.features.professional',
    ],
  },
};

export const PLAN_ORDER: PlanType[] = ['free', 'starter', 'plus', 'pro'];

// Legacy mapping for backwards compatibility
export const LEGACY_PLAN_MAP: Record<string, PlanType> = {
  basic: 'starter',
  unlimited: 'pro', // Map old unlimited to new pro
};

export function normalizePlanKey(planKey: string): PlanType {
  const lower = planKey.toLowerCase();
  return LEGACY_PLAN_MAP[lower] || (lower as PlanType) || 'free';
}

export function getPlanConfig(planKey: string): PlanConfig {
  const normalized = normalizePlanKey(planKey);
  return PLANS[normalized] || PLANS.free;
}

// Helper functions for limits
export function getCaseLimit(planKey: string): number | null {
  const config = getPlanConfig(planKey);
  return config.maxCasesPerMonth;
}

export function getChatMessageLimit(planKey: string): number | null {
  const config = getPlanConfig(planKey);
  return config.maxChatMessagesPerDay;
}

export function getStripePriceId(planKey: string): string | null {
  const config = getPlanConfig(planKey);
  return config.stripePriceId || null;
}

// Plan validation
export function isValidPlan(planKey: string): boolean {
  const normalized = normalizePlanKey(planKey);
  return Object.values(PLANS).some(plan => plan.id === normalized);
}

// Export for Stripe integration
export const STRIPE_PRICE_TO_PLAN: Record<string, PlanType> = {
  'price_1SivfMKG0eqN9CTOVXhLdPo7': 'starter',
  'price_1SivfjKG0eqN9CTOXzYLuH7v': 'plus',
  'price_1Sivg3KG0eqN9CTORmNvZX1Z': 'pro',
};
