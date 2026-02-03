import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenAI } from "../_shared/openai.ts";
import { getIntakeModeRules, DOCUMENT_TYPE_DETECTION } from "../_shared/intakePromptRules.ts";
import { normLang } from "../_shared/lang.ts";
import { checkScope, getRefusalMessage } from "../_shared/scopeGate.ts";
import { webSearch, formatSourcesSection, type SearchResult } from "../_shared/webAssist.ts";
import { intelligentSearch, detectSearchIntent, detectInfoRequest } from "../_shared/intelligentSearch.ts";
import { hasUserConfirmed, isDocumentGenerationAttempt, buildSummaryBlock, extractDocumentData, wasPreviousMessageSummary, type DocumentData } from "../_shared/documentGate.ts";
import { UNIFIED_LEXORA_IDENTITY } from "../_shared/lexoraSystemPrompt.ts";

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

// Whitelist of system markers that should NOT be treated as placeholders
const PLACEHOLDER_WHITELIST = [
  '[LETTER]', '[/LETTER]', '[BRIEF]', '[/BRIEF]', 
  '[LETTERA]', '[/LETTERA]', '[DOCUMENT]', '[/DOCUMENT]'
];

// Check for forbidden placeholders in AI output
function containsForbiddenPlaceholders(text: string): { hasForbidden: boolean; found: string[] } {
  // Pattern to match bracketed placeholders like [Nome], [Data], [CAP], [Luogo], etc.
  const placeholderPattern = /\[([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{0,30})\]/g;
  const matches = text.match(placeholderPattern) || [];
  
  // Filter out whitelisted markers
  const forbidden = matches.filter(m => 
    !PLACEHOLDER_WHITELIST.some(w => w.toLowerCase() === m.toLowerCase())
  );
  
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

    const { userMessage, letterText, draftResponse, praticaData, chatHistory, userLanguage, mode = "chat", praticaId, legalSearchContext = [] } = await req.json();

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
    
    const intakeModeRules = getIntakeModeRules(langCode);

    const lexoraMasterRules = `${UNIFIED_LEXORA_IDENTITY}

=== LINGUA ===
Rispondi nella lingua corrente dell'interfaccia utente: ${outputLanguage}. Nessuna eccezione.

⚠️ CONTESTO ISOLATO - REGOLA CRITICA ⚠️
- Questa conversazione riguarda SOLO la pratica corrente.
- NON fare riferimento a nomi, scuole, datori di lavoro o dettagli di altre pratiche.
- Ogni pratica/fascicolo è completamente indipendente.

=== AMBITO AMMESSO (SEMPRE ACCETTARE) ===
✔️ Lettere a scuole, asili, università, datori di lavoro, proprietari, aziende, uffici pubblici, banche, assicurazioni.
✔️ Qualsiasi comunicazione formale o semi-formale scritta. MAI rifiutare questi tipi di richieste.

${intakeModeRules}

${DOCUMENT_TYPE_DETECTION}

LIMITI: Non rappresenti l'utente in tribunale. Puoi rifiutare SOLO: intrattenimento, ricette, argomenti estranei a documenti.

⛔ PLACEHOLDER VIETATI: NON usare MAI placeholder tra parentesi quadre. Se mancano informazioni: CHIEDI all'utente.

FORMATO OUTPUT (SOLO DOPO CONFERMA): Output SOLO testo lettera. NO spiegazioni, NO meta-commenti.
Struttura: Mittente → Destinatario → Luogo+Data → Oggetto → Corpo → Chiusura → Firma.`;

    let systemPrompt: string;
    
    if (mode === "modify") {
      // CRITICAL: In modify mode, only use data from THIS pratica
      systemPrompt = `${lexoraMasterRules}

═══════════════════════════════════════════════════════════════════════════
MODE: DRAFT MODIFICATION (CONTEXT-ISOLATED)
═══════════════════════════════════════════════════════════════════════════

⚠️ IMPORTANTE: Questa è la pratica con ID: ${praticaId || 'unknown'}
Usa SOLO le informazioni fornite qui sotto. Non inventare dettagli.

BOZZA ATTUALE:
${draftResponse || "Nessuna bozza disponibile."}

DOCUMENTO ORIGINALE (se presente):
${letterText || "Nessun documento originale disponibile."}

DATI PRATICA CORRENTE:
- Titolo: ${praticaData?.title || "N/A"}
- Autorità/Destinatario: ${praticaData?.authority || "N/A"}
- Riferimento: ${praticaData?.aktenzeichen || "N/A"}
- Scadenza: ${praticaData?.deadline || "N/A"}

DEVI:
✔️ Modificare la bozza come richiesto dall'utente
✔️ Migliorare forma linguistica, tono, chiarezza
✔️ Aggiungere contenuti, espandere sezioni, rafforzare argomenti
✔️ Correggere grammatica, ortografia, struttura
✔️ Se mancano dati specifici (nome, data, indirizzo), CHIEDI all'utente
✔️ Spiegare le implicazioni legali delle modifiche quando rilevante (es. "Attenzione: rimuovendo questa clausola perdi la protezione X")

⛔ NON DEVI:
- Usare placeholder come [Nome], [Data], [CAP]
- Inventare nomi, date o indirizzi non forniti
- Fare riferimento a pratiche o casi precedenti

OUTPUT CRITICO:
- Restituisci SOLO la lettera modificata, pronta per stampa.
- NIENTE spiegazioni, commenti, "---LETTERA---", "fine lettera".
- La lettera deve iniziare direttamente con l'intestazione formale.
- Mantieni formato DIN 5008 / lettera formale standard.`;
    } else {
      systemPrompt = `${lexoraMasterRules}

═══════════════════════════════════════════════════════════════════════════
MODE: DOCUMENT ASSISTANCE & LEGAL HELP (CONTEXT-ISOLATED)
═══════════════════════════════════════════════════════════════════════════

⚠️ IMPORTANTE: Questa è la pratica con ID: ${praticaId || 'unknown'}
Usa SOLO le informazioni fornite qui sotto.

ORIGINAL DOCUMENT:
${letterText || "No document available."}

CURRENT DRAFT (if any):
${draftResponse || "No draft generated yet."}

CASE DATA:
- Title: ${praticaData?.title || "N/A"}
- Authority: ${praticaData?.authority || "N/A"}
- Reference: ${praticaData?.aktenzeichen || "N/A"}
- Deadline: ${praticaData?.deadline || "N/A"}

YOU MUST:
✔️ Help the user understand the document fully
✔️ Answer all questions about its meaning and implications
✔️ Explain legal terms in accessible language
✔️ Clarify rights, obligations, deadlines, consequences
✔️ Provide substantive guidance on how to proceed
✔️ If asked, help draft or modify response letters
✔️ If missing specific data (names, dates), ASK the user - do NOT use placeholders

You may add a brief note like: "For complex litigation, consider consulting a lawyer."
But NEVER refuse to answer or replace your response with this note.`;
    }

    // Build messages array
    const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // CRITICAL: Only include chatHistory from THIS pratica, limit to recent messages
    // Filter out any potentially stale or cross-contaminated data
    const recentHistory = (chatHistory || []).slice(-8); // Reduce from 10 to 8 for tighter context
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

    // CLIENT-PROVIDED LEGAL SEARCH CONTEXT (from webSearch.ts)
    const legalSources: SearchResult[] = Array.isArray(legalSearchContext) ? legalSearchContext.map((r: { title?: string; snippet?: string; link?: string; url?: string; date?: string }) => ({
      title: r.title ?? '',
      snippet: r.snippet ?? '',
      url: r.link ?? r.url ?? '',
    })).filter((r: SearchResult) => r.url) : [];
    if (legalSources.length > 0) {
      const sourcesBlock = legalSources.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nFonte: ${r.url}`).join('\n\n');
      openaiMessages[0].content += `\n\nFONTI UFFICIALI CONSULTATE (use to inform your answer, cite when relevant):\n${sourcesBlock}\n\n`;
      webSearchResults = [...webSearchResults, ...legalSources];
    }

    // Use OpenAI API directly
    const aiResult = await callOpenAI({
      messages: openaiMessages,
      model: "gpt-4.1-mini",
      temperature: 0.3,
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

    // WEB ASSIST: Append sources section if web search or legal search was performed
    if (webSearchResults.length > 0) {
      content += formatSourcesSection(webSearchResults, langCode);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLACEHOLDER HARD-STOP: Block responses with forbidden placeholders
    // ═══════════════════════════════════════════════════════════════════════
    const placeholderCheck = containsForbiddenPlaceholders(content);
    if (placeholderCheck.hasForbidden && mode === "modify") {
      console.log(`[CHAT-AI] BLOCKED: Response contains forbidden placeholders:`, placeholderCheck.found);
      
      // Instead of returning the draft, ask for missing information
      const missingDataPrompt = langCode === 'DE' 
        ? `Ich benötige noch einige Informationen, um die Bozza zu vervollständigen. Bitte geben Sie folgende Daten an: ${placeholderCheck.found.join(', ')}`
        : langCode === 'IT'
        ? `Ho bisogno di alcune informazioni per completare la bozza. Per favore fornisci i seguenti dati: ${placeholderCheck.found.join(', ')}`
        : `I need some information to complete the draft. Please provide the following: ${placeholderCheck.found.join(', ')}`;
      
      return new Response(
        JSON.stringify({ 
          response: missingDataPrompt,
          contains_modified_draft: false,
          placeholder_blocked: true,
          blocked_placeholders: placeholderCheck.found
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
