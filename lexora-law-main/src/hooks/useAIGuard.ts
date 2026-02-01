import { useCallback, useRef, useState } from 'react';
import { useEntitlements } from './useEntitlements';
import { useAuth } from '@/contexts/AuthContext';

interface AIGuardOptions {
  featureKey?: 'ai_draft' | 'ai_chat';
  debounceMs?: number;
}

interface UseAIGuardReturn {
  canCallAI: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  guardedCall: <T>(fn: () => Promise<T>) => Promise<T | null>;
  isInFlight: boolean;
}

/**
 * Hook to guard AI calls with entitlement checks and debouncing.
 * Prevents token burn by blocking calls when:
 * - User is not authenticated
 * - Entitlements are still loading (unknown state)
 * - User doesn't have the required feature
 * - Another AI call is already in flight
 */
export function useAIGuard(options: AIGuardOptions = {}): UseAIGuardReturn {
  const { featureKey = 'ai_draft', debounceMs = 1000 } = options;
  const { user } = useAuth();
  const { entitlements, isReady, isLoading } = useEntitlements();
  const [isInFlight, setIsInFlight] = useState(false);
  const lastCallRef = useRef<number>(0);

  // Determine if AI calls should be blocked
  const getBlockReason = useCallback((): string | null => {
    if (!user) {
      return 'NOT_AUTHENTICATED';
    }

    // Payment enforcement (server-derived)
    if ((entitlements as any)?.access_state === 'blocked') {
      return 'ACCESS_BLOCKED';
    }
    
    if (!isReady || isLoading) {
      return 'ENTITLEMENTS_LOADING';
    }
    
    // Check if user has exceeded their case limit for free plan
    if (entitlements.plan_key === 'free' && entitlements.cases_created >= entitlements.max_cases) {
      // Free user has used their 1 case - still allow AI on existing cases
      // but block new case creation (handled separately)
    }
    
    // Check specific feature
    if (!entitlements.features[featureKey]) {
      return `FEATURE_DISABLED:${featureKey}`;
    }
    
    return null;
  }, [user, isReady, isLoading, entitlements, featureKey]);

  const blockReason = getBlockReason();
  const canCallAI = blockReason === null;
  const isBlocked = !canCallAI;

  /**
   * Wrap an AI call with guards:
   * - Blocks if not entitled
   * - Debounces rapid calls
   * - Prevents concurrent calls
   */
  const guardedCall = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    const reason = getBlockReason();
    
    if (reason) {
      console.warn('[AIGuard] BLOCKED_AI_CALL', {
        reason,
        user_id: user?.id,
        plan: entitlements.plan_key,
      });
      return null;
    }

    // Check debounce
    const now = Date.now();
    if (now - lastCallRef.current < debounceMs) {
      console.warn('[AIGuard] DEBOUNCED_AI_CALL', {
        timeSinceLastCall: now - lastCallRef.current,
        debounceMs,
      });
      return null;
    }

    // Check in-flight
    if (isInFlight) {
      console.warn('[AIGuard] CONCURRENT_AI_CALL_BLOCKED');
      return null;
    }

    try {
      setIsInFlight(true);
      lastCallRef.current = now;
      return await fn();
    } finally {
      setIsInFlight(false);
    }
  }, [getBlockReason, user?.id, entitlements.plan_key, debounceMs, isInFlight]);

  return {
    canCallAI,
    isBlocked,
    blockReason,
    guardedCall,
    isInFlight,
  };
}
