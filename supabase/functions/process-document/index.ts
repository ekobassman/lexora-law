/**
 * LEXORA: Pipeline unico upload + OCR (OpenAI Vision).
 * POST multipart (file, caseId?, source?) o JSON { base64, mimeType, caseId? }
 * Bucket: documents. Path: userId/caseId||no-case/timestamp-safeFilename
 * Log: pipeline_runs ad ogni step. Ritorno sempre JSON con code/where.
 * OCR: OpenAI Vision (immagini). PDF: status ocr_failed, code PDF_NOT_SUPPORTED.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const PDF_NOT_SUPPORTED_MSG = "Convert PDF pages to images first.";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

async function logStep(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  userId: string | null,
  docId: string | null,
  step: string,
  ok: boolean,
  code?: string,
  message?: string,
  meta?: Record<string, unknown>
) {
  try {
    const { error } = await supabase.from("pipeline_runs").insert({
      run_id: runId,
      user_id: userId ?? null,
      doc_id: docId,
      step,
      ok,
      code: code ?? null,
      message: message ?? null,
      meta: meta ?? {},
    });
    if (error) console.error("[process-document] logStep failed", step, error.message);
  } catch (e) {
    console.error("[process-document] logStep exception", step, e);
  }
}

/**
 * OCR con OpenAI Vision: image bytes -> base64 data URL -> Chat Completions con prompt testo.
 */
async function openaiVisionOcr(
  base64DataUrl: string,
  apiKey: string,
  model: string
): Promise<{ text: string } | { error: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: base64DataUrl } },
              {
                type: "text",
                text: "Extract ALL text exactly as it appears. Preserve line breaks. No commentary.",
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { error: `OpenAI ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return { text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

serve(async (req) => {
  const ts = new Date().toISOString();
  const runId = crypto.randomUUID();
  const errPayload = (where: string, code: string, message: string) =>
    ({ ok: false, where, code, message, run_id: runId, ts });

  let supabase: ReturnType<typeof createClient> | null = null;
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") {
      return json(errPayload("method", "METHOD_NOT_ALLOWED", "Use POST"), 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const visionModel = Deno.env.get("OPENAI_MODEL_VISION") ?? "gpt-4o-mini";

    if (!supabaseUrl || !serviceKey) {
      return json(errPayload("env", "ENV_MISSING", "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing"), 500);
    }

    try {
      supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(errPayload("env", "CLIENT_ERROR", msg), 500);
    }

    const requestMeta = {
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    };
    await logStep(supabase, runId, null, null, "start", true, undefined, undefined, requestMeta);

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      await logStep(supabase, runId, null, null, "auth_failed", false, "MISSING_BEARER", "Authorization Bearer required");
      return json(errPayload("auth", "MISSING_BEARER", "Authorization Bearer required"), 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let userId: string;
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        await logStep(supabase, runId, null, null, "auth_failed", false, "INVALID_TOKEN", userError?.message ?? "Invalid token");
        return json(errPayload("auth", "INVALID_TOKEN", userError?.message ?? "Invalid token"), 401);
      }
      userId = userData.user.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logStep(supabase, runId, null, null, "auth_failed", false, "AUTH_ERROR", msg);
      return json(errPayload("auth", "AUTH_ERROR", msg), 401);
    }

    await supabase.from("pipeline_runs").update({ user_id: userId }).eq("run_id", runId).is("user_id", null);
    await logStep(supabase, runId, userId, null, "auth_ok", true);

    let fileBytes: Uint8Array;
    let fileName: string;
    let mimeType: string;
    let caseId: string | null = null;

    try {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const caseIdParam = formData.get("caseId") as string | null;
        if (caseIdParam) caseId = caseIdParam;
        if (!file || !(file instanceof File)) {
          await logStep(supabase, runId, userId, null, "payload_error", false, "NO_FILE", "Missing file in form");
          return json(errPayload("payload", "NO_FILE", "Missing file in form"), 400);
        }
        fileBytes = new Uint8Array(await file.arrayBuffer());
        fileName = file.name || "upload";
        mimeType = file.type || "application/octet-stream";
      } else {
        const body = (await req.json().catch(() => null)) as { base64?: string; mimeType?: string; caseId?: string } | null;
        if (!body?.base64 || typeof body.base64 !== "string") {
          await logStep(supabase, runId, userId, null, "payload_error", false, "NO_BASE64", "Missing base64 in body");
          return json(errPayload("payload", "NO_BASE64", "Missing base64 in body"), 400);
        }
        const raw = body.base64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
        try {
          fileBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
        } catch {
          await logStep(supabase, runId, userId, null, "payload_error", false, "INVALID_BASE64", "Invalid base64");
          return json(errPayload("payload", "INVALID_BASE64", "Invalid base64"), 400);
        }
        fileName = "camera-capture";
        mimeType = (body.mimeType as string) || "image/jpeg";
        if (body.caseId) caseId = String(body.caseId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logStep(supabase, runId, userId, null, "payload_error", false, "PAYLOAD_ERROR", msg);
      return json(errPayload("payload", "PAYLOAD_ERROR", msg), 400);
    }

    if (fileBytes.length > MAX_FILE_BYTES) {
      await logStep(supabase, runId, userId, null, "validation_failed", false, "FILE_TOO_LARGE", `Max ${MAX_FILE_BYTES} bytes`);
      return json(errPayload("validation", "FILE_TOO_LARGE", `File too large (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB)`), 413);
    }
    const allowed = ALLOWED_MIMES.some((m) => mimeType.toLowerCase() === m || mimeType.toLowerCase().startsWith(m.split("/")[0]));
    if (!allowed) {
      await logStep(supabase, runId, userId, null, "validation_failed", false, "INVALID_TYPE", "Allowed: jpeg, png, webp, pdf");
      return json(errPayload("validation", "INVALID_TYPE", "Allowed: jpeg, png, webp, pdf"), 400);
    }

    const pathPrefix = caseId ? `${userId}/${caseId}` : `${userId}/no-case`;
    const pathSegment = `${Date.now()}-${safeFilename(fileName)}`;
    const storagePath = `${pathPrefix}/${pathSegment}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) {
      await logStep(supabase, runId, userId, null, "upload_storage_failed", false, "STORAGE_ERROR", uploadError.message, { path: storagePath });
      return json(errPayload("upload_storage", "STORAGE_ERROR", uploadError.message), 500);
    }
    await logStep(supabase, runId, userId, null, "upload_storage_ok", true, undefined, undefined, { path: storagePath });

    const docRow = {
      user_id: userId,
      case_id: caseId,
      pratica_id: caseId,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size: fileBytes.length,
      size_bytes: fileBytes.length,
      status: "uploaded",
      direction: "incoming",
    };
    const { data: insertDoc, error: insertError } = await supabase.from("documents").insert(docRow).select("id").single();
    if (insertError) {
      await logStep(supabase, runId, userId, null, "insert_db_failed", false, "DB_ERROR", insertError.message);
      return json(errPayload("insert_db", "DB_ERROR", insertError.message), 500);
    }
    const docId = insertDoc.id;
    await logStep(supabase, runId, userId, docId, "insert_db_ok", true);

    let ocrText: string | null = null;
    let ocrError: string | null = null;
    let status = "uploaded";
    let warning: { ocr?: string } | undefined;

    if (mimeType === "application/pdf") {
      ocrError = PDF_NOT_SUPPORTED_MSG;
      status = "ocr_failed";
      await logStep(supabase, runId, userId, docId, "ocr_start", true);
      await logStep(supabase, runId, userId, docId, "ocr_failed", false, "PDF_NOT_SUPPORTED", PDF_NOT_SUPPORTED_MSG);
    } else if (mimeType.startsWith("image/")) {
      await logStep(supabase, runId, userId, docId, "ocr_start", true);
      if (!openaiKey) {
        warning = { ocr: "disabled" };
        await logStep(supabase, runId, userId, docId, "ocr_done", true, undefined, undefined, { skipped: true, reason: "no_openai_key" });
      } else {
        const base64ForVision = `data:${mimeType};base64,${btoa(String.fromCharCode(...fileBytes))}`;
        const ocrResult = await openaiVisionOcr(base64ForVision, openaiKey, visionModel);
        if ("error" in ocrResult) {
          ocrError = ocrResult.error;
          status = "ocr_failed";
          await logStep(supabase, runId, userId, docId, "ocr_failed", false, "OCR_FAILED", ocrResult.error);
        } else {
          ocrText = ocrResult.text;
          status = "ocr_done";
          await logStep(supabase, runId, userId, docId, "ocr_done", true, undefined, undefined, { textLength: ocrText.length });
        }
      }
    } else {
      await logStep(supabase, runId, userId, docId, "ocr_start", true);
      if (!openaiKey) warning = { ocr: "disabled" };
      await logStep(supabase, runId, userId, docId, "ocr_done", true, undefined, undefined, { skipped: true });
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        ocr_text: ocrText,
        ocr_error: ocrError,
        status,
        updated_at: new Date().toISOString(),
        raw_text: ocrText,
        ultima_run_id: runId,
      })
      .eq("id", docId);
    if (updateError) {
      await logStep(supabase, runId, userId, docId, "save_ocr_failed", false, "UPDATE_ERROR", updateError.message);
    } else {
      await logStep(supabase, runId, userId, docId, "save_ocr_ok", true);
    }

    await logStep(supabase, runId, userId, docId, "done", true);

    const textPreview = ocrText ? ocrText.slice(0, 200) + (ocrText.length > 200 ? "…" : "") : null;
    return json(
      {
        ok: true,
        doc: { id: docId, storage_path: storagePath, status, has_text: !!ocrText, text_preview: textPreview },
        run_id: runId,
        ts,
        ...(warning && { warning }),
        ...(status === "ocr_failed" && ocrError === PDF_NOT_SUPPORTED_MSG && { code: "PDF_NOT_SUPPORTED", message: PDF_NOT_SUPPORTED_MSG }),
      },
      200
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[process-document] unhandled", msg);
    try {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const client = supabase ?? (url && key ? createClient(url, key, { auth: { persistSession: false } }) : null);
      if (client) {
        await logStep(client, runId, null, null, "unhandled", false, "INTERNAL", msg);
      }
    } catch (_) {
      /* ignore */
    }
    return json(errPayload("unhandled", "INTERNAL", msg), 500);
  }
});
