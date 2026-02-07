import { useState, useEffect } from 'react';

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
 * Uses geo-check edge function with fallback client-side detection
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

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
          console.error('[useGeoBlock] Missing Supabase config');
          // Fail-open if config missing
          if (!cancelled) {
            setIsBlocked(false);
            setLoading(false);
          }
          return;
        }

        // Call edge function with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        let response: Response;
        try {
          response = await fetch(`${supabaseUrl}/functions/v1/geo-check`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (cancelled) return;

        // Parse response - handle both JSON and non-JSON responses
        let data: any;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.error('[useGeoBlock] Non-JSON response:', text);
          // Try client-side fallback
          await tryClientSideFallback();
          return;
        }

        console.log('[useGeoBlock] Edge function response:', { status: response.status, data });

        // Handle 451 Unavailable For Legal Reasons
        if (response.status === 451 || data.code === 'JURISDICTION_BLOCKED' || data.code === 'JURISDICTION_UNKNOWN') {
          console.log('[useGeoBlock] Jurisdiction blocked:', data);

          const detectedCountry = data.countryCode || 'unknown';
          
          // Cache the blocked result
          localStorage.setItem('lexora_geo_check', JSON.stringify({
            countryCode: detectedCountry,
            isBlocked: true,
            timestamp: Date.now()
          }));

          if (!cancelled) {
            setCountryCode(detectedCountry);
            setIsBlocked(true);
            setLoading(false);
          }
          return;
        }

        // Handle successful response
        if (response.ok && data) {
          const detectedCountry = data.countryCode || 'unknown';
          const blocked = data.isBlocked === true;

          // Cache result
          localStorage.setItem('lexora_geo_check', JSON.stringify({
            countryCode: detectedCountry,
            isBlocked: blocked,
            timestamp: Date.now()
          }));

          if (!cancelled) {
            setCountryCode(detectedCountry);
            setIsBlocked(blocked);
            setLoading(false);
          }
          return;
        }

        // Unexpected response - try fallback
        console.error('[useGeoBlock] Unexpected response:', response.status);
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
