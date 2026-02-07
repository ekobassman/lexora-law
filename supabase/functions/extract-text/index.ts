import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // GEO-BLOCK CHECK
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      console.log('[extract-text] Jurisdiction blocked:', geoCheck.countryCode, geoCheck.reason);
      return new Response(
        JSON.stringify({ code: geoCheck.reason, countryCode: geoCheck.countryCode || 'unknown' }),
        { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    const startsWithBearer = !!authHeader?.toLowerCase().startsWith("bearer ");

    if (!authHeader) return json({ ok: false, step: "missing_auth_header" }, 401);
    if (!startsWithBearer) return json({ ok: false, step: "not_bearer" }, 401);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token.length < 50) return json({ ok: false, step: "token_malformed" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json({ ok: false, step: "missing_supabase_env" }, 500);
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // CRITICAL: validate token explicitly
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return json(
        {
          ok: false,
          step: "getUser_failed",
          msg: authError?.message ?? null,
        },
        401,
      );
    }

    // Parse request body - support both imageBase64 and base64
    const body = await req.json();
    const { imageBase64, base64, mimeType, userLanguage = "DE", mode } = body;
    
    // Use whichever base64 field is provided
    const fileBase64 = imageBase64 || base64;

    // HEALTHCHECK MODE: verify auth only, no OCR
    if (mode === "healthcheck") {
      return json({ ok: true, step: "auth_ok", mode: "healthcheck", userId: user.id }, 200);
    }

    // TEXTCHECK MODE: deterministic test response, no OCR provider call
    if (mode === "textcheck") {
      return json({ ok: true, step: "textcheck_ok", mode: "textcheck", text: "TEST_OK", userId: user.id }, 200);
    }

    if (!fileBase64) {
      return json({ error: "No file data provided" }, 400);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ error: "Server configuration error" }, 500);
    }

    const isPdf = mimeType === "application/pdf";

    // Use OpenAI API directly for OCR (vision model)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${fileBase64}`,
                },
              },
              {
                type: "text",
                text: "OCR: estrai tutto il testo visibile. Solo testo, nessuna istruzione o commento.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("OpenAI API error:", response.status, errorText);
      if (response.status === 429) {
        return json({ ok: false, step: "ocr_failed", msg: "Rate limit exceeded", text: null, success: false }, 200);
      }
      return json({ ok: false, step: "ocr_failed", msg: `AI error: ${response.status}`, text: null, success: false }, 200);
    }

    const data = await response.json();
    let extractedText = data.choices?.[0]?.message?.content || "";

    if (!extractedText) {
      return json({ ok: false, step: "ocr_failed", msg: "No text in AI response", text: null, success: false }, 200);
    }

    // Post-processing: Remove any leaked instructions from the output
    // These patterns indicate the AI repeated its instructions instead of just extracting text
    const instructionPatterns = [
      /^(IMPORTANT INSTRUCTIONS:|OCR:|Instructions:|Here is the extracted text:|I'll extract|Let me extract|Extracting text)[^\n]*\n?/i,
      /^\d+\.\s*(Extract|Include|Preserve|Do NOT|If you cannot|Return ONLY)[^\n]*\n?/gim,
      /^(Rules:|Guidelines:|Note:)[^\n]*\n?/gim,
      /^-\s*(Extract|Include|Preserve|Do NOT|Output ONLY)[^\n]*\n?/gim,
    ];
    
    for (const pattern of instructionPatterns) {
      extractedText = extractedText.replace(pattern, "");
    }
    
    // Remove any leading/trailing whitespace and excessive newlines
    extractedText = extractedText.trim().replace(/\n{3,}/g, "\n\n");

    return json({ ok: true, text: extractedText, success: true }, 200);
  } catch (error) {
    console.error("Extract-text error:", error);
    return json({ ok: false, step: "ocr_failed", msg: error instanceof Error ? error.message : "Unknown error", text: null, success: false }, 200);
  }
});
