import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import i18n from '../i18n';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export type Language = 'IT' | 'DE' | 'EN' | 'FR' | 'ES' | 'PL' | 'RO' | 'TR' | 'AR' | 'UK' | 'RU';

export type Country = 'DE' | 'AT' | 'CH' | 'IT' | 'FR' | 'ES' | 'PL' | 'RO' | 'NL' | 'BE' | 'PT' | 'GR' | 'CZ' | 'HU' | 'SE' | 'DK' | 'FI' | 'NO' | 'IE' | 'GB' | 'OTHER';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}

export interface CountryInfo {
  code: Country;
  name: string;
  nativeName: string;
  flag: string;
  defaultLanguage: Language;
  authorityTerm: string;
  letterFormat: 'din5008' | 'standard' | 'uk';
}

export const languages: LanguageInfo[] = [
  { code: 'IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', rtl: false },
  { code: 'DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false },
  { code: 'EN', name: 'English', nativeName: 'English', flag: '🇬🇧', rtl: false },
  { code: 'FR', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'PL', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', rtl: false },
  { code: 'RO', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', rtl: false },
  { code: 'TR', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', rtl: false },
  { code: 'AR', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'UK', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', rtl: false },
  { code: 'RU', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', rtl: false },
];

export const countries: CountryInfo[] = [
  { code: 'DE', name: 'Germany', nativeName: 'Deutschland', flag: '🇩🇪', defaultLanguage: 'DE', authorityTerm: 'Behörde', letterFormat: 'din5008' },
  { code: 'AT', name: 'Austria', nativeName: 'Österreich', flag: '🇦🇹', defaultLanguage: 'DE', authorityTerm: 'Behörde', letterFormat: 'din5008' },
  { code: 'CH', name: 'Switzerland', nativeName: 'Schweiz', flag: '🇨🇭', defaultLanguage: 'DE', authorityTerm: 'Behörde', letterFormat: 'din5008' },
  { code: 'IT', name: 'Italy', nativeName: 'Italia', flag: '🇮🇹', defaultLanguage: 'IT', authorityTerm: 'Autorità', letterFormat: 'standard' },
  { code: 'FR', name: 'France', nativeName: 'France', flag: '🇫🇷', defaultLanguage: 'FR', authorityTerm: 'Autorité', letterFormat: 'standard' },
  { code: 'ES', name: 'Spain', nativeName: 'España', flag: '🇪🇸', defaultLanguage: 'ES', authorityTerm: 'Autoridad', letterFormat: 'standard' },
  { code: 'PL', name: 'Poland', nativeName: 'Polska', flag: '🇵🇱', defaultLanguage: 'PL', authorityTerm: 'Urząd', letterFormat: 'standard' },
  { code: 'RO', name: 'Romania', nativeName: 'România', flag: '🇷🇴', defaultLanguage: 'RO', authorityTerm: 'Autoritate', letterFormat: 'standard' },
  { code: 'NL', name: 'Netherlands', nativeName: 'Nederland', flag: '🇳🇱', defaultLanguage: 'EN', authorityTerm: 'Overheid', letterFormat: 'standard' },
  { code: 'BE', name: 'Belgium', nativeName: 'België', flag: '🇧🇪', defaultLanguage: 'FR', authorityTerm: 'Autorité', letterFormat: 'standard' },
  { code: 'PT', name: 'Portugal', nativeName: 'Portugal', flag: '🇵🇹', defaultLanguage: 'ES', authorityTerm: 'Autoridade', letterFormat: 'standard' },
  { code: 'GR', name: 'Greece', nativeName: 'Ελλάδα', flag: '🇬🇷', defaultLanguage: 'EN', authorityTerm: 'Αρχή', letterFormat: 'standard' },
  { code: 'CZ', name: 'Czech Republic', nativeName: 'Česká republika', flag: '🇨🇿', defaultLanguage: 'EN', authorityTerm: 'Úřad', letterFormat: 'standard' },
  { code: 'HU', name: 'Hungary', nativeName: 'Magyarország', flag: '🇭🇺', defaultLanguage: 'EN', authorityTerm: 'Hatóság', letterFormat: 'standard' },
  { code: 'SE', name: 'Sweden', nativeName: 'Sverige', flag: '🇸🇪', defaultLanguage: 'EN', authorityTerm: 'Myndighet', letterFormat: 'standard' },
  { code: 'DK', name: 'Denmark', nativeName: 'Danmark', flag: '🇩🇰', defaultLanguage: 'EN', authorityTerm: 'Myndighed', letterFormat: 'standard' },
  { code: 'FI', name: 'Finland', nativeName: 'Suomi', flag: '🇫🇮', defaultLanguage: 'EN', authorityTerm: 'Viranomainen', letterFormat: 'standard' },
  { code: 'NO', name: 'Norway', nativeName: 'Norge', flag: '🇳🇴', defaultLanguage: 'EN', authorityTerm: 'Myndighet', letterFormat: 'standard' },
  { code: 'IE', name: 'Ireland', nativeName: 'Ireland', flag: '🇮🇪', defaultLanguage: 'EN', authorityTerm: 'Authority', letterFormat: 'uk' },
  { code: 'GB', name: 'United Kingdom', nativeName: 'United Kingdom', flag: '🇬🇧', defaultLanguage: 'EN', authorityTerm: 'Authority', letterFormat: 'uk' },
  { code: 'OTHER', name: 'Other', nativeName: 'Other', flag: '🌍', defaultLanguage: 'EN', authorityTerm: 'Authority', letterFormat: 'standard' },
];

// Helper to get available languages for LanguageSelector
export const availableLanguages = languages;
export const availableCountries = countries;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  country: Country;
  setCountry: (country: Country) => void;
  countryInfo: CountryInfo;
  t: (key: string, options?: Record<string, unknown>) => string;
  isRTL: boolean;
  languageInfo: LanguageInfo;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Auto-detect country from browser/system
function detectCountry(): Country {
  try {
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en-US';
    const regionCode = browserLang.split('-')[1]?.toUpperCase();
    
    const matchedCountry = countries.find(c => c.code === regionCode);
    if (matchedCountry) {
      return matchedCountry.code;
    }
    
    const langCode = browserLang.split('-')[0].toUpperCase();
    if (langCode === 'DE') return 'DE';
    if (langCode === 'IT') return 'IT';
    if (langCode === 'FR') return 'FR';
    if (langCode === 'ES') return 'ES';
    if (langCode === 'PL') return 'PL';
    if (langCode === 'RO') return 'RO';
    
    return 'OTHER';
  } catch {
    return 'OTHER';
  }
}

// Map Language code (uppercase) to i18next language code (lowercase)
function languageToI18nCode(lang: Language): string {
  return lang.toLowerCase();
}

// Map i18next language code (lowercase) to Language code (uppercase)
function i18nCodeToLanguage(code: string): Language {
  const upper = code.toUpperCase() as Language;
  if (languages.find(l => l.code === upper)) {
    return upper;
  }
  return 'EN';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [language, setLanguageState] = useState<Language>(() => {
    // Initial locale must be available before first render.
    // i18n.ts already resolves localStorage > browser > default.
    return i18nCodeToLanguage(i18n.language);
  });

  const [country, setCountryState] = useState<Country>(() => {
    // Prefer geo-check cache (written by GeoBlockWrapper / this provider)
    try {
      const cached = localStorage.getItem('lexora_geo_check');
      if (cached) {
        const { countryCode, isBlocked, timestamp } = JSON.parse(cached);
        const tenMinutes = 10 * 60 * 1000;
        if (isBlocked !== true && countryCode && Date.now() - timestamp < tenMinutes) {
          const upper = String(countryCode).toUpperCase() as Country;
          if (countries.find((c) => c.code === upper)) return upper;
        }
      }
    } catch {
      // ignore
    }

    const saved = localStorage.getItem('lexora-country');
    if (saved) return saved as Country;
    return detectCountry();
  });

  const languageInfo = languages.find(l => l.code === language) || languages[0];
  const countryInfo = countries.find(c => c.code === country) || countries[countries.length - 1];
  const isRTL = languageInfo.rtl;

  // For logged-out users: keep the country indicator in sync with geo detection.
  // This prevents showing a stale country when localStorage has an old value.
  useEffect(() => {
    if (user) return;
    let cancelled = false;

    const applyDetectedCountry = (code: string | null | undefined) => {
      if (!code) return;
      const upper = code.toUpperCase() as Country;
      if (!countries.find((c) => c.code === upper)) return;
      // Always update localStorage to keep it in sync with detected geo
      localStorage.setItem('lexora-country', upper);
      if (upper !== country) {
        setCountryState(upper);
      }
    };

    const run = async () => {
      try {
        // Prefer cached geo-check result (written by GeoBlockWrapper)
        const cached = localStorage.getItem('lexora_geo_check');
        if (cached) {
          try {
            const { countryCode: cachedCode, isBlocked: cachedBlocked, timestamp } = JSON.parse(cached);
            const tenMinutes = 10 * 60 * 1000;
            if (cachedBlocked !== true && Date.now() - timestamp < tenMinutes) {
              if (!cancelled) applyDetectedCountry(cachedCode);
              return;
            }
          } catch {
            // ignore
          }
        }

        // If no usable cache, fetch geo-check once
        const backendUrl = import.meta.env.VITE_SUPABASE_URL;
        const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!backendUrl || !publishableKey) return;

        const controller = new AbortController();
        const t = window.setTimeout(() => controller.abort(), 5000);
        let res: Response;
        try {
          res = await fetch(`${backendUrl}/functions/v1/geo-check`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: publishableKey,
            },
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(t);
        }

        if (cancelled) return;
        if (!res.ok) return;

        const data = await res.json().catch(() => null);
        if (data?.isBlocked === true) return;

        // Write cache in the same format used elsewhere
        localStorage.setItem(
          'lexora_geo_check',
          JSON.stringify({ countryCode: data?.countryCode || null, isBlocked: false, timestamp: Date.now() })
        );

        applyDetectedCountry(data?.countryCode);
      } catch {
        // fail-open: don't change country
      }
    };

    // Run once on mount and also shortly after to catch when GeoBlockWrapper writes cache slightly later.
    run();
    const retry = window.setTimeout(run, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, [user, country]);

  // Highest priority after login: persisted user profile settings.
  useEffect(() => {
    let cancelled = false;

    async function loadProfileLocale() {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_language, country')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn('Failed to load profile locale:', error.message);
        return;
      }

      const preferred = (data?.preferred_language || '').toString().toUpperCase();
      const profileLang = languages.find((l) => l.code === (preferred as any))
        ? (preferred as Language)
        : null;

      if (profileLang && profileLang !== language) {
        i18n.changeLanguage(languageToI18nCode(profileLang));
        setLanguageState(profileLang);
      }

      const profileCountry = (data?.country || '').toString().toUpperCase() as Country;
      if (profileCountry && countries.find((c) => c.code === profileCountry) && profileCountry !== country) {
        setCountryState(profileCountry);
      }
    }

    loadProfileLocale();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep localStorage + <html> attributes in sync (and ensure i18n uses the same locale)
  useEffect(() => {
    localStorage.setItem('lexora-language', language.toLowerCase());
    if (i18n.language !== language.toLowerCase()) {
      i18n.changeLanguage(language.toLowerCase());
    }
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language.toLowerCase();
  }, [language, isRTL]);

  useEffect(() => {
    localStorage.setItem('lexora-country', country);
  }, [country]);

  const persistProfile = async (patch: { preferred_language?: string; country?: string }) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) console.warn('Failed to persist profile settings:', error.message);
  };

  const setLanguage = (lang: Language) => {
    const i18nCode = languageToI18nCode(lang);
    i18n.changeLanguage(i18nCode);
    setLanguageState(lang);
    void persistProfile({ preferred_language: lang });
  };

  const setCountry = (c: Country) => {
    setCountryState(c);
    void persistProfile({ country: c });
  };

  // Translation function using i18n directly
  // useCallback with language dependency to force re-renders when language changes
  const t = useCallback((key: string, options?: Record<string, unknown>): string => {
    // Force using current language to ensure correct translations
    const langCode = language.toLowerCase();
    const defaultValue = options?.defaultValue as string | undefined;
    
    // Don't pass defaultValue to i18n.t - we handle fallback ourselves
    const { defaultValue: _, ...i18nOptions } = options || {};
    const result = i18n.t(key, { ...i18nOptions, lng: langCode } as any);
    
    // If i18n returns the key (not found), try manual resolution
    if (result === key) {
      // Try to get the translation from the resources directly
      const resources = i18n.options.resources;
      if (resources && resources[langCode]) {
        const translation = (resources[langCode] as any)?.translation;
        if (translation) {
          // Navigate nested keys (e.g., "chat.updateDraft")
          const keys = key.split('.');
          let value: any = translation;
          for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
          }
          if (typeof value === 'string') return value;
        }
      }
      // Fallback to English
      if (resources && resources['en']) {
        const enTranslation = (resources['en'] as any)?.translation;
        if (enTranslation) {
          const keys = key.split('.');
          let value: any = enTranslation;
          for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
          }
          if (typeof value === 'string') return value;
        }
      }
      // Ultimate fallback: use defaultValue if provided, otherwise return key
      if (defaultValue) return defaultValue;
    }
    
    return typeof result === 'string' ? result : (defaultValue ?? key);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, country, setCountry, countryInfo, t, isRTL, languageInfo }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
