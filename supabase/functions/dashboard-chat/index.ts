import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenAI } from "../_shared/openai.ts";
import { getIntakeModeRules, DOCUMENT_TYPE_DETECTION, DOCUMENT_IN_CONTEXT_INTAKE_OVERRIDE } from "../_shared/intakePromptRules.ts";
import { normLang } from "../_shared/lang.ts";
import { checkScope, getRefusalMessage } from "../_shared/scopeGate.ts";
import { webSearch, formatSourcesSection, type SearchResult } from "../_shared/webAssist.ts";
import { intelligentSearch, detectSearchIntent, detectInfoRequest } from "../_shared/intelligentSearch.ts";
import { hasUserConfirmed, isDocumentGenerationAttempt, buildSummaryBlock, extractDocumentData, wasPreviousMessageSummary, CREATE_DOCUMENT_OR_ADD_MORE, type DocumentData } from "../_shared/documentGate.ts";
import { POLICY_DEMO_DASHBOARD } from "../_shared/lexoraChatPolicy.ts";
import { LEXORA_CONTEXT_FIRST_RULES } from "../_shared/lexoraSystemPrompt.ts";
import {
  buildStrictMessages,
  expectDocumentGuardrail,
  validateOutputForbiddenPhrases,
} from "../_shared/documentChatGuardrails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// User profile context (passed from frontend)
interface UserProfileContext {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  senderFullName?: string;
  senderAddress?: string;
  senderCity?: string;
  senderPostalCode?: string;
  senderCountry?: string;
}

// Case context (passed from frontend)
interface CaseContext {
  id: string;
  title: string;
  authority?: string;
  aktenzeichen?: string;
  deadline?: string;
  letterText?: string;
  draftResponse?: string;
  documents?: Array<{
    id: string;
    fileName?: string;
    rawText?: string;
    direction: string;
    createdAt: string;
  }>;
}

// Message limits per plan (per calendar day). Free: 15/day; starter/plus/pro: unlimited (entitlements returns null)
const PLAN_LIMITS: Record<string, number | null> = {
  free: 15,
  starter: null,
  plus: null,
  pro: null,
  unlimited: null,
};

const PLAN_FEATURES: Record<string, {
  allowsStructuredSuggestions: boolean;
  allowsLegalReferences: boolean;
  allowsFullStrategy: boolean;
}> = {
  free: { allowsStructuredSuggestions: false, allowsLegalReferences: false, allowsFullStrategy: false },
  starter: { allowsStructuredSuggestions: true, allowsLegalReferences: false, allowsFullStrategy: false },
  plus: { allowsStructuredSuggestions: true, allowsLegalReferences: true, allowsFullStrategy: false },
  pro: { allowsStructuredSuggestions: true, allowsLegalReferences: true, allowsFullStrategy: true },
  unlimited: { allowsStructuredSuggestions: true, allowsLegalReferences: true, allowsFullStrategy: true },
};

const LANGUAGE_MAP: Record<string, string> = {
  IT: "Italian",
  DE: "German",
  EN: "English",
  FR: "French",
  ES: "Spanish",
  PL: "Polish",
  RO: "Romanian",
  TR: "Turkish",
  AR: "Arabic",
  UK: "Ukrainian",
  RU: "Russian",
};

// Opening: professional Lexora presentation (biglietto da visita) – all 3 chats
const LEXORA_FIRST_GREETING: Record<string, string> = {
  IT: "Salve, sono LEXORA, il vostro assistente AI. Come posso aiutarla?",
  DE: "Guten Tag, ich bin LEXORA, Ihr KI-Assistent. Wie kann ich Ihnen helfen?",
  EN: "Hello, I am LEXORA, your AI assistant. How may I help you?",
  FR: "Bonjour, je suis LEXORA, votre assistant IA. Comment puis-je vous aider?",
  ES: "Hola, soy LEXORA, su asistente de IA. ¿Cómo puedo ayudarle?",
  PL: "Dzień dobry, jestem LEXORA, Pana/Pani asystent AI. Jak mogę pomóc?",
  RO: "Bună ziua, sunt LEXORA, asistentul dvs. AI. Cu ce vă pot ajuta?",
  TR: "Merhaba, ben LEXORA, yapay zeka asistanınız. Size nasıl yardımcı olabilirim?",
  AR: "مرحباً، أنا LEXORA، مساعدكم بالذكاء الاصطناعي. كيف يمكنني مساعدتكم؟",
  UK: "Доброго дня, я LEXORA, ваш асистент з ШІ. Як я можу вам допомогти?",
  RU: "Здравствуйте, я LEXORA, ваш ИИ-ассистент. Чем могу помочь?",
};

// Suggested action labels for "Create case from chat"
const CREATE_CASE_LABELS: Record<string, string> = {
  IT: "Vuoi che crei un fascicolo con la bozza pronta?",
  DE: "Soll ich einen Vorgang mit fertigem Entwurf erstellen?",
  EN: "Want me to create a case with the draft ready?",
  FR: "Voulez-vous que je crée un dossier avec le brouillon prêt?",
  ES: "¿Quieres que cree un expediente con el borrador listo?",
  TR: "Taslak hazır bir dosya oluşturmamı ister misiniz?",
  RO: "Doriți să creez un dosar cu ciorna gata?",
  RU: "Хотите, чтобы я создал дело с готовым черновиком?",
  UK: "Бажаєте, щоб я створив справу з готовим чернетком?",
  PL: "Chcesz, żebym utworzył sprawę z gotowym szkicem?",
  AR: "هل تريد مني إنشاء ملف مع المسودة جاهزة؟",
};

// CTA translations - ONLY shown when a formal letter/document is ready
// NOT shown on every message - only when hasDraftContent is true
const CTA_WHEN_READY: Record<string, string> = {
  IT: "\n\n---\n✅ **Il documento è pronto.** Ora puoi inviarlo via email/PEC, stamparlo, esportarlo o archiviarlo nella pratica.",
  DE: "\n\n---\n✅ **Das Dokument ist fertig!** Verwenden Sie den Button 'Dokument erstellen' unter dem Chat zum Speichern.",
  EN: "\n\n---\n✅ **The document is ready!** Use the 'Create document' button below the chat to save it.",
  FR: "\n\n---\n✅ **Le document est prêt!** Utilisez le bouton 'Créer document' sous le chat pour le sauvegarder.",
  ES: "\n\n---\n✅ **¡El documento está listo!** Usa el botón 'Crear documento' debajo del chat para guardarlo.",
  TR: "\n\n---\n✅ **Belge hazır!** Kaydetmek için sohbetin altındaki 'Belge oluştur' düğmesini kullanın.",
  RO: "\n\n---\n✅ **Documentul este gata!** Folosește butonul 'Creează document' de sub chat pentru a-l salva.",
  RU: "\n\n---\n✅ **Документ готов!** Используйте кнопку 'Создать документ' под чатом для сохранения.",
  UK: "\n\n---\n✅ **Документ готовий!** Використовуйте кнопку 'Створити документ' під чатом для збереження.",
  PL: "\n\n---\n✅ **Dokument jest gotowy!** Użyj przycisku 'Utwórz dokument' pod czatem, aby go zapisać.",
  AR: "\n\n---\n✅ **المستند جاهز!** استخدم زر 'إنشاء مستند' أسفل الدردشة لحفظه.",
};

// When draft is NOT ready, the assistant must not instruct actions that aren't available (create/open case/document).
const NOT_READY_HINT: Record<string, string> = {
  IT: "\n\nPer ora sto analizzando la situazione. Quando avrò il testo completo della lettera, potrai creare il documento.",
  DE: "\n\nIch analysiere die Situation noch. Sobald der vollständige Briefentwurf fertig ist, können Sie das Dokument erstellen.",
  EN: "\n\nI'm still analyzing the situation. Once the full formal letter is ready, you'll be able to create the document.",
  FR: "\n\nJ'analyse encore la situation. Une fois la lettre formelle prête, vous pourrez créer le document.",
  ES: "\n\nTodavía estoy analizando la situación. Cuando la carta formal esté lista, podrás crear el documento.",
};

// =====================
// PLACEHOLDER HARD-STOP
// =====================
// If the model ever returns bracket placeholders (e.g. [Luogo], [CAP, Città]),
// we must NEVER treat it as a printable/savable draft. Instead we ask for the
// missing info.
// IMPORTANT: Exclude system markers and SIGNATURE (never ask user for signature – client signs on printed doc)
const SYSTEM_MARKERS = new Set([
  "[LETTER]", "[/LETTER]", "[BRIEF]", "[/BRIEF]", "[LETTRE]", "[/LETTRE]", "[CARTA]", "[/CARTA]",
  "[SIGNATURE]", "[FIRMA]", "[UNTERSCHRIFT]", "[FIRMA DEL MITTENTE]", "[SIGNATURE DU DESTINATAIRE]",
]);

function isExcludedPlaceholder(m: string): boolean {
  const u = m.toUpperCase().trim();
  if (SYSTEM_MARKERS.has(u)) return true;
  // Signature-related: never ask user (client signs on paper)
  if (/^\[(SIGNATURE|FIRMA|UNTERSCHRIFT|SIGNATURA|PARAFA)\s*\]$/.test(u)) return true;
  if (/^\[.*(FIRMA|SIGNATURE|UNTERSCHRIFT).*\]$/.test(u)) return true;
  return false;
}
function containsBracketPlaceholders(text: string): boolean {
  if (!text) return false;
  const matches = text.match(/\[[^\]]+\]/g) || [];
  const realPlaceholders = matches.filter(m => !isExcludedPlaceholder(m));
  return realPlaceholders.length > 0;
}

function extractBracketPlaceholders(text: string, max = 6): string[] {
  if (!text) return [];
  const matches = text.match(/\[[^\]]+\]/g) || [];
  const realPlaceholders = matches.filter(m => !isExcludedPlaceholder(m));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of realPlaceholders) {
    const norm = m.trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
    if (out.length >= max) break;
  }
  return out;
}

// Replace signature placeholders with line (client signs on printed document only – never ask for signature)
function replaceSignaturePlaceholders(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*\[Signature\]\s*/gi, "\n________________\n")
    .replace(/\s*\[Firma\]\s*/gi, "\n________________\n")
    .replace(/\s*\[Unterschrift\]\s*/gi, "\n________________\n")
    .replace(/\s*\[Firma del mittente\]\s*/gi, "\n________________\n")
    .replace(/\s*\[.*?(?:signature|firma|unterschrift).*?\]\s*/gi, "\n________________\n");
}

const PLACEHOLDER_BLOCK_MESSAGE: Record<string, string> = {
  IT: "Mi mancano alcuni dati per creare una bozza pronta da stampare. Indicami (o dimmi che vuoi ometterli se non disponibili):",
  DE: "Mir fehlen noch einige Angaben, um einen druckfertigen Entwurf zu erstellen. Bitte nenne (oder sag, dass wir sie weglassen sollen):",
  EN: "I'm missing some details to produce a print-ready draft. Please provide (or tell me to omit if not available):",
  FR: "Il me manque certaines informations pour générer un brouillon prêt à imprimer. Merci de préciser (ou me dire de les omettre):",
  ES: "Me faltan algunos datos para crear un borrador listo para imprimir. Indícame (o dime que lo omita si no está disponible):",
  PL: "Brakuje mi kilku danych, aby przygotować wersję gotową do wydruku. Podaj (albo powiedz, że mamy pominąć):",
  RO: "Îmi lipsesc câteva date pentru a genera o ciornă gata de tipărit. Te rog să le indici (sau să spui că le omitem):",
  TR: "Baskıya hazır bir taslak oluşturmak için bazı bilgiler eksik. Lütfen belirtin (yoksa çıkarabileceğimi söyleyin):",
  AR: "تنقصني بعض البيانات لإعداد مسودة جاهزة للطباعة. يرجى تزويدي بها (أو أخبرني إن كنت تريد حذفها):",
  UK: "Мені бракує деяких даних, щоб створити чернетку, готову до друку. Будь ласка, надайте (або скажіть, що пропустити):",
  RU: "Мне не хватает некоторых данных, чтобы создать черновик, готовый к печати. Пожалуйста, укажите (или скажите, что можно опустить):",
};

function buildPlaceholderQuestion(language: string, rawAssistant: string): string {
  const lang = language || "EN";
  const intro = PLACEHOLDER_BLOCK_MESSAGE[lang] || PLACEHOLDER_BLOCK_MESSAGE.EN;
  const placeholders = extractBracketPlaceholders(rawAssistant, 6);
  if (placeholders.length === 0) return intro;
  const bullets = placeholders.slice(0, 3).map((p) => `• ${p}`).join("\n");
  return `${intro}\n${bullets}`;
}

function stripUnavailableCTAs(text: string): string {
  // Remove lines/sentences that suggest actions not available when draftReady=false.
  // Keep it broad to catch both Italian and other languages.
  const patterns: RegExp[] = [
    // IT
    /.*\b(apertura\s+del\s+fascicolo|apri(?:re)?\s+un\s+fascicolo|aprire\s+un\s+fascicolo|apri(?:re)?\s+(?:una\s+)?pratica|aprire\s+(?:una\s+)?pratica|dashboard)\b.*\n?/gi,
    /.*\b(crea(?:re)?\s+documento|crea(?:re)?\s+il\s+documento|usa\s+il\s+pulsante|pulsante\s+['\"]?crea\s+documento['\"]?)\b.*\n?/gi,
    /.*\b(create\s+(a\s+)?case|open\s+(a\s+)?case|create\s+document|use\s+the\s+button)\b.*\n?/gi,
    /.*\b(dossier|expediente|dosar)\b.*\b(créer|crear|create)\b.*\n?/gi,
  ];

  let out = text;
  for (const p of patterns) out = out.replace(p, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// Copy hardening: never imply PDF-only. Keep this on assistantMessage ONLY.
function normalizeAssistantCopy(language: string, text: string): string {
  let out = (text || '').trimEnd();
  if (!out) return out;

  // Replace Italian PDF-only phrases
  out = out
    .replace(/\bversione\s+ufficiale\s+in\s+pdf\b/gi, "Il documento è pronto. Ora puoi inviarlo via email/PEC, stamparlo, esportarlo o archiviarlo nella pratica")
    .replace(/\bpdf\s+pronto\s+per\s+la\s+stampa\b/gi, "Il documento è pronto. Ora puoi inviarlo via email/PEC, stamparlo, esportarlo o archiviarlo nella pratica");

  // Generic (language-agnostic) soft replacement for "PDF-only" wording
  out = out.replace(/\b(only|solo|nur)\s+(as\s+)?pdf\b/gi, (m) => {
    return language === 'IT' ? 'in vari formati (email, stampa, export, archivio)' : m;
  });

  return out;
}

// =====================
// STRICT LETTER EXTRACTION v2 (user spec)
// =====================
const MIN_DRAFT_LENGTH = 250;

// 1) Strip up to 3 leading subject lines so detection works even if the letter starts with Oggetto/Betreff
function stripLeadingSubject(raw: string): string {
  let out = (raw || '').trimStart();
  for (let i = 0; i < 3; i++) {
    const next = out.replace(
      /^\s*(betreff|oggetto|subject|objet|asunto)\s*:\s*.*\n+/i,
      ''
    ).trimStart();
    if (next === out) break;
    out = next;
  }
  return out;
}

// 2) Hard cut after signature/closing (keep only a few trailing lines)
function cutAfterSignature(txt: string, closingRe: RegExp): string {
  let out = txt;

  const m = out.match(closingRe);
  if (m?.index != null) {
    const start = m.index + m[0].length;
    const after = out.slice(start).split('\n').slice(0, 8).join('\n');
    out = (out.slice(0, start) + after).trim();
  }

  // Remove trailing notes/headers that sometimes get appended
  out = out
    .split(/\n\s*#{2,6}\s+/)[0]
    .split(/\n\s*Note\s*[:\-]/i)[0]
    .split(/\n\s*###\s*/)[0]
    .trim();

  return out;
}

// Remove non-letter sections that sometimes get appended ("Next steps", app CTA, etc.)
function sanitizeExtractedDraft(raw: string): string {
  let text = (raw || '').trim();
  if (!text) return text;

  // Drop markdown fences
  text = text.replace(/```[\s\S]*?```/g, '').trim();

  // Cut everything after "next steps" sections (multi-language)
  const cutPatterns: RegExp[] = [
    /^\s*#{1,6}\s*(prossimi\s+passi|next\s+steps|nächste\s+schritte|etapes\s+suivantes|étapes\s+suivantes|pasos\s+siguientes|sonraki\s+adımlar|nastupni\s+kroky|наступні\s+кроки|следующие\s+шаги|الخطوات\s+التالي(?:ة|ه))\b[\s\S]*$/im,
    /^\s*\*{0,2}(prossimi\s+passi|next\s+steps|nächste\s+schritte|etapes\s+suivantes|étapes\s+suivantes|pasos\s+siguientes|sonraki\s+adımlar|nastupni\s+kroky|наступні\s+кроки|следующие\s+шаги|الخطوات\s+التالي(?:ة|ه))\b.*$/im,
    /^\s*---\s*$/m,
  ];

  let cutAt = -1;
  for (const p of cutPatterns) {
    const m = text.match(p);
    if (m?.index != null) {
      cutAt = cutAt === -1 ? m.index : Math.min(cutAt, m.index);
    }
  }
  if (cutAt !== -1) {
    text = text.slice(0, cutAt).trim();
  }

  // Remove app-CTA lines that might be inside the draft
  text = text
    .replace(/^\s*(✅|➕|\+)\s*.*$/gm, '')
    .replace(/^\s*.*\b(lexora|pulsante|sotto la chat|below the chat|unter dem chat)\b.*$/gim, '')
    .trim();

  return text;
}

// 3) STRICT markers for formal letters
const SUBJECT_RE = /^\s*(betreff|oggetto|subject|objet|asunto)\s*:\s*.+$/im;

const OPENING_RE = /^\s*(egregio|gentile|spett\.?\s*le|spett\.?\s*li|spett\.?\s*mo|alla\s+cortese\s+attenzione|sehr\s+geehrte[rn]?|geehrte\s+damen?|dear\s+(sir|madam|mr|ms|mrs)|to\s+whom\s+it\s+may\s+concern|an\s*:|to\s*:|a\s*:)\b/im;

const CLOSING_RE = /(mit\s+freundlichen\s+grüßen|hochachtungsvoll|cordiali\s+saluti|distinti\s+saluti|con\s+osservanza|sincerely|best\s+regards|kind\s+regards|cordialement|salutations|atentamente)\b/i;

const SIGNATURE_RE = /^\s*(firma|unterschrift|signature)\b/im;

// CHAT JUNK detector: phrases that indicate the AI is still analyzing / not providing a letter
const CHAT_JUNK_RE = /\b(per\s+ora\s+sto\s+analizzando|quando\s+avrò\s+il\s+testo\s+completo|apri\s+un\s+fascicolo|usa\s+il\s+pulsante|i'm\s+still\s+analyzing|once\s+the\s+full\s+letter\s+is\s+ready)\b/i;

// Only treat as a real letter when it has formal structure (prevents summaries/recaps from enabling buttons)
function looksLikeFormalLetter(text: string): boolean {
  if (!text || text.length < 200) return false;
  const hasOpening = /\b(egregio|gentile|spett\.?\s*(le|li|mo)|sehr\s+geehrte|dear\s+(sir|madam|mr|ms)|to\s+whom|alla\s+cortese|geehrte\s+damen)/i.test(text);
  const hasClosing = /\b(cordiali\s+saluti|distinti\s+saluti|mit\s+freundlichen\s+grüßen|sincerely|best\s+regards|kind\s+regards|hochachtungsvoll|con\s+osservanza)/i.test(text);
  const hasSubject = /\b(oggetto|betreff|subject|objet|asunto)\s*:/i.test(text);
  return [hasOpening, hasClosing, hasSubject].filter(Boolean).length >= 2;
}

// Extract the subject line value for auto-titling
function extractSubjectTitle(text: string): string | null {
  const subjectMatch = text.match(/^\s*(betreff|oggetto|subject|objet|asunto)\s*:\s*(.+)$/im);
  if (subjectMatch && subjectMatch[2]) {
    // Clean up the subject line and limit to 80 chars
    const subject = subjectMatch[2].trim().replace(/[\n\r]+/g, ' ').slice(0, 80);
    return subject || null;
  }
  return null;
}

function extractStrictDraft(content: string): { draftReady: boolean; draftResponse: string | null; extractedTitle: string | null } {
  const text = (content || '').replace(/\r\n/g, '\n').trim();
  const normalized = stripLeadingSubject(text);

  // Extract title from subject line
  const extractedTitle = extractSubjectTitle(text);

  // RELAXED GATING: Accept letters with at least 2 of 3 markers (was ALL 3)
  const hasSubject = SUBJECT_RE.test(text);
  const hasOpening = OPENING_RE.test(normalized);
  const hasClosing = CLOSING_RE.test(normalized) || SIGNATURE_RE.test(normalized);

  const markerCount = [hasSubject, hasOpening, hasClosing].filter(Boolean).length;
  
  // MINIMUM: 2 markers required (e.g., Opening + Closing, or Subject + Opening)
  if (markerCount < 2) {
    return { draftReady: false, draftResponse: null, extractedTitle: null };
  }

  // Try to extract ONLY the letter body
  let extractedDraft = normalized;
  
  // If we have an opening marker, start from there
  const openMatch = normalized.match(OPENING_RE);
  if (openMatch && openMatch.index != null) {
    extractedDraft = normalized.slice(openMatch.index).trim();
  }

  // Hard cut after signature/closing
  extractedDraft = sanitizeExtractedDraft(extractedDraft);
  extractedDraft = cutAfterSignature(extractedDraft, CLOSING_RE);

  // FINAL REJECTION (ANTI-CHAT): if chat junk detected, reject
  if (CHAT_JUNK_RE.test(extractedDraft)) {
    return { draftReady: false, draftResponse: null, extractedTitle: null };
  }

  // REDUCED MIN LENGTH: 200 chars (was 250)
  const MIN_RELAXED = 200;
  if (!extractedDraft || extractedDraft.length < MIN_RELAXED) {
    return { draftReady: false, draftResponse: null, extractedTitle: null };
  }

  return { draftReady: true, draftResponse: extractedDraft, extractedTitle };
}

// Out-of-scope refusal messages (translated)
const REFUSAL_MESSAGES: Record<string, string> = {
  IT: "Mi dispiace, ma posso aiutarti solo con questioni legali, amministrative e burocratiche. Per altri argomenti, ti consiglio di rivolgerti a risorse più appropriate.",
  DE: "Es tut mir leid, aber ich kann Ihnen nur bei rechtlichen, administrativen und bürokratischen Angelegenheiten helfen. Für andere Themen empfehle ich Ihnen, sich an geeignetere Ressourcen zu wenden.",
  EN: "I'm sorry, but I can only help you with legal, administrative, and bureaucratic matters. For other topics, I recommend consulting more appropriate resources.",
  FR: "Je suis désolé, mais je ne peux vous aider que pour des questions juridiques, administratives et bureaucratiques. Pour d'autres sujets, je vous recommande de consulter des ressources plus appropriées.",
  ES: "Lo siento, pero solo puedo ayudarte con asuntos legales, administrativos y burocráticos. Para otros temas, te recomiendo consultar recursos más apropiados.",
  TR: "Üzgünüm, ancak size yalnızca yasal, idari ve bürokratik konularda yardımcı olabilirim. Diğer konular için daha uygun kaynaklara başvurmanızı öneririm.",
  RO: "Îmi pare rău, dar vă pot ajuta doar cu chestiuni juridice, administrative și birocratice. Pentru alte subiecte, vă recomand să consultați resurse mai potrivite.",
  RU: "Извините, но я могу помочь вам только по юридическим, административным и бюрократическим вопросам. По другим темам рекомендую обратиться к более подходящим ресурсам.",
  UK: "Вибачте, але я можу допомогти вам лише з юридичними, адміністративними та бюрократичними питаннями. З інших тем рекомендую звертатися до більш відповідних ресурсів.",
  PL: "Przepraszam, ale mogę Ci pomóc tylko w sprawach prawnych, administracyjnych i biurokratycznych. W innych kwestiach zalecam skonsultowanie się z odpowiednimi zasobami.",
  AR: "أنا آسف، لكنني أستطيع مساعدتك فقط في المسائل القانونية والإدارية والبيروقراطية. للمواضيع الأخرى، أنصحك بالرجوع إلى موارد أكثر ملاءمة.",
};

// Keywords that indicate LEGAL/ADMINISTRATIVE topics (allowed)
const LEGAL_KEYWORDS: Record<string, RegExp> = {
  IT: /\b(lettera|multa|documento|scadenza|risposta|ricorso|avvocato|legge|diritto|obblig|procedura|amministra|ufficio|agenzia|tribunale|notifica|pagamento|autorità|contravvenzione|verbale|sanzione|appello|istanza|pratica|fascicolo|richiesta|denuncia|contratto|normativa|regolamento|decreto|sentenza|udienza|giudice|causa|citazione|ingiunzione|diffida|atto|certificato|modulo|domanda|reclamo|rimborso|tassa|imposta|fisco|contribut|pensione|inps|inail|comune|prefettura|questura|polizia|carabinieri|finanza|asl|infortunio|lavoro|licenziamento|assunzione|stipendio|tfr|ferie|permess|maternità|paternità|disoccupazione|naspi|bonus|agevolazion|sussidio|invalidità|handicap|104|famiglia|divorzio|separazione|affido|eredità|successione|testamento|donazione|compravendita|locazione|affitto|sfratto|condominio|proprietà|ipoteca|mutuo|banca|finanziamento|debito|credit|pignora|esecuzione|fallimento|concordato|bilancio|società|partita iva|fattura|iva|agenzia entrate|equitalia|cartella|rateizzazione|ravvedimento|accertamento|verifiche|ispezione|privacy|gdpr|dati personal|consenso|trattamento dati|cookie|copyright|marchio|brevetto|proprietà intellettuale|violazione|reato|penale|civile|amministrativ|giuridic|legal|norma|articolo|comma|paragrafo|codice|costituzione|europeo|ue|eu|direttiva|regolamento ue|schengen|visto|permesso soggiorno|cittadinanza|residenza|anagrafe|stato civile|nascita|morte|matrimonio|unione civile|carta identità|passaporto|patente|bollo|revisione|assicurazione|incidente|sinistro|risarcimento|danno|responsabilità|garanzia|recesso|consumatore|vendita|acquisto|ecommerce|spedizione|reso|difetto|reclamo prodotto|servizio|utenza|bolletta|luce|gas|acqua|telefono|internet|operatore|disdetta|trasloco|voltura|subentro|allaccio|contatore|lettura|conguaglio|prescrizione|decadenza|termine|proroga|sospensione|interruzione)\b/i,
  DE: /\b(brief|bescheid|dokument|frist|antwort|einspruch|anwalt|recht|gesetz|pflicht|verfahren|verwaltung|amt|behörde|gericht|zustellung|zahlung|autorität|bußgeld|ordnungswidrig|strafe|berufung|antrag|akte|fall|anfrage|anzeige|vertrag|vorschrift|verordnung|erlass|urteil|verhandlung|richter|klage|ladung|mahnung|abmahnung|urkunde|bescheinigung|formular|beschwerde|erstattung|steuer|abgabe|fiskus|beitrag|rente|sozialversicherung|kommune|gemeinde|präfektur|polizei|finanzamt|arbeitsunfall|arbeit|kündigung|einstellung|gehalt|urlaub|elternzeit|arbeitslosigkeit|arbeitslosengeld|bonus|förderung|beihilfe|invalidität|behinderung|schwerbehinderung|familie|scheidung|trennung|sorgerecht|erbschaft|nachfolge|testament|schenkung|kauf|verkauf|miete|mietvertrag|räumung|eigentum|hypothek|kredit|bank|finanzierung|schuld|pfändung|vollstreckung|insolvenz|konkurs|bilanz|gesellschaft|gewerbe|rechnung|mehrwertsteuer|finanzamt|steuerbescheid|ratenzahlung|nachzahlung|prüfung|kontrolle|datenschutz|dsgvo|personendaten|einwilligung|datenverarbeitung|urheberrecht|marke|patent|verletzung|straftat|straf|zivil|verwaltungs|rechtlich|juristisch|norm|artikel|absatz|paragraph|gesetzbuch|grundgesetz|europa|eu|richtlinie|verordnung|schengen|visum|aufenthalt|staatsangehörigkeit|wohnsitz|meldeamt|standesamt|geburt|tod|heirat|lebenspartnerschaft|ausweis|reisepass|führerschein|kfz|steuer|tüv|versicherung|unfall|schaden|entschädigung|haftung|garantie|widerruf|verbraucher|kauf|bestellung|online|versand|rückgabe|mangel|reklamation|dienstleistung|vertrag|rechnung|strom|gas|wasser|telefon|internet|anbieter|kündigung|umzug|anschluss|zähler|ablesung|nachzahlung|verjährung|frist|verlängerung|aussetzung|unterbrechung|jobcenter|arbeitsamt|hartz|bürgergeld|wohngeld|kindergeld|elterngeld|bafög|grundsicherung|sozialamt|jugendamt|familienkasse|rentenversicherung|krankenkasse|pflegeversicherung|unfallversicherung|berufsgenossenschaft|handwerkskammer|ihk|gewerbeamt|ordnungsamt|bauamt|umweltamt|gesundheitsamt|veterinäramt|ausländerbehörde|einbürgerung|integration|sprachkurs|anerkennung|zeugnis|abschluss|studium|ausbildung|praktikum|minijob|werkvertrag|zeitarbeit|leiharbeit|betriebsrat|gewerkschaft|tarifvertrag|mindestlohn|überstunden|kurzarbeit|insolvenzgeld|abfindung|zeugnis|referenz|bewerbung|vorstellung|probezeit|befristung|unbefristet|teilzeit|vollzeit|homeoffice|telearbeit|dienstreise|spesen|firmenwagen|sachbezug|vermögenswirksam|betriebsrente|direktversicherung|riester|rürup|kapitallebensversicherung|berufsunfähigkeit|erwerbsminderung|rehabilitation|kur|krankengeld|kinderkrankengeld|mutterschaftsgeld|pflegegeld|verhinderungspflege|kurzzeitpflege|tagespflege|vollstationär|ambulant|hilfsmittel|rollstuhl|pflegegrad|mdkl|gutachten|widerspruch|klage|sozialgericht|verwaltungsgericht|finanzgericht|arbeitsgericht|amtsgericht|landgericht|oberlandesgericht|bundesgerichtshof|bundesverfassungsgericht|europäischer gerichtshof|menschenrechte|grundrechte|meinungsfreiheit|versammlungsfreiheit|religionsfreiheit|berufsfreiheit|eigentumsgarantie|gleichbehandlung|diskriminierung|mobbing|belästigung|stalking|bedrohung|nötigung|erpressung|betrug|diebstahl|raub|körperverletzung|sachbeschädigung|hausfriedensbruch|beleidigung|verleumdung|üble nachrede|falschaussage|meineid|urkundenfälschung|steuerhinterziehung|geldwäsche|korruption|bestechung|untreue|veruntreuung|unterschlagung|hehlerei|drogenhandel|waffen|terrorismus|extremismus|verfassungsschutz|bundeskriminalamt|landeskriminalamt|staatsanwaltschaft|ermittlung|festnahme|verhaftung|untersuchungshaft|strafhaft|bewährung|geldstrafe|freiheitsstrafe|führungszeugnis|vorstrafe|rehabilitation|amnestie|begnadigung)\b/i,
  EN: /\b(letter|fine|document|deadline|response|appeal|lawyer|law|right|obligation|procedure|administrative|office|agency|court|notification|payment|authority|penalty|violation|sanction|hearing|application|case|file|request|complaint|contract|regulation|decree|judgment|trial|judge|lawsuit|summons|injunction|warning|certificate|form|claim|refund|tax|contribution|pension|insurance|municipality|police|accident|work|dismissal|employment|salary|leave|maternity|paternity|unemployment|benefit|subsidy|disability|family|divorce|separation|custody|inheritance|succession|will|donation|purchase|sale|lease|rent|eviction|property|mortgage|loan|bank|financing|debt|credit|seizure|execution|bankruptcy|balance|company|invoice|vat|revenue|installment|assessment|inspection|privacy|gdpr|personal data|consent|data processing|copyright|trademark|patent|intellectual property|crime|criminal|civil|legal|juridical|norm|article|paragraph|code|constitution|european|eu|directive|visa|residence permit|citizenship|registry|birth|death|marriage|civil union|identity card|passport|license|insurance|accident|damage|compensation|liability|warranty|withdrawal|consumer|sale|purchase|ecommerce|shipping|return|defect|service|utility|bill|electricity|gas|water|phone|internet|provider|cancellation|termination|prescription|expiration|extension|suspension)\b/i,
  FR: /\b(lettre|amende|document|délai|réponse|recours|avocat|loi|droit|obligation|procédure|administratif|bureau|agence|tribunal|notification|paiement|autorité|contravention|sanction|appel|demande|dossier|plainte|contrat|règlement|décret|jugement|audience|juge|procès|citation|injonction|mise en demeure|certificat|formulaire|réclamation|remboursement|impôt|taxe|contribution|pension|assurance|mairie|commune|préfecture|police|gendarmerie|accident|travail|licenciement|embauche|salaire|congé|maternité|paternité|chômage|allocation|prestation|invalidité|handicap|famille|divorce|séparation|garde|héritage|succession|testament|donation|achat|vente|location|bail|expulsion|propriété|hypothèque|prêt|banque|financement|dette|crédit|saisie|exécution|faillite|bilan|société|entreprise|facture|tva|impôts|échéancier|contrôle|vérification|vie privée|rgpd|données personnelles|consentement|traitement|droit d'auteur|marque|brevet|propriété intellectuelle|infraction|pénal|civil|juridique|légal|norme|article|alinéa|code|constitution|européen|ue|directive|visa|titre de séjour|nationalité|citoyenneté|état civil|naissance|décès|mariage|pacs|carte d'identité|passeport|permis|assurance|sinistre|dommage|indemnisation|responsabilité|garantie|rétractation|consommateur|commande|livraison|retour|défaut|service|facture|électricité|gaz|eau|téléphone|internet|opérateur|résiliation|prescription|forclusion|délai|prolongation|suspension)\b/i,
  ES: /\b(carta|multa|documento|plazo|respuesta|recurso|abogado|ley|derecho|obligación|procedimiento|administrativo|oficina|agencia|tribunal|notificación|pago|autoridad|infracción|sanción|apelación|solicitud|expediente|denuncia|contrato|reglamento|decreto|sentencia|juicio|juez|demanda|citación|requerimiento|certificado|formulario|reclamación|reembolso|impuesto|tasa|contribución|pensión|seguro|ayuntamiento|municipio|policía|accidente|trabajo|despido|contratación|salario|sueldo|vacaciones|maternidad|paternidad|desempleo|paro|prestación|subsidio|invalidez|discapacidad|familia|divorcio|separación|custodia|herencia|sucesión|testamento|donación|compra|venta|alquiler|arrendamiento|desahucio|propiedad|hipoteca|préstamo|banco|financiación|deuda|crédito|embargo|ejecución|quiebra|balance|sociedad|empresa|factura|iva|hacienda|fraccionamiento|inspección|privacidad|rgpd|datos personales|consentimiento|tratamiento|derechos de autor|marca|patente|propiedad intelectual|delito|penal|civil|jurídico|legal|norma|artículo|apartado|código|constitución|europeo|ue|directiva|visado|permiso de residencia|nacionalidad|ciudadanía|registro civil|nacimiento|defunción|matrimonio|pareja de hecho|dni|pasaporte|carnet|seguro|siniestro|daño|indemnización|responsabilidad|garantía|desistimiento|consumidor|pedido|envío|devolución|defecto|servicio|factura|luz|gas|agua|teléfono|internet|operador|baja|prescripción|caducidad|plazo|prórroga|suspensión)\b/i,
};

// Function to check if message is within legal/administrative scope
function isWithinScope(message: string, language: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check against legal keywords for the detected language
  const langRegex = LEGAL_KEYWORDS[language] || LEGAL_KEYWORDS.EN;
  if (langRegex.test(lowerMessage)) {
    return true;
  }
  
  // Also check common legal terms across all languages as fallback
  const universalLegalTerms = /\b(legal|lawyer|law|court|judge|police|tax|fine|penalty|contract|document|deadline|appeal|claim|right|obligation|procedure|authority|official|government|administration|bureau|office|permit|license|visa|passport|insurance|pension|employment|dismissal|salary|inheritance|property|mortgage|loan|debt|credit|bankruptcy|divorce|custody|marriage|birth|death|certificate|notification|payment|refund|complaint|regulation|decree|judgment|sanction|violation|crime|criminal|civil|attorney|solicitor|barrister|notary|tribunal|hearing|verdict|sentence|prosecution|defendant|plaintiff|witness|evidence|testimony|affidavit|subpoena|injunction|restraining|custody|alimony|child support|probate|executor|beneficiary|trust|estate|deed|title|lien|foreclosure|eviction|tenant|landlord|lease|rent|deposit|utility|bill|invoice|receipt|statement|account|balance|interest|fee|charge|surcharge|penalty|fine|ticket|citation|summons|warrant|arrest|detention|bail|parole|probation|rehabilitation|amnesty|pardon|extradition|asylum|refugee|immigration|naturalization|citizenship|residency|domicile|registration|enrollment|application|petition|motion|brief|memorandum|affirmation|declaration|stipulation|settlement|mediation|arbitration|litigation|jurisdiction|venue|statute|ordinance|bylaw|amendment|repeal|enactment|promulgation|ratification|implementation|enforcement|compliance|violation|infringement|breach|default|negligence|liability|damages|compensation|indemnity|restitution|remedy|relief|injunction|mandamus|certiorari|habeas corpus|due process|equal protection|fundamental right|constitutional|unconstitutional|judicial review|precedent|stare decisis|common law|civil law|criminal law|administrative law|constitutional law|international law|european law|human rights|civil rights|consumer rights|labor rights|property rights|intellectual property|copyright|trademark|patent|trade secret|confidentiality|privacy|data protection|gdpr|compliance|audit|investigation|inspection|examination|assessment|evaluation|determination|decision|ruling|order|decree|judgment|verdict|sentence|penalty|sanction|fine|forfeiture|confiscation|seizure|attachment|garnishment|levy|execution|enforcement|collection|recovery|reimbursement|refund|credit|deduction|exemption|exclusion|exception|waiver|deferral|postponement|extension|renewal|termination|cancellation|revocation|suspension|reinstatement|restoration|rehabilitation|expungement|sealing|destruction|retention|preservation|disclosure|notification|service|filing|submission|registration|recording|publication|notice|hearing|trial|appeal|review|reconsideration|rehearing|retrial|remand|reversal|affirmation|modification|vacation|dismissal|withdrawal|abandonment|default|summary judgment|directed verdict|mistrial|hung jury|acquittal|conviction|sentencing|incarceration|imprisonment|probation|parole|supervised release|community service|restitution|fine|forfeiture|deportation|exclusion|removal|inadmissibility|waiver|relief|asylum|withholding|protection|humanitarian|temporary status|adjustment|naturalization|citizenship|oath|ceremony|certificate|passport|travel document|reentry permit|advance parole|employment authorization|work permit|labor certification|prevailing wage|recruitment|attestation|petition|application|interview|biometrics|background check|medical examination|vaccination|quarantine|isolation|contact tracing|testing|treatment|hospitalization|discharge|aftercare|rehabilitation|therapy|counseling|medication|prescription|pharmacy|insurance|coverage|premium|deductible|copay|coinsurance|out-of-pocket|maximum|benefit|exclusion|preexisting condition|waiting period|open enrollment|special enrollment|qualifying event|cobra|continuation|conversion|portability|creditable coverage|coordination|subrogation|assignment|lien|recovery|reimbursement|overpayment|underpayment|adjustment|correction|appeal|grievance|complaint|dispute|resolution|arbitration|mediation|litigation|settlement|judgment|award|damages|compensation|indemnification|hold harmless|release|waiver|disclaimer|limitation|exclusion|exception|condition|warranty|guarantee|representation|certification|attestation|affirmation|declaration|statement|disclosure|notice|acknowledgment|consent|authorization|permission|approval|ratification|confirmation|acceptance|rejection|denial|refusal|objection|protest|challenge|contest|dispute|claim|demand|request|petition|motion|application|submission|filing|registration|enrollment|subscription|membership|affiliation|association|partnership|joint venture|merger|acquisition|consolidation|reorganization|restructuring|recapitalization|refinancing|workout|turnaround|recovery|liquidation|dissolution|termination|winding up|distribution|allocation|apportionment|division|separation|partition|segregation|isolation|quarantine|containment|mitigation|remediation|restoration|rehabilitation|reconstruction|redevelopment|revitalization|renewal|regeneration|transformation|conversion|adaptation|modification|alteration|amendment|revision|update|upgrade|enhancement|improvement|optimization|streamlining|simplification|standardization|harmonization|integration|coordination|collaboration|cooperation|partnership|alliance|coalition|consortium|federation|confederation|union|association|organization|institution|agency|authority|commission|board|council|committee|panel|task force|working group|advisory|consultative|deliberative|decision-making|policy-making|rule-making|standard-setting|norm-setting|guideline|recommendation|best practice|benchmark|indicator|metric|measure|target|goal|objective|outcome|output|input|resource|allocation|budget|funding|financing|investment|expenditure|cost|expense|fee|charge|price|rate|tariff|duty|levy|tax|contribution|premium|subscription|membership|dues|assessment|surcharge|penalty|fine|interest|dividend|profit|loss|gain|return|yield|income|revenue|receipt|payment|disbursement|transfer|remittance|settlement|clearing|netting|offset|setoff|counterclaim|recoupment|deduction|withholding|escrow|trust|custody|safekeeping|storage|warehousing|logistics|transportation|shipping|delivery|distribution|fulfillment|order|purchase|sale|trade|exchange|barter|swap|option|future|forward|derivative|security|bond|stock|share|equity|debt|loan|credit|mortgage|lien|pledge|collateral|guarantee|surety|indemnity|insurance|reinsurance|underwriting|actuarial|risk|exposure|loss|claim|coverage|policy|premium|deductible|copay|coinsurance|exclusion|limitation|condition|warranty|representation|disclosure|misrepresentation|fraud|concealment|bad faith|breach|default|termination|cancellation|rescission|reformation|rectification|modification|amendment|waiver|estoppel|laches|statute of limitations|prescription|repose|tolling|suspension|interruption|revival|renewal|extension|acceleration|maturity|due date|grace period|cure period|notice period|waiting period|cooling-off period|trial period|probationary period|interim|provisional|temporary|permanent|final|conclusive|binding|enforceable|valid|void|voidable|unenforceable|illegal|unlawful|prohibited|forbidden|restricted|regulated|licensed|permitted|authorized|approved|certified|accredited|registered|enrolled|qualified|eligible|entitled|obligated|required|mandatory|compulsory|voluntary|optional|discretionary|conditional|unconditional|absolute|relative|partial|complete|full|limited|unlimited|general|specific|particular|individual|collective|joint|several|solidary|primary|secondary|subordinate|superior|equal|equivalent|comparable|similar|different|distinct|separate|independent|dependent|contingent|consequential|incidental|direct|indirect|proximate|remote|foreseeable|unforeseeable|intentional|negligent|reckless|willful|malicious|fraudulent|innocent|good faith|bad faith|reasonable|unreasonable|fair|unfair|just|unjust|equitable|inequitable|legal|illegal|lawful|unlawful|legitimate|illegitimate|valid|invalid|effective|ineffective|enforceable|unenforceable|binding|non-binding|conclusive|inconclusive|final|provisional|temporary|permanent|revocable|irrevocable|conditional|unconditional|absolute|qualified|limited|unlimited|general|special|ordinary|extraordinary|regular|irregular|normal|abnormal|usual|unusual|customary|exceptional|standard|non-standard|typical|atypical|common|uncommon|frequent|infrequent|rare|occasional|periodic|sporadic|continuous|intermittent|constant|variable|fixed|flexible|rigid|elastic|static|dynamic|stable|unstable|certain|uncertain|definite|indefinite|specific|vague|clear|unclear|ambiguous|unambiguous|express|implied|explicit|implicit|written|oral|verbal|non-verbal|formal|informal|official|unofficial|public|private|confidential|secret|classified|unclassified|sensitive|non-sensitive|personal|impersonal|individual|collective|singular|plural|positive|negative|affirmative|negative|active|passive|present|past|future|current|former|prospective|retrospective|antecedent|subsequent|prior|posterior|anterior|initial|final|intermediate|primary|secondary|tertiary|principal|accessory|main|auxiliary|central|peripheral|core|marginal|essential|non-essential|fundamental|superficial|basic|advanced|elementary|complex|simple|complicated|easy|difficult|hard|soft|strong|weak|heavy|light|large|small|big|little|long|short|tall|high|low|deep|shallow|wide|narrow|broad|thick|thin|dense|sparse|full|empty|complete|incomplete|whole|partial|total|subtotal|gross|net|maximum|minimum|average|median|mean|mode|range|deviation|variance|standard|normal|abnormal|regular|irregular|typical|atypical|common|uncommon|usual|unusual|ordinary|extraordinary|general|special|universal|particular|abstract|concrete|theoretical|practical|conceptual|empirical|qualitative|quantitative|subjective|objective|relative|absolute|approximate|exact|precise|accurate|inaccurate|correct|incorrect|right|wrong|true|false|valid|invalid|reliable|unreliable|consistent|inconsistent|coherent|incoherent|logical|illogical|rational|irrational|reasonable|unreasonable|fair|unfair|just|unjust|equal|unequal|equivalent|different|similar|dissimilar|same|other|identical|distinct|separate|combined|united|divided|joined|split|merged|separated|integrated|segregated|included|excluded|incorporated|attached|detached|connected|disconnected|linked|unlinked|related|unrelated|associated|dissociated|affiliated|independent|dependent|autonomous|subordinate|superior|inferior|equal|parallel|perpendicular|horizontal|vertical|diagonal|straight|curved|circular|linear|angular|rectangular|square|triangular|round|flat|pointed|sharp|blunt|smooth|rough|even|uneven|regular|irregular|symmetric|asymmetric|balanced|unbalanced|stable|unstable|steady|unsteady|constant|variable|fixed|flexible|rigid|elastic|static|dynamic|active|passive|positive|negative|neutral|charged|magnetic|electric|mechanical|chemical|physical|biological|organic|inorganic|natural|artificial|synthetic|authentic|fake|genuine|counterfeit|original|copy|duplicate|replica|model|prototype|sample|specimen|example|instance|case|situation|circumstance|condition|state|status|position|location|place|site|venue|area|region|zone|sector|district|territory|domain|field|sphere|realm|scope|range|extent|limit|boundary|border|frontier|edge|margin|perimeter|circumference|diameter|radius|center|middle|core|heart|essence|substance|matter|material|stuff|thing|object|item|article|piece|part|component|element|factor|aspect|feature|characteristic|attribute|property|quality|trait|nature|character|identity|personality|individuality|uniqueness|distinction|difference|similarity|resemblance|likeness|analogy|comparison|contrast|opposition|contradiction|conflict|tension|stress|pressure|force|power|energy|strength|intensity|magnitude|degree|level|grade|rank|class|category|type|kind|sort|variety|species|genus|family|order|phylum|kingdom|domain|realm|sphere|field|area|sector|industry|business|commerce|trade|market|economy|finance|banking|investment|insurance|real estate|construction|manufacturing|production|processing|distribution|retail|wholesale|service|hospitality|tourism|transportation|logistics|communication|information|technology|science|research|development|innovation|invention|discovery|creation|design|engineering|architecture|planning|management|administration|organization|operation|execution|implementation|performance|evaluation|assessment|analysis|review|audit|inspection|examination|investigation|inquiry|study|survey|research|experiment|test|trial|demonstration|presentation|exhibition|display|show|event|conference|meeting|seminar|workshop|training|education|instruction|teaching|learning|development|growth|progress|advancement|improvement|enhancement|optimization|efficiency|effectiveness|productivity|quality|excellence|success|achievement|accomplishment|attainment|fulfillment|satisfaction|happiness|well-being|health|safety|security|protection|prevention|precaution|preparation|readiness|response|recovery|restoration|rehabilitation|reconstruction|redevelopment|revitalization|renewal|regeneration|transformation|change|modification|alteration|adjustment|adaptation|accommodation|flexibility|resilience|sustainability|durability|longevity|permanence|stability|continuity|consistency|reliability|dependability|trustworthiness|credibility|integrity|honesty|transparency|accountability|responsibility|duty|obligation|commitment|dedication|devotion|loyalty|fidelity|faithfulness|allegiance|adherence|compliance|conformity|obedience|submission|surrender|acceptance|agreement|consent|approval|endorsement|support|assistance|help|aid|relief|rescue|salvation|liberation|freedom|independence|autonomy|sovereignty|self-determination|self-governance|self-regulation|self-control|self-discipline|self-improvement|self-development|self-actualization|self-realization|self-fulfillment|self-expression|self-representation|self-advocacy|self-defense|self-protection|self-preservation|self-interest|self-benefit|self-advantage|self-gain|self-profit|self-enrichment|self-advancement|self-promotion|self-aggrandizement|self-glorification|self-praise|self-congratulation|self-satisfaction|self-complacency|self-contentment|self-sufficiency|self-reliance|self-dependence|self-support|self-sustenance|self-maintenance|self-care|self-help|self-service|self-employment|self-business|self-enterprise|self-venture|self-project|self-initiative|self-action|self-effort|self-work|self-labor|self-production|self-creation|self-generation|self-development|self-growth|self-expansion|self-extension|self-enlargement|self-amplification|self-multiplication|self-replication|self-reproduction|self-propagation|self-dissemination|self-distribution|self-spreading|self-diffusion|self-dispersion|self-scattering|self-fragmentation|self-division|self-separation|self-isolation|self-segregation|self-exclusion|self-withdrawal|self-retreat|self-retirement|self-resignation|self-abdication|self-renunciation|self-denial|self-sacrifice|self-immolation|self-destruction|self-annihilation|self-elimination|self-termination|self-ending|self-conclusion|self-completion|self-fulfillment|self-realization|self-actualization|self-transcendence|self-transformation|self-metamorphosis|self-evolution|self-revolution|self-reformation|self-renewal|self-regeneration|self-rejuvenation|self-restoration|self-rehabilitation|self-recovery|self-healing|self-cure|self-remedy|self-treatment|self-therapy|self-medication|self-prescription|self-diagnosis|self-examination|self-inspection|self-review|self-audit|self-assessment|self-evaluation|self-analysis|self-study|self-research|self-investigation|self-inquiry|self-questioning|self-doubt|self-uncertainty|self-insecurity|self-anxiety|self-fear|self-worry|self-concern|self-care|self-attention|self-focus|self-concentration|self-absorption|self-preoccupation|self-obsession|self-fixation|self-attachment|self-clinging|self-grasping|self-holding|self-keeping|self-retaining|self-maintaining|self-preserving|self-protecting|self-defending|self-guarding|self-shielding|self-covering|self-hiding|self-concealing|self-masking|self-disguising|self-camouflaging|self-blending|self-merging|self-fusing|self-uniting|self-joining|self-combining|self-integrating|self-incorporating|self-including|self-containing|self-comprising|self-constituting|self-forming|self-shaping|self-molding|self-making|self-building|self-constructing|self-creating|self-producing|self-generating|self-originating|self-initiating|self-starting|self-beginning|self-commencing|self-launching|self-opening|self-introducing|self-presenting|self-showing|self-displaying|self-exhibiting|self-demonstrating|self-manifesting|self-expressing|self-communicating|self-conveying|self-transmitting|self-sending|self-delivering|self-distributing|self-disseminating|self-spreading|self-propagating|self-multiplying|self-replicating|self-reproducing|self-cloning|self-copying|self-duplicating|self-repeating|self-iterating|self-cycling|self-rotating|self-revolving|self-spinning|self-turning|self-moving|self-traveling|self-journeying|self-proceeding|self-advancing|self-progressing|self-developing|self-growing|self-expanding|self-extending|self-enlarging|self-amplifying|self-intensifying|self-strengthening|self-empowering|self-enabling|self-equipping|self-arming|self-preparing|self-readying|self-training|self-educating|self-teaching|self-learning|self-studying|self-practicing|self-exercising|self-working|self-laboring|self-toiling|self-striving|self-endeavoring|self-attempting|self-trying|self-testing|self-experimenting|self-exploring|self-discovering|self-finding|self-locating|self-positioning|self-placing|self-situating|self-establishing|self-founding|self-creating|self-making|self-building|self-constructing|self-assembling|self-organizing|self-arranging|self-ordering|self-structuring|self-formatting|self-configuring|self-setting|self-adjusting|self-adapting|self-accommodating|self-fitting|self-matching|self-aligning|self-balancing|self-stabilizing|self-steadying|self-calming|self-soothing|self-comforting|self-consoling|self-reassuring|self-encouraging|self-motivating|self-inspiring|self-energizing|self-activating|self-stimulating|self-exciting|self-arousing|self-awakening|self-alerting|self-warning|self-signaling|self-indicating|self-showing|self-displaying|self-presenting|self-representing|self-depicting|self-portraying|self-describing|self-explaining|self-interpreting|self-understanding|self-comprehending|self-knowing|self-recognizing|self-identifying|self-defining|self-characterizing|self-qualifying|self-categorizing|self-classifying|self-typing|self-sorting|self-grouping|self-clustering|self-aggregating|self-collecting|self-gathering|self-assembling|self-combining|self-merging|self-uniting|self-joining|self-connecting|self-linking|self-relating|self-associating|self-affiliating|self-allying|self-partnering|self-collaborating|self-cooperating|self-coordinating|self-synchronizing|self-harmonizing|self-integrating|self-incorporating|self-including|self-containing|self-comprising|self-constituting|self-composing|self-forming|self-shaping|self-molding|self-casting|self-forging|self-fashioning|self-styling|self-designing|self-planning|self-scheming|self-strategizing|self-plotting|self-mapping|self-charting|self-graphing|self-diagramming|self-illustrating|self-picturing|self-imaging|self-visualizing|self-imagining|self-conceiving|self-thinking|self-reasoning|self-analyzing|self-evaluating|self-assessing|self-judging|self-critiquing|self-reviewing|self-examining|self-inspecting|self-checking|self-verifying|self-validating|self-confirming|self-certifying|self-authenticating|self-legitimating|self-justifying|self-explaining|self-rationalizing|self-excusing|self-defending|self-advocating|self-representing|self-speaking|self-voicing|self-expressing|self-articulating|self-communicating|self-conveying|self-transmitting|self-broadcasting|self-publishing|self-distributing|self-disseminating|self-circulating|self-spreading|self-propagating|self-promoting|self-advertising|self-marketing|self-selling|self-trading|self-dealing|self-transacting|self-negotiating|self-bargaining|self-contracting|self-agreeing|self-consenting|self-approving|self-endorsing|self-supporting|self-backing|self-funding|self-financing|self-investing|self-capitalizing|self-resourcing|self-supplying|self-providing|self-furnishing|self-equipping|self-arming|self-preparing|self-readying|self-training|self-educating|self-teaching|self-instructing|self-guiding|self-directing|self-managing|self-administering|self-governing|self-regulating|self-controlling|self-disciplining|self-restraining|self-limiting|self-restricting|self-constraining|self-confining|self-binding|self-obligating|self-committing|self-dedicating|self-devoting|self-applying|self-employing|self-engaging|self-occupying|self-busying|self-working|self-operating|self-functioning|self-performing|self-executing|self-implementing|self-realizing|self-actualizing|self-fulfilling|self-completing|self-finishing|self-ending|self-concluding|self-terminating|self-closing|self-shutting|self-stopping|self-halting|self-pausing|self-resting|self-relaxing|self-unwinding|self-decompressing|self-destressing|self-calming|self-soothing|self-comforting|self-healing|self-recovering|self-restoring|self-regenerating|self-renewing|self-refreshing|self-reviving|self-resuscitating|self-resurrecting|self-reborn|self-reincarnating|self-transforming|self-metamorphosing|self-evolving|self-developing|self-growing|self-maturing|self-aging|self-ripening|self-seasoning|self-curing|self-fermenting|self-brewing|self-distilling|self-refining|self-purifying|self-cleansing|self-washing|self-cleaning|self-scrubbing|self-polishing|self-shining|self-brightening|self-illuminating|self-lighting|self-glowing|self-radiating|self-emanating|self-emitting|self-projecting|self-casting|self-throwing|self-hurling|self-launching|self-propelling|self-driving|self-moving|self-traveling|self-journeying|self-voyaging|self-navigating|self-steering|self-guiding|self-directing|self-leading|self-heading|self-aiming|self-targeting|self-focusing|self-concentrating|self-centering|self-grounding|self-rooting|self-anchoring|self-stabilizing|self-balancing|self-equalizing|self-leveling|self-aligning|self-adjusting|self-calibrating|self-tuning|self-optimizing|self-maximizing|self-minimizing|self-economizing|self-saving|self-conserving|self-preserving|self-protecting|self-defending|self-guarding|self-shielding|self-covering|self-wrapping|self-packaging|self-containing|self-sealing|self-closing|self-locking|self-securing|self-fastening|self-attaching|self-sticking|self-adhering|self-bonding|self-welding|self-fusing|self-melting|self-dissolving|self-liquefying|self-vaporizing|self-evaporating|self-sublimating|self-crystallizing|self-solidifying|self-hardening|self-stiffening|self-toughening|self-strengthening|self-reinforcing|self-supporting|self-sustaining|self-maintaining|self-repairing|self-fixing|self-mending|self-patching|self-healing|self-recovering|self-restoring|self-regenerating|self-renewing|self-replacing|self-substituting|self-exchanging|self-swapping|self-trading|self-bartering|self-dealing|self-transacting|self-negotiating|self-bargaining|self-haggling|self-dickering|self-quibbling|self-arguing|self-debating|self-discussing|self-conversing|self-talking|self-speaking|self-voicing|self-expressing|self-articulating|self-communicating|self-signaling|self-indicating|self-showing|self-displaying|self-exhibiting|self-presenting|self-representing|self-depicting|self-portraying|self-describing|self-narrating|self-telling|self-recounting|self-relating|self-reporting|self-informing|self-advising|self-counseling|self-guiding|self-directing|self-instructing|self-teaching|self-educating|self-training|self-coaching|self-mentoring|self-tutoring|self-schooling|self-studying|self-learning|self-reading|self-researching|self-investigating|self-exploring|self-discovering|self-finding|self-seeking|self-searching|self-hunting|self-tracking|self-tracing|self-following|self-pursuing|self-chasing|self-catching|self-capturing|self-seizing|self-grabbing|self-taking|self-getting|self-obtaining|self-acquiring|self-gaining|self-earning|self-winning|self-achieving|self-accomplishing|self-attaining|self-reaching|self-arriving|self-coming|self-going|self-moving|self-traveling|self-journeying|self-voyaging|self-sailing|self-flying|self-soaring|self-gliding|self-floating|self-drifting|self-flowing|self-streaming|self-running|self-racing|self-speeding|self-accelerating|self-decelerating|self-slowing|self-stopping|self-halting|self-pausing|self-waiting|self-staying|self-remaining|self-continuing|self-persisting|self-persevering|self-enduring|self-lasting|self-surviving|self-living|self-existing|self-being|self-becoming|self-happening|self-occurring|self-arising|self-emerging|self-appearing|self-manifesting|self-revealing|self-disclosing|self-exposing|self-uncovering|self-unveiling|self-unmasking|self-opening|self-unfolding|self-developing|self-evolving|self-growing|self-expanding|self-extending|self-spreading|self-branching|self-dividing|self-multiplying|self-reproducing|self-replicating|self-cloning|self-copying|self-duplicating|self-imitating|self-mimicking|self-emulating|self-simulating|self-modeling|self-representing|self-symbolizing|self-signifying|self-meaning|self-expressing|self-communicating|self-conveying|self-transmitting|self-sending|self-delivering|self-giving|self-offering|self-presenting|self-providing|self-supplying|self-furnishing|self-equipping|self-arming|self-preparing|self-readying|self-positioning|self-placing|self-situating|self-locating|self-finding|self-discovering|self-identifying|self-recognizing|self-knowing|self-understanding|self-comprehending|self-grasping|self-apprehending|self-perceiving|self-sensing|self-feeling|self-experiencing|self-undergoing|self-suffering|self-enduring|self-bearing|self-tolerating|self-accepting|self-embracing|self-welcoming|self-receiving|self-taking|self-getting|self-obtaining|self-acquiring|self-possessing|self-owning|self-having|self-holding|self-keeping|self-retaining|self-maintaining|self-preserving|self-protecting|self-defending|self-guarding|self-shielding|self-covering|self-hiding|self-concealing|self-masking|self-disguising|self-camouflaging|self-blending|self-merging|self-fusing|self-uniting|self-joining|self-combining|self-mixing|self-mingling|self-interacting|self-relating|self-connecting|self-linking|self-bonding|self-attaching|self-adhering|self-sticking|self-clinging|self-grasping|self-holding|self-gripping|self-clutching|self-seizing|self-catching|self-capturing|self-trapping|self-ensnaring|self-entangling|self-involving|self-implicating|self-including|self-containing|self-comprising|self-constituting|self-composing|self-forming|self-shaping|self-molding|self-making|self-creating|self-producing|self-generating|self-originating|self-initiating|self-starting|self-beginning|self-commencing|self-launching|self-opening|self-introducing|self-presenting|self-showing|self-displaying|self-exhibiting|self-demonstrating|self-manifesting|self-expressing|self-articulating|self-communicating|self-conveying|self-transmitting|self-broadcasting|self-publishing|self-distributing|self-disseminating|self-circulating|self-spreading|self-propagating|self-multiplying|self-replicating|self-reproducing|self-cloning|self-copying|self-duplicating|self-repeating|self-iterating|self-cycling|self-rotating|self-revolving|self-spinning|self-turning|self-twisting|self-winding|self-coiling|self-curling|self-bending|self-flexing|self-stretching|self-extending|self-expanding|self-growing|self-developing|self-evolving|self-transforming|self-changing|self-modifying|self-altering|self-adjusting|self-adapting|self-accommodating|self-fitting|self-matching|self-aligning|self-balancing|self-stabilizing|self-steadying|self-calming|self-soothing|self-comforting|self-consoling|self-reassuring|self-encouraging|self-motivating|self-inspiring|self-energizing|self-activating|self-stimulating|self-exciting|self-arousing|self-awakening|self-alerting|self-warning|self-signaling|self-indicating|self-showing|self-displaying|self-presenting|self-representing|self-depicting|self-portraying|self-describing|self-explaining|self-interpreting|self-understanding|self-comprehending|self-knowing|self-recognizing|self-identifying|self-defining|self-characterizing|self-qualifying|self-categorizing|self-classifying|self-typing|self-sorting|self-grouping|self-clustering|self-aggregating|self-collecting|self-gathering|self-assembling|self-combining|self-merging|self-uniting|self-joining|self-connecting|self-linking|self-relating|self-associating|self-affiliating|self-allying|self-partnering|self-collaborating|self-cooperating|self-coordinating|self-synchronizing|self-harmonizing|self-integrating|self-incorporating|self-including|self-containing|self-comprising|self-constituting|self-composing|self-forming|self-shaping|self-molding|self-casting|self-forging|self-fashioning|self-styling|self-designing|self-planning|self-scheming|self-strategizing|self-plotting|self-mapping|self-charting|self-graphing|self-diagramming|self-illustrating|self-picturing|self-imaging|self-visualizing|self-imagining|self-conceiving|self-thinking|self-reasoning|self-analyzing|self-evaluating|self-assessing|self-judging|self-critiquing|self-reviewing|self-examining|self-inspecting|self-checking|self-verifying|self-validating|self-confirming|self-certifying|self-authenticating|self-legitimating|self-justifying|self-explaining|self-rationalizing|self-excusing|self-defending|self-advocating|self-representing|self-speaking|self-voicing|self-expressing|self-articulating|self-communicating|self-conveying|self-transmitting|self-broadcasting|self-publishing|self-distributing|self-disseminating|self-circulating|self-spreading|self-propagating|self-promoting|self-advertising|self-marketing|self-selling|self-trading|self-dealing|self-transacting|self-negotiating|self-bargaining|self-contracting|self-agreeing|self-consenting|self-approving|self-endorsing|self-supporting|self-backing|self-funding|self-financing|self-investing|self-capitalizing|self-resourcing|self-supplying|self-providing|self-furnishing|self-equipping)\b/i;
  
  if (universalLegalTerms.test(lowerMessage)) {
    return true;
  }
  
  // Check for common greetings or simple follow-ups (allow these)
  const greetings = /^(ciao|salve|buongiorno|buonasera|hallo|guten tag|guten morgen|hello|hi|hey|bonjour|hola|merhaba|bună|привет|здравствуйте|cześć|dzień dobry|مرحبا|ok|okay|sì|si|ja|yes|oui|no|nein|non|grazie|danke|thank|merci|gracias|teşekkür|mulțumesc|спасибо|дякую|dziękuję|شكرا)[\s.,!?]*$/i;
  if (greetings.test(message.trim())) {
    return true;
  }
  
  // Check for questions about the assistant itself (allow)
  const aboutAssistant = /\b(chi sei|cosa fai|come funzioni|wer bist du|was machst du|wie funktionierst du|who are you|what do you do|how do you work|que fais-tu|qui es-tu|comment ça marche|quién eres|qué haces|cómo funciona)\b/i;
  if (aboutAssistant.test(lowerMessage)) {
    return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      message, 
      userLanguage, 
      isFirstMessage, 
      chatHistory, 
      skipContentFilter,
      caseId,
      userProfile,
      caseContext,
      conversationStatus,
      legalSearchContext = [],
      contextSummary,
      letterText: bodyLetterText,
      documentText: bodyDocumentText,
    } = await req.json() as {
      message: string;
      userLanguage?: string;
      isFirstMessage?: boolean;
      chatHistory?: Array<{ role: string; content: string }>;
      skipContentFilter?: boolean;
      caseId?: string;
      userProfile?: UserProfileContext;
      caseContext?: CaseContext;
      conversationStatus?: 'collecting' | 'confirmed' | 'document_generated';
      legalSearchContext?: Array<{ title?: string; snippet?: string; link?: string; url?: string; date?: string }>;
      contextSummary?: string;
      letterText?: string;
      documentText?: string;
    };

    if (!message || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No message provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

// Get user's plan from entitlements edge function
    const entitlementsResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/entitlements`,
      {
        headers: {
          Authorization: req.headers.get('Authorization')!,
          'Content-Type': 'application/json',
        },
      }
    );

    let userPlan = 'free';
    let userRole: 'admin' | 'user' = 'user';
    let messageLimit: number | null = PLAN_LIMITS.free;
    
    if (entitlementsResponse.ok) {
      const entitlements = await entitlementsResponse.json();
      userPlan = entitlements.plan || 'free';
      userRole = entitlements.role || 'user';
      
      const messagesMax = entitlements.limits?.messages;
      messageLimit = messagesMax !== undefined ? messagesMax : (PLAN_LIMITS[userPlan] ?? (userPlan === 'free' ? 15 : null));
      
      console.log(`[DASHBOARD-CHAT] User ${user.id}: role=${userRole}, plan=${userPlan}, messageLimit=${messageLimit === null ? '∞' : messageLimit}`);
    }

    const planKey = userPlan === 'unlimited' ? 'pro' : userPlan;
    const planFeatures = PLAN_FEATURES[planKey] ?? PLAN_FEATURES[userPlan] ?? PLAN_FEATURES.free;

    // Check today's message count
    const today = new Date().toISOString().split('T')[0];
    
    const { data: usageData, error: usageError } = await supabaseClient
      .from('dashboard_chat_messages')
      .select('messages_count')
      .eq('user_id', user.id)
      .eq('message_date', today)
      .single();

    const currentCount = usageData?.messages_count || 0;

    // ADMIN BYPASS + UNLIMITED BYPASS: Skip limit check if admin or messageLimit is null
    const shouldEnforceLimit = userRole !== 'admin' && messageLimit !== null;
    
    if (shouldEnforceLimit && messageLimit !== null && currentCount >= messageLimit) {
      console.log(`[DASHBOARD-CHAT] Message limit reached: ${currentCount}/${messageLimit}`);
      return new Response(
        JSON.stringify({
          error: 'limit_reached',
          message: 'Limite giornaliero di 15 messaggi raggiunto con il piano Free. Passa a un piano superiore per messaggi illimitati.',
          messagesUsed: currentCount,
          messagesLimit: messageLimit,
          plan: userPlan,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Always use UI language - no auto-detection
    // This ensures the AI always responds in the user's selected language
    const responseLanguage = userLanguage?.toUpperCase() || "EN";
    
    const fullLanguageName = LANGUAGE_MAP[responseLanguage] || "English";

    // LEXORA MASTER PROMPT v5 - UNIFIED INTELLIGENT CHAT + GLOBAL POLICY
    const intakeModeRules = getIntakeModeRules(responseLanguage);
    const contextBlock = typeof contextSummary === "string" && contextSummary.trim().length > 0
      ? `CONTEXT ALREADY AVAILABLE (do not ask for these):\n${contextSummary.trim()}\n\n`
      : "";
    
    let systemPrompt = `${contextBlock}${LEXORA_CONTEXT_FIRST_RULES}${POLICY_DEMO_DASHBOARD}

LEXORA MASTER PROMPT v5 - UNIFIED INTELLIGENT CHAT

=== IDENTITÀ ===
Sei Lexora, assistente AI intelligente che funziona come ChatGPT ma specializzata in documenti legali/amministrativi.
Assume di avere sempre accesso a profilo utente, fascicolo e documenti quando forniti. Non chiedere dati già in contesto.

=== LINGUA ===
Rispondi nella lingua corrente dell'interfaccia utente: ${fullLanguageName}. Nessuna eccezione.

=== UNIFIED INTELLIGENT BEHAVIOR ===
CORE: Sei un'AI conversazionale e utile. Rispondi alle domande naturalmente, fornisci spiegazioni, brainstorming - E quando serve un documento formale, crealo con precisione.

1) RILEVAMENTO INTENTO AUTOMATICO (NO toggle, NO UI changes):
- CONVERSAZIONE: Domande, spiegazioni, idee → rispondi conversazionalmente come ChatGPT
- RICHIESTA INFO: Servono dati esterni → cerca online autonomamente PRIMA
- CREAZIONE DOCUMENTO: Serve lettera formale → segui regole documento rigide

2) RICERCA ONLINE INTELLIGENTE (AUTONOMA):
Quando servono informazioni esterne (indirizzi, procedure, contatti):

STEP 1: Cerca autonomamente con query expansion:
- Query diretta nella lingua utente
- Sinonimi in DE/IT/EN
- "zuständig für" / "competente per" / "responsible for"
- Fallback territoriale: città → provincia → autorità competente

STEP 2: Se trovato con buona affidabilità:
- PROPONI il risultato all'utente
- Chiedi conferma semplice prima di usarlo nei documenti

STEP 3: Se NON trovato in modo affidabile:
- NON inventare nulla
- Fai UNA domanda chiara

STEP 4: Se utente dice "trovalo tu" / "such es selbst" / "find it yourself":
- DEVI eseguire la ricerca online, non chiedere di nuovo all'utente

VIETATO: Usare indirizzi approssimativi, enti non ufficiali come fallback, "indovinare" informazioni mancanti

3) REGOLE GENERAZIONE DOCUMENTI (RIGIDE):
NON generare MAI un documento finale automaticamente senza conferma.

FLUSSO OBBLIGATORIO:
1. Raccogli tutte le informazioni necessarie (dal profilo utente, fascicolo, conversazione, o ricerca)
2. Riassumi cosa verrà inserito nel documento
3. Chiedi conferma ESPLICITA: "Posso creare la lettera con queste informazioni?"
4. SOLO dopo conferma → genera il documento formale

=== AMBITO AMMESSO (SEMPRE ACCETTARE) ===
✔️ Lettere a scuole, asili, università
✔️ Comunicazioni con datori di lavoro, proprietari, aziende
✔️ Lettere a uffici pubblici, banche, assicurazioni
✔️ Qualsiasi comunicazione formale o semi-formale scritta
- MAI rifiutare questi tipi di richieste

${intakeModeRules}

${DOCUMENT_TYPE_DETECTION}`;

    if (planFeatures.allowsStructuredSuggestions) {
      systemPrompt += `\n- Fornire suggerimenti strutturati.`;
    }

    if (planFeatures.allowsLegalReferences) {
      systemPrompt += `\n- Citare riferimenti legali pertinenti.`;
    }

    systemPrompt += `

LIMITI:
- Non rappresenti l'utente in tribunale.
- Puoi rifiutare SOLO: intrattenimento, ricette, argomenti estranei a documenti.
- NON menzionare pulsanti, dashboard, apertura pratica.

ANTI-RIFIUTO (CRITICO):
- È VIETATO rifiutare lettere a scuole, datori di lavoro, proprietari.
- È VIETATO dire "posso solo aiutare con questioni legali".

PIANO UTENTE: ${userPlan.toUpperCase()}

⚠️ PLACEHOLDER VIETATI - REGOLA ASSOLUTA ⚠️
NON usare MAI placeholder tra parentesi quadre:
- [Nome], [Data], [Luogo], [CAP], [Indirizzo], [Città]
- [Name], [Datum], [Ort], [PLZ], [Adresse], [Stadt]
- [Signature], [Firma], [Unterschrift]: VIETATO chiedere la firma. Usare nome a stampa o ________________ (il cliente firma sul documento stampato).

Se mancano informazioni: CHIEDI all'utente, NON generare la lettera con placeholder.

FORMATO OUTPUT (BOZZE - SOLO DOPO CONFERMA):
Quando generi una lettera FINALE (dopo conferma), output SOLO il testo della lettera.
VIETATO: Spiegazioni, "SPIEGAZIONE", "---LETTERA---", meta-commenti, separatori.
Struttura: Mittente → Destinatario → Luogo+Data → Oggetto → Corpo → Chiusura → nome a stampa o ________________ (riga per firma a mano dopo la stampa). VIETATO chiedere la firma: il cliente firma solo sul documento stampato.
`;

    // =====================
    // AUTO-CONTEXT INJECTION
    // =====================
    // If user profile is provided, inject it so AI doesn't ask for sender info
    if (userProfile) {
      const senderName = userProfile.senderFullName || userProfile.fullName || 
        [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ');
      const senderAddress = userProfile.senderAddress || userProfile.address;
      const senderCity = userProfile.senderCity || userProfile.city;
      const senderPostalCode = userProfile.senderPostalCode || userProfile.postalCode;
      const senderCountry = userProfile.senderCountry || userProfile.country;
      
      if (senderName || senderAddress) {
        systemPrompt += `
=== DATI MITTENTE (GIÀ NOTI - NON CHIEDERE) ===
${senderName ? `Nome: ${senderName}` : ''}
${senderAddress ? `Indirizzo: ${senderAddress}` : ''}
${senderPostalCode && senderCity ? `${senderPostalCode} ${senderCity}` : senderCity || ''}
${senderCountry ? `Paese: ${senderCountry}` : ''}
${userProfile.email ? `Email: ${userProfile.email}` : ''}

REGOLA CRITICA: NON chiedere MAI nome, cognome, indirizzo o email dell'utente.
Usa questi dati automaticamente quando generi lettere.
`;
      }
    }

    // Single source of truth for OCR: request (caseContext.letterText) → DB when caseId → current/last user message
    const looksLikeLetter = (text: string): boolean => {
      if (!text || text.length < 350) return false;
      const hasOpening = /\b(egregio|gentile|spett\.?\s*(le|li|mo)|sehr\s+geehrte|dear\s+(sir|madam|mr|ms)|to\s+whom|alla\s+cortese|geehrte\s+damen|betreff|oggetto|subject)\b/i.test(text);
      const hasClosing = /\b(cordiali\s+saluti|distinti\s+saluti|mit\s+freundlichen|sincerely|best\s+regards|hochachtungsvoll|con\s+osservanza)\b/i.test(text);
      const hasSubject = /\b(oggetto|betreff|subject|objet|asunto)\s*:/i.test(text);
      return [hasOpening, hasClosing, hasSubject].filter(Boolean).length >= 2;
    };
    const isUploadedDoc = (t: string): boolean =>
      t.startsWith("[Document uploaded]") || t.startsWith("[PDF uploaded]") || /^\[\d+\s+documents uploaded\]/.test(t);

    let resolvedLetterText = (bodyLetterText ?? bodyDocumentText ?? caseContext?.letterText ?? "").trim();
    if (caseId && !resolvedLetterText) {
      const { data } = await supabaseClient
        .from("pratiche")
        .select("letter_text")
        .eq("id", caseId)
        .eq("user_id", user.id)
        .single();
      if (data?.letter_text) resolvedLetterText = String(data.letter_text).trim();
    }
    if (!resolvedLetterText && message?.trim()) {
      const msg = message.trim();
      const history = Array.isArray(chatHistory) ? chatHistory : [];
      if (isUploadedDoc(msg) || (msg.length >= 350 && looksLikeLetter(msg))) {
        resolvedLetterText = msg.slice(0, 12000);
      } else {
        const lastUser = [...history].reverse().find((m: { role: string }) => m.role === "user");
        const lastContent = lastUser && typeof (lastUser as any).content === "string" ? (lastUser as any).content : "";
        if (isUploadedDoc(lastContent) || (lastContent.length >= 350 && looksLikeLetter(lastContent)))
          resolvedLetterText = lastContent.slice(0, 12000);
      }
    }
    if (resolvedLetterText.length > 0) {
      const snippet = resolvedLetterText.length > 8000 ? resolvedLetterText.slice(0, 8000) + "...[troncato]" : resolvedLetterText;
      systemPrompt += `

${DOCUMENT_IN_CONTEXT_INTAKE_OVERRIDE}

=== DOCUMENTO GIÀ RICEVUTO E LETTO – USA QUESTO PER RISPONDERE ===
Il testo completo è nel blocco DOCUMENT_TEXT (authoritative) iniettato dal sistema. Rispondi SEMPRE basandoti su quelle informazioni (destinatario, indirizzi, date, riferimenti).
REGOLA OBBLIGATORIA: Hai già il documento. ESTRAGGI mittente, destinatario e indirizzi dal DOCUMENT_TEXT e usali nella lettera. Non dire mai "non ho trovato" o "indicami l'indirizzo". NON chiedere MAI "standard address", "Standard office address", "Address from the letter" né dati che compaiono nel documento. NON chiedere la firma. Chiedi SOLO informazioni AGGIUNTIVE non presenti nella lettera, oppure cerca sul web. Se gli indirizzi sono nel testo, copiali; non usare placeholder [Address].
`;
    }

    // HARD GUARDRAIL: case/document expected but no OCR text → fail closed
    const guardrail = expectDocumentGuardrail({
      caseId: caseId ?? null,
      documentText: resolvedLetterText || null,
    });
    if (!guardrail.ok) {
      console.error(
        "[DASHBOARD-CHAT] DOCUMENT_TEXT_MISSING",
        guardrail.caseId,
        guardrail.documentId,
        guardrail.documentTextLength
      );
      return new Response(
        JSON.stringify({
          error: guardrail.error,
          hint: guardrail.hint,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If case context is provided, inject it so AI has full case awareness
    if (caseContext) {
      systemPrompt += `
=== CONTESTO FASCICOLO ATTIVO ===
Titolo: ${caseContext.title}
${caseContext.authority ? `Autorità/Destinatario: ${caseContext.authority}` : ''}
${caseContext.aktenzeichen ? `Numero riferimento: ${caseContext.aktenzeichen}` : ''}
${caseContext.deadline ? `Scadenza: ${caseContext.deadline}` : ''}
`;

      // Main letter (OCR) is injected via DOCUMENT_TEXT system message; brief note here for redundancy
      if (resolvedLetterText.length > 0) {
        systemPrompt += `
=== LETTERA PRINCIPALE (OCR) – vedi blocco DOCUMENT_TEXT (authoritative) iniettato dal sistema. USA COME FONTE PRIMARIA. NON chiedere MAI la firma (signature/firma/Unterschrift). Il cliente firma su carta dopo la stampa. ===

`;
      }

      // Add document OCR context
      if (caseContext.documents && caseContext.documents.length > 0) {
        const docsWithText = caseContext.documents
          .filter(d => d.rawText && d.rawText.trim().length > 0)
          .slice(0, 3); // Limit to 3 most relevant docs
        
        if (docsWithText.length > 0) {
          systemPrompt += `\n=== DOCUMENTI DEL FASCICOLO – GIÀ IN TUO POSSESSO (usa come fonte, non chiedere dove trovare) ===\n`;
          for (const doc of docsWithText) {
            const direction = doc.direction === 'incoming' ? '📥 Ricevuto' : '📤 Inviato';
            const name = doc.fileName || 'Documento';
            // Truncate long OCR to keep context manageable
            const text = doc.rawText!.length > 1500 
              ? doc.rawText!.slice(0, 1500) + '...[troncato]'
              : doc.rawText;
            systemPrompt += `\n${direction} - ${name}:\n${text}\n---\n`;
          }
        }
      }

      // Add existing draft if any
      if (caseContext.draftResponse) {
        const draftSnippet = caseContext.draftResponse.length > 800
          ? caseContext.draftResponse.slice(0, 800) + '...'
          : caseContext.draftResponse;
        systemPrompt += `\n=== BOZZA ESISTENTE ===\n${draftSnippet}\n`;
      }

      systemPrompt += `
REGOLE CONTESTO FASCICOLO (OBBLIGATORIE):
- Tutte le informazioni nella LETTERA PRINCIPALE e nei DOCUMENTI sopra sono GIÀ NOTE. NON chiedere MAI dati che vi compaiono (destinatario, riferimento, scadenza, nomi, date, numeri, indirizzi). NON chiedere MAI la firma (signature/firma/Unterschrift). Usali direttamente; firma = nome a stampa o "________________" dopo la stampa.
- Chiedi SOLO informazioni AGGIUNTIVE non presenti nei documenti, oppure cerca sul web.
- NON chiedere "chi ti scrive" se authority/dati sono già nei documenti.
- Usa i riferimenti (aktenzeichen) automaticamente. Mantieni coerenza con la corrispondenza precedente.

=== REGOLE ANTI-CONTAMINAZIONE CROSS-FASCICOLO (CRITICHE) ===
- Ogni fascicolo è una SANDBOX ISOLATA. Non riutilizzare MAI:
  - Ruoli del mittente da altri fascicoli (es. "Genitore", "Padre", "Madre")
  - Descrizioni semantiche da lettere precedenti di altri casi
  - Contesto di corrispondenza non appartenente a QUESTO fascicolo

- RUOLO MITTENTE:
  - Se il fascicolo è FISCALE/AMMINISTRATIVO (Finanzamt, Familienkasse, Zoll, Agenzia Entrate, INPS, etc.):
    → NON usare MAI ruoli familiari (Genitore, Padre, Madre, Figlio)
    → Usa forma neutra: solo nome e cognome, oppure "Contribuente" se appropriato
  - Se il fascicolo è SCOLASTICO/FAMILIARE (Scuola, Asilo, Kindergarten):
    → Ruolo "Genitore" SOLO se esplicitamente indicato nel contesto
  - DEFAULT: Usare SEMPRE il nome neutro dell'utente senza qualifiche inventate

- È VIETATO ASSOLUTO inventare ruoli o qualifiche non presenti nel contesto attuale.
- Quando in dubbio, usa: "Ich, [Nome Cognome]" / "[Nome Cognome]" senza qualifiche.
`;
    }

    const letterTextForMessages =
      resolvedLetterText.length > 8000
        ? resolvedLetterText.slice(0, 8000) + "\n...[troncato]"
        : resolvedLetterText;

    // Strict message structure: system rules, DOCUMENT_TEXT (authoritative) when present, history, current user message
    const recentHistory = (chatHistory || []).slice(-8);
    const messages: Array<{ role: string; content: string }> = buildStrictMessages({
      systemRules: systemPrompt,
      documentText: letterTextForMessages.length > 0 ? letterTextForMessages : null,
      documentTextMaxLen: 8000,
      history: recentHistory,
      userMessage: message,
      userMessageInHistory: false,
    });

    if (conversationStatus === 'document_generated') {
      const closureMsg = "Il documento è già stato generato. Puoi usare Anteprima, Stampa, Email o Copia.";
      await supabaseClient.from('dashboard_chat_history').insert([
        { user_id: user.id, role: 'user', content: message },
        { user_id: user.id, role: 'assistant', content: closureMsg },
      ]);
      if (usageData) {
        await supabaseClient.from('dashboard_chat_messages').update({ messages_count: currentCount + 1 }).eq('user_id', user.id).eq('message_date', today);
      } else {
        await supabaseClient.from('dashboard_chat_messages').insert({ user_id: user.id, message_date: today, messages_count: 1 });
      }
      return new Response(
        JSON.stringify({
          response: closureMsg,
          messagesUsed: currentCount + 1,
          messagesLimit: messageLimit,
          plan: userPlan,
          draftReady: false,
          draftResponse: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DASHBOARD-CHAT] User: ${user.id}, Plan: ${userPlan}, Messages: ${currentCount}/${messageLimit}`);

    // SCOPE CHECK: Use new scopeGate for consistent filtering
    const lang = normLang(responseLanguage);
    const hasLegalContext = chatHistory && chatHistory.length > 0;
    const isConfirmation = /^(ok|okay|sì|si|yes|ja|oui|d'accordo|einverstanden|procedi|proceed|fallo|mach das|do it|genera|generate|scrivi|schreibe|write)[\s.,!?]*$/i.test(message.trim());
    const shouldFilter = !hasLegalContext && !skipContentFilter && !isConfirmation;
    
    // Use new scope gate for filtering
    const scopeCheck = checkScope(message);
    if (shouldFilter && !scopeCheck.inScope && scopeCheck.confidence !== 'low') {
      const refusalMessage = getRefusalMessage(lang);
      console.log(`[DASHBOARD-CHAT] Out-of-scope request rejected for user: ${user.id}, reason: ${scopeCheck.reason}`);
      
      // Still count the message but return refusal
      if (usageData) {
        await supabaseClient
          .from('dashboard_chat_messages')
          .update({ messages_count: currentCount + 1 })
          .eq('user_id', user.id)
          .eq('message_date', today);
      } else {
        await supabaseClient
          .from('dashboard_chat_messages')
          .insert({ user_id: user.id, message_date: today, messages_count: 1 });
      }

      // Save to history
      await supabaseClient.from('dashboard_chat_history').insert([
        { user_id: user.id, role: 'user', content: message },
        { user_id: user.id, role: 'assistant', content: refusalMessage },
      ]);

      return new Response(
        JSON.stringify({ 
          response: refusalMessage,
          messagesUsed: currentCount + 1,
          messagesLimit: messageLimit,
          plan: userPlan
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================
    // INTELLIGENT AUTO-SEARCH (REAL LOGIC - NOT JUST PROMPT)
    // =====================
    // When user has uploaded a document or we have case letter: skip search ENTIRELY – doc text would trigger "indirizzo" and return "non ho trovato informazioni"
    const hasDocumentInContext = resolvedLetterText.length > 0 || isUploadedDoc(message.trim());
    const userWantsSearch = detectSearchIntent(message);
    const needsExternalInfo = detectInfoRequest(message);
    
    let intelligentSearchResult = null;
    let webSearchResults: SearchResult[] = [];
    let webSearchContext = '';
    
    if (!hasDocumentInContext && (userWantsSearch || needsExternalInfo)) {
      console.log(`[DASHBOARD-CHAT] Intelligent search triggered (userWantsSearch: ${userWantsSearch}, needsExternalInfo: ${needsExternalInfo})`);
      
      intelligentSearchResult = await intelligentSearch(message.slice(0, 200), responseLanguage);
      
      if (intelligentSearchResult.found && intelligentSearchResult.confidence >= 0.85) {
        // High confidence - propose result to user (DON'T use directly in documents)
        console.log(`[DASHBOARD-CHAT] High confidence result found (${intelligentSearchResult.confidence.toFixed(2)})`);
        
        // Save proposal to history
        await supabaseClient.from('dashboard_chat_history').insert([
          { user_id: user.id, role: 'user', content: message },
          { user_id: user.id, role: 'assistant', content: intelligentSearchResult.proposedAnswer || '' },
        ]);
        
        if (usageData) {
          await supabaseClient.from('dashboard_chat_messages').update({ messages_count: currentCount + 1 }).eq('user_id', user.id).eq('message_date', today);
        } else {
          await supabaseClient.from('dashboard_chat_messages').insert({ user_id: user.id, message_date: today, messages_count: 1 });
        }
        
        return new Response(
          JSON.stringify({
            response: intelligentSearchResult.proposedAnswer + (intelligentSearchResult.sourcesSection || ''),
            messagesUsed: currentCount + 1,
            messagesLimit: messageLimit,
            plan: userPlan,
            searchConfidence: intelligentSearchResult.confidence,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (intelligentSearchResult.needsUserInput && !intelligentSearchResult.found) {
        // Low confidence - ask user (hasDocumentInContext already excluded this block from running)
        console.log(`[DASHBOARD-CHAT] Low confidence (${intelligentSearchResult.confidence.toFixed(2)}) - asking user`);
        
        await supabaseClient.from('dashboard_chat_history').insert([
          { user_id: user.id, role: 'user', content: message },
          { user_id: user.id, role: 'assistant', content: intelligentSearchResult.userQuestion || '' },
        ]);
        
        if (usageData) {
          await supabaseClient.from('dashboard_chat_messages').update({ messages_count: currentCount + 1 }).eq('user_id', user.id).eq('message_date', today);
        } else {
          await supabaseClient.from('dashboard_chat_messages').insert({ user_id: user.id, message_date: today, messages_count: 1 });
        }
        
        return new Response(
          JSON.stringify({
            response: intelligentSearchResult.userQuestion || "Could you provide the specific address or office?",
            messagesUsed: currentCount + 1,
            messagesLimit: messageLimit,
            plan: userPlan,
            searchConfidence: intelligentSearchResult.confidence,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Medium confidence - include in context with warning
      if (intelligentSearchResult.results.length > 0) {
        webSearchResults = intelligentSearchResult.results;
        const resultsText = webSearchResults.map((r, i) => 
          `[${i+1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`
        ).join('\n\n');
        webSearchContext = `\n\n📌 WEB SEARCH RESULTS (verify before using):\n${resultsText}\n\nWARNING: Confidence is ${(intelligentSearchResult.confidence * 100).toFixed(0)}%. Propose to user and ask for confirmation before using in documents.`;
        messages[0].content += webSearchContext;
      }
    }
    
    const previousWasSummary = wasPreviousMessageSummary(chatHistory || []);
    const userConfirmedDoc = hasUserConfirmed(message);
    const statusConfirmed = conversationStatus === 'confirmed' || conversationStatus === 'document_generated';
    const allowDocumentGeneration = statusConfirmed || (previousWasSummary && userConfirmedDoc);
    
    // Add gate instruction to system prompt
    let gateInstruction = '';
    if (!allowDocumentGeneration) {
      const createDocPhrase = CREATE_DOCUMENT_OR_ADD_MORE[normLang(responseLanguage)] ?? CREATE_DOCUMENT_OR_ADD_MORE.EN;
      gateInstruction = `\n\n=== DOCUMENT GENERATION GATE (ENFORCED BY SYSTEM) ===
CRITICAL: Before generating ANY final document/letter, you MUST:
1. First show a SUMMARY of all data you will use (from the document in context – do NOT ask for data already there; do NOT ask for signature/firma).
2. Ask ONE question only, in the user's interface language, exactly this (or equivalent): "${createDocPhrase}"
3. Then WAIT. Do NOT ask for signature or any other data. ONLY after user confirms (yes/ok/genera/no), generate the letter with [LETTER]...[/LETTER].

The user has NOT confirmed yet. Do NOT generate final letters yet. Do NOT ask for signature or extra data.`;
    } else {
      gateInstruction = `\n\n=== CONFIRMATION RECEIVED ===
User has confirmed. Generate IMMEDIATELY the final letter with [LETTER]...[/LETTER] tags.
DO NOT ask for ANYTHING else: no signature, no further data, no "create document or add more?" in any language. Generate ONLY the letter. One brief phrase then [LETTER]...[/LETTER] only.`;
      console.log(`[DASHBOARD-CHAT] Document generation ALLOWED after confirmation`);
    }
    const isFirstMessage = !chatHistory || chatHistory.length === 0;
    if (isFirstMessage) {
      const lang = (responseLanguage || 'EN').toUpperCase();
      const greeting = LEXORA_FIRST_GREETING[lang] || LEXORA_FIRST_GREETING.EN;
      messages[0].content += `

=== REGOLA PRIMO MESSAGGIO (OBBLIGATORIA – CON O SENZA DOCUMENTO) ===
1. Il tuo primo messaggio DEVE iniziare SEMPRE con: "${greeting}"
2. Prima ti presenti, POI (se c'è un documento) dici di averlo letto e di essere pronto ad aiutare.
3. VIETATO ASSOLUTO – MAI scrivere: "non ho trovato", "I didn't find", "nessuna informazione", "indicami l'indirizzo", "please provide the address". Se non hai un dato, usa il documento o cerca sul web; non dire mai che non hai trovato informazioni.`;
    }
    messages[0].content += gateInstruction;

    // Use OpenAI API directly (no Lovable credits)
    const aiResult = await callOpenAI({
      messages: messages as Array<{role: "system" | "user" | "assistant"; content: string}>,
      model: "gpt-4.1-mini",
      temperature: 0.4,
    });

    if (!aiResult.ok) {
      console.error("[DASHBOARD-CHAT] OpenAI error:", aiResult.error);
      if (aiResult.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI_PROVIDER_ERROR", message: "AI temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawAssistant = aiResult.content;

    if (!rawAssistant) {
      throw new Error("No response from AI");
    }

    // DO NOT append CTA to every response - only when document is ready (below)

    // Update message count
    if (usageData) {
      await supabaseClient
        .from('dashboard_chat_messages')
        .update({ messages_count: currentCount + 1 })
        .eq('user_id', user.id)
        .eq('message_date', today);
    } else {
      await supabaseClient
        .from('dashboard_chat_messages')
        .insert({ user_id: user.id, message_date: today, messages_count: 1 });
    }

    // HARD FIX: draftResponse must be derived ONLY from strict markers.
    // IMPORTANT: extract from RAW assistant content (no CTA appended).
    let { draftReady, draftResponse, extractedTitle } = extractStrictDraft(rawAssistant);

    // Signature: never ask user. Replace [Signature]/[Firma] with line for signing after print.
    if (draftResponse) draftResponse = replaceSignaturePlaceholders(draftResponse);

    // Only treat as letter when it has formal structure (prevents summaries/recaps from enabling preview/print/email)
    if (draftResponse && !looksLikeFormalLetter(draftResponse.trim())) {
      draftReady = false;
      draftResponse = null;
      extractedTitle = null;
    }

    let assistantMessage = normalizeAssistantCopy(responseLanguage, replaceSignaturePlaceholders(rawAssistant));

    // HARD-STOP: Never allow drafts with placeholders.
    // If placeholders appear anywhere in the raw assistant output OR extracted draft,
    // force collection questions and DO NOT return draftResponse.
    const placeholderBlocked =
      containsBracketPlaceholders(rawAssistant) || containsBracketPlaceholders(draftResponse || "");
    if (placeholderBlocked) {
      draftReady = false;
      draftResponse = null;
      extractedTitle = null;
      assistantMessage = buildPlaceholderQuestion(responseLanguage, rawAssistant);
    }

    // Output validation: if document was provided but model says it didn't receive it → replace with safe fallback
    const outputCheck = validateOutputForbiddenPhrases(
      letterTextForMessages.length,
      assistantMessage,
      { endpoint: "dashboard-chat", caseId: caseId ?? undefined }
    );
    if (!outputCheck.ok) {
      assistantMessage = outputCheck.response;
    }

    // REGOLA PRIMO MESSAGGIO: risposta deve sempre iniziare con presentazione Lexora; VIETATO "non ho trovato"
    if (isFirstMessage && assistantMessage) {
      const langForGreeting = (responseLanguage || "EN").toUpperCase();
      const greeting = LEXORA_FIRST_GREETING[langForGreeting] || LEXORA_FIRST_GREETING.EN;
      const forbidden = [
        /non ho trovato/i, /I didn't find/i, /I couldn't find/i, /nessuna informazione/i,
        /indicami l'indirizzo/i, /please provide the address/i, /could you provide/i, /puoi indicarmi/i,
        /nessuna informazione affidabile/i, /non dispongo di informazioni/i,
      ];
      const hasForbidden = forbidden.some((r) => r.test(assistantMessage));
      const trimmed = assistantMessage.trim();
      const startsWithGreeting = greeting && (trimmed.startsWith(greeting) || trimmed.toLowerCase().startsWith(greeting.toLowerCase().slice(0, 20)));
      if (hasForbidden || !startsWithGreeting) {
        const docLine = hasDocumentInContext
          ? (langForGreeting === "IT" ? "Ho letto il documento e sono pronto ad aiutarla.\n\n" : "I have read the document and am ready to help.\n\n")
          : "";
        const closing = langForGreeting === "IT" ? "Come posso aiutarla?" : "How may I help you?";
        assistantMessage = greeting + "\n\n" + docLine + closing;
      }
    }

    // Build suggested action only when we have a clean, formal draft.
    let suggestedAction = null;
    if (draftReady && draftResponse) {
      const createCaseLabel = CREATE_CASE_LABELS[responseLanguage] || CREATE_CASE_LABELS.EN;
      
      // Use extracted title from subject line (already extracted in extractStrictDraft)
      // This ensures the case title is meaningful, e.g. "Disdetta casa", "Kündigung Mietvertrag"
      const caseTitle = extractedTitle || "Document";
      
      // ONLY append CTA when document is ready (not on every message)
      const ctaReady = CTA_WHEN_READY[responseLanguage] || CTA_WHEN_READY.EN;
      assistantMessage = normalizeAssistantCopy(responseLanguage, assistantMessage + ctaReady);
      
      suggestedAction = {
        type: 'CREATE_CASE_FROM_CHAT',
        label: createCaseLabel,
        payload: {
          draftResponse: draftResponse,
          title: caseTitle,
        },
      };
    } else {
      // Draft NOT ready: ensure the assistant does not instruct unavailable actions.
      // If we already replaced the message due to placeholder blocking, don't append generic hints.
      if (!placeholderBlocked) {
        assistantMessage = stripUnavailableCTAs(assistantMessage);
        const hint = NOT_READY_HINT[responseLanguage] || NOT_READY_HINT.EN;
        assistantMessage = (assistantMessage + hint).trim();
      }
    }

    // WEB ASSIST: Append sources section if web search was performed
    if (webSearchResults.length > 0) {
      const sourcesSection = formatSourcesSection(webSearchResults, responseLanguage);
      assistantMessage = assistantMessage + sourcesSection;
    }

    // Increment global documents counter (homepage) when a real letter was generated
    if (draftReady && draftResponse && draftResponse.trim().length >= 200) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && serviceKey) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
          await supabaseAdmin.rpc("increment_documents_processed");
        } catch (e) {
          console.warn("[dashboard-chat] increment_documents_processed failed (non-critical):", (e as Error)?.message);
        }
      }
    }

    // Save chat messages to history (store assistantMessage shown in UI)
    await supabaseClient.from('dashboard_chat_history').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: assistantMessage },
    ]);

    return new Response(
      JSON.stringify({ 
        // NOTE: assistantMessage may contain explanations/CTA. draftResponse is ONLY the formal letter.
        response: assistantMessage,
        assistantMessage,
        draftReady,
        draftResponse,
        messagesUsed: currentCount + 1,
        messagesLimit: messageLimit,
        plan: userPlan,
        suggestedAction,
        webSources: webSearchResults.length > 0 ? webSearchResults : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("dashboard-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
