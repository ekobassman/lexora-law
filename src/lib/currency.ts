// Currency resolution and formatting utilities

export type Currency = 'EUR' | 'USD' | 'GBP';
export type CountryCode = string;

/**
 * Map country code to currency
 */
export function getCurrencyByCountry(country?: string): Currency {
  if (!country) return 'EUR';
  
  const upper = country.toUpperCase();
  
  // US -> USD
  if (upper === 'US') return 'USD';
  
  // UK/GB -> GBP
  if (upper === 'GB' || upper === 'UK') return 'GBP';
  
  // Everyone else -> EUR
  return 'EUR';
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  switch (currency) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    default: return '€';
  }
}

/**
 * Format price with Intl.NumberFormat
 */
export function formatPrice(amount: number, currency: Currency, locale?: string): string {
  const resolvedLocale = locale || getDefaultLocale(currency);
  
  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format price as short string (e.g. "$10" instead of "$10.00")
 */
export function formatPriceShort(amount: number, currency: Currency): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(2);
  
  // USD/GBP: symbol before number
  if (currency === 'USD' || currency === 'GBP') {
    return `${symbol}${formatted}`;
  }
  
  // EUR: symbol after number (European convention)
  return `${formatted}${symbol}`;
}

/**
 * Get default locale for currency
 */
function getDefaultLocale(currency: Currency): string {
  switch (currency) {
    case 'USD': return 'en-US';
    case 'GBP': return 'en-GB';
    case 'EUR': return 'de-DE';
    default: return 'de-DE';
  }
}

/**
 * Guess country from timezone (lightweight heuristic)
 * Only specific US timezones return 'US' - Canada/Mexico/etc are excluded
 */
export function guessCountryFromTimezone(tz?: string): 'US' | 'GB' | undefined {
  if (!tz) return undefined;
  
  // Only specific US timezones (excludes Canada, Mexico, etc.)
  const usTimezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
  ];
  if (usTimezones.includes(tz)) return 'US';
  
  // Europe/London -> GB
  if (tz === 'Europe/London') return 'GB';
  
  return undefined;
}

/**
 * Get user's timezone-based country guess
 */
export function getTimezoneCountry(): 'US' | 'GB' | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return guessCountryFromTimezone(tz);
  } catch {
    return undefined;
  }
}
