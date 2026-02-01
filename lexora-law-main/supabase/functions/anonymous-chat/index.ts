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
    || req.headers.get('x-country');
  
  if (!countryCode) return { blocked: false, countryCode: null };
  const normalized = countryCode.toUpperCase();
  return { blocked: BLOCKED_COUNTRIES.includes(normalized), countryCode: normalized };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Rate limiting per IP
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15; // messages per hour
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipCounts.get(ip);
  
  if (!record || now > record.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

const LANGUAGE_MAP: Record<string, string> = {
  IT: "Italian", DE: "German", EN: "English", FR: "French",
  ES: "Spanish", PL: "Polish", RO: "Romanian", TR: "Turkish",
  AR: "Arabic", UK: "Ukrainian", RU: "Russian",
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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
      return json({ ok: false, error: "Rate limit exceeded", code: "RATE_LIMITED" }, 429);
    }

    const { message, chatHistory = [], context, language = "EN" } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return json({ ok: false, error: "Message required" }, 400);
    }

    const trimmedMessage = message.trim().slice(0, 4000);
    const langCode = (language || "EN").toUpperCase();
    const outputLanguage = LANGUAGE_MAP[langCode] || "English";

    // Using direct OpenAI API (no Lovable credits dependency)

    // Build system prompt - DRAFT-ONLY MODE
    let systemPrompt = `You are Lexora, AI assistant for formal letters and administrative communications.

LANGUAGE RULE: Respond in the current UI language: ${outputLanguage}. No exceptions.

ALLOWED SCOPE (ALWAYS ACCEPT):
- Letters to schools, kindergartens, universities, employers, landlords, companies
- Communications with public offices, banks, insurance companies
- Any formal or semi-formal written communication
- NEVER refuse these types of requests

YOUR ROLE:
- Draft formal letters when requested
- If data is missing, use placeholders: [DATE], [NAME], [REFERENCE]
- Or ask for missing data BEFORE generating

LIMITS:
- You don't replace a lawyer for complex court cases
- Refuse ONLY: entertainment, recipes, topics unrelated to documents

ANTI-REFUSAL (CRITICAL):
- FORBIDDEN to refuse letters to schools, employers, landlords
- FORBIDDEN to say "I can only help with legal matters"

OUTPUT FORMAT (CRITICAL - DRAFT-ONLY):
When generating a letter, output ONLY the final print-ready letter text.
ABSOLUTELY FORBIDDEN in output:
- Explanations, analysis, summaries, next steps
- "EXPLANATION", "---LETTER---", "end of document"
- Meta-comments like "I adjusted...", "Here is the letter..."
- Separators like --- or ___

Letter starts directly with Sender/Recipient.
Structure: Sender → Recipient → Place+Date → Subject → Body → Closing → Signature.
Attachments only if relevant. Letter ends with signature. NOTHING after.`;

    // Add document context if available
    if (context?.letterText) {
      systemPrompt += `\n\nDOCUMENT CONTEXT:\nThe user has shared this document:\n${context.letterText.slice(0, 3000)}`;
    }
    if (context?.analysis) {
      systemPrompt += `\n\nPREVIOUS ANALYSIS:\n${context.analysis.slice(0, 1500)}`;
    }

    // Build messages array
    const openaiMessages: Array<{role: "system" | "user" | "assistant"; content: string}> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add recent chat history (limit to last 10 messages)
    const recentHistory = chatHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        openaiMessages.push({
          role: msg.role,
          content: msg.content.slice(0, 2000),
        });
      }
    }

    // Add current message
    openaiMessages.push({ role: 'user', content: trimmedMessage });

    // Use OpenAI API directly (no Lovable credits)
    const aiResult = await callOpenAI({
      messages: openaiMessages,
      model: "gpt-4.1-mini",
      temperature: 0.7,
    });

    if (!aiResult.ok) {
      console.error("OpenAI error:", aiResult.error);
      if (aiResult.status === 429) {
        return json({ ok: false, error: "Too many requests", code: "RATE_LIMITED" }, 429);
      }
      return json({ ok: false, error: "AI temporarily unavailable", code: "AI_PROVIDER_ERROR" }, 500);
    }

    const reply = aiResult.content || "";

    // Check if AI is asking clarifying questions (for UI hints)
    const isAskingQuestions = /\?/.test(reply) && 
      (reply.match(/\?/g) || []).length >= 1 &&
      reply.length < 1500;

    return json({
      ok: true,
      reply,
      meta: {
        isAskingQuestions,
        messageCount: openaiMessages.length,
      },
    });

  } catch (error) {
    console.error("anonymous-chat error:", error);
    return json({ 
      ok: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, 500);
  }
});
