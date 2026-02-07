import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Legacy plan types for backwards compatibility
export type LegacyPlanType = 'free' | 'basic' | 'plus' | 'pro';

// Plan mapping for checkout (maps old names to new names)
const PLAN_CHECKOUT_MAP: Record<string, string> = {
  basic: 'starter',
  starter: 'starter',
  plus: 'pro',
  pro: 'pro',
  unlimited: 'unlimited',
};

export function useCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckoutSession = useCallback(async (plan: string): Promise<{ url: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const normalizedPlan = PLAN_CHECKOUT_MAP[plan.toLowerCase()] || plan.toLowerCase();
      
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { plan: normalizedPlan },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to create checkout session');
      }

      if (!data?.url) {
        throw new Error('No checkout URL returned');
      }

      return { url: data.url };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openCustomerPortal = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('customer-portal');

      if (fnError) {
        throw new Error(fnError.message || 'Failed to open customer portal');
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Portal failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createCheckoutSession,
    openCustomerPortal,
    isLoading,
    error,
  };
}
