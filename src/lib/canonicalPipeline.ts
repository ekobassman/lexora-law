/**
 * Canonical pipeline: upload-document → ocr-document → analyze-and-draft.
 * Single source for demo chat and case flow. No n8n, no mock, no legacy endpoints.
 */
import { supabase } from "@/integrations/supabase/client";

const BASE =
  import.meta.env.VITE_SUPABASE_URL ||
  (supabase as { supabaseUrl?: string })?.supabaseUrl ||
  "";

function getToken(): Promise<string> {
  return supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessione scaduta. Effettua di nuovo l'accesso.");
    return token;
  });
}

async function fetchJson<T>(
  path: string,
  options: { method?: string; body?: unknown; token: string }
): Promise<{ data: T; ok: boolean; status: number }> {
  const url = `${BASE.replace(/\/$/, "")}/functions/v1/${path}`;
  const res = await fetch(url, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  return { data, ok: res.ok, status: res.status };
}

export interface UploadDocumentResult {
  ok: true;
  document_id: string;
  file_path: string;
  signed_url: string | null;
  status: string;
}

export interface UploadDocumentError {
  ok: false;
  error: string;
  message: string;
}

export async function uploadDocument(
  file: File,
  options?: { caseId?: string; source?: "upload" | "camera" }
): Promise<UploadDocumentResult> {
  const token = await getToken();
  const url = `${BASE.replace(/\/$/, "")}/functions/v1/upload-document`;
  const form = new FormData();
  form.append("file", file);
  if (options?.caseId) form.append("caseId", options.caseId);
  if (options?.source) form.append("source", options.source);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as UploadDocumentResult | UploadDocumentError;
  if (!res.ok) {
    const err = data as UploadDocumentError;
    throw new Error(err?.message ?? err?.error ?? `Upload failed ${res.status}`);
  }
  if (data && typeof data === "object" && "ok" in data && data.ok === true) {
    return data as UploadDocumentResult;
  }
  throw new Error((data as UploadDocumentError)?.message ?? "Upload failed");
}

export interface OcrDocumentResult {
  ok: true;
  document_id: string;
  status: string;
  ocr_text_length: number;
}

export interface OcrDocumentError {
  ok: false;
  error: string;
  message: string;
}

export async function ocrDocument(documentId: string): Promise<OcrDocumentResult> {
  const token = await getToken();
  const { data, ok, status } = await fetchJson<OcrDocumentResult | OcrDocumentError>("ocr-document", {
    token,
    body: { document_id: documentId },
  });
  if (!ok) {
    const err = data as OcrDocumentError;
    throw new Error(err?.message ?? err?.error ?? `OCR failed ${status}`);
  }
  if (data && typeof data === "object" && "ok" in data && data.ok === true) {
    return data as OcrDocumentResult;
  }
  throw new Error((data as OcrDocumentError)?.message ?? "OCR failed");
}

export interface AnalysisItem {
  deadlines?: string[];
  risks?: string[];
  summary?: string;
  suggested_action?: string;
}

export interface AnalyzeAndDraftResult {
  ok: true;
  document_id: string;
  status: string;
  analysis: AnalysisItem;
  draft_text: string;
}

export interface AnalyzeAndDraftError {
  ok: false;
  error: string;
  message: string;
}

export async function analyzeAndDraft(
  documentId: string,
  options?: { userLanguage?: string }
): Promise<AnalyzeAndDraftResult> {
  const token = await getToken();
  const { data, ok, status } = await fetchJson<AnalyzeAndDraftResult | AnalyzeAndDraftError>("analyze-and-draft", {
    token,
    body: { document_id: documentId, user_language: options?.userLanguage ?? "DE" },
  });
  if (!ok) {
    const err = data as AnalyzeAndDraftError;
    throw new Error(err?.message ?? err?.error ?? `Analysis failed ${status}`);
  }
  if (data && typeof data === "object" && "ok" in data && data.ok === true) {
    return data as AnalyzeAndDraftResult;
  }
  throw new Error((data as AnalyzeAndDraftError)?.message ?? "Analysis failed");
}

export interface PipelineResult {
  document_id: string;
  signed_url: string | null;
  ocr_text: string;
  analysis: AnalysisItem;
  draft_text: string;
}

/** Run full pipeline: upload → ocr → analyze-and-draft. Returns final doc data (ocr_text from DB). */
export async function runCanonicalPipeline(
  file: File,
  options?: { caseId?: string; source?: "upload" | "camera"; userLanguage?: string; onProgress?: (step: string) => void }
): Promise<PipelineResult> {
  options?.onProgress?.("uploading");
  const upload = await uploadDocument(file, { caseId: options?.caseId, source: options?.source });
  options?.onProgress?.("ocr");
  await ocrDocument(upload.document_id);
  options?.onProgress?.("analyzing");
  const analysisResult = await analyzeAndDraft(upload.document_id, { userLanguage: options?.userLanguage });

  const { data: docRow } = await supabase
    .from("documents")
    .select("ocr_text")
    .eq("id", upload.document_id)
    .single();

  return {
    document_id: upload.document_id,
    signed_url: upload.signed_url,
    ocr_text: (docRow?.ocr_text as string) ?? "",
    analysis: analysisResult.analysis,
    draft_text: analysisResult.draft_text,
  };
}

/** HEIC not supported in canonical pipeline. */
export function isHeicFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

export const HEIC_NOT_SUPPORTED_MSG =
  "Le foto HEIC non sono supportate. Esporta in JPEG dall'album o scegli un file JPG/PNG.";
