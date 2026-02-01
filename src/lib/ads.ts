/**
 * Google Ads Conversion Tracking Helper
 * 
 * Usage:
 * - trackAdsConversion('AW-17633692634/CONVERSION_LABEL') 
 * - Use labels from Google Ads > Tools & Settings > Conversions > Event snippet
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GOOGLE_ADS_ID = 'AW-17633692634';

/**
 * Track a Google Ads conversion event
 * @param sendTo - Full conversion ID (e.g., 'AW-17633692634/XXXXXX')
 * @param eventKey - Unique key for anti-duplicate protection (e.g., 'signup', 'case_created')
 */
export function trackAdsConversion(sendTo: string, eventKey: string): void {
  // SSR safety check
  if (typeof window === 'undefined') {
    return;
  }

  // Anti-duplicate: check if already sent in this session
  const storageKey = `ads_conversion_${eventKey}`;
  if (sessionStorage.getItem(storageKey) === 'true') {
    if (import.meta.env.DEV) {
      console.log(`[Google Ads] Conversion "${eventKey}" already sent in this session, skipping.`);
    }
    return;
  }

  // Check gtag exists
  if (typeof window.gtag !== 'function') {
    if (import.meta.env.DEV) {
      console.warn('[Google Ads] gtag not found. Is the script loaded?');
    }
    return;
  }

  // Send conversion event
  window.gtag('event', 'conversion', {
    send_to: sendTo,
  });

  // Mark as sent to prevent duplicates
  sessionStorage.setItem(storageKey, 'true');

  if (import.meta.env.DEV) {
    console.log(`[Google Ads] Conversion sent: ${sendTo} (key: ${eventKey})`);
  }
}

/**
 * Track signup completion conversion
 * PLACEHOLDER: Replace CONVERSION_LABEL with actual label from Google Ads
 */
export function trackSignupConversion(): void {
  trackAdsConversion(
    'AW-17633692634/Ybn-CJGHY6kbENqXs9hB',
    'signup'
  );
}

/**
 * Track case creation conversion
 * PLACEHOLDER: Replace CONVERSION_LABEL with actual label from Google Ads
 */
export function trackCaseCreatedConversion(): void {
  // TODO: Replace 'CASE_CREATED_LABEL' with actual conversion label from Google Ads
  trackAdsConversion(`${GOOGLE_ADS_ID}/CASE_CREATED_LABEL`, 'case_created');
}

/**
 * Debug: Check if Google Ads tag is properly loaded
 */
export function checkGoogleAdsTag(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isLoaded = typeof window.gtag === 'function' && Array.isArray(window.dataLayer);
  
  if (import.meta.env.DEV) {
    console.log('[Google Ads] Tag status:', isLoaded ? '✅ Loaded' : '❌ Not loaded');
    console.log('[Google Ads] gtag:', typeof window.gtag);
    console.log('[Google Ads] dataLayer:', window.dataLayer?.length ?? 0, 'items');
  }
  
  return isLoaded;
}
