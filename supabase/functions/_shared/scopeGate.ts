import { normLang, SupportedLang } from "./lang.ts";

export const SCOPE_REFUSAL_MESSAGES: Record<SupportedLang, string> = {
  IT: "Mi occupo solo di questioni legali e amministrative: lettere, uffici, scadenze, divorzi, consulenze legali, lettura e generazione di documenti. Non posso aiutare con diete, amore, sesso, meccanica o altri argomenti fuori ambito. Per un documento o una lettera, dimmi pure!",
  DE: "Ich helfe nur bei rechtlichen und behördlichen Angelegenheiten: Briefe, Ämter, Fristen, Scheidung, Rechtsberatung, Dokumente lesen und erstellen. Keine Diäten, Liebe, Sex, Mechanik oder andere Themen. Bei einem Dokument oder Brief sag Bescheid!",
  EN: "I only help with legal and administrative matters: letters, offices, deadlines, divorce, legal advice, reading and generating documents. I don't do diets, love, sex, mechanics or other off-topic subjects. For a document or letter, let me know!",
  FR: "Je n'aide qu'en matière juridique et administrative : lettres, administrations, délais, divorce, conseils juridiques, lecture et rédaction de documents. Pas de régimes, amour, sexe, mécanique ou autres sujets. Pour un document ou une lettre, dites-moi !",
  ES: "Solo ayudo en asuntos legales y administrativos: cartas, oficinas, plazos, divorcio, asesoramiento legal, lectura y redacción de documentos. No dietas, amor, sexo, mecánica ni otros temas. Para un documento o carta, ¡dímelo!",
  PL: "Pomagam tylko w sprawach prawnych i administracyjnych: listy, urzędy, terminy, rozwód, porady prawne, dokumenty. Nie diety, miłość, seks, mechanika ani inne tematy. W sprawie dokumentu lub listu daj znać!",
  RO: "Vă ajut doar cu aspecte juridice și administrative: scrisori, birouri, termene, divorț, consultanță juridică, citire și redactare documente. Fără diete, dragoste, sex, mecanică sau alte subiecte. Pentru un document sau o scrisoare, spune-mi!",
  TR: "Sadece hukuki ve idari konularda yardımcı olurum: mektuplar, ofisler, son tarihler, boşanma, hukuki danışmanlık, belge okuma ve oluşturma. Diyet, aşk, cinsellik, mekanik veya diğer konularda yardımcı olamam. Belge veya mektup için söyleyin!",
  AR: "أساعد فقط في الأمور القانونية والإدارية: رسائل، مكاتب، مواعيد، طلاق، استشارات قانونية، قراءة وكتابة المستندات. لا أنظمات غذائية ولا حب ولا جنس ولا ميكانيكا. للمستند أو الرسالة أخبرني!",
  UK: "Допомагаю лише з юридичними та адміністративними питаннями: листи, офіси, терміни, розлучення, юридичні консультації, документи. Без дієт, кохання, сексу, механіки тощо. Для документа чи листа — напишіть!",
  RU: "Помогаю только по юридическим и административным вопросам: письма, офисы, сроки, развод, юридические консультации, документы. Без диет, любви, секса, механики и т.д. Для документа или письма — напишите!",
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
  // diete / diet / nutrition (no legal)
  /\b(dieta|diete|diet|dimagrire|perdere peso|calorie|nutrizione|nutrition|regime alimentare)\b/i,
  // amore / love / relazioni non legali
  /\b(amore|love|innamoramento|storia d'amore|romance|dating|appuntamento romantico)\b/i,
  // sesso / sex (no legal/medical context)
  /\b(sesso|sex|sessualità|sexual|erotico|erotic)\b/i,
  // meccanico / auto / riparazioni
  /\b(meccanico|mechanic|riparare auto|car repair|motore|engine|cambio|clutch|freni|brakes)\b/i,
  // ricette/cibo
  /\b(ricetta|cucin|patate|kartoffel|pizza|pasta|torta|dolce|ingredienti|rezept|kochen|backen)\b/i,
  // entertainment
  /\b(film|movie|serie|netflix|music|song|tiktok|capcut|youtube|spotify|kino)\b/i,
  // gaming/fitness (non legale)
  /\b(videogioco|gaming|ps5|xbox|workout|gym|fitness)\b/i,
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
