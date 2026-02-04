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
  const commaIdx = base64.indexOf(",");
  if (commaIdx !== -1) return base64.slice(commaIdx + 1).trim();
  return base64.trim();
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

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY mancante su Vercel");
      return res.status(500).json({
        error: "Could not read document. Try again.",
        details: "OpenAI API key not configured on server",
      });
    }

    const body = typeof req.body === "object" && req.body !== null ? (req.body as { base64?: string; mimeType?: string }) : {};
    const rawBase64 = body.base64;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";

    if (!rawBase64 || typeof rawBase64 !== "string") {
      return res.status(400).json({
        error: "Could not read document. Try again.",
        details: "Request must contain base64 image data",
      });
    }

    const base64 = normalizeBase64(rawBase64);

    const estimatedSizeMB = (base64.length * 0.75) / 1024 / 1024;
    if (estimatedSizeMB > 10) {
      return res.status(400).json({
        error: "Could not read document. Try again.",
        details: `File too large (max 10MB). Estimated: ${estimatedSizeMB.toFixed(2)}MB`,
      });
    }

    console.log(`[api/ocr] Processing via OpenAI Vision... Size: ${estimatedSizeMB.toFixed(2)}MB`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Extract all text from this document image. Preserve formatting as much as possible. Return only the extracted text without additional comments.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: "auto",
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
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
    return res.status(200).json({ text: extractedText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/ocr] Error:", err);
    return res.status(500).json({
      error: "Could not read document. Try again.",
      details: message,
    });
  }
}
