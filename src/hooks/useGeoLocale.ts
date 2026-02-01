import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, Country, Language, countries, languages } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Maps detected geo country code to our Country type
 */
function mapGeoToCountry(geoCode: string | null | undefined): Country | null {
  if (!geoCode) return null;
  const upper = geoCode.toUpperCase();
  const found = countries.find(c => c.code === upper);
  return found ? found.code : null;
}

/**
 * Gets the default language for a country
 */
function getLanguageForCountry(country: Country): Language {
  const countryInfo = countries.find(c => c.code === country);
  if (countryInfo) {
    const lang = countryInfo.defaultLanguage;
    if (languages.find(l => l.code === lang)) {
      return lang;
    }
  }
  return 'EN';
}

/**
 * Hook that fetches geo-location on login and applies the detected
 * territory's country (legal context) and language.
 * 
 * Only applies on first login session or when profile has no country set.
 * User can always override in Settings.
 */
export function useGeoLocale() {
  const { user } = useAuth();
  const { country, setCountry, setLanguage } = useLanguage();
  const appliedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset when user changes (new login)
    if (user?.id !== lastUserIdRef.current) {
      appliedRef.current = false;
      lastUserIdRef.current = user?.id || null;
    }

    if (!user || appliedRef.current) return;

    async function applyGeoLocale() {
      try {
        // Check if user already has a country set in profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('country, preferred_language')
          .eq('id', user!.id)
          .maybeSingle();

        // If profile already has country set, don't override
        if (profile?.country && profile.country !== 'OTHER') {
          appliedRef.current = true;
          return;
        }

        // Fetch geo data
        const { data: geoData, error } = await supabase.functions.invoke('geo-check');
        
        if (error) {
          console.warn('[useGeoLocale] Geo check error:', error);
          appliedRef.current = true;
          return;
        }

        const detectedCountry = mapGeoToCountry(geoData?.countryCode);
        
        if (detectedCountry && detectedCountry !== 'OTHER') {
          console.log('[useGeoLocale] Detected country:', detectedCountry);
          
          // Apply country (legal context)
          setCountry(detectedCountry);
          
          // Apply default language for that country
          const detectedLanguage = getLanguageForCountry(detectedCountry);
          setLanguage(detectedLanguage);
          
          // Persist to profile
          await supabase
            .from('profiles')
            .update({ 
              country: detectedCountry,
              preferred_language: detectedLanguage 
            })
            .eq('id', user!.id);
          
          console.log('[useGeoLocale] Applied geo-locale:', { 
            country: detectedCountry, 
            language: detectedLanguage 
          });
        }
        
        appliedRef.current = true;
      } catch (err) {
        console.warn('[useGeoLocale] Error:', err);
        appliedRef.current = true;
      }
    }

    applyGeoLocale();
  }, [user, setCountry, setLanguage]);
}
