/**
 * Client-side guardrail: block non-legal/administrative queries before sending to AI.
 * Used by Demo Homepage chat, Dashboard chat, and Document Editor chat.
 */

/** Patterns that indicate out-of-scope (blocked) topics */
const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  // Ricette, cucina, diete
  /\b(ricetta|ricette|cucin|cuocere|bollire|quanto bollire|ingredienti|pasta|pizza|torta|dolce|rezept|kochen|backen|recipe|cook|bake|ingredient)\b/i,
  /\b(dieta|diete|calorie|dimagrire|peso|fitness|gym|workout)\b/i,
  // Sesso non-legale (relazioni personali generiche; allow divorce/domestic violence context via legal keywords)
  /\b(sesso\s+posizioni|posizioni\s+sessuali|come\s+fare\s+sesso|sex\s+positions)\b/i,
  // Medicina/diagnosi/farmaci (non contesto legale: allow malpractice, insurance)
  /\b(malattia\s+sintomi|sintomi\s+malattia|diagnosi\s+malattia|quale\s+farmaco|medicine\s+for|pillole\s+per)\b/i,
  /\b(ho\s+mal\s+di|mal\s+di\s+testa|febbre|influenza)\s+(cosa\s+prendo|che\s+prendo|what\s+to\s+take)\b/i,
  // Programmazione, tech support
  /\b(codice\s+javascript|javascript\s+code|python\s+script|come\s+si\s+programma|programmazione\s+in)\b/i,
  /\b(errore\s+di\s+codice|bug\s+code|fix\s+my\s+code|tech\s+support|computer\s+non\s+funziona)\b/i,
  // Intrattenimento generico, gossip
  /\b(film\s+da\s+vedere|serie\s+tv|netflix|gossip|celebrity|calcio\s+risultati|sport\s+risultati)\b/i,
  /\b(music|song|canzone|film|movie)\s+(recommend|consiglia|consigli)\b/i,
  // Domande scolastiche non giuridiche (generiche: matematica, storia non-legale)
  /\b(equazione|derivata|integrale|matematica\s+esercizio)\b/i,
];

/** Short messages (greetings, ok) are allowed and passed through */
const MIN_LENGTH_TO_CHECK = 12;

/**
 * Returns true if the message appears to be a legal/administrative query (or neutral/short).
 * Returns false if the message clearly belongs to blocked topics (recipes, tech, etc.).
 */
export function isLegalAdministrativeQuery(message: string): boolean {
  if (!message || typeof message !== 'string') return false;
  const trimmed = message.trim();
  if (trimmed.length < MIN_LENGTH_TO_CHECK) return true; // short = allow (greetings, "ok")
  const lower = trimmed.toLowerCase();
  for (const p of OUT_OF_SCOPE_PATTERNS) {
    if (p.test(lower)) return false;
  }
  return true;
}
