import { normLang, SupportedLang } from "./lang.ts";

export const SCOPE_REFUSAL_MESSAGES: Record<SupportedLang, string> = {
  IT: "Posso aiutarti solo con documenti e burocrazia (lettere, uffici, scadenze, moduli). Se hai bisogno di assistenza con un ufficio o un documento, dimmi pure!",
  DE: "Ich kann dir nur bei Dokumenten und Behördenangelegenheiten helfen (Briefe, Ämter, Fristen, Formulare). Wenn du Hilfe bei einem Amt oder Dokument brauchst, sag mir Bescheid!",
  EN: "I can only help with documents and bureaucratic matters (letters, offices, deadlines, forms). If you need help with an office or document, let me know!",
  FR: "Je ne peux vous aider qu'avec les documents et les démarches administratives (lettres, bureaux, délais, formulaires). Si vous avez besoin d'aide avec un bureau ou un document, dites-le moi!",
  ES: "Solo puedo ayudarte con documentos y trámites burocráticos (cartas, oficinas, plazos, formularios). Si necesitas ayuda con una oficina o documento, ¡dímelo!",
  PL: "Mogę Ci pomóc tylko w sprawach dokumentów i biurokracji (listy, urzędy, terminy, formularze). Jeśli potrzebujesz pomocy z urzędem lub dokumentem, daj mi znać!",
  RO: "Pot să te ajut doar cu documente și chestiuni birocratice (scrisori, birouri, termene, formulare). Dacă ai nevoie de ajutor cu un birou sau document, spune-mi!",
  TR: "Size yalnızca belgeler ve bürokratik konularda yardımcı olabilirim (mektuplar, ofisler, son tarihler, formlar). Bir ofis veya belge ile ilgili yardıma ihtiyacınız varsa, bana söyleyin!",
  AR: "يمكنني مساعدتك فقط في المستندات والأمور البيروقراطية (الرسائل، المكاتب، المواعيد النهائية، النماذج). إذا كنت بحاجة إلى مساعدة في مكتب أو مستند، أخبرني!",
  UK: "Я можу допомогти лише з документами та бюрократичними питаннями (листи, офіси, терміни, форми). Якщо вам потрібна допомога з офісом або документом, скажіть!",
  RU: "Я могу помочь только с документами и бюрократическими вопросами (письма, офисы, сроки, формы). Если вам нужна помощь с офисом или документом, скажите!",
};

export interface ScopeCheckResult {
  inScope: boolean;
  confidence: "high" | "medium" | "low";
  reason?: string;
}

const IN_SCOPE_PATTERNS: RegExp[] = [
  /\b(finanzamt|jobcenter|arbeitsagentur|ausländerbehörde|bürgeramt|zulassungsstelle|familienkasse|zoll|gericht|amtsgericht|anwalt|bescheid|widerspruch|einspruch|frist|formular|antrag|kündigung|mahnung|vollstreckung|schufa|rechnung|vertrag|behörde|amt)\b/i,
  /\b(lettera|ufficio|scadenza|modulo|istanza|ricorso|diffida|raccomandata|pec|inps|agenzia\s+delle\s+entrate)\b/i,
  /\b(office|deadline|form|appeal|notice|letter|administration|authority)\b/i,
];

const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  // ricette/cibo (including German compound words)
  /\b(ricetta|cucin|patate|kartoffel|kartoffelsalat|pizza|pasta|torta|dolce|ingredienti|rezept|kochen|backen)\b/i,
  // entertainment
  /\b(film|movie|serie|netflix|music|song|tiktok|capcut|youtube|spotify|kino)\b/i,
  // gaming/fitness ecc
  /\b(videogioco|gaming|ps5|xbox|workout|gym|dieta|calorie|fitness)\b/i,
];

export function checkScope(message: string): ScopeCheckResult {
  if (!message || typeof message !== "string") return { inScope: false, confidence: "high", reason: "empty_message" };

  const m = message.toLowerCase().trim();
  if (m.length < 10) return { inScope: true, confidence: "low", reason: "short_message" };

  let inHits = 0, outHits = 0;
  for (const p of IN_SCOPE_PATTERNS) if (p.test(message)) inHits++;
  for (const p of OUT_OF_SCOPE_PATTERNS) if (p.test(message)) outHits++;

  if (outHits > 0 && inHits === 0) return { inScope: false, confidence: "high", reason: "out_of_scope_detected" };
  if (inHits > 0) return { inScope: true, confidence: inHits >= 2 ? "high" : "medium", reason: "in_scope_detected" };

  // Ambiguo: lascia passare ma con low confidence
  if (outHits === 0 && inHits === 0) return { inScope: true, confidence: "low", reason: "no_clear_signal" };

  // Mixed
  if (inHits >= outHits) return { inScope: true, confidence: "medium", reason: "mixed_content_allowed" };
  return { inScope: false, confidence: "medium", reason: "mixed_content_rejected" };
}

export function getRefusalMessage(languageCode?: string): string {
  const lang = normLang(languageCode);
  return SCOPE_REFUSAL_MESSAGES[lang] || SCOPE_REFUSAL_MESSAGES.EN;
}
