import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-demo-mode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[ocr] request received");

    let base64: string;
    let mimeType = "image/jpeg";

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return json({ error: "No file provided", details: "Send a field named 'file'" }, 400);
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return json({ error: "Invalid file type. Use JPG, PNG or WEBP", details: file.type }, 400);
      }

      if (file.size > MAX_SIZE_BYTES) {
        return json({ error: "File too large (max 10MB)", details: `${Math.round(file.size / 1024)}KB` }, 400);
      }

      console.log(`[ocr] processing: ${file.name}, ${file.type}, ${Math.round(file.size / 1024)}KB`);
      mimeType = file.type;
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      base64 = btoa(String.fromCharCode(...bytes));
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      base64 = body?.base64 ?? body?.imageBase64;
      mimeType = body?.mimeType ?? "image/jpeg";

      if (!base64 || typeof base64 !== "string") {
        return json({ error: "No image data provided", details: "Send base64 or imageBase64 in JSON body" }, 400);
      }

      if (base64.length > 14_000_000) {
        return json({ error: "Image too large (max ~10MB)", details: "Reduce image size" }, 400);
      }

      base64 = base64.includes(",") ? base64.split(",")[1]?.trim() ?? base64 : base64;
    } else {
      return json({ error: "Content-Type must be multipart/form-data or application/json" }, 400);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[ocr] OPENAI_API_KEY not set");
      return json({
        error: "Could not read document. Try again.",
        details: "OCR service not configured",
        tip: "Ensure the image is clear and text is readable.",
      }, 500);
    }

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
                image_url: { url: `data:${mimeType};base64,${base64}` },
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
      const errText = await response.text();
      console.error("[ocr] OpenAI error:", response.status, errText);
      const rateLimit = response.status === 429;
      return json({
        error: rateLimit ? "Service busy. Try again in a moment." : "Could not read document. Try again.",
        details: errText.slice(0, 200),
        tip: "Ensure the image is clear and text is readable. Try reducing image size if the problem persists.",
      }, 500);
    }

    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content ?? "";

    text = text
      .replace(/^(OCR:|Here is the extracted text:|I'll extract)[^\n]*\n?/i, "")
      .trim()
      .replace(/\n{3,}/g, "\n\n");

    if (!text) {
      return json({
        error: "No text detected in image. Please try with better lighting and focus.",
        details: "AI returned empty text",
        tip: "Ensure the image is clear and text is readable.",
      }, 422);
    }

    console.log("[ocr] success, text length:", text.length);
    return json({ success: true, text, confidence: "processed" }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ocr] critical error:", error);
    return json(
      {
        error: "Could not read document. Try again.",
        details: message,
        tip: "Ensure the image is clear and text is readable. Try reducing image size if the problem persists.",
      },
      500
    );
  }
});
