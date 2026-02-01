/**
 * Document Sanitizer Utility
 * Ensures final letter output NEVER contains bracket placeholders.
 */

/**
 * Known placeholder patterns that must be removed.
 */
const PLACEHOLDER_PATTERNS = [
  /\[CAP\s*e?\s*città\]/gi,
  /\[CAP\]/gi,
  /\[Città\]/gi,
  /\[Luogo\]/gi,
  /\[Data\s*odierna?\]/gi,
  /\[Data\]/gi,
  /\[indirizzo\s*scuola[^\]]*\]/gi,
  /\[inserire[^\]]*\]/gi,
  /\[Nome\]/gi,
  /\[Indirizzo\]/gi,
  /\[Scuola\]/gi,
  /\[tuo\s*nome\]/gi,
  /\[PLZ\]/gi,
  /\[Stadt\]/gi,
  /\[Ort\]/gi,
  /\[Datum\]/gi,
  /\[Name\]/gi,
  /\[Adresse\]/gi,
  /\[ZIP\]/gi,
  /\[City\]/gi,
  /\[Location\]/gi,
  /\[Date\]/gi,
  /\[Address\]/gi,
];

/**
 * Text patterns that indicate placeholder data (without brackets).
 */
const TEXT_PLACEHOLDER_PATTERNS = [
  /CAP\s+e\s+città/gi,
  /Data\s+odierna/gi,
];

/**
 * Checks if text contains any placeholder patterns.
 * Returns true if placeholders are found.
 */
export function containsPlaceholders(text: string): boolean {
  if (!text) return false;
  
  // Check for any bracket placeholder: [...]
  if (/\[[^\]]+\]/.test(text)) {
    return true;
  }
  
  // Check for known text patterns
  for (const pattern of TEXT_PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Finds the first placeholder in text and returns it.
 * Returns null if no placeholder found.
 */
export function findPlaceholder(text: string): string | null {
  if (!text) return null;
  
  // Find bracket placeholder
  const bracketMatch = text.match(/\[[^\]]+\]/);
  if (bracketMatch) {
    return bracketMatch[0];
  }
  
  // Find text patterns
  for (const pattern of TEXT_PLACEHOLDER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * Strips all placeholder patterns from text.
 * - Removes standalone lines that only contain placeholders
 * - Removes bracket tokens inside lines
 * - Cleans up double spaces and excessive newlines
 */
export function stripPlaceholders(text: string): string {
  if (!text) return '';
  
  let result = text;
  
  // Remove known placeholder patterns
  for (const pattern of PLACEHOLDER_PATTERNS) {
    result = result.replace(pattern, '');
  }
  
  // Remove any remaining bracket placeholders: [anything]
  result = result.replace(/\s*\[[^\]]+\]\s*/g, ' ');
  
  // Remove standalone lines that are now empty or only whitespace/punctuation
  result = result
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      // Remove lines that are only punctuation/whitespace after cleanup
      if (/^[\s,;.:-]*$/.test(trimmed)) {
        return '';
      }
      // Clean up double spaces within lines
      return line.replace(/\s{2,}/g, ' ').trim();
    })
    .join('\n');
  
  // Collapse 3+ consecutive newlines to max 2
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace
  result = result.trim();
  
  return result;
}

/**
 * Sanitizes a document for final output.
 * Combines placeholder stripping with additional cleanup.
 */
export function sanitizeDocument(text: string): string {
  if (!text) return '';
  
  let result = stripPlaceholders(text);
  
  // Additional cleanup: remove orphaned commas at line start/end
  result = result
    .split('\n')
    .map(line => {
      let cleaned = line.trim();
      // Remove leading commas
      cleaned = cleaned.replace(/^[,\s]+/, '');
      // Remove trailing orphaned commas
      cleaned = cleaned.replace(/[,\s]+$/, '');
      return cleaned;
    })
    .filter(line => line.length > 0 || line === '')
    .join('\n');
  
  return result.trim();
}

/**
 * Checks if document is safe for export (no placeholders).
 */
export function isDocumentSafe(text: string): boolean {
  return !containsPlaceholders(text);
}

/**
 * Gets a localized error message for placeholder detection.
 */
export function getPlaceholderErrorMessage(lang: string): string {
  const messages: Record<string, string> = {
    IT: 'Dati mancanti: completa CAP/Città e Luogo/Data.',
    DE: 'Fehlende Daten: PLZ/Stadt und Ort/Datum vervollständigen.',
    EN: 'Missing data: complete ZIP/City and Location/Date.',
    FR: 'Données manquantes : compléter CP/Ville et Lieu/Date.',
    ES: 'Datos faltantes: completa CP/Ciudad y Lugar/Fecha.',
    PL: 'Brakujące dane: uzupełnij kod pocztowy/miasto i miejsce/datę.',
    RO: 'Date lipsă: completează CP/Oraș și Loc/Dată.',
    TR: 'Eksik veri: posta kodu/şehir ve yer/tarih tamamlayın.',
    AR: 'بيانات مفقودة: أكمل الرمز البريدي/المدينة والموقع/التاريخ.',
    UK: 'Відсутні дані: заповніть індекс/місто та місце/дату.',
    RU: 'Отсутствуют данные: заполните индекс/город и место/дату.',
  };
  return messages[lang] || messages.DE;
}
