/**
 * Format postal code and city, omitting placeholders.
 * Returns empty string if both are missing.
 */
export function formatAddress(zip?: string | null, city?: string | null): string {
  const zipClean = (zip ?? "").trim();
  const cityClean = (city ?? "").trim();
  
  if (zipClean && cityClean) return `${zipClean} ${cityClean}`;
  return zipClean || cityClean;
}

/**
 * Format a full address block, omitting any missing parts.
 * Returns array of non-empty lines.
 */
export function formatAddressLines(
  name?: string | null,
  address?: string | null,
  zip?: string | null,
  city?: string | null,
  country?: string | null
): string[] {
  const lines: string[] = [];
  const n = (name ?? "").trim();
  const a = (address ?? "").trim();
  const capCity = formatCapCity(zip, city);
  const co = (country ?? "").trim();

  if (n) lines.push(n);
  if (a) lines.push(a);
  if (capCity) lines.push(capCity);
  if (co) lines.push(co);

  return lines;
}

/**
 * Format sender line for DIN5008 header (single line with · separator)
 */
export function formatSenderLine(
  name?: string | null,
  address?: string | null,
  zip?: string | null,
  city?: string | null
): string {
  const parts: string[] = [];
  const n = (name ?? "").trim();
  const a = (address ?? "").trim();
  const capCity = formatCapCity(zip, city);

  if (n) parts.push(n);
  if (a) parts.push(a);
  if (capCity) parts.push(capCity);

  return parts.join(' · ');
}

/**
 * FORBIDDEN PLACEHOLDER PATTERNS
 * These must NEVER appear in final rendered documents.
 */
const FORBIDDEN_PLACEHOLDERS = [
  '[CAP]',
  '[CAP e città]',
  '[Città]',
  '[Luogo]',
  '[Data]',
  '[Data odierna]',
  '[inserire indirizzo se desiderato]',
  '[indirizzo scuola, se noto]',
  '[Nome]',
  '[Indirizzo]',
  '[Scuola]',
  '[tuo nome]',
  '[indirizzo]',
  // German variants
  '[PLZ]',
  '[Stadt]',
  '[Ort]',
  '[Datum]',
  '[Name]',
  '[Adresse]',
  // English variants
  '[ZIP]',
  '[City]',
  '[Location]',
  '[Date]',
  '[Address]',
];

/**
 * Check if text contains any forbidden placeholders.
 * Returns the first found placeholder or null if clean.
 */
export function findForbiddenPlaceholder(text: string): string | null {
  if (!text) return null;
  for (const placeholder of FORBIDDEN_PLACEHOLDERS) {
    if (text.includes(placeholder)) {
      return placeholder;
    }
  }
  return null;
}

/**
 * Check if document is safe to render (no forbidden placeholders).
 */
export function isDocumentClean(text: string): boolean {
  return findForbiddenPlaceholder(text) === null;
}

/**
 * Strip any forbidden placeholder patterns from text.
 * Removes entire lines that only contain placeholders.
 */
export function stripPlaceholders(text: string): string {
  if (!text) return '';
  
  let result = text;
  
  // Remove placeholders
  for (const placeholder of FORBIDDEN_PLACEHOLDERS) {
    result = result.split(placeholder).join('');
  }
  
  // Clean up empty lines and excessive whitespace
  result = result
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 || line === '') // Keep intentional empty lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  
  return result.trim();
}
