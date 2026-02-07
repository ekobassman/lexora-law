/**
 * Canonical pipeline: upload-document → ocr-document → analyze-and-draft.
 * Single source for demo chat and case flow. No n8n, no mock, no legacy endpoints.
 *
 * Dev check: In browser Network tab, request to /functions/v1/upload-document should have
 * Authorization: Bearer <token> for logged-in users; x-demo-mode: true for demo. No http://ip-api.com in repo.
 */
import { supabase } from '@/lib/supabaseClient';

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

function getAnonKey(): string {
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    "";
  if (!key) throw new Error("Configurazione Supabase mancante.");
  return key;
}

/**
 * For demo mode: use valid session token (or create anonymous session so we always send a real JWT).
 * Edge Functions accept X-Demo-Mode: true and use ANON_DEMO_USER_ID without validating the JWT.
 */
async function getDemoToken(): Promise<string> {
  // 1. Controlla sessione esistente
  let { data: { session } } = await supabase.auth.getSession();

  // 2. Se non c'è, chiama signInAnonymously() (crea JWT eyJ...)
  if (!session) {
    const { data: anonSession, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[getDemoToken] Errore signInAnonymously:", error);
      throw error;
    }
    session = anonSession.session;
  }

  // 3. Se ancora non c'è access_token, errore
  if (!session?.access_token) {
    throw new Error("Impossibile ottenere token demo");
  }

  return session.access_token;
}

async function fetchJson<T>(
  path: string,
  options: { method?: string; body?: unknown; token: string; headers?: Record<string, string> }
): Promise<{ data: T; ok: boolean; status: number }> {
  const url = `${BASE.replace(/\/$/, "")}/functions/v1/${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${options.token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    ...options.headers,
  };
  const res = await fetch(url, {
    method: options.method ?? "POST",
    headers,
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
  options?: { caseId?: string; source?: "upload" | "camera"; isDemo?: boolean }
): Promise<UploadDocumentResult> {
  console.log("[DEBUG-processDocument] Chiamata funzione: uploadDocument (canonicalPipeline)", { file: file?.name, fileSize: file?.size, fileType: file?.type, options });
  const explicitDemo = options?.isDemo === true;
  const headers: Record<string, string> = {};

  if (explicitDemo) {
    const demoToken = await getDemoToken();
    headers["X-Demo-Mode"] = "true";
    headers["Authorization"] = `Bearer ${demoToken}`;
    console.log("[auth] upload-document: demo path", {
      hasAuthHeader: true,
      tokenPreview: demoToken.substring(0, 20) + "...",
      isDemo: true,
    });
  } else {
    await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token ?? null;
    const hasSession = !!data?.session;
    const hasAuthHeader = !!accessToken;
    console.log("[auth] upload-document token info", { hasSession, hasAuthHeader });
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    } else {
      const err = new Error("Sessione scaduta. Effettua di nuovo l'accesso.") as Error & { code?: string };
      err.code = "SESSION_EXPIRED";
      throw err;
    }
  }

  const url = `${BASE.replace(/\/$/, "")}/functions/v1/upload-document`;
  const form = new FormData();
  form.append("file", file);
  if (options?.caseId) form.append("caseId", options.caseId);
  if (options?.source) form.append("source", options.source);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as UploadDocumentResult | UploadDocumentError;
  console.log("[DEBUG-UPLOAD] Risposta upload-document (Supabase):", { ok: res.ok, status: res.status, data });
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

export async function ocrDocument(
  documentId: string,
  options?: { isDemo?: boolean }
): Promise<OcrDocumentResult> {
  const explicitDemo = options?.isDemo === true;
  let token: string;
  let extraHeaders: Record<string, string> | undefined;
  if (explicitDemo) {
    token = await getDemoToken();
    extraHeaders = { "X-Demo-Mode": "true" };
  } else {
    try {
      token = await getToken();
    } catch {
      token = await getDemoToken();
      extraHeaders = { "X-Demo-Mode": "true" };
    }
  }
  const { data, ok, status } = await fetchJson<OcrDocumentResult | OcrDocumentError>("ocr-document", {
    token,
    body: { document_id: documentId },
    headers: extraHeaders,
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
  /** Set by Edge Function so demo client can use it without reading from DB (RLS). */
  ocr_text?: string;
}

export interface AnalyzeAndDraftError {
  ok: false;
  error: string;
  message: string;
}

export async function analyzeAndDraft(
  documentId: string,
  options?: { userLanguage?: string; isDemo?: boolean }
): Promise<AnalyzeAndDraftResult> {
  const explicitDemo = options?.isDemo === true;
  let token: string;
  let extraHeaders: Record<string, string> | undefined;
  if (explicitDemo) {
    token = await getDemoToken();
    extraHeaders = { "X-Demo-Mode": "true" };
  } else {
    try {
      token = await getToken();
    } catch {
      token = await getDemoToken();
      extraHeaders = { "X-Demo-Mode": "true" };
    }
  }
  const { data, ok, status } = await fetchJson<AnalyzeAndDraftResult | AnalyzeAndDraftError>("analyze-and-draft", {
    token,
    body: { document_id: documentId, user_language: options?.userLanguage ?? "DE" },
    headers: extraHeaders,
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

/** Run full pipeline: upload → ocr → analyze-and-draft. Returns final doc data (ocr_text from DB or from last step in demo). */
export async function runCanonicalPipeline(
  file: File,
  options?: { caseId?: string; source?: "upload" | "camera"; userLanguage?: string; onProgress?: (step: string) => void; isDemo?: boolean }
): Promise<PipelineResult> {
  const isDemo = options?.isDemo === true;
  options?.onProgress?.("uploading");
  const upload = await uploadDocument(file, { caseId: options?.caseId, source: options?.source, isDemo });
  console.log("[pipeline] upload-document response:", upload);

  options?.onProgress?.("ocr");
  // No OCR skip branch: always call ocr-document after upload
  console.log("[pipeline] calling ocr-document with:", {
    documentId: upload.document_id,
    path: upload.file_path,
    bucket: "(from doc in EF)",
    mimeType: "(from doc in EF)",
    isDemo,
  });
  await ocrDocument(upload.document_id, { isDemo });
  options?.onProgress?.("analyzing");
  const analysisResult = await analyzeAndDraft(upload.document_id, { userLanguage: options?.userLanguage, isDemo });

  let ocrText: string;
  if (analysisResult.ocr_text) {
    ocrText = analysisResult.ocr_text;
  } else {
    const { data: docRow } = await supabase
      .from("documents")
      .select("ocr_text")
      .eq("id", upload.document_id)
      .single();
    ocrText = (docRow?.ocr_text as string) ?? "";
  }

  return {
    document_id: upload.document_id,
    signed_url: upload.signed_url,
    ocr_text: ocrText,
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
