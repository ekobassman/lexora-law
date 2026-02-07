/**
 * POST /api/ocr – OpenAI Vision OCR (images).
 * Uses OPENAI_API_KEY on Vercel. CORS headers on all responses for browser clients.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs" };

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey"
  );
  res.setHeader("Content-Type", "application/json");
}

function normalizeBase64(base64: string): string {
  if (typeof base64 !== "string") return "";
  let s = base64.trim();
  const commaIdx = s.indexOf(",");
  if (commaIdx !== -1) s = s.slice(commaIdx + 1).trim();
  // Remove any whitespace/newlines that can break OpenAI (e.g. from JSON)
  return s.replace(/\s/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", details: "Use POST" });
  }

  // Debug: log OPENAI_API_KEY presence (never log the key itself)
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  const keyLen = process.env.OPENAI_API_KEY?.length ?? 0;
  console.log("[api/ocr] OPENAI_API_KEY present:", hasKey, "length:", keyLen);

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("[api/ocr] OPENAI_API_KEY mancante su Vercel");
      return res.status(500).json({
        error: "Could not read document. Try again.",
        details: "OpenAI API key not configured on server",
      });
    }

    // Supabase Edge Function public-health (diagnostica; verify_jwt: false)
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      "";
    let authHealthPayload: { ok: boolean; healthy?: boolean; ts?: string | null; status?: number; message?: string } = { ok: false };
    try {
      const authHealthRes = await fetch(
        "https://wzpxxlkfxymelrodjarl.supabase.co/functions/v1/public-health",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Functions" }),
        }
      );
      const json = (await authHealthRes.json()) as { ok?: boolean; healthy?: boolean; ts?: string };
      if (authHealthRes.status === 200 && json?.ok) {
        authHealthPayload = { ok: true, healthy: json.healthy, ts: json.ts ?? null };
        console.log("[api/ocr] public-health ok, ts:", json?.ts ?? "n/a");
      } else if (authHealthRes.status === 401) {
        authHealthPayload = { ok: false, status: 401, message: "not authenticated" };
        console.warn("[api/ocr] public-health 401 (no user token in backend), continuing scan");
      } else {
        authHealthPayload = { ok: false, status: authHealthRes.status, message: "request_failed" };
        console.warn("[api/ocr] public-health non-ok, status:", authHealthRes.status);
      }
    } catch (authHealthErr) {
      console.warn("[api/ocr] public-health fetch failed (continuing scan):", authHealthErr instanceof Error ? authHealthErr.message : "unknown");
    }

    // Support both parsed object and raw JSON string (Vercel can send either)
    let body: { base64?: string; mimeType?: string } = {};
    if (typeof req.body === "object" && req.body !== null) {
      body = req.body as { base64?: string; mimeType?: string };
    } else if (typeof req.body === "string") {
      try {
        body = JSON.parse(req.body) as { base64?: string; mimeType?: string };
      } catch {
        console.error("[api/ocr] Invalid JSON body");
        return res.status(400).json({
          error: "Could not read document. Try again.",
          details: "Invalid request body",
        });
      }
    }

    const rawBase64 = body.base64;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";

    if (rawBase64 === undefined || rawBase64 === null || typeof rawBase64 !== "string") {
      console.error("[api/ocr] Missing or invalid base64: type", typeof rawBase64);
      return res.status(400).json({
        error: "Could not read document. Try again.",
        details: "Request must contain base64 image data",
      });
    }

    const base64 = normalizeBase64(rawBase64);

    if (!base64.length) {
      console.error("[api/ocr] Base64 empty after normalize (raw length:", rawBase64.length, ")");
      return res.status(400).json({
        error: "Could not read document. Try again.",
        details: "Empty image data after parsing",
      });
    }

    console.log("[api/ocr] base64 length:", base64.length, "mimeType:", mimeType);

    const estimatedSizeMB = (base64.length * 0.75) / 1024 / 1024;
    if (estimatedSizeMB > 10) {
      return res.status(400).json({
        error: "Could not read document. Try again.",
        details: `File too large (max 10MB). Estimated: ${estimatedSizeMB.toFixed(2)}MB`,
      });
    }

    console.log(`[api/ocr] Processing via OpenAI Vision (gpt-4o)... Size: ${estimatedSizeMB.toFixed(2)}MB`);

    const GERMAN_OCR_PROMPT = `OCR per documenti ufficiali tedeschi (Finanzamt, Amt, Behörden).
Estrai TUTTO il testo visibile. Mantieni formattazione, nomi, indirizzi, importi.
Correzioni obbligatorie: "pinanzamt"→"Finanzamt", "£"→"€", "Herm"→"Herrn", "Raden-" + spazi → "Baden-Württemberg".
Ignora macchie e sfocature. Ritorna SOLO il testo estratto, niente commenti.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.0,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: GERMAN_OCR_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[api/ocr] OpenAI error:", response.status, errText.slice(0, 200));
      const isRateLimit = response.status === 429;
      return res.status(500).json({
        error: isRateLimit ? "Service busy. Try again in a moment." : "Could not read document. Try again.",
        details: errText.slice(0, 300),
      });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const extractedText = data?.choices?.[0]?.message?.content?.trim();

    if (!extractedText) {
      return res.status(422).json({
        error: "Could not read document. Try again.",
        details: "No text detected in image. Please try with better lighting and focus.",
      });
    }

    console.log("[api/ocr] Success, length:", extractedText.length);
    return res.status(200).json({
      text: extractedText,
      auth_health: {
        ok: authHealthPayload.ok,
        healthy: authHealthPayload.healthy ?? false,
        ts: authHealthPayload.ts ?? null,
        ...(authHealthPayload.status != null && { status: authHealthPayload.status }),
        ...(authHealthPayload.message && { message: authHealthPayload.message }),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/ocr] Error:", err);
    return res.status(500).json({
      error: "Could not read document. Try again.",
      details: message,
    });
  }
}
