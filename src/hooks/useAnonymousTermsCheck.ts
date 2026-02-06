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
  const [needsAcceptance, setNeedsAcceptance] = useState(false);

  const checkTerms = useCallback(() => {
    try {
      // Auto-accept: always consider terms as accepted, persist immediately
      const data: AnonymousTermsData = {
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        agePolicyVersion: AGE_POLICY_VERSION,
        acceptedAt: new Date().toISOString(),
      };
      localStorage.setItem(ANONYMOUS_TERMS_KEY, JSON.stringify(data));
      setNeedsAcceptance(false);
    } catch {
      setNeedsAcceptance(false);
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
