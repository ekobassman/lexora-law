/**
 * Centralized legal document versions
 * 
 * These constants ensure consistency between:
 * - What's shown in the Terms/Privacy pages
 * - What's saved to the database when users accept
 * 
 * When updating legal documents, change the version here
 * and the change will propagate everywhere automatically.
 */

// ISO date format for database storage
export const TERMS_VERSION = '2026-01-28';
export const PRIVACY_VERSION = '2026-01-28';
export const AGE_POLICY_VERSION = '2026-01-28';
export const DISCLAIMER_VERSION = '2026-01-28';

/**
 * Format a version date for display based on locale
 * @param version - ISO date string (YYYY-MM-DD)
 * @param language - Language code (de, en, it, etc.)
 * @returns Formatted date string
 */
export function formatVersionDate(version: string, language: string): string {
  const date = new Date(version);
  
  // Map language codes to locale codes
  const localeMap: Record<string, string> = {
    de: 'de-DE',
    en: 'en-US',
    it: 'it-IT',
    fr: 'fr-FR',
    es: 'es-ES',
    tr: 'tr-TR',
    ro: 'ro-RO',
    pl: 'pl-PL',
    ru: 'ru-RU',
    uk: 'uk-UA',
    ar: 'ar-SA',
  };
  
  const locale = localeMap[language.toLowerCase()] || 'de-DE';
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Get the "Last updated" label with formatted date
 */
export function getLastUpdatedLabel(version: string, language: string): string {
  const formattedDate = formatVersionDate(version, language);
  
  const labels: Record<string, string> = {
    de: `Zuletzt aktualisiert: ${formattedDate}`,
    en: `Last updated: ${formattedDate}`,
    it: `Ultimo aggiornamento: ${formattedDate}`,
    fr: `Dernière mise à jour : ${formattedDate}`,
    es: `Última actualización: ${formattedDate}`,
    tr: `Son güncelleme: ${formattedDate}`,
    ro: `Ultima actualizare: ${formattedDate}`,
    pl: `Ostatnia aktualizacja: ${formattedDate}`,
    ru: `Последнее обновление: ${formattedDate}`,
    uk: `Останнє оновлення: ${formattedDate}`,
    ar: `آخر تحديث: ${formattedDate}`,
  };
  
  return labels[language.toLowerCase()] || labels.de;
}
