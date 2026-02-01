import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOpenAI } from "../_shared/openai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Blocked country codes
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
// LIVELLO 1 — CLASSIFICAZIONE GIURIDICA STRUTTURATA
// L'AI NON può procedere senza questa classificazione
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      console.log('[analyze-document] Jurisdiction blocked:', geoCheck.countryCode, geoCheck.reason);
      return new Response(
        JSON.stringify({ code: geoCheck.reason, countryCode: geoCheck.countryCode || 'unknown' }),
        { status: 451, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { documentText, userLanguage } = await req.json();
    
    const langCode = (userLanguage || "DE").toUpperCase();
    const outputLanguage = LANGUAGE_MAP[langCode] || "German";
    
    console.log(`[LEVEL-1] Legal classification for user: ${user.id}, language: ${outputLanguage}`);

    // Using direct OpenAI API (no Lovable credits dependency)

    if (!documentText || documentText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No document text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LEGAL GOVERNANCE: LEVEL 1 - MANDATORY LEGAL CLASSIFICATION
    // The AI MUST produce this structured classification BEFORE any analysis
    // If classification fails → STOP (no freeform response allowed)
    // ═══════════════════════════════════════════════════════════════════════

    const systemPrompt = `CRITICAL LEGAL GOVERNANCE RULES:
═══════════════════════════════════════════════════════════════════════════
1. You are NOT a lawyer and do NOT provide legal advice
2. You do NOT decide strategy
3. You do NOT invent facts, laws, terms, or intentions
4. You do NOT expand the legal scope without explicit input
5. If information is missing → You MUST declare uncertainty
═══════════════════════════════════════════════════════════════════════════

MANDATORY LANGUAGE: All text fields MUST be in ${outputLanguage}.

Your ONLY task is LEVEL 1 - LEGAL CLASSIFICATION.
Produce a structured JSON classification of this document.

You MUST respond with this EXACT JSON structure:
{
  "classification": {
    "document_type": "Bescheid | Mahnung | Inkasso | Schreiben | Behörde | Bußgeldbescheid | Anhörungsbogen | Unbekannt",
    "legal_domain": ["List applicable: DSGVO, BGB, SGB, VwVfG, Verwaltungsrecht, Verbraucherrecht, Strafrecht, Ordnungswidrigkeitenrecht, Steuerrecht, Arbeitsrecht, Mietrecht"],
    "authority_or_sender": "Exact name of sender/authority from document",
    "aktenzeichen": "Reference number if found, or null",
    "document_date": "YYYY-MM-DD if found, or null",
    "deadlines_detected": true or false,
    "deadline_date": "YYYY-MM-DD if found, or null",
    "deadline_type": "Widerspruchsfrist | Zahlungsfrist | Stellungnahmefrist | Anhörungsfrist | other | null",
    "risk_level": "low | medium | high",
    "classification_confidence": "high | medium | low"
  },
  "missing_information": [
    "List any information that CANNOT be determined from the document"
  ],
  "extracted_facts": {
    "main_claim": "What is the authority/sender claiming or requesting - ONLY what is explicitly stated",
    "monetary_amount": "If any amount is mentioned, or null",
    "legal_basis_cited": "Legal references cited IN THE DOCUMENT (not invented)",
    "required_action": "What action is explicitly requested from the recipient"
  },
  "summary": "Brief 2-3 sentence summary in ${outputLanguage} - ONLY describing what the document contains, not advice",
  "can_proceed_to_analysis": true or false,
  "stop_reason": "If can_proceed_to_analysis is false, explain why classification failed"
}

CRITICAL RULES:
- Extract ONLY what is explicitly in the document
- Do NOT invent legal references
- Do NOT make assumptions about facts not stated
- If you cannot classify with confidence → set can_proceed_to_analysis to false
- Respond ONLY with the JSON object`;

    // Use OpenAI API directly (no Lovable credits)
    const aiResult = await callOpenAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CLASSIFY THIS DOCUMENT (Level 1 - Legal Classification):\n\n${documentText}` }
      ],
      model: 'gpt-4.1-mini',
      temperature: 0.1, // Low temperature for consistent classification
    });

    if (!aiResult.ok) {
      console.error('[LEVEL-1] OpenAI error:', aiResult.error);
      
      if (aiResult.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI_PROVIDER_ERROR', message: 'AI temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = aiResult.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'No classification generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedResult;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ 
          error: 'Classification failed - cannot proceed',
          can_proceed_to_analysis: false,
          stop_reason: 'AI response could not be parsed as valid JSON'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that classification was successful
    if (!parsedResult.classification) {
      console.error('Invalid classification structure:', parsedResult);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid classification structure',
          can_proceed_to_analysis: false,
          stop_reason: 'Classification structure is missing required fields'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GOVERNANCE CHECK: If classification failed, stop here
    if (parsedResult.can_proceed_to_analysis === false) {
      console.log(`[LEVEL-1] Classification STOPPED for user ${user.id}: ${parsedResult.stop_reason}`);
    } else {
      console.log(`[LEVEL-1] Classification SUCCESS for user ${user.id}, type: ${parsedResult.classification.document_type}`);
    }

    // Map to legacy format for backward compatibility while including new structured data
    const legacyResponse = {
      // New structured classification (Level 1)
      legal_classification: parsedResult.classification,
      missing_information: parsedResult.missing_information || [],
      extracted_facts: parsedResult.extracted_facts,
      can_proceed_to_analysis: parsedResult.can_proceed_to_analysis !== false,
      stop_reason: parsedResult.stop_reason || null,
      
      // Legacy fields for backward compatibility
      authority: parsedResult.classification.authority_or_sender,
      aktenzeichen: parsedResult.classification.aktenzeichen,
      documentDate: parsedResult.classification.document_date,
      deadline: parsedResult.classification.deadline_date,
      documentType: parsedResult.classification.document_type?.toLowerCase() || 'other',
      direction: 'incoming',
      summary: parsedResult.summary,
      mainAction: parsedResult.extracted_facts?.required_action,
    };

    return new Response(
      JSON.stringify(legacyResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
