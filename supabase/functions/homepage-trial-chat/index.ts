import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenAI } from "../_shared/openai.ts";
import { normLang } from "../_shared/lang.ts";
import { checkScope, getRefusalMessage } from "../_shared/scopeGate.ts";
import { webSearch, formatSourcesSection, type SearchResult } from "../_shared/webAssist.ts";
import { intelligentSearch, detectSearchIntent, detectInfoRequest } from "../_shared/intelligentSearch.ts";
import { hasUserConfirmed, isDocumentGenerationAttempt, buildSummaryBlock, extractDocumentData, wasPreviousMessageSummary } from "../_shared/documentGate.ts";
import { POLICY_DEMO_DASHBOARD } from "../_shared/lexoraChatPolicy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OkResponse = { ok: true; reply: string; draftText: string | null; meta?: { model?: string; blocked?: boolean; confidence?: number }; webSources?: SearchResult[] };
type ErrResponse = { ok: false; error: { code: string; message: string } };

function json(status: number, body: OkResponse | ErrResponse) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

// Unified Intelligent Chat Behavior - SAME FOR ALL LANGUAGES
// Demo/Dashboard: guided action, show results immediately, no setup questions (POLICY_DEMO_DASHBOARD)
const UNIFIED_CHAT_BEHAVIOR = `
${POLICY_DEMO_DASHBOARD}

=== DEMO-SPECIFIC RULES ===
- This is GUIDED ACTION MODE. Explain what you can do and show results immediately.
- Do NOT ask for personal or document data in demo. Simulate real behavior.
- Say things like: "I analyzed your situation and prepared a response draft."
- When the user describes a situation, produce a draft or analysis directly when possible; only ask for confirmation before finalizing the letter (one summary + confirm step is enough).
- Use smart defaults for missing sender/date/place. Never use [placeholder] brackets; use real values or "—".

=== 1) AUTOMATIC INTENT DETECTION ===
- CONVERSATION: Answer naturally, provide explanations, strategies.
- INFORMATION REQUEST: Search online first when needed.
- DOCUMENT CREATION: After brief summary, ask one confirmation then generate with [LETTER]...[/LETTER].

=== 2) ONLINE SEARCH (when needed) ===
Search autonomously; propose result and ask simple confirmation before using in documents. If user says "find it yourself", perform search.

=== 3) DOCUMENT GENERATION ===
One summary + explicit confirmation, then generate. No multi-step interviews. Use defaults for missing data.

=== 4) LETTER FORMAT ===
Wrap in [LETTER] and [/LETTER]. Structure: Sender → Recipient → Place+Date → Subject → Body → Closing → typed name or ________________ (line for hand signature after printing). NEVER use [Signature] or ask the user for a signature in ANY language (IT, DE, EN, FR, ES, PL, RO, TR, AR, UK, RU); the client signs on the printed document only. After user confirms ("sì"/"ok"/"genera"/etc.), generate ONLY the letter – do not ask for anything else. Current date: ${new Date().toLocaleDateString('it-IT')}
`;

// System prompts - DYNAMIC LANGUAGE from UI locale
const SYSTEM_PROMPTS: Record<string, string> = {
  IT: `Sei Lexora, assistente AI intelligente per questioni legali e amministrative.

COMPORTAMENTO: Funzioni come ChatGPT ma sei specializzata in documenti legali/amministrativi.
- Rispondi alle domande in modo conversazionale e utile
- Cerca informazioni online automaticamente quando servono
- Crea documenti formali SOLO dopo conferma esplicita dell'utente

AMBITO AMMESSO (SEMPRE ACCETTARE):
- Lettere a scuole, asili, università, datori di lavoro, proprietari, aziende
- Comunicazioni con uffici pubblici, banche, assicurazioni
- Qualsiasi comunicazione formale o semi-formale scritta
- MAI rifiutare questi tipi di richieste

REGOLA LINGUA: Rispondi in italiano.
${UNIFIED_CHAT_BEHAVIOR}
Questa è una demo gratuita.`,

  DE: `Du bist Lexora, intelligenter KI-Assistent für rechtliche und administrative Angelegenheiten.

VERHALTEN: Du funktionierst wie ChatGPT, bist aber auf rechtliche/administrative Dokumente spezialisiert.
- Beantworte Fragen gesprächig und hilfreich
- Suche automatisch online nach Informationen wenn nötig
- Erstelle formelle Dokumente NUR nach ausdrücklicher Bestätigung des Benutzers

ERLAUBTER BEREICH (IMMER AKZEPTIEREN):
- Briefe an Schulen, Kindergärten, Universitäten, Arbeitgeber, Vermieter, Unternehmen
- Kommunikation mit Behörden, Banken, Versicherungen
- Jede formelle oder halbformelle schriftliche Kommunikation
- NIEMALS diese Anfragen ablehnen

SPRACHREGEL: Antworte auf Deutsch. DIN 5008 Format für Briefe.
${UNIFIED_CHAT_BEHAVIOR}
Dies ist eine kostenlose Demo.`,

  EN: `You are Lexora, an intelligent AI assistant for legal and administrative matters.

BEHAVIOR: You function like ChatGPT but specialize in legal/administrative documents.
- Answer questions conversationally and helpfully
- Search online automatically when information is needed
- Create formal documents ONLY after explicit user confirmation

ALLOWED SCOPE (ALWAYS ACCEPT):
- Letters to schools, kindergartens, universities, employers, landlords, companies
- Communications with public offices, banks, insurance companies
- Any formal or semi-formal written communication
- NEVER refuse these types of requests

LANGUAGE RULE: Respond in English.
${UNIFIED_CHAT_BEHAVIOR}
This is a free demo.`,

  FR: `Tu es Lexora, assistant IA intelligent pour les questions juridiques et administratives.

COMPORTEMENT: Tu fonctionnes comme ChatGPT mais tu es spécialisée dans les documents juridiques/administratifs.
- Réponds aux questions de manière conversationnelle et utile
- Recherche automatiquement en ligne quand des informations sont nécessaires
- Crée des documents formels UNIQUEMENT après confirmation explicite de l'utilisateur

DOMAINE ACCEPTÉ (TOUJOURS ACCEPTER):
- Lettres aux écoles, crèches, universités, employeurs, propriétaires, entreprises
- Communications avec administrations, banques, assurances
- Toute communication formelle ou semi-formelle écrite
- Ne JAMAIS refuser ces demandes

RÈGLE LANGUE: Réponds en français.
${UNIFIED_CHAT_BEHAVIOR}
Ceci est une démo gratuite.`,

  ES: `Eres Lexora, asistente IA inteligente para asuntos legales y administrativos.

COMPORTAMIENTO: Funcionas como ChatGPT pero te especializas en documentos legales/administrativos.
- Responde preguntas de manera conversacional y útil
- Busca información en línea automáticamente cuando sea necesario
- Crea documentos formales SOLO después de confirmación explícita del usuario

ÁMBITO PERMITIDO (SIEMPRE ACEPTAR):
- Cartas a escuelas, guarderías, universidades, empleadores, propietarios, empresas
- Comunicaciones con oficinas públicas, bancos, aseguradoras
- Cualquier comunicación formal o semiformal escrita
- NUNCA rechazar estas solicitudes

REGLA IDIOMA: Responde en español.
${UNIFIED_CHAT_BEHAVIOR}
Esta es una demo gratuita.`,

  PL: `Jesteś Lexora, inteligentnym asystentem AI do spraw prawnych i administracyjnych.

ZACHOWANIE: Działasz jak ChatGPT, ale specjalizujesz się w dokumentach prawnych/administracyjnych.
- Odpowiadaj na pytania konwersacyjnie i pomocnie
- Automatycznie szukaj informacji online gdy potrzeba
- Twórz formalne dokumenty TYLKO po wyraźnym potwierdzeniu użytkownika

DOZWOLONY ZAKRES (ZAWSZE AKCEPTUJ):
- Listy do szkół, przedszkoli, uniwersytetów, pracodawców, wynajmujących, firm
- Komunikacja z urzędami, bankami, ubezpieczycielami
- Każda formalna lub półformalna komunikacja pisemna
- NIGDY nie odmawiaj tych próśb

REGUŁA JĘZYKA: Odpowiadaj po polsku.
${UNIFIED_CHAT_BEHAVIOR}
To jest bezpłatna demo.`,

  RO: `Ești Lexora, asistent AI inteligent pentru chestiuni juridice și administrative.

COMPORTAMENT: Funcționezi ca ChatGPT dar ești specializată în documente juridice/administrative.
- Răspunde la întrebări conversațional și util
- Caută automat online când sunt necesare informații
- Creează documente formale DOAR după confirmarea explicită a utilizatorului

DOMENIU PERMIS (ACCEPTĂ ÎNTOTDEAUNA):
- Scrisori către școli, grădinițe, universități, angajatori, proprietari, companii
- Comunicări cu birouri publice, bănci, asiguratori
- Orice comunicare formală sau semiformală scrisă
- Nu refuza NICIODATĂ aceste cereri

REGULĂ LIMBĂ: Răspunde în română.
${UNIFIED_CHAT_BEHAVIOR}
Aceasta este o demo gratuită.`,

  TR: `Sen Lexora, hukuki ve idari konular için akıllı yapay zeka asistanısın.

DAVRANIŞ: ChatGPT gibi çalışırsın ama hukuki/idari belgelerde uzmanlaşmışsın.
- Soruları sohbet tarzında ve yardımcı bir şekilde yanıtla
- Bilgi gerektiğinde otomatik olarak çevrimiçi ara
- Resmi belgeleri SADECE kullanıcının açık onayından sonra oluştur

İZİN VERİLEN KAPSAM (HER ZAMAN KABUL ET):
- Okullara, anaokullarına, üniversitelere, işverenlere, ev sahiplerine, şirketlere mektuplar
- Kamu daireleri, bankalar, sigorta şirketleri ile iletişim
- Her türlü resmi veya yarı resmi yazılı iletişim
- Bu talepleri ASLA reddetme

DİL KURALI: Türkçe yanıt ver.
${UNIFIED_CHAT_BEHAVIOR}
Bu ücretsiz bir demodur.`,

  AR: `أنت Lexora، مساعد ذكاء اصطناعي ذكي للمسائل القانونية والإدارية.

السلوك: تعمل مثل ChatGPT لكنك متخصصة في المستندات القانونية/الإدارية.
- أجب على الأسئلة بطريقة محادثة ومفيدة
- ابحث تلقائياً عبر الإنترنت عند الحاجة لمعلومات
- أنشئ المستندات الرسمية فقط بعد تأكيد صريح من المستخدم

النطاق المسموح (اقبل دائماً):
- رسائل إلى المدارس، رياض الأطفال، الجامعات، أصحاب العمل، الملاك، الشركات
- التواصل مع المكاتب الحكومية، البنوك، شركات التأمين
- أي اتصال رسمي أو شبه رسمي مكتوب
- لا ترفض أبداً هذه الطلبات

قاعدة اللغة: أجب بالعربية.
${UNIFIED_CHAT_BEHAVIOR}
هذه نسخة تجريبية مجانية.`,

  UK: `Ти Lexora, інтелектуальний асистент ШІ для юридичних та адміністративних питань.

ПОВЕДІНКА: Ти працюєш як ChatGPT, але спеціалізуєшся на юридичних/адміністративних документах.
- Відповідай на запитання розмовно та корисно
- Автоматично шукай інформацію онлайн коли потрібно
- Створюй офіційні документи ТІЛЬКИ після явного підтвердження користувача

ДОЗВОЛЕНА СФЕРА (ЗАВЖДИ ПРИЙМАТИ):
- Листи до шкіл, дитячих садків, університетів, роботодавців, орендодавців, компаній
- Спілкування з державними установами, банками, страховими компаніями
- Будь-яке офіційне чи напівофіційне письмове спілкування
- НІКОЛИ не відмовляти в цих запитах

ПРАВИЛО МОВИ: Відповідай українською.
${UNIFIED_CHAT_BEHAVIOR}
Це безкоштовна демо.`,

  RU: `Ты Lexora, интеллектуальный ИИ-ассистент для юридических и административных вопросов.

ПОВЕДЕНИЕ: Ты работаешь как ChatGPT, но специализируешься на юридических/административных документах.
- Отвечай на вопросы разговорно и полезно
- Автоматически ищи информацию онлайн когда нужно
- Создавай официальные документы ТОЛЬКО после явного подтверждения пользователя

РАЗРЕШЁННАЯ СФЕРА (ВСЕГДА ПРИНИМАТЬ):
- Письма в школы, детские сады, университеты, работодателям, арендодателям, компаниям
- Общение с государственными органами, банками, страховыми компаниями
- Любая официальная или полуофициальная письменная коммуникация
- НИКОГДА не отказывать в этих запросах

ПРАВИЛО ЯЗЫКА: Отвечай на русском.
${UNIFIED_CHAT_BEHAVIOR}
Это бесплатная демо.`,
};

// Greeting prefixes per language (ONLY for first message)
const GREETINGS: Record<string, string> = {
  IT: "Ciao, sono Lexora, il tuo assistente legale AI. ",
  DE: "Hallo, ich bin Lexora, dein KI-Rechtsassistent. ",
  EN: "Hello, I'm Lexora, your AI legal assistant. ",
  FR: "Bonjour, je suis Lexora, votre assistant juridique IA. ",
  ES: "Hola, soy Lexora, tu asistente legal de IA. ",
  PL: "Cześć, jestem Lexora, Twój asystent prawny AI. ",
  RO: "Bună, sunt Lexora, asistentul tău juridic AI. ",
  TR: "Merhaba, ben Lexora, yapay zeka hukuk asistanınız. ",
  AR: "مرحباً، أنا Lexora، مساعدك القانوني بالذكاء الاصطناعي. ",
  UK: "Привіт, я Lexora, ваш юридичний асистент на базі ШІ. ",
  RU: "Привет, я Lexora, ваш юридический ассистент на базе ИИ. ",
};

// Extract letter from AI response using [LETTER]...[/LETTER] markers (primary)
// Falls back to pattern-based detection if markers not found
function extractLetterFromResponse(text: string): string | null {
  if (!text) return null;
  
  // PRIMARY: Look for [LETTER]...[/LETTER] markers (case insensitive)
  const markerMatch = text.match(/\[LETTER\]([\s\S]*?)\[\/LETTER\]/i);
  
  if (markerMatch && markerMatch[1]) {
    const extracted = markerMatch[1].trim();
    if (extracted.length >= 50) {
      return extracted;
    }
  }
  
  // FALLBACK: Pattern-based detection for when AI doesn't use markers
  return extractFormalLetterFallback(text);
}

// Fallback extraction using formal letter patterns
function extractFormalLetterFallback(text: string): string | null {
  if (!text || text.length < 100) return null;

  // Formal letter markers (multi-language)
  const hasSubject = /\b(oggetto|betreff|subject|objet|asunto|re:|betrifft)\s*:/i.test(text);
  const hasOpening = /\b(egregio|gentile|spett\.?\s*(le|li|mo)|sehr\s+geehrte|dear\s+(sir|madam|mr|ms)|to\s+whom|alla\s+cortese|geehrte\s+damen|guten\s+tag|an\s+die|an\s+das)/i.test(text);
  const hasClosing = /\b(cordiali\s+saluti|distinti\s+saluti|mit\s+freundlichen\s+grüßen|sincerely|best\s+regards|kind\s+regards|hochachtungsvoll|con\s+osservanza|freundliche\s+grüße|viele\s+grüße)/i.test(text);
  const hasAddress = /\b(absender|empfänger|mittente|destinatario|sender|recipient|indirizzo|adresse|straße|via|platz)\s*:/i.test(text);
  const hasDate = /\b(datum|data|date)\s*:/i.test(text) || /\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4}/i.test(text);

  const markerCount = [hasSubject, hasOpening, hasClosing, hasAddress, hasDate].filter(Boolean).length;
  if (markerCount < 1) return null;

  // Clean up the text
  let cleaned = text.replace(/```[\s\S]*?```/g, '').trim();

  // Strip chatty prefaces
  const prefacePatterns: RegExp[] = [
    /^\s*(hallo,?\s*(ich\s+bin\s+)?lexora[^.]*\.\s*)/i,
    /^\s*(hello,?\s*(i'?m\s+)?lexora[^.]*\.\s*)/i,
    /^\s*(ciao,?\s*(sono\s+)?lexora[^.]*\.\s*)/i,
    /^\s*(certamente|certo|ecco(\s+la)?|ti\s+propongo|qui\s+trovi|di\s+seguito)[^:]*:\s*/i,
    /^\s*(sure|of\s+course|here\s+is|below\s+is|here'?s)[^:]*:\s*/i,
    /^\s*(sehr\s+gern|natürlich|hier\s+ist|im\s+folgenden|gerne)[^:]*:\s*/i,
  ];
  for (const p of prefacePatterns) {
    cleaned = cleaned.replace(p, '');
  }
  cleaned = cleaned.trim();

  // Cut after signature/closing
  const endPatterns: RegExp[] = [
    /(mit\s+freundlichen\s+grüßen[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(freundliche\s+grüße[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(cordiali\s+saluti[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(distinti\s+saluti[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(sincerely[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
    /(best\s+regards[\s\S]*?)(?=\n\s*\n\s*#{1,6}|\n\s*\n\s*\*\*(?![\w])|$)/i,
  ];

  for (const p of endPatterns) {
    const m = cleaned.match(p);
    if (m && m.index != null) {
      const signatureEnd = m.index + m[0].length;
      const afterSignature = cleaned.slice(signatureEnd);
      const nameMatch = afterSignature.match(/^[\s\n]*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/);
      if (nameMatch) {
        return cleaned.slice(0, signatureEnd + nameMatch.index! + nameMatch[0].length).trim();
      }
      return cleaned.slice(0, signatureEnd).trim();
    }
  }

  return cleaned.length >= 100 ? cleaned : null;
}

// Only treat as a real letter when it has formal structure (prevents summaries/recaps from being returned as draft)
function looksLikeFormalLetter(text: string): boolean {
  if (!text || text.length < 200) return false;
  const hasOpening = /\b(egregio|gentile|spett\.?\s*(le|li|mo)|sehr\s+geehrte|dear\s+(sir|madam|mr|ms)|to\s+whom|alla\s+cortese|geehrte\s+damen)/i.test(text);
  const hasClosing = /\b(cordiali\s+saluti|distinti\s+saluti|mit\s+freundlichen\s+grüßen|sincerely|best\s+regards|kind\s+regards|hochachtungsvoll|con\s+osservanza)/i.test(text);
  const hasSubject = /\b(oggetto|betreff|subject|objet|asunto)\s*:/i.test(text);
  return [hasOpening, hasClosing, hasSubject].filter(Boolean).length >= 2;
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, language = "EN", isFirstMessage = false, conversationHistory = [], letterText, documentText, conversationStatus } = await req.json() as {
      message: string;
      language?: string;
      isFirstMessage?: boolean;
      conversationHistory?: Array<{ role: string; content: string }>;
      letterText?: string;
      documentText?: string;
      conversationStatus?: 'collecting' | 'confirmed' | 'document_generated';
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return json(400, {
        ok: false,
        error: { code: "invalid_input", message: "Message is required" },
      });
    }

    // Limit message length for security
    const trimmedMessage = message.trim().slice(0, 4000);
    const lang = normLang(language);
    
    // SCOPE GATE: Check if message is within allowed scope (bureaucratic/legal topics)
    const hasContext = Array.isArray(conversationHistory) && conversationHistory.length > 0;
    const isConfirmation = /^(ok|okay|sì|si|yes|ja|oui|d'accordo|einverstanden|procedi|proceed|fallo|mach das|do it|genera|generate|scrivi|schreibe|write)[\s.,!?]*$/i.test(trimmedMessage);
    
    if (!hasContext && !isConfirmation) {
      const scopeCheck = checkScope(trimmedMessage);
      if (!scopeCheck.inScope && scopeCheck.confidence !== 'low') {
        console.log(`[homepage-trial-chat] Scope rejected: ${scopeCheck.reason}`);
        const refusalMessage = getRefusalMessage(lang);
        return json(200, {
          ok: true,
          reply: refusalMessage,
          draftText: null,
          meta: { model: "scope-gate", blocked: true },
        });
      }
    }
    
    let systemPrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.EN;

    // Helper: detect if text looks like a scanned/pasted letter (so we treat it as THE document)
    const looksLikeLetter = (text: string): boolean => {
      if (!text || text.length < 350) return false;
      const hasOpening = /\b(egregio|gentile|spett\.?\s*(le|li|mo)|sehr\s+geehrte|dear\s+(sir|madam|mr|ms)|to\s+whom|alla\s+cortese|geehrte\s+damen|betreff|oggetto|subject)\b/i.test(text);
      const hasClosing = /\b(cordiali\s+saluti|distinti\s+saluti|mit\s+freundlichen|sincerely|best\s+regards|hochachtungsvoll|con\s+osservanza)\b/i.test(text);
      const hasSubject = /\b(oggetto|betreff|subject|objet|asunto)\s*:/i.test(text);
      return [hasOpening, hasClosing, hasSubject].filter(Boolean).length >= 2;
    };

    // Helper: detect upload prefix so we always treat as document (AI must read immediately, no waiting for user)
    const isUploadedDoc = (t: string): boolean =>
      t.startsWith("[Document uploaded]") || t.startsWith("[PDF uploaded]") || /^\[\d+\s+documents uploaded\]/.test(t);

    // Document: explicit (letterText/documentText) OR derived from current/last user message (OCR / upload in chat)
    let letterOrDocText = (letterText || documentText || "").trim();
    if (letterOrDocText.length === 0) {
      const fullMessage = message.trim();
      const history = Array.isArray(conversationHistory) ? conversationHistory : [];
      if (isUploadedDoc(fullMessage) || (fullMessage.length >= 350 && looksLikeLetter(fullMessage))) {
        letterOrDocText = fullMessage.slice(0, 12000);
      } else {
        const lastUser = [...history].reverse().find((m: { role: string }) => m.role === "user");
        const lastContent = lastUser && typeof (lastUser as any).content === "string" ? (lastUser as any).content : "";
        if (isUploadedDoc(lastContent) || (lastContent.length >= 350 && looksLikeLetter(lastContent))) {
          letterOrDocText = lastContent.slice(0, 12000);
        }
      }
    }
    if (letterOrDocText.length > 0) {
      const snippet = letterOrDocText.length > 8000 ? letterOrDocText.slice(0, 8000) + "...[troncato]" : letterOrDocText;
      systemPrompt += `

=== LETTERA/DOCUMENTO IN CHAT (OCR / SCANSIONE) – FONTE UNICA DI VERITÀ ===
L'utente ha caricato/scannerizzato questo documento. DEVI considerarlo GIÀ LETTO e usarlo come fonte primaria. NON aspettare che l'utente ti dica dove cercare: le informazioni sono QUI SOTTO.
${snippet}

REGOLA OBBLIGATORIA (tutte le lingue):
- Il documento è già in tuo possesso. Usalo per rispondere senza chiedere all'utente dove trovare i dati.
- NON chiedere MAI all'utente dati che compaiono nel documento sopra (destinatario, riferimento, scadenza, nomi, date, numeri, indirizzi, autorità). Usali SEMPRE direttamente.
- NON chiedere MAI la firma (signature, firma, Unterschrift). Il cliente firma su carta dopo la stampa. Nella lettera usa solo nome a stampa o "________________".
- Se questo messaggio È il caricamento del documento: rispondi brevemente confermando di aver letto il documento e di essere pronto a aiutare (es. 1-2 frasi), poi proponi il passo successivo.
- Chiedi SOLO informazioni AGGIUNTIVE non presenti nella lettera, oppure cerca sul web.
`;
    }
    
    // Add greeting instruction ONLY for first message
    const greetingInstruction = isFirstMessage 
      ? `\n\nIMPORTANT: This is the user's FIRST message. Start your response with a brief greeting: "${GREETINGS[lang] || GREETINGS.EN}" Then proceed to ask what they need help with.`
      : `\n\nNote: This is a follow-up message. Do NOT greet or introduce yourself again. Just respond directly to the user's question or continue the intake process.`;

    // =====================
    // INTELLIGENT AUTO-SEARCH (REAL LOGIC - NOT JUST PROMPT)
    // =====================
    // Check if user explicitly wants us to search
    const userWantsSearch = detectSearchIntent(trimmedMessage);
    // Check if message requests external info
    const needsExternalInfo = detectInfoRequest(trimmedMessage);
    
    let intelligentSearchResult = null;
    let webSearchContext = '';
    let webSearchResults: SearchResult[] = [];
    
    if (userWantsSearch || needsExternalInfo) {
      console.log(`[homepage-trial-chat] Intelligent search triggered (userWantsSearch: ${userWantsSearch}, needsExternalInfo: ${needsExternalInfo})`);
      
      // Perform intelligent search with query expansion and confidence scoring
      intelligentSearchResult = await intelligentSearch(trimmedMessage.slice(0, 200), language);
      
      if (intelligentSearchResult.found && intelligentSearchResult.confidence >= 0.85) {
        // High confidence - propose result and ask for confirmation
        console.log(`[homepage-trial-chat] High confidence result found (${intelligentSearchResult.confidence.toFixed(2)})`);
        
        // Return proposal instead of calling AI
        return json(200, {
          ok: true,
          reply: intelligentSearchResult.proposedAnswer + (intelligentSearchResult.sourcesSection || ''),
          draftText: null,
          meta: { model: "intelligent-search", confidence: intelligentSearchResult.confidence },
          webSources: intelligentSearchResult.results.slice(0, 3),
        });
      } else if (intelligentSearchResult.needsUserInput && !intelligentSearchResult.found) {
        // Low confidence - ask user for info, DON'T invent
        console.log(`[homepage-trial-chat] Low confidence (${intelligentSearchResult.confidence.toFixed(2)}) - asking user`);
        
        return json(200, {
          ok: true,
          reply: intelligentSearchResult.userQuestion || "Could you provide the specific address or office?",
          draftText: null,
          meta: { model: "intelligent-search-fallback", confidence: intelligentSearchResult.confidence },
        });
      }
      
      // Medium confidence - include in context for AI
      if (intelligentSearchResult.results.length > 0) {
        webSearchResults = intelligentSearchResult.results;
        const resultsText = webSearchResults.map((r, i) => 
          `[${i+1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`
        ).join('\n\n');
        webSearchContext = `\n\n📌 WEB SEARCH RESULTS (verify before using):\n${resultsText}\n\nIMPORTANT: Confidence is ${(intelligentSearchResult.confidence * 100).toFixed(0)}%. If using this info, propose it to user and ask for confirmation first.`;
      }
    }
    
    // =====================
    // DOCUMENT CONFIRMATION GATE (conversation status)
    // =====================
    const previousWasSummary = wasPreviousMessageSummary(conversationHistory);
    const userConfirmed = hasUserConfirmed(trimmedMessage);
    const statusConfirmed = conversationStatus === 'confirmed' || conversationStatus === 'document_generated';
    const allowDocumentGeneration = statusConfirmed || (previousWasSummary && userConfirmed);
    
    // Add gate instruction to system prompt
    let gateInstruction = '';
    if (!allowDocumentGeneration) {
      gateInstruction = `\n\n=== DOCUMENT GENERATION GATE (ENFORCED BY SYSTEM) ===
CRITICAL: Before generating ANY final document/letter, you MUST:
1. First show a SUMMARY of all data you will use (from the document in chat – do NOT ask for data already there; do NOT ask for signature).
2. Ask ONE question only: "Posso creare il documento / vuole aggiungere altro?" (or equivalent in user language: "Can I create the document or do you want to add something?").
3. Then WAIT. Do NOT ask for signature, firma, or any other data. ONLY after user confirms (yes/ok/genera/no), generate the letter with [LETTER]...[/LETTER].

The user has NOT confirmed yet. Do NOT generate final letters yet. Do NOT ask for signature or extra data.`;
    } else {
      gateInstruction = `\n\n=== CONFIRMATION RECEIVED ===
User has confirmed. Proceed IMMEDIATELY to create the letter with [LETTER]...[/LETTER] tags.
DO NOT ask for ANYTHING else: no signature, no further data, no "vuole aggiungere altro?". Generate ONLY the letter. Say one brief phrase (e.g. "Ecco la lettera.") then output [LETTER]...[/LETTER] only.
DO NOT mention or correct typos in the user's confirmation. Just generate the document.`;
      console.log(`[homepage-trial-chat] Document generation ALLOWED after confirmation`);
    }

    // Build messages array: system, then EXPLICIT OCR user message when present, then history
    const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
       { role: "system", content: systemPrompt + greetingInstruction + gateInstruction + webSearchContext },
    ];

    if (letterOrDocText.length > 0) {
      const ocrForMessages = letterOrDocText.length > 8000 ? letterOrDocText.slice(0, 8000) + "\n...[troncato]" : letterOrDocText;
      aiMessages.push({
        role: "user",
        content: `TESTO LETTERA (OCR):\n"""\n${ocrForMessages}\n"""`,
      });
    }

    const historyToUse = Array.isArray(conversationHistory) 
      ? conversationHistory.slice(-20) 
      : [];
    for (const msg of historyToUse) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({
          role: msg.role as "user" | "assistant",
          content: String(msg.content || '').slice(0, 4000),
        });
      }
    }

    if (conversationStatus === 'document_generated') {
      return json(200, {
        ok: true,
        reply: "Il documento è già stato generato. Puoi usare i pulsanti Anteprima, Stampa, Email o Copia per utilizzarlo.",
        draftText: null,
        meta: { model: "closure" },
      });
    }

    // Use OpenAI API directly (no Lovable credits)
    const aiResult = await callOpenAI({
      messages: aiMessages,
      model: "gpt-4.1-mini",
      temperature: 0.7,
    });

    if (!aiResult.ok) {
      console.error("[homepage-trial-chat] OpenAI error:", aiResult.error);
      
      if (aiResult.status === 429) {
        return json(429, {
          ok: false,
          error: { code: "rate_limited", message: "Too many requests" },
        });
      }

      return json(500, {
        ok: false,
        error: { code: "AI_PROVIDER_ERROR", message: "AI temporarily unavailable" },
      });
    }

    const responseText = aiResult.content || "";

    // Extract letter using [LETTER]...[/LETTER] markers (primary) with pattern fallback
    let draftText = extractLetterFromResponse(responseText);
    let finalReply = responseText;

    // =====================
    // PLACEHOLDER HARD-STOP (same as dashboard-chat)
    // =====================
    // If the model returns bracket placeholders, REJECT the draft and ask for missing data
    // Exclude system markers and SIGNATURE (never ask for signature – client signs on printed doc)
    const SYSTEM_MARKERS = new Set([
      "[LETTER]", "[/LETTER]", "[BRIEF]", "[/BRIEF]", "[LETTRE]", "[/LETTRE]", "[CARTA]", "[/CARTA]",
      "[SIGNATURE]", "[FIRMA]", "[UNTERSCHRIFT]", "[FIRMA DEL MITTENTE]", "[SIGNATURE DU DESTINATAIRE]",
    ]);
    const isExcludedPlaceholder = (m: string): boolean => {
      const u = m.toUpperCase().trim();
      if (SYSTEM_MARKERS.has(u)) return true;
      if (/^\[(SIGNATURE|FIRMA|UNTERSCHRIFT|SIGNATURA|PARAFA)\s*\]$/.test(u)) return true;
      if (/^\[.*(FIRMA|SIGNATURE|UNTERSCHRIFT).*\]$/.test(u)) return true;
      return false;
    };
    const containsPlaceholders = (text: string): boolean => {
      if (!text) return false;
      const matches = text.match(/\[[^\]]+\]/g) || [];
      const realPlaceholders = matches.filter(m => !isExcludedPlaceholder(m));
      return realPlaceholders.length > 0;
    };
    const extractPlaceholders = (text: string, max = 5): string[] => {
      if (!text) return [];
      const matches = text.match(/\[[^\]]+\]/g) || [];
      const realPlaceholders = matches.filter(m => !isExcludedPlaceholder(m));
      const unique = [...new Set(realPlaceholders)];
      return unique.slice(0, max);
    };

    const PLACEHOLDER_BLOCK_MESSAGES: Record<string, string> = {
      IT: "Per creare una lettera completa, mi servono alcune informazioni. Per favore indicami:",
      DE: "Um einen vollständigen Brief zu erstellen, benötige ich einige Informationen. Bitte geben Sie an:",
      EN: "To create a complete letter, I need some information. Please provide:",
      FR: "Pour créer une lettre complète, j'ai besoin de quelques informations. Veuillez indiquer:",
      ES: "Para crear una carta completa, necesito alguna información. Por favor indique:",
    };

    const placeholderBlocked = containsPlaceholders(responseText) || containsPlaceholders(draftText || "");
    
    if (placeholderBlocked) {
      // REJECT the draft - don't send it to frontend
      draftText = null;
      
      // Build a question asking for missing data
      const lang = (language || "EN").toUpperCase();
      const intro = PLACEHOLDER_BLOCK_MESSAGES[lang] || PLACEHOLDER_BLOCK_MESSAGES.EN;
      const placeholders = extractPlaceholders(responseText, 5);
      const bullets = placeholders.map((p) => `• ${p}`).join("\n");
      
      finalReply = `${intro}\n${bullets}`;
      
      console.log(`[homepage-trial-chat] PLACEHOLDER BLOCKED: ${placeholders.join(", ")}`);
    } else {
      // Signature: never ask user. Replace [Signature]/[Firma] with line for signing after print.
      finalReply = replaceSignaturePlaceholders(finalReply);
      if (draftText) draftText = replaceSignaturePlaceholders(draftText);
    }

    // Only return draftText when it is a real formal letter (not a summary/recap) – keeps buttons disabled until letter is ready
    if (draftText && !looksLikeFormalLetter(draftText.trim())) {
      draftText = null;
    }

    // WEB ASSIST: Append sources section if web search was performed
    if (webSearchResults.length > 0 && !placeholderBlocked) {
      const sourcesSection = formatSourcesSection(webSearchResults, lang);
      finalReply = finalReply + sourcesSection;
    }

    // Increment global documents counter only when we return a real letter
    if (draftText && draftText.trim().length >= 200) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && serviceKey) {
        try {
          const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
          await supabaseAdmin.rpc("increment_documents_processed");
        } catch (e) {
          console.warn("[homepage-trial-chat] increment_documents_processed failed (non-critical):", (e as Error)?.message);
        }
      }
    }

    return json(200, {
      ok: true,
      reply: finalReply,
      draftText: draftText,
      meta: { model: "gpt-4.1-mini" },
      webSources: webSearchResults.length > 0 ? webSearchResults : undefined,
    });

  } catch (error) {
    console.error("[homepage-trial-chat] Unhandled error:", error);
    return json(500, {
      ok: false,
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
});
