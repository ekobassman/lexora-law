import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrencyByCountry, formatPrice, Currency, getTimezoneCountry } from '@/lib/currency';
import { getDisplayPrice, PaidPlanKey } from '@/lib/pricingDisplay';

interface PriceProps {
  planKey: PaidPlanKey | 'free';
  country?: string;
  locale?: string;
  suffix?: string;
  showSuffix?: boolean;
  className?: string;
}

/**
 * Reusable Price component that displays localized pricing
 * based on user's country/timezone using Intl.NumberFormat
 */
export function Price({
  planKey,
  country,
  locale,
  suffix,
  showSuffix = true,
  className = '',
}: PriceProps) {
  const { t, language } = useLanguage();

  // Free plan renders as "Free" with no currency
  if (planKey === 'free') {
    return <span className={className}>{t('pricing.free')}</span>;
  }

  // Resolve currency from country or timezone
  const resolvedCountry = country || getTimezoneCountry();
  const currency: Currency = getCurrencyByCountry(resolvedCountry);
  const amount = getDisplayPrice(planKey, currency);

  // Resolve locale: priority is explicit locale > UI language > navigator
  const languageToLocale: Record<string, string> = {
    DE: 'de-DE',
    EN: 'en-US',
    IT: 'it-IT',
    FR: 'fr-FR',
    ES: 'es-ES',
    TR: 'tr-TR',
    RO: 'ro-RO',
    PL: 'pl-PL',
    RU: 'ru-RU',
    UK: 'uk-UA',
    AR: 'ar-SA',
  };
  const resolvedLocale = locale || languageToLocale[language] || navigator.language || 'en-US';

  // Format price using Intl.NumberFormat
  const priceString = formatPrice(amount, currency, resolvedLocale);

  // Determine suffix text
  const suffixText = suffix ?? (showSuffix ? `/${t('pricing.perMonth')}` : '');

  return (
    <span className={className}>
      {priceString}
      {suffixText && <span className="text-muted-foreground">{suffixText}</span>}
    </span>
  );
}

/**
 * Hook to get the resolved currency for the current user
 */
export function usePricingCurrency(profileCountry?: string | null): {
  currency: Currency;
  country: string | undefined;
} {
  // Import here to avoid circular dependency
  const { getTimezoneCountry } = require('@/lib/currency');
  
  // Priority: profile country > timezone guess
  const tzCountry = getTimezoneCountry();
  const resolvedCountry = profileCountry || tzCountry;
  const currency = getCurrencyByCountry(resolvedCountry);
  
  return { currency, country: resolvedCountry };
}
