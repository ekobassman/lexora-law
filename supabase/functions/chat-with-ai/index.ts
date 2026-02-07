import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenAI } from "../_shared/openai.ts";
import { normLang } from "../_shared/lang.ts";
import { checkScope, getRefusalMessage } from "../_shared/scopeGate.ts";
import { webSearch, formatSourcesSection, type SearchResult } from "../_shared/webAssist.ts";
import { intelligentSearch, detectSearchIntent, detectInfoRequest } from "../_shared/intelligentSearch.ts";
import { hasUserConfirmed, isDocumentGenerationAttempt, buildSummaryBlock, extractDocumentData, wasPreviousMessageSummary, type DocumentData } from "../_shared/documentGate.ts";
import { POLICY_EDIT_MODIFY, POLICY_DOCUMENT_CHAT } from "../_shared/lexoraChatPolicy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const BLOCKED_COUNTRIES = ['RU', 'CN'];

// Whitelist of system markers and SIGNATURE (never ask for signature – client signs on printed doc)
const PLACEHOLDER_WHITELIST = [
  '[LETTER]', '[/LETTER]', '[BRIEF]', '[/BRIEF]', 
  '[LETTERA]', '[/LETTERA]', '[DOCUMENT]', '[/DOCUMENT]',
  '[SIGNATURE]', '[FIRMA]', '[UNTERSCHRIFT]', '[FIRMA DEL MITTENTE]',
];

// Check for forbidden placeholders in AI output
function containsForbiddenPlaceholders(text: string): { hasForbidden: boolean; found: string[] } {
  // Pattern to match bracketed placeholders like [Nome], [Data], [CAP], [Luogo], etc.
  const placeholderPattern = /\[([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{0,30})\]/g;
  const matches = text.match(placeholderPattern) || [];
  
  // Filter out whitelisted markers and any signature-related (never ask user for signature)
  const forbidden = matches.filter(m => {
    const lower = m.toLowerCase().trim();
    if (PLACEHOLDER_WHITELIST.some(w => w.toLowerCase() === lower)) return false;
    if (/^\[(signature|firma|unterschrift|signatura|parafa)\s*\]$/.test(lower)) return false;
    if (/^\[.*(firma|signature|unterschrift).*\]$/.test(lower)) return false;
    return true;
  });
  
  return {
    hasForbidden: forbidden.length > 0,
    found: forbidden
  };
}

// Check if request is from a blocked jurisdiction (FAIL-OPEN for dev/preview)
function checkGeoBlock(req: Request): { blocked: boolean; countryCode: string | null; reason: string } {
  const countryCode = req.headers.get('cf-ipcountry') 
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-country')
    || req.headers.get('fly-client-country');
  
  // FAIL-OPEN: Allow if no country header (dev/preview environment)
  if (!countryCode) {
    return { blocked: false, countryCode: null, reason: 'NO_GEO_HEADER' };
  }
  
  const normalized = countryCode.toUpperCase();
  
  if (BLOCKED_COUNTRIES.includes(normalized)) {
    return { blocked: true, countryCode: normalized, reason: 'JURISDICTION_BLOCKED' };
  }
  
  return { blocked: false, countryCode: normalized, reason: 'OK' };
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

// ═══════════════════════════════════════════════════════════════════════════
// LEXORA MASTER PROMPT - FULL LEGAL-TECH CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      console.log('[chat-with-ai] Jurisdiction blocked:', geoCheck.countryCode, geoCheck.reason);
      return new Response(
        JSON.stringify({ code: geoCheck.reason, countryCode: geoCheck.countryCode || 'unknown' }),
        { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userMessage, letterText, draftResponse, praticaData, chatHistory, userLanguage, mode = "chat", praticaId } = await req.json();

    if (!userMessage || userMessage.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No message provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Always use UI language - no auto-detection
    const langCode = (userLanguage || "DE").toUpperCase();
    const outputLanguage = LANGUAGE_MAP[langCode] || "German";
    
    console.log(`[CHAT-AI] Mode: ${mode}, user: ${user.id}, pratica: ${praticaId || 'N/A'}, language: ${outputLanguage}`);

    // ═══════════════════════════════════════════════════════════════════════
    // CONTEXT ISOLATION: Each pratica/case gets fresh context
    // ═══════════════════════════════════════════════════════════════════════
    // CRITICAL: Only use chatHistory from this specific pratica
    // Do NOT let information from other pratiche leak into this conversation
    
    const letterSnippet = (letterText || "").trim().slice(0, 8000);
    const hasLetterContext = letterSnippet.length > 0;

    // WEB SEARCH (Perplexity): se c'è contesto lettera, cerca normativa/sentenze 2026 prima della risposta
    let webData = "";
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (hasLetterContext && perplexityKey) {
      try {
        const searchResponse = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${perplexityKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-sonar-small-128k-online",
            messages: [
              { role: "user", content: `LEGGE ITALIANA 2026: normativa e sentenze aggiornate su: "${letterSnippet.slice(0, 3000)}". Cita articoli CdS, Cassazione, Gazzetta Ufficiale, gov.it.` },
            ],
            max_tokens: 2000,
          }),
        });
        if (searchResponse.ok) {
          const searchJson = await searchResponse.json();
          const searchContent = searchJson?.choices?.[0]?.message?.content;
          if (searchContent) {
            webData = searchContent;
            console.log("[CHAT-AI] Perplexity web search OK, injected into context");
          }
        }
      } catch (e) {
        console.warn("[CHAT-AI] Perplexity search failed:", e);
      }
    }

    const policyBlock = mode === "modify" ? POLICY_EDIT_MODIFY : POLICY_DOCUMENT_CHAT;
    const modeInstruction = mode === "modify"
      ? `\n\nMODIFY MODE: The user asked to change the draft. You have letter text, current draft, and case data above. Apply the requested modification DIRECTLY. Use smart defaults: authority address → standard; signature → typed name or "________________" (NEVER ask user for signature); date → current date; tone → formal. NEVER ask "can you provide...", "please confirm...", or for signature/firma. Return the modified draft text (formal letter only). Do not use [placeholder] brackets; use real values or standard defaults. Language: ${outputLanguage}.`
      : `\n\nDOCUMENT CHAT: Propose actions and answers based on the case. Do not ask for data already in the context. NEVER ask for signature (firma/signature/Unterschrift). Language: ${outputLanguage}.`;

    const systemPromptBase = `You are Lexora, a precise legal assistant. For every legal question: analyze OCR, cite norms and deadlines, search for updated data when needed, then respond with clear strategy and draft when relevant.

Lingua risposta: ${outputLanguage}.`;

    const contextBlock = `
=== CONTESTO PRATICA ===
PRATICA ID: ${praticaId || "N/A"}
Titolo: ${praticaData?.title || "N/A"}
Autorità: ${praticaData?.authority || "N/A"}
Riferimento: ${praticaData?.aktenzeichen || "N/A"}
Scadenza: ${praticaData?.deadline || "N/A"}

DOCUMENTO ORIGINALE (OCR) – FONTE UNICA DI VERITÀ – GIÀ IN TUO POSSESSO:
Le informazioni stanno in questo documento; usalo come fonte primaria. Non chiedere all'utente dove trovarle.
${letterSnippet || "Nessun documento."}

REGOLA CRITICA (tutte le lingue): Non chiedere MAI all'utente dati che compaiono nel DOCUMENTO sopra (destinatario, riferimento, scadenza, nomi, date, numeri, indirizzi). Non chiedere MAI la firma (signature/firma/Unterschrift): il cliente firma su carta dopo la stampa; nella bozza usa nome a stampa o "________________". Usali direttamente. Chiedi SOLO informazioni AGGIUNTIVE non presenti nella lettera, oppure cerca sul web.

BOZZA ATTUALE:
${(draftResponse || "").trim().slice(0, 4000) || "Nessuna bozza."}
${webData ? `\n\n📌 DATI WEB AGGIORNATI (normativa/sentenze):\n${webData}\n\nUsa questi dati per citare articoli e sentenze.` : ""}`;

    let systemPrompt = policyBlock + modeInstruction + "\n\n" + systemPromptBase + contextBlock;
    const isFirstMessage = mode !== "modify" && (!chatHistory || chatHistory.length === 0);
    if (isFirstMessage) {
      const greeting = LEXORA_FIRST_GREETING[langCode] || LEXORA_FIRST_GREETING.EN;
      systemPrompt += `\n\n=== PRIMO MESSAGGIO (presentazione LEXORA) ===
Start your response with this professional presentation: "${greeting}" Then offer help. Be friendly, professional. NEVER start with negative phrases ("I didn't find", "please provide").`;
    }

    // Build messages array
    const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];
    if (letterSnippet.length > 0) {
      openaiMessages.push({
        role: "user",
        content: `TESTO LETTERA (OCR):\n"""\n${letterSnippet}\n"""`,
      });
    }
    const recentHistory = (chatHistory || []).slice(-8);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        // Clean any system markers from history
        const cleanContent = msg.content
          .replace(/\[LETTER\]/gi, '')
          .replace(/\[\/LETTER\]/gi, '')
          .trim();
        openaiMessages.push({ role: msg.role, content: cleanContent });
      }
    }

    // Add current user message
    openaiMessages.push({ role: "user", content: userMessage });

    console.log(`[CHAT-AI] Sending ${openaiMessages.length} messages for user: ${user.id}, pratica: ${praticaId}`);

    // SCOPE GATE: Check if message is within allowed scope
    const lang = normLang(langCode);
    const hasContext = chatHistory && chatHistory.length > 0;
    const isConfirmation = /^(ok|okay|sì|si|yes|ja|oui|d'accordo|einverstanden|procedi|proceed|fallo|mach das|do it|genera|generate|scrivi|schreibe|write)[\s.,!?]*$/i.test(userMessage.trim());
    
    if (!hasContext && !isConfirmation && mode !== "modify") {
      const scopeCheck = checkScope(userMessage);
      if (!scopeCheck.inScope && scopeCheck.confidence !== 'low') {
        console.log(`[CHAT-AI] Scope rejected: ${scopeCheck.reason}`);
        const refusalMessage = getRefusalMessage(lang);
        return new Response(
          JSON.stringify({ 
            response: refusalMessage,
            contains_modified_draft: false,
            scope_blocked: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // WEB ASSIST: Detect if user is asking for external info (reduced false positives)
    const wantsContactInfo = /\b(indirizzo|adresse|address|orario|orari|öffnungszeit|opening\s+hours|telefono|telefon|phone|email|kontakt|contatto|contact)\b/i.test(userMessage);
    const mentionsOffice = /\b(finanzamt|jobcenter|arbeitsagentur|ausländerbehörde|bürgeramt|standesamt|einwohnermeldeamt|zulassungsstelle|kfz|zoll)\b/i.test(userMessage);
    const needsWebSearch = wantsContactInfo || (mentionsOffice && /\b(modulo|formular|antrag|download|scarica|herunterladen|termin|appointment|procedure|procedura|verfahren)\b/i.test(userMessage));
    let webSearchResults: SearchResult[] = [];
    
    if (needsWebSearch) {
      console.log(`[CHAT-AI] Web search triggered`);
      const searchResult = await webSearch(userMessage.slice(0, 150), 3);
      
      if (searchResult.ok && searchResult.results.length > 0) {
        webSearchResults = searchResult.results;
        const resultsText = webSearchResults.map((r, i) => 
          `[${i+1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`
        ).join('\n\n');
        openaiMessages[0].content += `\n\n📌 WEB SEARCH RESULTS:\n${resultsText}\n\nCite sources when providing addresses/contacts.`;
      }
    }

    // Use OpenAI API directly (precise legal answers)
    const aiResult = await callOpenAI({
      messages: openaiMessages,
      model: "gpt-4o",
      temperature: 0.05,
    });

    if (!aiResult.ok) {
      console.error("[CHAT-AI] OpenAI error:", aiResult.error);
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

    let content = aiResult.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // WEB ASSIST: Append sources section if web search was performed
    if (webSearchResults.length > 0) {
      content += formatSourcesSection(webSearchResults, langCode);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFY MODE: Never ask user for placeholders; apply defaults and return
    // ═══════════════════════════════════════════════════════════════════════
    const placeholderCheck = containsForbiddenPlaceholders(content);
    if (placeholderCheck.hasForbidden && mode === "modify") {
      console.log(`[CHAT-AI] Modify mode: replacing placeholders with defaults:`, placeholderCheck.found);
      const today = new Date().toISOString().slice(0, 10);
      let cleaned = content;
      const defaults: Record<string, string> = {
        "[Data]": today, "[DATA]": today, "[Date]": today, "[Datum]": today,
        "[Ort]": "—", "[Luogo]": "—", "[Place]": "—", "[Stadt]": "—",
        "[Name]": "—", "[Nome]": "—", "[Vorname]": "—", "[Nachname]": "—",
        "[Signature]": "________________", "[Firma]": "________________", "[Unterschrift]": "________________",
      };
      for (const [ph, value] of Object.entries(defaults)) {
        cleaned = cleaned.replace(new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), value);
      }
      // Any remaining [.*signature.*] / [.*firma.*] → line (never ask user for signature)
      cleaned = cleaned.replace(/\s*\[[^\]]*(?:signature|firma|unterschrift)[^\]]*\]\s*/gi, "\n________________\n");
      const appliedNote = langCode === "DE"
        ? "Ich habe Ihre Änderungen übernommen und Standardangaben verwendet, wo nötig.\n\n"
        : langCode === "IT"
        ? "Ho applicato le modifiche e usato dati standard dove necessario.\n\n"
        : "I applied your changes and used standard defaults where needed.\n\n";
      content = appliedNote + cleaned;
    }

    // Check if response contains a modified draft (for apply functionality)
    const containsModifiedDraft = mode === "modify" && (
      content.includes("Sehr geehrte") || 
      content.includes("Gentile") ||
      content.includes("Dear") ||
      content.includes("Estimado") ||
      content.includes("Cher")
    );

    console.log(`[CHAT-AI] Response received for user: ${user.id}, contains draft: ${containsModifiedDraft}`);

    return new Response(
      JSON.stringify({ 
        response: content,
        contains_modified_draft: containsModifiedDraft,
        requires_confirmation: content.toLowerCase().includes("substantial modification") || 
                               content.toLowerCase().includes("wesentliche änderung") ||
                               content.toLowerCase().includes("modifica sostanziale")
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("chat-with-ai error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
