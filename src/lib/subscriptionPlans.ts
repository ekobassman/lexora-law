// Lexora subscription plans - display config (aligned with src/lib/plans.ts)
// free, starter, plus, pro. NO side effects, NO Stripe checks.

export type PlanType = 'free' | 'starter' | 'plus' | 'pro';

export interface PlanConfig {
  id: PlanType;
  name: string;
  price: number;
  priceDisplay: string;
  maxCasesPerMonth: number | null; // null = unlimited
  maxChatMessagesPerDay: number | null; // null = unlimited
  features: {
    scan_letter: boolean;
    ai_draft: boolean;
    ai_chat: boolean;
    export_pdf: boolean;
    urgent_reply: boolean;
  };
  highlighted?: boolean;
  featureKeys: string[];
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
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
    name: 'Starter',
    price: 3.99,
    priceDisplay: '€3.99',
    maxCasesPerMonth: 5,
    maxChatMessagesPerDay: null, // unlimited
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

export const LEGACY_PLAN_MAP: Record<string, PlanType> = {
  basic: 'starter',
  unlimited: 'pro', // Map old unlimited to new pro
};

export function normalizePlanKey(planKey: string): PlanType {
  const lower = (planKey || '').toLowerCase().trim();
  return LEGACY_PLAN_MAP[lower] ?? (PLAN_ORDER.includes(lower as PlanType) ? (lower as PlanType) : 'free');
}

export function getPlanConfig(planKey: string): PlanConfig {
  const normalized = normalizePlanKey(planKey);
  return PLANS[normalized] ?? PLANS.free;
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
