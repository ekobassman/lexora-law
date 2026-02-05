/**
 * Canonical pipeline step 2: OCR a document by document_id.
 * Fetches file from Storage, calls Google Vision API (or OpenAI Vision fallback), saves ocr_text + status=ocr_done.
 * No n8n, no mock. Auth required. Uses service role for DB/storage.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

/** User ID for demo/anonymous pipeline (no login). Must match upload-document. */
const ANON_DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function googleVisionOcr(base64: string, apiKey: string): Promise<{ text: string } | { error: string }> {
  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { error: `Google Vision ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        error?: { message?: string };
      }>;
    };
    const first = data.responses?.[0];
    if (first?.error?.message) return { error: first.error.message };
    const text = first?.fullTextAnnotation?.text?.trim() ?? "";
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function openaiVisionOcr(base64DataUrl: string, apiKey: string): Promise<{ text: string } | { error: string }> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: base64DataUrl } },
              { type: "text", text: "Extract ALL text exactly as it appears. Preserve line breaks. No commentary." },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { error: `OpenAI ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED", message: "Use POST" }, 405, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "ENV_MISSING", message: "Server configuration error" }, 500, cors);
  }

  const isDemoMode = req.headers.get("x-demo-mode") === "true";
  let userId: string;

  if (isDemoMode) {
    userId = ANON_DEMO_USER_ID;
  } else {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return json({ ok: false, error: "UNAUTHORIZED", message: "Authorization Bearer required" }, 401, cors);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError || !user) {
      return json({ ok: false, error: "UNAUTHORIZED", message: userError?.message ?? "Invalid token" }, 401, cors);
    }
    userId = user.id;
  }

  let documentId: string;
  let body: Record<string, unknown> & { document_id?: string };
  try {
    body = (await req.json()) as typeof body;
    console.log("[ocr-document] body keys:", Object.keys(body ?? {}));
    documentId = body?.document_id ?? "";
    if (!documentId) {
      return json({ ok: false, error: "BAD_REQUEST", message: "Missing document_id" }, 400, cors);
    }
  } catch {
    return json({ ok: false, error: "BAD_REQUEST", message: "Invalid JSON body" }, 400, cors);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, user_id, file_path, storage_bucket, mime_type")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docError || !doc) {
    return json({ ok: false, error: "NOT_FOUND", message: "Document not found or access denied" }, 404, cors);
  }

  const bucket = doc.storage_bucket || "uploads";
  const filePath = doc.file_path;
  if (!filePath) {
    return json({ ok: false, error: "BAD_STATE", message: "Document has no file_path" }, 400, cors);
  }

  console.log("[ocr-document] input summary:", {
    bucket,
    path: filePath,
    mime: doc.mime_type ?? null,
    fileName: filePath?.split("/").pop() ?? null,
  });

  console.log("[ocr-document] downloading from storage...", { bucket, path: filePath });
  const { data: fileData, error: downloadError } = await supabase.storage.from(bucket).download(filePath);
  if (downloadError || !fileData) {
    console.error("[ocr-document] Storage download failed", downloadError?.message);
    const { error: updateErr } = await supabase
      .from("documents")
      .update({ status: "ocr_failed", ocr_error: downloadError?.message ?? "Download failed", updated_at: new Date().toISOString() })
      .eq("id", documentId);
    if (updateErr) console.error("[ocr-document] Update failed", updateErr.message);
    return json({ ok: false, error: "STORAGE_ERROR", message: downloadError?.message ?? "Could not read file" }, 500, cors);
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  console.log("[ocr-document] downloaded bytes:", bytes?.byteLength ?? null);

  if (!bytes || bytes.byteLength === 0) {
    return json({ ok: false, error: "file_not_found_or_empty", bucket, path: filePath }, 400, cors);
  }

  const mimeType = doc.mime_type || "image/jpeg";

  if (mimeType === "application/pdf") {
    await supabase
      .from("documents")
      .update({ status: "ocr_failed", ocr_error: "PDF not supported for OCR in this step. Use images.", updated_at: new Date().toISOString() })
      .eq("id", documentId);
    return json({ ok: false, error: "PDF_NOT_SUPPORTED", message: "Convert PDF to images first" }, 400, cors);
  }

  const base64 = btoa(String.fromCharCode(...bytes));
  const googleKey = Deno.env.get("GOOGLE_VISION_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  let ocrText: string;
  if (googleKey) {
    try {
      const result = await googleVisionOcr(base64, googleKey);
      if ("error" in result) {
        console.error("[ocr-document] vision error:", result.error);
        await supabase
          .from("documents")
          .update({ status: "ocr_failed", ocr_error: result.error, updated_at: new Date().toISOString() })
          .eq("id", documentId);
        return json({ ok: false, error: "vision_failed", message: String(result.error) }, 500, cors);
      }
      ocrText = result.text;
    } catch (err) {
      console.error("[ocr-document] vision error:", err);
      await supabase
        .from("documents")
        .update({ status: "ocr_failed", ocr_error: err instanceof Error ? err.message : String(err), updated_at: new Date().toISOString() })
        .eq("id", documentId);
      return json({ ok: false, error: "vision_failed", message: String((err as Error)?.message ?? err) }, 500, cors);
    }
  } else if (openaiKey) {
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const result = await openaiVisionOcr(dataUrl, openaiKey);
    if ("error" in result) {
      console.error("[ocr-document] OpenAI Vision failed", result.error);
      await supabase
        .from("documents")
        .update({ status: "ocr_failed", ocr_error: result.error, updated_at: new Date().toISOString() })
        .eq("id", documentId);
      return json({ ok: false, error: "OCR_FAILED", message: result.error }, 500, cors);
    }
    ocrText = result.text;
  } else {
    await supabase
      .from("documents")
      .update({ status: "ocr_failed", ocr_error: "No OCR provider configured", updated_at: new Date().toISOString() })
      .eq("id", documentId);
    return json({ ok: false, error: "OCR_NOT_CONFIGURED", message: "Set GOOGLE_VISION_API_KEY or OPENAI_API_KEY" }, 500, cors);
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      ocr_text: ocrText,
      raw_text: ocrText,
      status: "ocr_done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (updateError) {
    console.error("[ocr-document] DB update failed", updateError.message);
    return json({ ok: false, error: "DB_ERROR", message: updateError.message }, 500, cors);
  }

  return json(
    {
      ok: true,
      document_id: documentId,
      status: "ocr_done",
      ocr_text_length: ocrText.length,
    },
    200,
    cors
  );
});
