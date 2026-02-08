import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface GeoBlockResult {
  loading: boolean;
  isBlocked: boolean;
  countryCode: string | null;
  error: string | null;
}

// Blocked country codes - must match edge function
const BLOCKED_COUNTRIES = ['RU', 'CN'];

/**
 * Hook to check if the user is accessing from a blocked country
 * Uses geo-check edge function (via shared Supabase client) with fallback client-side detection
 */
export function useGeoBlock(): GeoBlockResult {
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkGeo = async () => {
      try {
        // Check localStorage cache first (valid for 10 minutes only to catch location changes)
        const cached = localStorage.getItem('lexora_geo_check');
        if (cached) {
          try {
            const { countryCode: cachedCode, isBlocked: cachedBlocked, timestamp } = JSON.parse(cached);
            const tenMinutes = 10 * 60 * 1000;
            if (Date.now() - timestamp < tenMinutes) {
              console.log('[useGeoBlock] Using cached result:', { cachedCode, cachedBlocked });
              if (!cancelled) {
                setCountryCode(cachedCode);
                setIsBlocked(cachedBlocked);
                setLoading(false);
              }
              return;
            } else {
              // Cache expired, remove it
              console.log('[useGeoBlock] Cache expired, refreshing');
              localStorage.removeItem('lexora_geo_check');
            }
          } catch (e) {
            console.log('[useGeoBlock] Cache parse error, continuing with check');
            localStorage.removeItem('lexora_geo_check');
          }
        }

        // Call edge function using shared Supabase client (no direct env reads), 10s timeout
        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('AbortError')), 10000);
        });
        let data: any;
        let fnError: any;
        try {
          const result = await Promise.race([
            supabase.functions.invoke('geo-check', { method: 'POST' }),
            timeoutPromise,
          ]) as { data: any; error: any };
          data = result.data;
          fnError = result.error;
        } catch (err: any) {
          if (err?.message === 'AbortError' || err?.name === 'AbortError') throw err;
          data = null;
          fnError = err;
        } finally {
          clearTimeout(timeoutId!);
        }

        if (cancelled) return;

        // Success (2xx): edge returned { countryCode, isBlocked }
        if (!fnError && data) {
          const detectedCountry = data.countryCode ?? 'unknown';
          const blocked = data.isBlocked === true;
          console.log('[useGeoBlock] Edge function response:', { countryCode: detectedCountry, isBlocked: blocked });

          localStorage.setItem('lexora_geo_check', JSON.stringify({
            countryCode: detectedCountry,
            isBlocked: blocked,
            timestamp: Date.now(),
          }));
          if (!cancelled) {
            setCountryCode(detectedCountry);
            setIsBlocked(blocked);
            setLoading(false);
          }
          return;
        }

        // 451 or other error: try to read body from error context (edge returns 451 with JSON body)
        const errBody = fnError?.context?.body ?? fnError?.body ?? fnError;
        const status = fnError?.context?.status ?? fnError?.status;
        const code = errBody?.code ?? fnError?.code;
        if (status === 451 || code === 'JURISDICTION_BLOCKED' || code === 'JURISDICTION_UNKNOWN') {
          const detectedCountry = errBody?.countryCode ?? 'unknown';
          console.log('[useGeoBlock] Jurisdiction blocked:', { countryCode: detectedCountry });
          localStorage.setItem('lexora_geo_check', JSON.stringify({
            countryCode: detectedCountry,
            isBlocked: true,
            timestamp: Date.now(),
          }));
          if (!cancelled) {
            setCountryCode(detectedCountry);
            setIsBlocked(true);
            setLoading(false);
          }
          return;
        }

        // Other error (e.g. network, no config): try client-side fallback
        console.log('[useGeoBlock] Edge function error, trying fallback:', fnError?.message ?? fnError);
        await tryClientSideFallback();

      } catch (err: any) {
        console.error('[useGeoBlock] Exception:', err);
        
        if (cancelled) return;

        // For abort (timeout) or fetch errors, try client-side fallback
        if (err.name === 'AbortError') {
          console.log('[useGeoBlock] Request timeout, trying fallback');
        }
        
        await tryClientSideFallback();
      }
    };

    // Client-side fallback using free geo API
    const tryClientSideFallback = async () => {
      console.log('[useGeoBlock] Trying client-side geo detection');
      
      try {
        // Try ip-api.com directly from client (works for HTTP requests)
        const response = await fetch('http://ip-api.com/json/?fields=status,countryCode', {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.countryCode) {
            const isCountryBlocked = BLOCKED_COUNTRIES.includes(data.countryCode.toUpperCase());
            console.log('[useGeoBlock] Client-side detection:', { countryCode: data.countryCode, isBlocked: isCountryBlocked });
            
            localStorage.setItem('lexora_geo_check', JSON.stringify({
              countryCode: data.countryCode,
              isBlocked: isCountryBlocked,
              timestamp: Date.now()
            }));

            setCountryCode(data.countryCode);
            setIsBlocked(isCountryBlocked);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.log('[useGeoBlock] Client-side fallback failed:', e);
      }

      // All methods failed - fail-open to not block legitimate users
      console.log('[useGeoBlock] All geo checks failed, allowing access');
      setError('geo_check_failed');
      setIsBlocked(false);
      setLoading(false);
    };

    checkGeo();

    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, isBlocked, countryCode, error };
}
