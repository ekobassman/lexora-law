// Extract ONLY the formal letter text from an AI response.
// Supports short letters (school excuses, etc.) - min 50 chars instead of 200.

const END_MARKERS = [
  /\b(fine\s+documento)\b/gi,
  /\b(end\s+of\s+document)\b/gi,
  /\b(ende\s+des\s+dokuments?)\b/gi,
  /\b(fin\s+du\s+document)\b/gi,
  /\b(fin\s+del\s+documento)\b/gi,
  /\b(fine\s+lettera)\b/gi,
  /\b(end\s+of\s+letter)\b/gi,
  /\b(ende\s+des\s+briefs?)\b/gi,
];

// Meta headings that must be stripped BEFORE the letter
const META_HEADING_PATTERNS = [
  /^\s*\*{0,2}\s*(spiegazione|explanation|erklärung|explication|explicación)\s*\*{0,2}\s*:?\s*\n+/gim,
  /^\s*\*{0,2}\s*(analisi|analysis|analyse)\s*\*{0,2}\s*:?\s*\n+/gim,
  /^\s*\*{0,2}\s*(riassunto|summary|zusammenfassung|résumé)\s*\*{0,2}\s*:?\s*\n+/gim,
  /^\s*\*{0,2}\s*(note|notes|hinweise|remarques)\s*\*{0,2}\s*:?\s*\n+/gim,
  /^\s*\*{0,2}\s*(prossimi\s+passi|next\s+steps|nächste\s+schritte)\s*\*{0,2}\s*:?\s*\n+/gim,
  /^\s*[-—–]{2,}\s*(lettera|letter|brief|lettre)\s*[-—–]{2,}\s*\n+/gim,
  /^\s*(lettera|letter|brief|lettre)\s*:?\s*\n+/gim,
  /^\s*---\s*LETTERA\s*---\s*\n+/gim,
  /^\s*---\s*FINE\s+LETTERA\s*---\s*$/gim,
  /^\s*\[LETTER\]\s*\n*/gim,
  /^\s*\[\/LETTER\]\s*$/gim,
  /^\s*[-_]{3,}\s*\n+/gm, // Separator lines
];

function stripEndMarkers(text: string): string {
  let out = text;
  for (const re of END_MARKERS) out = out.replace(re, "");
  return out.replace(/[\s\n\r]+$/g, "").trimEnd();
}

function stripMetaHeadings(text: string): string {
  let out = text;
  for (const re of META_HEADING_PATTERNS) {
    out = out.replace(re, "");
  }
  return out.trim();
}

// Strip chatty prefaces that appear before letters
function stripChattyPrefaces(text: string): string {
  const prefacePatterns: RegExp[] = [
    /^\s*(ecco\s+la\s+(bozza|lettera)[^:]*:?\s*\n+)/i,
    /^\s*(here\s+is\s+(the\s+)?(draft|letter)[^:]*:?\s*\n+)/i,
    /^\s*(hier\s+ist\s+(der\s+)?(entwurf|brief)[^:]*:?\s*\n+)/i,
    /^\s*(voici\s+(le\s+)?(brouillon|lettre)[^:]*:?\s*\n+)/i,
    /^\s*(aquí\s+está\s+(el\s+)?(borrador|carta)[^:]*:?\s*\n+)/i,
    /^\s*(certamente|certo|sure|of\s+course|natürlich|bien\s+sûr)[^:]*:?\s*\n+/i,
    /^\s*(ho\s+modificato|i\s+have\s+modified|ich\s+habe\s+geändert)[^.]*\.\s*\n+/i,
  ];
  
  let out = text;
  for (const p of prefacePatterns) {
    out = out.replace(p, '');
  }
  return out.trim();
}

// Heuristic start detection
const START_PATTERNS: RegExp[] = [
  /(?:^|\n)(Sehr geehrte[\s\S]*)/m,
  /(?:^|\n)(Gentile[\s\S]*)/m,
  /(?:^|\n)(Spett\.[\s\S]*)/m,
  /(?:^|\n)(Spett\.le[\s\S]*)/m,
  /(?:^|\n)(Egregio[\s\S]*)/m,
  /(?:^|\n)(Alla\s+cortese\s+attenzione[\s\S]*)/im,
  /(?:^|\n)(Dear[\s\S]*)/im,
  /(?:^|\n)(To whom it may concern[\s\S]*)/im,
];

// Formal letter markers
const SUBJECT_RE = /^\s*(betreff|oggetto|subject|objet|asunto)\s*:\s*.+$/im;
const OPENING_RE = /^\s*(egregio|gentile|spett\.?\s*le|spett\.?\s*li|spett\.?\s*mo|alla\s+cortese\s+attenzione|sehr\s+geehrte[rn]?|geehrte\s+damen?|dear\s+(sir|madam|mr|ms|mrs)|to\s+whom\s+it\s+may\s+concern|an\s*:|to\s*:|a\s*:)\b/im;
const CLOSING_RE = /(mit\s+freundlichen\s+grüßen|hochachtungsvoll|cordiali\s+saluti|distinti\s+saluti|con\s+osservanza|sincerely|best\s+regards|kind\s+regards|cordialement|salutations|atentamente)\b/i;

/**
 * Returns the letter body if detected, otherwise null.
 * Supports short letters (min 50 chars) for school excuses, etc.
 */
export function extractFormalLetterOnly(raw: string): string | null {
  const input = (raw || "").replace(/\r\n/g, "\n").trim();
  if (!input) return null;

  // 1) Legacy markers support
  const markerMatch = input.match(/---LETTERA---\s*([\s\S]*?)\s*---FINE\s+LETTERA---/i);
  if (markerMatch?.[1]) {
    const cleaned = stripEndMarkers(stripMetaHeadings(markerMatch[1].trim()));
    return cleaned.length >= 50 ? cleaned : null;
  }

  // 2) Bracket markers (demo chat legacy)
  const bracketMatch = input.match(/\[LETTER\]\s*([\s\S]*?)\s*\[\/LETTER\]/i);
  if (bracketMatch?.[1]) {
    const cleaned = stripEndMarkers(stripMetaHeadings(bracketMatch[1].trim()));
    return cleaned.length >= 50 ? cleaned : null;
  }

  // 3) Start marker without end
  const startOnly = input.match(/---LETTERA---\s*([\s\S]*)$/i);
  if (startOnly?.[1]) {
    const cleaned = stripEndMarkers(stripMetaHeadings(startOnly[1].trim()));
    return cleaned.length >= 50 ? cleaned : null;
  }

  // 4) Clean input: strip meta headings and chatty prefaces
  const cleanedInput = stripChattyPrefaces(stripMetaHeadings(input));

  // 5) Heuristic: start from known greeting
  for (const p of START_PATTERNS) {
    const m = cleanedInput.match(p);
    if (m?.[1]) {
      const cleaned = stripEndMarkers(stripMetaHeadings(m[1].trim()));
      // SHORT LETTER SUPPORT: min 50 chars (was 200)
      if (cleaned.length >= 50) return cleaned;
    }
  }

  // 6) If has subject + closing, accept even if short
  const hasSubject = SUBJECT_RE.test(cleanedInput);
  const hasOpening = OPENING_RE.test(cleanedInput);
  const hasClosing = CLOSING_RE.test(cleanedInput);
  
  // Accept if at least 2 formal markers and min 50 chars
  const markerCount = [hasSubject, hasOpening, hasClosing].filter(Boolean).length;
  if (markerCount >= 2 && cleanedInput.length >= 50) {
    return stripEndMarkers(cleanedInput);
  }

  // 7) If has closing and min length, likely a letter
  if (hasClosing && cleanedInput.length >= 50) {
    return stripEndMarkers(cleanedInput);
  }

  return null;
}
