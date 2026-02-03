import { normLang, SupportedLang } from "./lang.ts";

export const SCOPE_REFUSAL_MESSAGES: Record<SupportedLang, string> = {
  IT: "Mi dispiace, posso aiutarti solo con questioni legali e amministrative. Posso assisterti con contratti, lettere formali, consulenza legale o pratiche burocratiche. Hai bisogno di aiuto con uno di questi argomenti?",
  DE: "Es tut mir leid, ich kann nur bei rechtlichen und administrativen Angelegenheiten helfen. Ich kann Sie bei Verträgen, formellen Schreiben, Rechtsberatung oder bürokratischen Verfahren unterstützen. Benötigen Sie Hilfe zu einem dieser Themen?",
  EN: "I'm sorry, I can only assist with legal and administrative matters. I can help with contracts, formal letters, legal advice or bureaucratic procedures. Do you need help with any of these?",
  FR: "Je suis désolé, je ne peux vous aider qu'en matière juridique et administrative. Je peux vous assister pour les contrats, lettres formelles, conseil juridique ou démarches administratives. Avez-vous besoin d'aide sur l'un de ces sujets ?",
  ES: "Lo siento, solo puedo ayudarte con asuntos legales y administrativos. Puedo asistirte con contratos, cartas formales, asesoramiento legal o trámites burocráticos. ¿Necesitas ayuda con alguno de estos temas?",
  PL: "Przepraszam, mogę pomagać tylko w sprawach prawnych i administracyjnych. Mogę pomóc w zakresie umów, pism formalnych, porad prawnych lub procedur urzędowych. Czy potrzebujesz pomocy w którymś z tych obszarów?",
  RO: "Îmi pare rău, vă pot ajuta doar în materie juridică și administrativă. Vă pot asista la contracte, scrisori formale, consultanță juridică sau proceduri birocratice. Aveți nevoie de ajutor pentru unul dintre aceste subiecte?",
  TR: "Üzgünüm, yalnızca hukuki ve idari konularda yardımcı olabilirim. Sözleşmeler, resmi yazılar, hukuki danışmanlık veya bürokratik işlemler konusunda size yardımcı olabilirim. Bu konulardan biriyle ilgili yardıma ihtiyacınız var mı?",
  AR: "أعتذر، يمكنني المساعدة فقط في المسائل القانونية والإدارية. يمكنني مساعدتك في العقود والرسائل الرسمية والاستشارات القانونية أو الإجراءات الإدارية. هل تحتاج مساعدة في أحد هذه المواضيع؟",
  UK: "Вибачте, я можу допомагати лише з юридичними та адміністративними питаннями. Можу допомогти з договорами, офіційними листами, юридичними консультаціями чи бюрократичними процедурами. Чи потрібна вам допомога з одним із цих питань?",
  RU: "Извините, я могу помогать только по юридическим и административным вопросам. Могу помочь с договорами, официальными письмами, юридическими консультациями или бюрократическими процедурами. Нужна ли вам помощь по одному из этих вопросов?",
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
