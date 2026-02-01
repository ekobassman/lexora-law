import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { TERMS_VERSION, PRIVACY_VERSION, AGE_POLICY_VERSION } from '@/lib/legalVersions';

interface TermsCheckResult {
  loading: boolean;
  termsOutdated: boolean;
  privacyOutdated: boolean;
  ageNotConfirmed: boolean;
  needsReaccept: boolean;
  refresh: () => void;
}

/**
 * Hook to check if a user needs to re-accept terms/privacy or confirm age
 * Returns loading state and whether terms are outdated or age not confirmed
 */
export function useTermsCheck(userId: string | null): TermsCheckResult {
  const [loading, setLoading] = useState(true);
  const [termsOutdated, setTermsOutdated] = useState(false);
  const [privacyOutdated, setPrivacyOutdated] = useState(false);
  const [ageNotConfirmed, setAgeNotConfirmed] = useState(false);

  const checkTerms = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setTermsOutdated(false);
      setPrivacyOutdated(false);
      setAgeNotConfirmed(false);
      return;
    }

    setLoading(true);

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('terms_version, privacy_version, age_confirmed, age_policy_version')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[useTermsCheck] Error fetching profile:', error);
        // On error, don't block the user - assume terms are OK
        setTermsOutdated(false);
        setPrivacyOutdated(false);
        setAgeNotConfirmed(false);
        setLoading(false);
        return;
      }

      const userTermsVersion = profile?.terms_version || null;
      const userPrivacyVersion = profile?.privacy_version || null;
      const userAgeConfirmed = profile?.age_confirmed === true;
      const userAgePolicyVersion = profile?.age_policy_version || null;

      // Check if versions match current
      const termsNeedsUpdate = userTermsVersion !== TERMS_VERSION;
      const privacyNeedsUpdate = userPrivacyVersion !== PRIVACY_VERSION;
      // User needs to confirm age if: not confirmed OR policy version changed
      const ageNeedsConfirm = !userAgeConfirmed || userAgePolicyVersion !== AGE_POLICY_VERSION;

      console.log('[useTermsCheck] Version check:', {
        userTermsVersion,
        currentTermsVersion: TERMS_VERSION,
        termsNeedsUpdate,
        userPrivacyVersion,
        currentPrivacyVersion: PRIVACY_VERSION,
        privacyNeedsUpdate,
        userAgeConfirmed,
        userAgePolicyVersion,
        ageNeedsConfirm,
      });

      setTermsOutdated(termsNeedsUpdate);
      setPrivacyOutdated(privacyNeedsUpdate);
      setAgeNotConfirmed(ageNeedsConfirm);
    } catch (err) {
      console.error('[useTermsCheck] Exception:', err);
      setTermsOutdated(false);
      setPrivacyOutdated(false);
      setAgeNotConfirmed(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkTerms();
  }, [checkTerms]);

  return {
    loading,
    termsOutdated,
    privacyOutdated,
    ageNotConfirmed,
    needsReaccept: termsOutdated || privacyOutdated || ageNotConfirmed,
    refresh: checkTerms,
  };
}
