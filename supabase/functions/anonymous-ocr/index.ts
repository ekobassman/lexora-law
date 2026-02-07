import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Blocked country codes
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

// Simple rate limiting by IP (in-memory, resets on function restart)
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // GEO-BLOCK CHECK
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      return json({ ok: false, error: "Service not available in your region" }, 451);
    }

    // Basic rate limiting by IP
    const clientIP = req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';
    
    if (!checkRateLimit(clientIP)) {
      return json({ ok: false, error: "Rate limit exceeded. Please try again later." }, 429);
    }

    const body = await req.json();
    const { base64, mimeType, language = "EN" } = body;

    if (!base64) {
      return json({ ok: false, error: "No image data provided" }, 400);
    }

    // Limit base64 size (roughly 10MB)
    if (base64.length > 14_000_000) {
      return json({ ok: false, error: "Image too large" }, 400);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return json({ ok: false, error: "Server configuration error" }, 500);
    }

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
                  url: `data:${mimeType || "image/jpeg"};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: "OCR: Extract all visible text from this document. Return ONLY the extracted text, no comments or explanations.",
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
        return json({ ok: false, error: "Service busy. Please try again." }, 429);
      }
      
      return json({ ok: false, error: "OCR processing failed" }, 500);
    }

    const data = await response.json();
    let extractedText = data.choices?.[0]?.message?.content || "";

    // Clean up any instruction leakage
    extractedText = extractedText
      .replace(/^(OCR:|Here is the extracted text:|I'll extract)[^\n]*\n?/i, "")
      .trim()
      .replace(/\n{3,}/g, "\n\n");

    return json({ 
      ok: true, 
      text: extractedText,
      success: true,
    });

  } catch (error) {
    console.error("anonymous-ocr error:", error);
    return json({ 
      ok: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, 500);
  }
});
