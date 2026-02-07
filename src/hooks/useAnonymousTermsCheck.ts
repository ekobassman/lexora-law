import { useState, useEffect, useCallback } from 'react';
import { TERMS_VERSION, PRIVACY_VERSION, AGE_POLICY_VERSION } from '@/lib/legalVersions';

const ANONYMOUS_TERMS_KEY = 'lexora_anonymous_terms_v1';

interface AnonymousTermsData {
  termsVersion: string;
  privacyVersion: string;
  agePolicyVersion: string;
  acceptedAt: string;
}

interface AnonymousTermsCheckResult {
  needsAcceptance: boolean;
  acceptTerms: () => void;
  resetTerms: () => void;
}

/**
 * Hook to check if an anonymous user needs to accept terms/privacy before using the chat
 * Returns whether acceptance is needed and a function to record acceptance
 */
export function useAnonymousTermsCheck(): AnonymousTermsCheckResult {
  const [needsAcceptance, setNeedsAcceptance] = useState(true);

  const checkTerms = useCallback(() => {
    try {
      const data = localStorage.getItem(ANONYMOUS_TERMS_KEY);
      if (!data) {
        setNeedsAcceptance(true);
        return;
      }

      const parsed: AnonymousTermsData = JSON.parse(data);
      
      // Check if all versions match current
      const termsOk = parsed.termsVersion === TERMS_VERSION;
      const privacyOk = parsed.privacyVersion === PRIVACY_VERSION;
      const ageOk = parsed.agePolicyVersion === AGE_POLICY_VERSION;

      setNeedsAcceptance(!termsOk || !privacyOk || !ageOk);
    } catch {
      setNeedsAcceptance(true);
    }
  }, []);

  useEffect(() => {
    checkTerms();
  }, [checkTerms]);

  const acceptTerms = useCallback(() => {
    try {
      const data: AnonymousTermsData = {
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        agePolicyVersion: AGE_POLICY_VERSION,
        acceptedAt: new Date().toISOString(),
      };
      localStorage.setItem(ANONYMOUS_TERMS_KEY, JSON.stringify(data));
      setNeedsAcceptance(false);
    } catch (e) {
      console.error('[useAnonymousTermsCheck] Failed to save acceptance:', e);
    }
  }, []);

  const resetTerms = useCallback(() => {
    try {
      localStorage.removeItem(ANONYMOUS_TERMS_KEY);
      setNeedsAcceptance(true);
    } catch {
      // ignore
    }
  }, []);

  return {
    needsAcceptance,
    acceptTerms,
    resetTerms,
  };
}
