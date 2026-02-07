import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenAI } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lexora-law.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_COUNTRIES = ['RU', 'CN'];

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
// LEGAL TEMPLATES - Locked structure, AI can only fill fields
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATE_TYPES = [
  'DSGVO_AUSKUNFT',
  'DSGVO_LOESCHUNG', 
  'FORDERUNG_BESTREITUNG',
  'ERINNERUNG_FRIST',
  'ANTWORT_BEHOERDE',
  'WIDERSPRUCH_BESCHEID',
  'STELLUNGNAHME',
];

// ═══════════════════════════════════════════════════════════════════════════
// DETERMINISTIC VALIDATORS (Non-AI, server-side)
// ═══════════════════════════════════════════════════════════════════════════

// Allowlist of valid legal references by domain
const LEGAL_ALLOWLIST: Record<string, string[]> = {
  DSGVO: ['Art. 12', 'Art. 13', 'Art. 14', 'Art. 15', 'Art. 16', 'Art. 17', 'Art. 18', 'Art. 19', 'Art. 20', 'Art. 21', 'Art. 22', 'Art. 77', 'Art. 79', 'DSGVO', 'GDPR', 'DS-GVO'],
  BGB: ['§ 126', '§ 127', '§ 130', '§ 133', '§ 145', '§ 157', '§ 194', '§ 195', '§ 199', '§ 241', '§ 249', '§ 280', '§ 286', '§ 305', '§ 307', '§ 312', '§ 355', '§ 357', '§ 433', '§ 434', '§ 437', '§ 611', '§ 626', '§ 812', '§ 823', '§ 985', 'BGB'],
  VwGO: ['§ 40', '§ 42', '§ 68', '§ 69', '§ 70', '§ 73', '§ 74', '§ 80', '§ 113', 'VwGO'],
  VwVfG: ['§ 28', '§ 35', '§ 37', '§ 39', '§ 41', '§ 43', '§ 44', '§ 45', '§ 48', '§ 49', '§ 51', '§ 70', '§ 71', 'VwVfG'],
  SGB: ['SGB I', 'SGB II', 'SGB III', 'SGB IV', 'SGB V', 'SGB VI', 'SGB VII', 'SGB VIII', 'SGB IX', 'SGB X', 'SGB XI', 'SGB XII'],
  StVO: ['§ 1', '§ 2', '§ 3', '§ 4', '§ 21', '§ 23', '§ 24', '§ 49', 'StVO', 'OWiG', '§ 55 OWiG', '§ 67 OWiG'],
  ZPO: ['§ 78', '§ 91', '§ 130', '§ 253', '§ 256', '§ 495', '§ 511', '§ 517', '§ 519', '§ 520', 'ZPO'],
  GG: ['Art. 1', 'Art. 2', 'Art. 3', 'Art. 5', 'Art. 10', 'Art. 14', 'Art. 19', 'Art. 20', 'GG', 'Grundgesetz'],
  EU: ['Verordnung', 'Richtlinie', 'EU 2016/679', 'EU-DSGVO'],
};

// Flatten all allowed laws for quick lookup
const ALL_ALLOWED_LAWS = Object.values(LEGAL_ALLOWLIST).flat();

// Forbidden phrases by language
const FORBIDDEN_PHRASES: Record<string, string[]> = {
  DE: [
    'ich rate Ihnen', 'mein Rat wäre', 'Sie sollten vielleicht', 'vielleicht könnten Sie',
    'als Ihr Anwalt', 'rechtlich gesehen empfehle ich', 'ich empfehle dringend',
    'ich garantiere', 'das wird funktionieren', 'Sie werden gewinnen',
    'machen Sie sich keine Sorgen', 'das ist kein Problem', 'ist völlig sicher',
    'vertrauen Sie mir', '100% sicher', 'garantiert erfolgreich'
  ],
  EN: [
    'I advise you', 'my advice would be', 'you should perhaps', 'perhaps you could',
    'as your lawyer', 'legally speaking I recommend', 'I strongly recommend',
    'I guarantee', 'this will work', 'you will win',
    'don\'t worry', 'that\'s no problem', 'is completely safe',
    'trust me', '100% certain', 'guaranteed success'
  ],
  IT: [
    'ti consiglio', 'il mio consiglio sarebbe', 'forse dovresti', 'forse potresti',
    'come tuo avvocato', 'legalmente ti raccomando', 'raccomando vivamente',
    'garantisco', 'funzionerà', 'vincerai',
    'non preoccuparti', 'non è un problema', 'è completamente sicuro',
    'fidati di me', '100% sicuro', 'successo garantito'
  ],
  FR: [
    'je vous conseille', 'mon conseil serait', 'vous devriez peut-être', 'peut-être pourriez-vous',
    'en tant que votre avocat', 'juridiquement je recommande', 'je recommande vivement',
    'je garantis', 'ça va marcher', 'vous allez gagner',
    'ne vous inquiétez pas', 'ce n\'est pas un problème', 'c\'est complètement sûr',
    'faites-moi confiance', '100% certain', 'succès garanti'
  ],
  ES: [
    'le aconsejo', 'mi consejo sería', 'quizás debería', 'tal vez podría',
    'como su abogado', 'legalmente recomiendo', 'recomiendo encarecidamente',
    'garantizo', 'esto funcionará', 'usted ganará',
    'no se preocupe', 'no es problema', 'es completamente seguro',
    'confíe en mí', '100% seguro', 'éxito garantizado'
  ],
};

// Get forbidden phrases for a language (with fallback to DE + EN)
function getForbiddenPhrases(langCode: string): string[] {
  const code = langCode.toUpperCase();
  const phrases = FORBIDDEN_PHRASES[code] || [];
  // Always include DE and EN as baseline
  return [...new Set([...phrases, ...FORBIDDEN_PHRASES.DE, ...FORBIDDEN_PHRASES.EN])];
}

// VALIDATOR 1: Check for invented laws
function validateNoInventedLaws(draftText: string, legalBasisCited: string | null): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!draftText) return { passed: true, warnings: [] };
  
  // Extract all law references from draft (patterns like "§ 123", "Art. 12", law names)
  const lawPatterns = [
    /§\s*\d+[a-z]?(?:\s+Abs\.\s*\d+)?(?:\s+(?:BGB|StGB|ZPO|VwGO|VwVfG|SGB|StVO|OWiG|GG|AO|HGB|GmbHG|AktG|InsO|UrhG|MarkenG|PatG|UWG|GWB))?/gi,
    /Art\.\s*\d+(?:\s+Abs\.\s*\d+)?(?:\s+(?:GG|DSGVO|GDPR|EU|EMRK))?/gi,
    /(?:DSGVO|GDPR|DS-GVO|BGB|StGB|ZPO|VwGO|VwVfG|SGB\s*[IVX]+|StVO|OWiG|GG|AO|HGB)/gi,
  ];
  
  const foundRefs: string[] = [];
  for (const pattern of lawPatterns) {
    const matches = draftText.match(pattern) || [];
    foundRefs.push(...matches);
  }
  
  // Check if found references are in allowlist
  for (const ref of foundRefs) {
    const normalized = ref.trim().replace(/\s+/g, ' ');
    const isAllowed = ALL_ALLOWED_LAWS.some(allowed => 
      normalized.toLowerCase().includes(allowed.toLowerCase()) || 
      allowed.toLowerCase().includes(normalized.toLowerCase())
    );
    
    if (!isAllowed) {
      // Not necessarily invented, but flag for review
      warnings.push(`Unverified legal reference: ${normalized}`);
    }
  }
  
  return { 
    passed: warnings.length === 0, 
    warnings 
  };
}

// VALIDATOR 2: Check for forbidden phrases
function validateNoForbiddenPhrases(draftText: string, langCode: string): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!draftText) return { passed: true, warnings: [] };
  
  const forbidden = getForbiddenPhrases(langCode);
  const lowerText = draftText.toLowerCase();
  
  for (const phrase of forbidden) {
    if (lowerText.includes(phrase.toLowerCase())) {
      warnings.push(`Forbidden phrase detected: "${phrase}"`);
    }
  }
  
  return { 
    passed: warnings.length === 0, 
    warnings 
  };
}

// VALIDATOR 3: Check minimum structure (DIN-like)
function validateStructureMinimum(draftText: string): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!draftText || draftText.length < 100) {
    warnings.push('Draft is too short to be a valid letter');
    return { passed: false, warnings };
  }
  
  // Check for salutation (various languages)
  const salutationPatterns = [
    /sehr geehrte/i, /guten tag/i, /hallo/i,
    /dear/i, /hello/i, /to whom/i,
    /egregio/i, /gentile/i, /spettabile/i,
    /cher|chère/i, /madame|monsieur/i,
    /estimado|estimada/i, /a quien corresponda/i,
  ];
  const hasSalutation = salutationPatterns.some(p => p.test(draftText));
  if (!hasSalutation) {
    warnings.push('Missing salutation/greeting');
  }
  
  // Check for subject/reference line
  const subjectPatterns = [
    /betreff|betrifft|bezug|aktenzeichen|geschäftszeichen/i,
    /subject|re:|reference/i,
    /oggetto|rif\.|riferimento/i,
    /objet|référence/i,
    /asunto|referencia/i,
  ];
  const hasSubject = subjectPatterns.some(p => p.test(draftText));
  if (!hasSubject) {
    warnings.push('Missing subject/reference line');
  }
  
  // Check for closing formula
  const closingPatterns = [
    /mit freundlichen grüßen/i, /hochachtungsvoll/i, /beste grüße/i,
    /sincerely|regards|respectfully/i,
    /cordiali saluti|distinti saluti/i,
    /cordialement|salutations/i,
    /atentamente|saludos/i,
  ];
  const hasClosing = closingPatterns.some(p => p.test(draftText));
  if (!hasClosing) {
    warnings.push('Missing formal closing formula');
  }
  
  // All 3 elements should be present for a valid letter
  const passed = hasSalutation && hasClosing; // Subject is recommended but not blocking
  
  return { passed, warnings };
}

// VALIDATOR 4: Check deadline if required
function validateDeadlineIfRequired(deadlinesDetected: boolean, draftText: string): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!deadlinesDetected) {
    return { passed: true, warnings: [] };
  }
  
  // If deadlines were detected, the draft should mention a deadline/Frist
  const deadlinePatterns = [
    /frist|termin|bis zum|spätestens|innerhalb von/i,
    /deadline|by|within|no later than/i,
    /termine|entro|scadenza/i,
    /délai|avant le|au plus tard/i,
    /plazo|antes de|a más tardar/i,
  ];
  
  const mentionsDeadline = deadlinePatterns.some(p => p.test(draftText));
  
  if (!mentionsDeadline) {
    warnings.push('Document has deadline but draft does not mention any deadline/Frist');
  }
  
  return { 
    passed: mentionsDeadline, 
    warnings 
  };
}

// Run all validators
function runAllValidators(
  draftText: string, 
  legalBasisCited: string | null, 
  langCode: string,
  deadlinesDetected: boolean
): { quality_passed: boolean; validation_warnings: string[]; validators: Record<string, boolean> } {
  const v1 = validateNoInventedLaws(draftText, legalBasisCited);
  const v2 = validateNoForbiddenPhrases(draftText, langCode);
  const v3 = validateStructureMinimum(draftText);
  const v4 = validateDeadlineIfRequired(deadlinesDetected, draftText);
  
  const allWarnings = [...v1.warnings, ...v2.warnings, ...v3.warnings, ...v4.warnings];
  
  // Critical failures: forbidden phrases, missing structure
  const criticalPassed = v2.passed && v3.passed;
  
  return {
    quality_passed: criticalPassed,
    validation_warnings: allWarnings,
    validators: {
      no_invented_laws: v1.passed,
      no_forbidden_phrases: v2.passed,
      structure_valid: v3.passed,
      deadline_included: v4.passed,
    }
  };
}

serve(async (req) => {
  // Preflight: must return 200 with CORS headers so browser allows POST
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  console.log("[analyze-letter] POST request start");
  try {
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      console.log('[analyze-letter] Jurisdiction blocked:', geoCheck.countryCode, geoCheck.reason);
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
      console.error("[analyze-letter] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - please log in" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[analyze-letter] user", user.id);

    // Get user's preferred language from profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('preferred_language, default_ai_language')
      .eq('id', user.id)
      .single();

    let letterText: string, userLanguage: string, senderData: unknown, legalClassification: unknown, caseContext: unknown;
    try {
      const body = await req.json();
      letterText = body.letterText;
      userLanguage = body.userLanguage;
      senderData = body.senderData;
      legalClassification = body.legalClassification;
      caseContext = body.caseContext;
    } catch (parseErr) {
      console.error("[analyze-letter] Body parse error:", parseErr);
      return new Response(
        JSON.stringify({ error: "Invalid request body", message: parseErr instanceof Error ? parseErr.message : "Bad JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[analyze-letter] body letterText length", letterText?.length ?? 0);

    if (!letterText || letterText.trim().length === 0) {
      console.log("[analyze-letter] return 400: no letter text");
      return new Response(
        JSON.stringify({ error: "No letter text provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build case context section for multi-doc awareness
    let caseContextSection = "";
    if (caseContext) {
      const contextParts: string[] = [];
      
      if (caseContext.previousLetterText) {
        contextParts.push(`PREVIOUS LETTER IN THIS CASE:\n${caseContext.previousLetterText.substring(0, 1500)}`);
      }
      
      if (caseContext.previousDraft) {
        contextParts.push(`PREVIOUS DRAFT RESPONSE:\n${caseContext.previousDraft.substring(0, 1500)}`);
      }
      
      if (caseContext.previousExplanation) {
        contextParts.push(`PREVIOUS ANALYSIS:\n${caseContext.previousExplanation.substring(0, 800)}`);
      }
      
      if (caseContext.documentsHistory && caseContext.documentsHistory.length > 0) {
        contextParts.push(`DOCUMENTS HISTORY:\n${caseContext.documentsHistory.slice(0, 3).join('\n\n')}`);
      }
      
      if (contextParts.length > 0) {
        caseContextSection = `
═══════════════════════════════════════════════════════════════════════════
CASE CONTEXT (THIS IS A FOLLOW-UP DOCUMENT)
═══════════════════════════════════════════════════════════════════════════
${contextParts.join('\n\n---\n\n')}

IMPORTANT: This new document is a FOLLOW-UP to the case above. The analysis and draft response should:
1. Reference the previous correspondence
2. Build upon the existing draft/response
3. Consider this as a continuation of the same legal matter
4. Update the strategy based on the new information
═══════════════════════════════════════════════════════════════════════════
`;
      }
    }

    // Determine output language with priority chain
    const outputLangCode = (
      profile?.preferred_language || 
      profile?.default_ai_language || 
      userLanguage || 
      "DE"
    ).toUpperCase();
    const outputLanguage = LANGUAGE_MAP[outputLangCode] || "German";
    
    // Using direct OpenAI API (no Lovable credits dependency)
    console.log(`[LEVEL-2-5] Legal analysis for user: ${user.id}, language: ${outputLanguage} (${outputLangCode})`);

    // Build sender section
    let senderSection = "";
    if (senderData) {
      const senderLines: string[] = [];
      if (senderData.sender_name) senderLines.push(`Name: ${senderData.sender_name}`);
      if (senderData.sender_address) senderLines.push(`Address: ${senderData.sender_address}`);
      if (senderData.sender_postal_code || senderData.sender_city) {
        senderLines.push(`Location: ${senderData.sender_postal_code || ''} ${senderData.sender_city || ''}`.trim());
      }
      if (senderData.sender_country) senderLines.push(`Country: ${senderData.sender_country}`);
      if (senderData.sender_date) {
        const date = new Date(senderData.sender_date);
        const locale = outputLangCode === 'DE' ? 'de-DE' : outputLangCode === 'IT' ? 'it-IT' : outputLangCode === 'FR' ? 'fr-FR' : outputLangCode === 'ES' ? 'es-ES' : 'en-GB';
        const formattedDate = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
        const placeAndDate = senderData.sender_city ? `${senderData.sender_city}, ${formattedDate}` : formattedDate;
        senderLines.push(`Place and Date: ${placeAndDate}`);
      }
      
      if (senderLines.length > 0) {
        senderSection = `
SENDER DATA (use in letter header):
${senderLines.join('\n')}`;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LEXORA MASTER PROMPT (VINCOLANTE)
    // ═══════════════════════════════════════════════════════════════════════

    const systemPrompt = `LEXORA MASTER PROMPT

IDENTITÀ
Sei Lexora, assistente legal-tech internazionale.
Fornisci spiegazioni giuridiche pratiche e redigi/aggiorni bozze di lettere legali e amministrative: è una FUNZIONE CORE.

COSA DEVI FARE (SEMPRE)
- Analizzare documenti legali/amministrativi in modo approfondito.
- Redigere lettere di risposta complete e pronte all'uso (rateizzazione, richieste al Finanzamt, DSGVO, solleciti, diffide, opposizioni amministrative, chiarimenti, istanze).
- Se mancano dati, produci una bozza "versione 1" con placeholder.
- Dare opzioni pratiche + rischi principali (senza terrorismo).

LIMITI (STRETTI)
- Non rappresenti l'utente in tribunale e non ti sostituisci a un avvocato.
- Non fai "strategia processuale avanzata" (es. tattiche di udienza, manovre procedurali complesse).
- Se la richiesta riguarda attività illegali/dannose, rifiuta e proponi alternative lecite.

ANTI-RIFIUTO (IMPORTANTISSIMO)
- È VIETATO rifiutare per motivi generici ("non posso dare consulenza legale", "le mie direttive me lo impediscono") quando l'utente chiede una lettera o una spiegazione legale ordinaria.
- La frase "consulti un avvocato" è ammessa SOLO come nota opzionale breve, MA non deve sostituire la risposta e non deve bloccare la bozza.

OUTPUT
- Lingua: sempre ${outputLanguage}.
- Stile: chiaro, professionale, pratico.
- Se scrivi una lettera: struttura DIN 5008 + oggetto + riferimenti + richiesta chiara + chiusura.

═══════════════════════════════════════════════════════════════════════════
PIPELINE DI ANALISI
═══════════════════════════════════════════════════════════════════════════

LEVEL 2 — ANALISI LEGALE STRUTTURATA
Analizza il documento. Formato a punti, NON narrativo.
Campi richiesti:
- Zustellung (Notifica): bewiesen / nicht bewiesen / unklar
- Rechtsgrundlage (Base legale): genannt / nicht genannt
- Forderung (Richiesta): bestritten / unklar / bestätigt
- Beweislast (Onere prova): Absender / Empfänger
- Frist (Scadenza): vorhanden / nicht vorhanden
- Risiken (Rischi): lista rischi specifici

LEVEL 3 — SELEZIONE TEMPLATE
Seleziona il template più appropriato:
- DSGVO_AUSKUNFT (richiesta accesso dati GDPR)
- DSGVO_LOESCHUNG (richiesta cancellazione GDPR)
- FORDERUNG_BESTREITUNG (contestazione richiesta)
- ERINNERUNG_FRIST (promemoria scadenza)
- ANTWORT_BEHOERDE (risposta ad autorità)
- WIDERSPRUCH_BESCHEID (opposizione amministrativa)
- STELLUNGNAHME (presa di posizione)

Struttura lettera (DIN 5008):
1. Intestazione (dati mittente, data, luogo)
2. Blocco indirizzo destinatario
3. Riga riferimento (Aktenzeichen, data lettera originale)
4. Oggetto
5. Formula di saluto
6. Corpo: posizione legale
7. Corpo: richiesta specifica
8. Corpo: scadenza (se applicabile)
9. Formula di chiusura formale
10. Firma

LEVEL 4 — LINGUAGGIO PROFESSIONALE
STILE OBBLIGATORIO: Neutro, Formale, Impersonale
Usa frasi come: "Unter Bezugnahme auf...", "Hiermit bestreite ich...", "Ich nehme Bezug auf..."

═══════════════════════════════════════════════════════════════════════════
LEVEL 5 — DUAL VERSION OUTPUT
═══════════════════════════════════════════════════════════════════════════
Generate ALWAYS two versions:
A) Standard version (neutral)
B) Reinforced version (more formal and firm)
${senderSection}

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT - STRICT JSON
═══════════════════════════════════════════════════════════════════════════

{
  "level2_analysis": {
    "zustellung": "bewiesen | nicht bewiesen | unklar",
    "rechtsgrundlage": "genannt | nicht genannt",
    "rechtsgrundlage_detail": "If cited, list the specific law/regulation from the document",
    "forderung": "bestritten | unklar | bestätigt",
    "forderung_detail": "Brief description of the claim",
    "beweislast": "Absender | Empfänger",
    "frist_vorhanden": true | false,
    "frist_datum": "YYYY-MM-DD or null",
    "risiken": ["List specific risks in ${outputLanguage}"]
  },
  "level3_template": {
    "template_type": "One of: DSGVO_AUSKUNFT, DSGVO_LOESCHUNG, FORDERUNG_BESTREITUNG, ERINNERUNG_FRIST, ANTWORT_BEHOERDE, WIDERSPRUCH_BESCHEID, STELLUNGNAHME",
    "template_justification": "Why this template was selected"
  },
  "level5_drafts": {
    "version_standard": "Complete formal letter in ${outputLanguage} - neutral tone, DIN 5008 format",
    "version_reinforced": "Complete formal letter in ${outputLanguage} - firmer/more assertive tone, DIN 5008 format"
  },
  "quality_check": {
    "no_invented_laws": true | false,
    "no_invented_facts": true | false,
    "template_respected": true | false,
    "din_5008_compliant": true | false,
    "deadline_included_if_required": true | false
  },
  "explanation": "Brief explanation in ${outputLanguage} of what the letter is about (for the user, in simple terms)",
  "warnings": ["List any uncertainties or missing information that the user should verify"],
  "ai_disclaimer": "⚠️ AI-generated draft - verify before sending. This is not legal advice."
}`;

    // Use OpenAI API directly (no Lovable credits)
    const userMessage = caseContextSection 
      ? `${caseContextSection}\nNEW DOCUMENT TO ANALYZE:\n\n${letterText}`
      : `EXECUTE LEVELS 2-5 LEGAL ANALYSIS PIPELINE:\n\n${letterText}`;
    
    const aiResult = await callOpenAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model: "gpt-4.1-mini",
      temperature: 0.2,
    });

    if (!aiResult.ok) {
      console.error("[LEVEL-2-5] OpenAI error:", aiResult.error);
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

    const content = aiResult.content;
    console.log("[analyze-letter] AI raw content length", content?.length ?? 0);

    if (!content) {
      console.error("[analyze-letter] No content from AI");
      return new Response(
        JSON.stringify({ error: "No response from AI", message: "AI returned empty content" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsedResult: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonString = (jsonMatch[1] ?? content) as string;
      parsedResult = JSON.parse(jsonString.trim()) as Record<string, unknown>;
    } catch (parseError) {
      console.error("[analyze-letter] Failed to parse AI response:", String(content).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response as JSON", message: parseError instanceof Error ? parseError.message : "Parse error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DETERMINISTIC SERVER-SIDE VALIDATION (Non-AI)
    // ═══════════════════════════════════════════════════════════════════════

    const level5 = parsedResult.level5_drafts as Record<string, string> | undefined;
    const level2 = parsedResult.level2_analysis as Record<string, unknown> | undefined;
    const standardDraft = level5?.version_standard || '';
    const reinforcedDraft = level5?.version_reinforced || '';
    const legalBasisCited = (level2?.rechtsgrundlage_detail as string | null) ?? null;
    const deadlinesDetected = (level2?.frist_vorhanden as boolean) ?? false;

    // Validate standard draft
    const standardValidation = runAllValidators(standardDraft, legalBasisCited, outputLangCode, deadlinesDetected);
    
    // Validate reinforced draft
    const reinforcedValidation = runAllValidators(reinforcedDraft, legalBasisCited, outputLangCode, deadlinesDetected);

    console.log(`[VALIDATORS] Standard: ${standardValidation.quality_passed}, Reinforced: ${reinforcedValidation.quality_passed}`);
    console.log(`[VALIDATORS] Warnings: ${[...standardValidation.validation_warnings, ...reinforcedValidation.validation_warnings].join(', ')}`);

    // Combine AI quality check with deterministic validation
    const aiQualityCheck = (parsedResult.quality_check as Record<string, unknown>) || {};
    const deterministicQuality = standardValidation.quality_passed && reinforcedValidation.quality_passed;
    const overallQualityPassed = 
      aiQualityCheck.no_invented_laws !== false &&
      aiQualityCheck.no_invented_facts !== false &&
      aiQualityCheck.template_respected !== false &&
      deterministicQuality;

    // Merge all warnings
    const allWarnings = [
      ...((parsedResult.warnings as string[]) || []),
      ...standardValidation.validation_warnings,
      ...reinforcedValidation.validation_warnings.filter(w => !standardValidation.validation_warnings.includes(w))
    ];

    // Enhanced quality check
    const enhancedQualityCheck = {
      ...aiQualityCheck,
      // Add deterministic validator results
      server_no_invented_laws: standardValidation.validators.no_invented_laws && reinforcedValidation.validators.no_invented_laws,
      server_no_forbidden_phrases: standardValidation.validators.no_forbidden_phrases && reinforcedValidation.validators.no_forbidden_phrases,
      server_structure_valid: standardValidation.validators.structure_valid && reinforcedValidation.validators.structure_valid,
      server_deadline_included: standardValidation.validators.deadline_included && reinforcedValidation.validators.deadline_included,
    };

    if (!overallQualityPassed) {
      console.warn(`[QUALITY-CHECK] FAILED for user ${user.id}:`, enhancedQualityCheck);
      parsedResult.quality_warning = "Quality check detected potential issues - please review carefully";
    }

    const level3 = parsedResult.level3_template as Record<string, unknown> | undefined;
    const risiken = (level2?.risiken as string[] | undefined) ?? [];
    const explanationFromAi = parsedResult.explanation as string | undefined;
    const fallbackExplanation = level2?.forderung_detail
      ? String(level2.forderung_detail)
      : level2?.zusammenfassung
        ? String(level2.zusammenfassung)
        : risiken.length > 0
          ? risiken.join(". ")
          : "Analysis completed.";
    const explanation = (explanationFromAi && explanationFromAi.trim()) ? explanationFromAi : fallbackExplanation;

    console.log(`[LEVEL-2-5] Analysis SUCCESS for user ${user.id}, template: ${level3?.template_type}, quality: ${overallQualityPassed}`);
    console.log("[analyze-letter] response explanation length:", explanation?.length, "risks count:", risiken?.length);

    // Map to response format with enhanced quality data
    const legacyResponse = {
      // New structured analysis (Levels 2-5)
      legal_analysis: level2,
      template_info: level3,
      drafts: level5,
      quality_check: enhancedQualityCheck,
      quality_passed: overallQualityPassed,
      warnings: allWarnings,
      ai_disclaimer: (parsedResult.ai_disclaimer as string) || "⚠️ AI-generated draft - verify before sending",
      // Legacy fields for backward compatibility (UI reads these)
      explanation,
      risks: risiken,
      draft_response: level5?.version_standard ?? null,
      draft_response_reinforced: level5?.version_reinforced ?? null,
    };

    return new Response(JSON.stringify(legacyResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[analyze-letter] error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
