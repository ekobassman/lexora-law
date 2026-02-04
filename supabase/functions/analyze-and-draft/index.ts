/**
 * Canonical pipeline step 3: Analyze OCR text and generate draft.
 * Input: document_id. Reads ocr_text, calls OpenAI for analysis_json (deadlines, risks, summary, suggested_action) and draft_text (DIN-5008 reply).
 * Saves both + status=done. No n8n, no mock. Auth required.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callOpenAI } from "../_shared/openai.ts";

const LANGUAGE_MAP: Record<string, string> = {
  IT: "Italian", DE: "German", EN: "English", FR: "French", ES: "Spanish",
  PL: "Polish", RO: "Romanian", TR: "Turkish", AR: "Arabic", UK: "Ukrainian", RU: "Russian",
};

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED", message: "Use POST" }, 405, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "ENV_MISSING", message: "Server configuration error" }, 500, cors);
  }
  if (!openaiKey) {
    return json({ ok: false, error: "OPENAI_NOT_CONFIGURED", message: "OPENAI_API_KEY required" }, 500, cors);
  }

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

  let documentId: string;
  let userLanguage: string = "DE";
  try {
    const body = (await req.json()) as { document_id?: string; user_language?: string };
    documentId = body?.document_id ?? "";
    if (body?.user_language) userLanguage = String(body.user_language).toUpperCase().slice(0, 2) || "DE";
    if (!documentId) {
      return json({ ok: false, error: "BAD_REQUEST", message: "Missing document_id" }, 400, cors);
    }
  } catch {
    return json({ ok: false, error: "BAD_REQUEST", message: "Invalid JSON body" }, 400, cors);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, user_id, ocr_text, status")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (docError || !doc) {
    return json({ ok: false, error: "NOT_FOUND", message: "Document not found or access denied" }, 404, cors);
  }

  const ocrText = doc.ocr_text?.trim();
  if (!ocrText) {
    return json({ ok: false, error: "NO_OCR", message: "Document has no OCR text. Run ocr-document first." }, 400, cors);
  }

  const langName = LANGUAGE_MAP[userLanguage] || "German";

  const systemPrompt = `You are Lexora, a legal-tech assistant. Analyze the following official letter (OCR text) and produce TWO outputs in the user's language (${langName}).

OUTPUT 1 - JSON (single valid JSON object, no markdown):
{
  "deadlines": ["list of any deadlines or Fristen mentioned"],
  "risks": ["main risks if the user does not act"],
  "summary": "brief summary of what the letter is about",
  "suggested_action": "what the user should do next"
}

OUTPUT 2 - DRAFT LETTER:
After the JSON, write "---DRAFT---" on a new line, then the full reply letter in DIN 5008 style (formal letter in ${langName}): sender block, date, recipient, subject, body, closing. No placeholder brackets like [Name]. Use clear formal language.`;

  const userPrompt = `Letter text to analyze and reply to:\n\n${ocrText.slice(0, 12000)}`;

  const result = await callOpenAI({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 3500,
  });

  if (!result.ok) {
    console.error("[analyze-and-draft] OpenAI failed", result.error);
    await supabase
      .from("documents")
      .update({ status: "ocr_done", updated_at: new Date().toISOString() })
      .eq("id", documentId);
    return json({ ok: false, error: "AI_FAILED", message: result.error ?? "Analysis failed" }, 500, cors);
  }

  const content = (result.content ?? "").trim();
  let analysisJson: Record<string, unknown> = {};
  let draftText = "";

  const draftSep = "---DRAFT---";
  const draftIdx = content.indexOf(draftSep);
  if (draftIdx >= 0) {
    const beforeDraft = content.slice(0, draftIdx).trim();
    draftText = content.slice(draftIdx + draftSep.length).trim();
    try {
      const jsonMatch = beforeDraft.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisJson = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      }
    } catch {
      analysisJson = { summary: beforeDraft.slice(0, 500) };
    }
  } else {
    draftText = content;
    analysisJson = { summary: "Analysis completed." };
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      analysis_json: analysisJson,
      draft_text: draftText,
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (updateError) {
    console.error("[analyze-and-draft] DB update failed", updateError.message);
    return json({ ok: false, error: "DB_ERROR", message: updateError.message }, 500, cors);
  }

  return json(
    {
      ok: true,
      document_id: documentId,
      status: "done",
      analysis: analysisJson,
      draft_text: draftText,
    },
    200,
    cors
  );
});
