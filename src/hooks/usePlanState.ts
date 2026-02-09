/**
 * usePlanState: SINGLE SOURCE OF TRUTH for plan + credits state
 * 
 * This hook unifies entitlements + credits-get-status into one canonical state.
 * All UI components must use ONLY this hook's PlanState to avoid mismatches.
 * 
 * CRITICAL RULES:
 * - Never show FREE UI for paid users (even for 1 frame)
 * - Show loading skeleton until both sources resolve and match
 * - If mismatch detected, trigger sync and block render
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCredits, CreditsStatus } from './useCredits';
import { useEntitlements } from './useEntitlements';
import { useSyncSubscription } from './useSyncSubscription';

export interface PlanState {
  plan: 'free' | 'starter' | 'plus' | 'pro' | 'unlimited';
  is_active: boolean;
  monthly_case_limit: number;
  cases_remaining: number;
  cases_used_this_month: number;
  messages_per_case: number;
  period_end: string | null;
  at_case_limit: boolean;
  credits_balance: number;
}

export interface UsePlanStateReturn {
  planState: PlanState;
  isLoading: boolean;
  isReady: boolean;
  isSyncing: boolean;
  isPaid: boolean;
  isUnlimited: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

// Plan-specific defaults (must match new plan structure)
const PLAN_DEFAULTS: Record<string, { maxCases: number | null; messagesPerCase: number | null }> = {
  free: { maxCases: 1, messagesPerCase: 15 }, // 15 per day, not per case
  starter: { maxCases: 5, messagesPerCase: null }, // unlimited
  plus: { maxCases: 20, messagesPerCase: null }, // unlimited
  pro: { maxCases: null, messagesPerCase: null }, // unlimited
  unlimited: { maxCases: null, messagesPerCase: null }, // unlimited
};

const DEFAULT_PLAN_STATE: PlanState = {
  plan: 'free',
  is_active: true,
  monthly_case_limit: 1,
  cases_remaining: 1,
  cases_used_this_month: 0,
  messages_per_case: 10,
  period_end: null,
  at_case_limit: false,
  credits_balance: 0,
};

export function usePlanState(): UsePlanStateReturn {
  const {
    status: creditsStatus,
    isLoading: creditsLoading,
    error: creditsError,
    refresh: refreshCredits,
    isUnlimited,
  } = useCredits();

  const {
    entitlements,
    isLoading: entitlementsLoading,
    isReady: entitlementsReady,
    error: entitlementsError,
    refreshEntitlements,
    isPaid: entitlementsPaid,
  } = useEntitlements();

  const { syncSubscription } = useSyncSubscription();

  const [forcedSyncDone, setForcedSyncDone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Detect mismatch between entitlements and credits status
  const hasMismatch = useMemo(() => {
    if (creditsLoading || entitlementsLoading) return false;
    
    const creditsPlan = creditsStatus.plan;
    const entitlementsPlan = entitlements.plan;
    
    // Mismatch if one says free and other says paid
    const creditsIsPaid = creditsPlan !== 'free';
    const entitlementsIsPaid = entitlementsPlan !== 'free';
    
    if (creditsIsPaid !== entitlementsIsPaid) {
      console.warn('[usePlanState] MISMATCH DETECTED:', {
        creditsPlan,
        entitlementsPlan,
        creditsLimit: creditsStatus.monthly_case_limit,
      });
      return true;
    }
    
    return false;
  }, [creditsLoading, entitlementsLoading, creditsStatus.plan, entitlements.plan, creditsStatus.monthly_case_limit]);

  // Auto-sync on mismatch (once)
  useEffect(() => {
    if (hasMismatch && !forcedSyncDone && !isSyncing) {
      console.log('[usePlanState] Triggering forced sync due to mismatch...');
      setIsSyncing(true);
      
      syncSubscription(true)
        .then(() => {
          return Promise.all([refreshCredits(), refreshEntitlements()]);
        })
        .finally(() => {
          setForcedSyncDone(true);
          setIsSyncing(false);
        });
    }
  }, [hasMismatch, forcedSyncDone, isSyncing, syncSubscription, refreshCredits, refreshEntitlements]);

  // Canonical plan state: prioritize PAID over FREE
  const planState = useMemo<PlanState>(() => {
    // If either source shows a paid plan, use the paid plan data
    const creditsPlan = creditsStatus.plan as PlanState['plan'];
    const entitlementsPlan = entitlements.plan as PlanState['plan'];
    
    // CRITICAL: Paid overrides free ALWAYS
    let canonicalPlan: PlanState['plan'] = 'free';
    
    if (creditsPlan !== 'free') {
      canonicalPlan = creditsPlan;
    } else if (entitlementsPlan !== 'free') {
      canonicalPlan = entitlementsPlan;
    }
    
    const planDefaults = PLAN_DEFAULTS[canonicalPlan] || PLAN_DEFAULTS.free;
    
    // Use credits status for limits (single source of truth from DB)
    // But if plan is paid and limit shows 1, use plan defaults instead
    let monthlyCaseLimit = creditsStatus.monthly_case_limit;
    if (canonicalPlan !== 'free' && monthlyCaseLimit <= 1) {
      // This is bug case: paid plan but showing free limits
      const planDefaults = PLAN_DEFAULTS[canonicalPlan] || PLAN_DEFAULTS.free;
      monthlyCaseLimit = planDefaults.maxCases ?? 1;
      console.warn('[usePlanState] Correcting limit from 1 to', monthlyCaseLimit, 'for plan', canonicalPlan);
    }
    
    const casesUsed = creditsStatus.cases_used_this_month;
    const casesRemaining = Math.max(0, monthlyCaseLimit - casesUsed);
    const atCaseLimit = canonicalPlan !== 'unlimited' && canonicalPlan !== 'pro' && casesRemaining <= 0;
    
    return {
      plan: canonicalPlan,
      is_active: creditsStatus.is_active,
      monthly_case_limit: monthlyCaseLimit,
      cases_remaining: casesRemaining,
      cases_used_this_month: casesUsed,
      messages_per_case: planDefaults.messagesPerCase,
      period_end: creditsStatus.period_end,
      at_case_limit: atCaseLimit,
      credits_balance: creditsStatus.credits_balance,
    };
  }, [creditsStatus, entitlements]);

  const isLoading = creditsLoading || entitlementsLoading || isSyncing;
  const isReady = !isLoading && (forcedSyncDone || !hasMismatch);
  const isPaid = planState.plan !== 'free';
  const error = creditsError || entitlementsError || null;

  const refresh = useCallback(async () => {
    await Promise.all([refreshCredits(), refreshEntitlements()]);
  }, [refreshCredits, refreshEntitlements]);

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncSubscription(true);
      await refresh();
    } finally {
      setIsSyncing(false);
    }
  }, [syncSubscription, refresh]);

  // Diagnostic logging
  useEffect(() => {
    if (!isLoading) {
      console.log('[usePlanState] Resolved state:', {
        plan: planState.plan,
        monthlyCaseLimit: planState.monthly_case_limit,
        casesRemaining: planState.cases_remaining,
        casesUsed: planState.cases_used_this_month,
        isPaid,
        isReady,
        hasMismatch,
        creditsStatusPlan: creditsStatus.plan,
        entitlementsPlan: entitlements.plan,
      });
    }
  }, [isLoading, planState, isPaid, isReady, hasMismatch, creditsStatus.plan, entitlements.plan]);

  return {
    planState,
    isLoading,
    isReady,
    isSyncing,
    isPaid,
    isUnlimited,
    error,
    refresh,
    triggerSync,
  };
}
