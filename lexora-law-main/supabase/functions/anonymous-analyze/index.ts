import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOpenAI } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLOCKED_COUNTRIES = ['RU', 'CN'];

function checkGeoBlock(req: Request): { blocked: boolean; countryCode: string | null } {
  const countryCode = req.headers.get('cf-ipcountry') 
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-country')
    || req.headers.get('fly-client-country');
  
  if (!countryCode) {
    return { blocked: false, countryCode: null };
  }
  
  const normalized = countryCode.toUpperCase();
  return { 
    blocked: BLOCKED_COUNTRIES.includes(normalized), 
    countryCode: normalized 
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Rate limiting
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipCounts.get(ip);
  
  if (!record || now > record.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      return json({ ok: false, error: "Service not available in your region" }, 451);
    }

    const clientIP = req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';
    
    if (!checkRateLimit(clientIP)) {
      return json({ ok: false, error: "Rate limit exceeded" }, 429);
    }

    const { letterText, language = "EN" } = await req.json();

    if (!letterText || letterText.trim().length < 20) {
      return json({ ok: false, error: "Please provide more text to analyze" }, 400);
    }

    // Limit text length
    const trimmedText = letterText.trim().slice(0, 8000);
    const langCode = (language || "EN").toUpperCase();
    const outputLanguage = LANGUAGE_MAP[langCode] || "English";

    // Using direct OpenAI API (no Lovable credits dependency)

    const systemPrompt = `You are Lexora, an AI legal assistant helping people understand official letters and bureaucratic communications.

TASK: Analyze the provided letter/document and respond in ${outputLanguage}.

Provide a structured response with:

1. **Summary** (2-3 sentences): What is this letter about?

2. **Sender**: Who sent this (authority/organization name)?

3. **Urgency**: Is this urgent? (HIGH / MEDIUM / LOW)
   - HIGH: Has a deadline within 14 days, requires immediate action, or has legal consequences
   - MEDIUM: Has a deadline within 30 days or requires a response
   - LOW: Informational, no immediate action required

4. **Deadline**: Is there a specific deadline mentioned? (date or "none")

5. **Key Points**: List 2-4 main points the recipient should understand.

6. **Recommended Actions**: List 2-3 specific next steps.

7. **Risks**: What could happen if no action is taken?

Be clear, practical, and reassuring. Avoid legal jargon.

IMPORTANT: This is a FREE preview. End with a brief note that saving this analysis requires creating a free account.`;

    // Use OpenAI API directly (no Lovable credits)
    const aiResult = await callOpenAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please analyze this letter:\n\n${trimmedText}` },
      ],
      model: "gpt-4.1-mini",
      temperature: 0.5,
    });

    if (!aiResult.ok) {
      console.error("OpenAI error:", aiResult.error);
      return json({ ok: false, error: "Analysis failed", code: "AI_PROVIDER_ERROR" }, 500);
    }

    const analysis = aiResult.content || "";

    // Parse structured data from response
    const urgencyMatch = analysis.match(/\*\*Urgency\*\*[:\s]*(HIGH|MEDIUM|LOW)/i);
    const deadlineMatch = analysis.match(/\*\*Deadline\*\*[:\s]*([^\n*]+)/i);
    const senderMatch = analysis.match(/\*\*Sender\*\*[:\s]*([^\n*]+)/i);

    return json({
      ok: true,
      analysis,
      structured: {
        urgency: urgencyMatch?.[1]?.toUpperCase() || "MEDIUM",
        deadline: deadlineMatch?.[1]?.trim() || null,
        sender: senderMatch?.[1]?.trim() || null,
      },
    });

  } catch (error) {
    console.error("anonymous-analyze error:", error);
    return json({ 
      ok: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, 500);
  }
});
