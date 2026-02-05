import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOpenAI } from "../_shared/openai.ts";
import { normLang } from "../_shared/lang.ts";
import { checkScope, getRefusalMessage } from "../_shared/scopeGate.ts";
import { webSearch, formatSourcesSection, type SearchResult } from "../_shared/webAssist.ts";
import { intelligentSearch, detectSearchIntent, detectInfoRequest } from "../_shared/intelligentSearch.ts";
import { hasUserConfirmed, isDocumentGenerationAttempt, buildSummaryBlock, extractDocumentData, wasPreviousMessageSummary } from "../_shared/documentGate.ts";
import { UNIFIED_LEXORA_IDENTITY } from "../_shared/lexoraSystemPrompt.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

type OkResponse = { ok: true; reply: string; draftText: string | null; meta?: { model?: string; blocked?: boolean; confidence?: number }; webSources?: SearchResult[] };
type ErrResponse = { ok: false; error: { code: string; message: string } };

function json(corsHeaders: HeadersInit, status: number, body: OkResponse | ErrResponse) {
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

// Document/letter rules (append to unified identity)
const UNIFIED_CHAT_BEHAVIOR = `

=== 1) AUTOMATIC INTENT DETECTION ===
Detect user intent automatically (NO toggles, NO UI changes):
- CONVERSATION: Questions, explanations, ideas, strategies → respond conversationally like ChatGPT
- INFORMATION REQUEST: Need external data → search online autonomously first
- DOCUMENT CREATION: Need a formal letter/document → follow strict document rules

=== 2) INTELLIGENT ONLINE SEARCH (AUTONOMOUS) ===
When external information is needed (addresses, procedures, contacts):

STEP 1: Search autonomously using query expansion:
- Direct query in user's language
- Synonyms in DE/IT/EN
- "zuständig für" / "competente per" / "responsible for"
- Territorial fallback: city → county → competent authority

STEP 2: If found with good reliability:
- PROPOSE the result to the user
- Ask for simple confirmation before using in documents

STEP 3: If NOT found reliably:
- DO NOT invent anything
- Ask ONE clear question

STEP 4: If user says "find it yourself" / "trovalo tu" / "such es selbst":
- MUST perform online search, do not ask the user again

FORBIDDEN: Using approximate addresses, unofficial entities as fallback, "guessing" missing information

=== 3) DOCUMENT GENERATION RULES (STRICT) ===
NEVER generate a final document automatically without confirmation.

MANDATORY FLOW:
1. Collect all necessary information (from user profile, case, conversation, or search)
2. Summarize what will be included in the document
3. Ask EXPLICIT confirmation: "Shall I create the letter with this information?"
4. ONLY after confirmation → generate the formal document

⚠️ ABSOLUTE PLACEHOLDER BAN ⚠️
NEVER generate documents containing ANY bracketed placeholders:
- [Name], [Nome], [Vorname], [Nachname]
- [Date], [Data], [Datum]
- [Address], [Indirizzo], [Adresse]
- [City], [Città], [Stadt], [Ort], [Luogo]
- [ZIP], [CAP], [PLZ]
- ANY text in square brackets [...]

If information is missing:
1. DO NOT generate the document yet
2. ASK for the specific missing information
3. Wait for answer
4. ONLY THEN generate with real data

=== 4) CONVERSATIONAL MODE (CHATGPT-LIKE) ===
For non-document requests, respond naturally:
- Answer questions about laws, procedures, rights
- Explain concepts in accessible language
- Brainstorm strategies and options
- Provide advice and suggestions
- Be helpful and informative

=== 5) LETTER FORMAT (WHEN GENERATING) ===
When generating a formal letter AFTER confirmation:
- Wrap in [LETTER] and [/LETTER] tags
- Structure: Sender → Recipient → Place+Date → Subject → Body → Closing → Signature
- NO explanations inside the letter
- Letter ends with signature, NOTHING after

Current date: ${new Date().toLocaleDateString('it-IT')}
`;

// System prompts: unified identity + language rule + document/letter rules
const LANGUAGE_RULE: Record<string, string> = {
  IT: "\nREGOLA LINGUA: Rispondi in italiano.\n",
  DE: "\nSPRACHREGEL: Antworte auf Deutsch. DIN 5008 für Briefe.\n",
  EN: "\nLANGUAGE RULE: Respond in English.\n",
  FR: "\nRÈGLE LANGUE: Réponds en français.\n",
  ES: "\nREGLA IDIOMA: Responde en español.\n",
  PL: "\nREGUŁA JĘZYKA: Odpowiadaj po polsku.\n",
  RO: "\nREGULĂ LIMBĂ: Răspunde în română.\n",
  TR: "\nDİL KURALI: Türkçe yanıt ver.\n",
  AR: "\nقاعدة اللغة: أجب بالعربية.\n",
  UK: "\nПРАВИЛО МОВИ: Відповідай українською.\n",
  RU: "\nПРАВИЛО ЯЗЫКА: Отвечай на русском.\n",
};

function getSystemPrompt(lang: string): string {
  const langRule = LANGUAGE_RULE[lang] || LANGUAGE_RULE.EN;
  return UNIFIED_LEXORA_IDENTITY + langRule + UNIFIED_CHAT_BEHAVIOR;
}

// Demo mode: Lexora avvocato digitale; può analizzare documenti caricati (OCR), raccogliere info, non generare documenti finali
const DEMO_ADDON = `

=== DEMO MODE (unauthenticated user) ===
Sei Lexora, avvocato digitale. Puoi analizzare documenti caricati dall'utente (lettere, multe, contratti) e raccogliere informazioni. Non generare il documento finale in demo, solo raccogliere info e invitare alla registrazione.

=== DOCUMENTI CARICATI (OBBLIGATORIO) ===
- I can analyze uploaded documents (contracts, letters, fines) via OCR to extract text and identify key information.
- Lexora PUÒ e DEVE analizzare i documenti che l'utente carica: contratti, lettere ufficiali, multe, diffide, ecc.
- Quando l'utente carica una foto o un file, il sistema estrae il testo (OCR) e te lo fornisce nel contesto. Tu DEVI:
  1. Leggere e analizzare il contenuto del documento
  2. Estrarre informazioni chiave: mittente, scadenze, importi, tipo di atto
  3. Identificare problemi legali rilevanti e rischi
  4. Rispondere in modo utile (riassunto, cosa fare, eventuali termini)
- Comportamento corretto: utente carica foto multa/contratto → Lexora la legge, estrae testo e analizza; utente scrive solo testo → Lexora lo usa per consiglio o per preparare documenti dopo registrazione.
- NON dire mai "non analizzo documenti" o "non posso leggere file". Lexora supporta l'analisi dei documenti caricati.

=== DEMO: RACCOLTA INFO E CTA ===
- You are in DEMO mode. Do NOT generate the actual downloadable document. Do NOT output [LETTER]...[/LETTER].
- Behave like Lexora: analizza i documenti se presenti; altrimenti fai 2-3 domande (tipo problema, controparte, date).
- After you have enough info (2-3 exchanges) or after analyzing an uploaded document, summarize and say something like:
  "Ho capito, si tratta di [brief summary]. Nella versione completa genererei un [tipo documento]. Per generare il documento ufficiale e scaricarlo, registrati gratis. Vuoi procedere? Lasciami la tua email per ricevere il documento quando ti registri!"
- Adapt the CTA to the user's language (IT/DE/EN/FR/ES etc.). Always end by inviting registration and asking for email.
- Never generate a full letter in demo. draftText must remain empty.`;

function getDemoSystemPrompt(lang: string): string {
  const langRule = LANGUAGE_RULE[lang] || LANGUAGE_RULE.EN;
  return UNIFIED_LEXORA_IDENTITY + langRule + DEMO_ADDON;
}

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as { message?: string; language?: string; isFirstMessage?: boolean; conversationHistory?: unknown[]; legalSearchContext?: unknown[]; isDemo?: boolean; uploadedDocumentText?: string };
    console.log("[trial-chat] body keys:", Object.keys(body ?? {}));
    console.log("[trial-chat] uploadedDocumentText length:", (body?.uploadedDocumentText ?? "").length);

    const { message, language = "EN", isFirstMessage = false, conversationHistory = [], legalSearchContext = [], isDemo = false, uploadedDocumentText } = body ?? {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return json(corsHeaders, 400, {
        ok: false,
        error: { code: "invalid_input", message: "Message is required" },
      });
    }

    // Limit message length for security
    const trimmedMessage = message.trim().slice(0, 4000);
    const langRaw = String(language ?? "EN").toUpperCase();
    const outLang = ["DE", "EN", "IT", "FR", "ES", "TR", "RO", "RU", "UK"].includes(langRaw) ? langRaw : "EN";
    const lang = normLang(language);
    
    // SCOPE GATE: Check if message is within allowed scope (bureaucratic/legal topics)
    const hasContext = Array.isArray(conversationHistory) && conversationHistory.length > 0;
    const isConfirmation = /^(ok|okay|sì|si|yes|ja|oui|d'accordo|einverstanden|procedi|proceed|fallo|mach das|do it|genera|generate|scrivi|schreibe|write)[\s.,!?]*$/i.test(trimmedMessage);
    
    if (!hasContext && !isConfirmation) {
      const scopeCheck = checkScope(trimmedMessage);
      if (!scopeCheck.inScope && scopeCheck.confidence !== 'low') {
        console.log(`[homepage-trial-chat] Scope rejected: ${scopeCheck.reason}`);
        const refusalMessage = getRefusalMessage(lang);
        return json(corsHeaders, 200, {
          ok: true,
          reply: refusalMessage,
          draftText: null,
          meta: { model: "scope-gate", blocked: true },
        });
      }
    }
    
    const systemPrompt = isDemo ? getDemoSystemPrompt(lang) : getSystemPrompt(lang);
    
    // Add greeting instruction ONLY for first message (skip in demo if we already have history with greeting)
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
        return json(corsHeaders, 200, {
          ok: true,
          reply: intelligentSearchResult.proposedAnswer + (intelligentSearchResult.sourcesSection || ''),
          draftText: null,
          meta: { model: "intelligent-search", confidence: intelligentSearchResult.confidence },
          webSources: intelligentSearchResult.results.slice(0, 3),
        });
      } else if (intelligentSearchResult.needsUserInput && !intelligentSearchResult.found) {
        // Low confidence - ask user for info, DON'T invent
        console.log(`[homepage-trial-chat] Low confidence (${intelligentSearchResult.confidence.toFixed(2)}) - asking user`);
        
        return json(corsHeaders, 200, {
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
    // CLIENT-PROVIDED LEGAL SEARCH CONTEXT (from webSearch.ts)
    // =====================
    const legalSources: SearchResult[] = Array.isArray(legalSearchContext) ? legalSearchContext.map((r: { title?: string; snippet?: string; link?: string; url?: string; date?: string }) => ({
      title: r.title ?? '',
      snippet: r.snippet ?? '',
      url: r.link ?? r.url ?? '',
    })).filter((r: SearchResult) => r.url) : [];
    if (legalSources.length > 0) {
      const sourcesBlock = legalSources.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nFonte: ${r.url}`).join('\n\n');
      webSearchContext += `\n\nFONTI UFFICIALI CONSULTATE (use to inform your answer, cite when relevant):\n${sourcesBlock}\n\n`;
      webSearchResults = [...webSearchResults, ...legalSources];
    }
    
    // =====================
    // DOCUMENT CONFIRMATION GATE (REAL LOGIC)
    // =====================
    // Check if previous message was a summary block awaiting confirmation
    const previousWasSummary = wasPreviousMessageSummary(conversationHistory);
    const userConfirmed = hasUserConfirmed(trimmedMessage);
    
    // If user confirmed after summary, allow document generation
    const allowDocumentGeneration = previousWasSummary && userConfirmed;
    
    // Add gate instruction to system prompt
    let gateInstruction = '';
    if (isDemo) {
      gateInstruction = `\n\nDemo: Do NOT generate [LETTER]...[/LETTER]. After collecting info, summarize and invite registration + ask for email.`;
    } else if (!allowDocumentGeneration) {
      gateInstruction = `\n\n=== DOCUMENT GENERATION GATE (ENFORCED BY SYSTEM) ===
CRITICAL: Before generating ANY final document/letter, you MUST:
1. First show a SUMMARY of all data you will use (sender, recipient, subject, etc.)
2. Ask for confirmation (any affirmative response like "yes", "ok", "confirm", "proceed", "go ahead" is valid)
3. ONLY after user confirms, generate the letter with [LETTER]...[/LETTER] tags

The user has NOT confirmed yet. Do NOT generate final letters yet.
If you have all the data, show a summary and ask for confirmation.`;
    } else {
      gateInstruction = `\n\n=== CONFIRMATION RECEIVED ===
User has confirmed. Proceed IMMEDIATELY to create the letter. Say something brief like "I will proceed to create the letter now." then generate it with [LETTER]...[/LETTER] tags.
DO NOT mention or correct any typos in the user's confirmation. DO NOT comment on how they confirmed. Just proceed directly.`;
      console.log(`[homepage-trial-chat] Document generation ALLOWED after confirmation`);
    }

    const langDirective = `OUTPUT LANGUAGE: ${outLang}. You MUST reply ONLY in ${outLang}. Do not switch languages.\n\n`;
    // Build messages array with conversation history for context
    const aiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
       { role: "system", content: langDirective + systemPrompt + greetingInstruction + gateInstruction + webSearchContext },
    ];
    
    // Add conversation history (limited to last 10 exchanges for token efficiency)
    const historyToUse = Array.isArray(conversationHistory) 
      ? conversationHistory.slice(-20) // Last 20 messages (10 exchanges)
      : [];
    
    for (const msg of historyToUse) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({
          role: msg.role as "user" | "assistant",
          content: String(msg.content || '').slice(0, 4000),
        });
      }
    }

    const docText = typeof uploadedDocumentText === "string" ? uploadedDocumentText.trim() : "";
    if (docText.length > 0) {
      aiMessages.push({
        role: "user",
        content: `[Documento caricato - testo estratto (OCR)]:\n\n${docText.slice(0, 12000)}`,
      });
    }

    const hasOcr =
      typeof uploadedDocumentText === "string" &&
      uploadedDocumentText.trim().length > 0;
    const formatBlock = `
FORMAT REQUIRED:
Return TWO sections exactly:
[ANALYSIS]
...short analysis + next steps...
[/ANALYSIS]
[DRAFT]
...a formal reply letter only (no analysis), with placeholders...
[/DRAFT]

DRAFT REQUIREMENTS:
- Use placeholders: [Your full name], [Your address], [Date], [Court/Authority address], [Reference/Az.], [Other party]
- Formal tone
- Subject line
- Short, clear paragraphs
- No analysis inside DRAFT
`;
    const currentUserContent = hasOcr
      ? `[Istruzione: analizza il documento già fornito sopra. Estrai informazioni chiave, indica rischi e prossimi passi, proponi una bozza di risposta (anche se mancano dettagli). Non fare domande di contesto generiche; chiedi eventuali chiarimenti solo DOPO aver presentato l'analisi.]\n\n${trimmedMessage}${formatBlock}`
      : trimmedMessage;
    aiMessages.push({ role: "user", content: currentUserContent });

    console.log(
      "[trial-chat] messages summary:",
      aiMessages.map(m => ({
        role: m.role,
        length: typeof m.content === "string" ? m.content.length : 0
      }))
    );

    // Use OpenAI API directly (no Lovable credits)
    const aiResult = await callOpenAI({
      messages: aiMessages,
      model: "gpt-4.1-mini",
      temperature: 0.7,
    });

    if (!aiResult.ok) {
      console.error("[homepage-trial-chat] OpenAI error:", aiResult.error);
      
      if (aiResult.status === 429) {
        return json(corsHeaders, 429, {
          ok: false,
          error: { code: "rate_limited", message: "Too many requests" },
        });
      }

      return json(corsHeaders, 500, {
        ok: false,
        error: { code: "AI_PROVIDER_ERROR", message: "AI temporarily unavailable" },
      });
    }

    const responseText = aiResult.content || "";

    let finalReply: string;
    let finalDraft: string | null;
    let placeholderBlocked = false;

    if (hasOcr) {
      const full = (responseText ?? "").toString();
      const analysisMatch = full.match(/\[ANALYSIS\]([\s\S]*?)\[\/ANALYSIS\]/i);
      const draftMatch = full.match(/\[DRAFT\]([\s\S]*?)\[\/DRAFT\]/i);
      const analysisText = (analysisMatch?.[1] ?? "").trim();
      const draftOnly = (draftMatch?.[1] ?? "").trim();
      finalReply = analysisText.length > 0 ? analysisText : full.trim();
      finalDraft = draftOnly.length > 0 ? draftOnly : null;
    } else {
      // Extract letter using [LETTER]...[/LETTER] markers (primary) with pattern fallback
      let draftText = extractLetterFromResponse(responseText);
      finalReply = responseText;
      finalDraft = draftText;

      // =====================
      // PLACEHOLDER HARD-STOP (same as dashboard-chat)
      // =====================
      // If the model returns bracket placeholders, REJECT the draft and ask for missing data
      // IMPORTANT: Exclude system markers like [LETTER], [/LETTER] from detection
      const SYSTEM_MARKERS = new Set(["[LETTER]", "[/LETTER]", "[BRIEF]", "[/BRIEF]", "[LETTRE]", "[/LETTRE]", "[CARTA]", "[/CARTA]"]);
    
    const containsPlaceholders = (text: string): boolean => {
      if (!text) return false;
      const matches = text.match(/\[[^\]]+\]/g) || [];
      // Filter out system markers
      const realPlaceholders = matches.filter(m => !SYSTEM_MARKERS.has(m.toUpperCase()));
      return realPlaceholders.length > 0;
    };

    const extractPlaceholders = (text: string, max = 5): string[] => {
      if (!text) return [];
      const matches = text.match(/\[[^\]]+\]/g) || [];
      // Filter out system markers
      const realPlaceholders = matches.filter(m => !SYSTEM_MARKERS.has(m.toUpperCase()));
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

      placeholderBlocked = containsPlaceholders(responseText) || containsPlaceholders(draftText || "");
      
      if (placeholderBlocked) {
        finalDraft = null;
        const langKey = (language || "EN").toUpperCase();
        const intro = PLACEHOLDER_BLOCK_MESSAGES[langKey] || PLACEHOLDER_BLOCK_MESSAGES.EN;
        const placeholders = extractPlaceholders(responseText, 5);
        const bullets = placeholders.map((p) => `• ${p}`).join("\n");
        finalReply = `${intro}\n${bullets}`;
        console.log(`[homepage-trial-chat] PLACEHOLDER BLOCKED: ${placeholders.join(", ")}`);
      }
    }

    // WEB ASSIST: Append sources section if web search was performed
    if (webSearchResults.length > 0 && !placeholderBlocked) {
      const sourcesSection = formatSourcesSection(webSearchResults, lang);
      finalReply = finalReply + sourcesSection;
    }

    return json(corsHeaders, 200, {
      ok: true,
      reply: finalReply,
      draftText: finalDraft,
      meta: { model: "gpt-4.1-mini" },
      webSources: webSearchResults.length > 0 ? webSearchResults : undefined,
    });

  } catch (error) {
    console.error("[homepage-trial-chat] Unhandled error:", error);
    const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
    return json(corsHeaders, 500, {
      ok: false,
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
});
