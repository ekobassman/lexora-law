import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export interface CreditsStatus {
  plan: string;
  is_active: boolean;
  period_end: string | null;
  cases_used_this_month: number;
  // PRIMARY FIELD: monthly_case_limit (single source of truth)
  monthly_case_limit: number;
  cases_remaining: number;
  at_case_limit: boolean;
  credits_balance: number;
  credits_spent_this_month: number;
  ai_sessions_this_month: number;
  lifetime_credits: number;
  next_refill_date: string;
  monthly_credit_refill: number;
}

export type CreditActionType = 
  | 'CASE_CREATED'
  | 'OCR_ANALYZE'
  | 'DRAFT_GENERATE'
  | 'DRAFT_REGENERATE'
  | 'AI_SESSION_START'
  | 'DOC_ANALYZE_EXTRA';

export interface ConsumeResult {
  success: boolean;
  new_balance?: number;
  credits_charged?: number;
  message?: string;
  error?: string;
  code?: 'INSUFFICIENT_CREDITS' | 'CASE_LIMIT_REACHED' | 'NO_AUTH' | 'INVALID_TOKEN' | 'INVALID_ACTION' | 'INTERNAL_ERROR';
  cases_used?: number;
  cases_limit?: number;
  session_active?: boolean;
}

const defaultStatus: CreditsStatus = {
  plan: 'free',
  is_active: true,
  period_end: null,
  cases_used_this_month: 0,
  monthly_case_limit: 1,
  cases_remaining: 1,
  at_case_limit: false,
  credits_balance: 0,
  credits_spent_this_month: 0,
  ai_sessions_this_month: 0,
  lifetime_credits: 0,
  next_refill_date: '',
  monthly_credit_refill: 0,
};

/** Fallback quando credits-get-status fallisce (CORS / rete): free con limiti alti per non bloccare la UI */
const fallbackStatusFree: CreditsStatus = {
  ...defaultStatus,
  monthly_case_limit: 999,
  cases_remaining: 999,
  at_case_limit: false,
};

export function useCredits() {
  const { session, user } = useAuth();
  const [status, setStatus] = useState<CreditsStatus>(defaultStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('credits-get-status', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus(data as CreditsStatus);
    } catch (err: any) {
      console.warn('[useCredits] fetchStatus error (using fallback):', err?.message ?? err);
      setStatus(fallbackStatusFree);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  // Fetch status on mount and when session changes
  useEffect(() => {
    if (user && session) {
      fetchStatus();
    }
  }, [user, session, fetchStatus]);

  const consume = useCallback(async (
    actionType: CreditActionType,
    caseId?: string,
    meta?: Record<string, any>
  ): Promise<ConsumeResult> => {
    if (!session?.access_token) {
      return { 
        success: false, 
        error: 'Not authenticated', 
        code: 'NO_AUTH' 
      };
    }

    try {
      const requestId = `${actionType}-${caseId || 'none'}-${Date.now()}`;

      const { data, error: fnError } = await supabase.functions.invoke('credits-consume', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action_type: actionType,
          case_id: caseId, // Use case_id (new standardized name)
          meta: meta || {},
          request_id: requestId,
        },
      });

      if (fnError) {
        // Check for specific HTTP status codes
        if (fnError.message?.includes('402')) {
          return {
            success: false,
            error: 'Crediti insufficienti',
            code: 'INSUFFICIENT_CREDITS',
          };
        }
        if (fnError.message?.includes('403')) {
          return {
            success: false,
            error: 'Limite pratiche raggiunto',
            code: 'CASE_LIMIT_REACHED',
          };
        }
        throw fnError;
      }

      // Parse response
      if (data?.error) {
        return {
          success: false,
          error: data.error,
          code: data.code,
          cases_used: data.cases_used,
          cases_limit: data.cases_limit,
        };
      }

      // Refresh status after successful consume
      await fetchStatus();

      return {
        success: true,
        new_balance: data.new_balance,
        credits_charged: data.credits_charged,
        message: data.message,
        session_active: data.session_active,
        cases_used: data.cases_used,
        cases_limit: data.cases_limit,
      };
    } catch (err: any) {
      console.error('[useCredits] consume error:', err);
      return {
        success: false,
        error: err.message || 'Errore durante il consumo crediti',
        code: 'INTERNAL_ERROR',
      };
    }
  }, [session?.access_token, fetchStatus]);

  const canCreateCase = !status.at_case_limit;
  const hasCredits = status.credits_balance > 0;
  const isUnlimited = status.plan === 'unlimited';
  const canUseAI = isUnlimited || hasCredits;

  return {
    status,
    isLoading,
    error,
    refresh: fetchStatus,
    consume,
    // Convenience flags
    canCreateCase,
    hasCredits,
    isUnlimited,
    canUseAI,
  };
}
