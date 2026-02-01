// Lexora subscription plans - STATIC DECLARATIVE CONFIG ONLY
// NO side effects, NO Stripe checks, NO user state

export type PlanType = 'free' | 'starter' | 'pro' | 'unlimited';

export interface PlanConfig {
  id: PlanType;
  name: string;
  price: number;
  priceDisplay: string;
  maxCases: number;
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
    maxCases: 1, // 1 case total trial, not monthly
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
    ],
  },
  starter: {
    id: 'starter',
    name: 'STARTER',
    price: 3.99,
    priceDisplay: '€3.99',
    maxCases: 3, // 3 cases/month, each case includes 15 AI messages
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: false,
    },
    featureKeys: [
      'subscription.features.threeCases',
      'subscription.features.multipleDocuments',
      'subscription.features.unlimitedOcr',
      'subscription.features.fifteenMessagesPerCase',
      'subscription.features.pdfExport',
      'subscription.features.print',
      'subscription.features.email',
      'subscription.features.caseStatus',
    ],
  },
  pro: {
    id: 'pro',
    name: 'PRO',
    price: 9.99,
    priceDisplay: '€9.99',
    maxCases: 10, // 10 cases/month, each case includes 30 AI messages
    highlighted: true,
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: true,
    },
    featureKeys: [
      'subscription.features.tenCases',
      'subscription.features.allBasic',
      'subscription.features.thirtyMessagesPerCase',
      'subscription.features.families',
    ],
  },
  unlimited: {
    id: 'unlimited',
    name: 'UNLIMITED',
    price: 19.99,
    priceDisplay: '€19.99',
    maxCases: 999999,
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

export const PLAN_ORDER: PlanType[] = ['free', 'starter', 'pro', 'unlimited'];

// Legacy mapping for backwards compatibility
export const LEGACY_PLAN_MAP: Record<string, PlanType> = {
  basic: 'starter',
  plus: 'pro',
};

export function normalizePlanKey(planKey: string): PlanType {
  const lower = planKey.toLowerCase();
  return LEGACY_PLAN_MAP[lower] || (lower as PlanType) || 'free';
}

export function getPlanConfig(planKey: string): PlanConfig {
  const normalized = normalizePlanKey(planKey);
  return PLANS[normalized] || PLANS.free;
}
