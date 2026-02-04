/**
 * Client per pipeline unico upload+OCR: chiama Edge Function process-document.
 * Un solo endpoint: multipart (file) o JSON (base64 + mimeType + caseId?).
 */

import { supabase } from "@/integrations/supabase/client";

const BASE =
  import.meta.env.VITE_SUPABASE_URL ||
  (supabase as { supabaseUrl?: string })?.supabaseUrl ||
  "";

export interface ProcessDocumentResult {
  ok: true;
  doc: { id: string; storage_path: string; status: string; has_text: boolean; text_preview: string | null };
  run_id: string | null;
  ts: string;
  warning?: { ocr?: string };
  /** Set when status is ocr_failed and document was PDF (hint for UI). */
  code?: string;
  message?: string;
}

/** Returns true if the file is HEIC/HEIF (iPhone camera). We do not support HEIC; client should block or convert to JPEG. */
export function isHeicFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

/** HEIC not supported message for UI. */
export const HEIC_NOT_SUPPORTED_MSG =
  "Le foto HEIC non sono supportate. Esporta in JPEG dall’album o scegli un file JPG/PNG.";

export interface ProcessDocumentError {
  ok: false;
  where: string;
  code: string;
  message: string;
  run_id?: string | null;
  ts: string;
}

/** Error with optional run_id (from process-document). */
export type ProcessDocumentErrorLike = Error & { code?: string; where?: string; run_id?: string | null };

/**
 * Build message and optional action label for process-document error toasts.
 * Shows "Run ID: xxx" only in admin or dev mode; admin gets actionLabel "Apri Pipeline Runs".
 * Caller adds action.onClick (e.g. navigate(`/admin/pipeline-runs?run_id=${runId}`)).
 */
export function getProcessDocumentErrorToast(
  err: ProcessDocumentErrorLike,
  options?: { isAdmin?: boolean; filePrefix?: string }
): { message: string; runId: string | null; actionLabel: string | null } {
  const msg = err?.message ?? "Errore";
  const runId = err?.run_id ?? null;
  const isAdmin = options?.isAdmin ?? false;
  const dev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
  const prefix = options?.filePrefix ? `${options.filePrefix}: ` : "";
  let message = prefix + msg;
  if (runId && (isAdmin || dev)) {
    message += ` Run ID: ${runId}`;
  }
  const actionLabel = isAdmin && runId ? "Apri Pipeline Runs" : null;
  return { message, runId, actionLabel };
}

function getToken(): Promise<string> {
  return supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessione scaduta. Effettua di nuovo l'accesso.");
    return token;
  });
}

/**
 * Invia un file (multipart) a process-document. Opzionale caseId (pratica/case).
 */
export async function processDocumentWithFile(
  file: File,
  options?: { caseId?: string }
): Promise<ProcessDocumentResult> {
  if (isHeicFile(file)) {
    const e = new Error(HEIC_NOT_SUPPORTED_MSG) as Error & { code?: string };
    e.code = "HEIC_NOT_SUPPORTED";
    throw e;
  }
  const token = await getToken();
  const url = `${BASE.replace(/\/$/, "")}/functions/v1/process-document`;
  const form = new FormData();
  form.append("file", file);
  if (options?.caseId) form.append("caseId", options.caseId);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as ProcessDocumentResult | ProcessDocumentError;
  if (!res.ok) {
    const err = data as ProcessDocumentError;
    const msg = err?.message ?? `Errore ${res.status}`;
    const code = err?.code ?? "UNKNOWN";
    const e = new Error(msg) as Error & { code?: string; where?: string; run_id?: string | null };
    e.code = code;
    e.where = err?.where;
    e.run_id = err?.run_id ?? null;
    throw e;
  }
  if (data && typeof data === "object" && "ok" in data && data.ok === true) {
    return data as ProcessDocumentResult;
  }
  const fallback = data as ProcessDocumentError;
  const ex = new Error(fallback?.message ?? "Risposta non valida") as Error & { run_id?: string | null };
  ex.run_id = fallback?.run_id ?? null;
  throw ex;
}

/** MIME types for HEIC/HEIF (iPhone); not accepted by process-document. */
const HEIC_MIMES = ["image/heic", "image/heif"];

/**
 * Invia base64 (es. da camera) a process-document.
 */
export async function processDocumentWithBase64(
  base64: string,
  mimeType: string,
  options?: { caseId?: string }
): Promise<ProcessDocumentResult> {
  const m = (mimeType || "").toLowerCase();
  if (HEIC_MIMES.some((h) => m.includes(h))) {
    const e = new Error(HEIC_NOT_SUPPORTED_MSG) as Error & { code?: string };
    e.code = "HEIC_NOT_SUPPORTED";
    throw e;
  }
  const token = await getToken();
  const url = `${BASE.replace(/\/$/, "")}/functions/v1/process-document`;
  const body = JSON.stringify({
    base64: base64.replace(/^data:[^;]+;base64,/, "").trim(),
    mimeType: mimeType || "image/jpeg",
    ...(options?.caseId && { caseId: options.caseId }),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body,
  });

  const data = (await res.json().catch(() => ({}))) as ProcessDocumentResult | ProcessDocumentError;
  if (!res.ok) {
    const err = data as ProcessDocumentError;
    const msg = err?.message ?? `Errore ${res.status}`;
    const code = err?.code ?? "UNKNOWN";
    const e = new Error(msg) as Error & { code?: string; where?: string; run_id?: string | null };
    e.code = code;
    e.where = err?.where;
    e.run_id = err?.run_id ?? null;
    throw e;
  }
  if (data && typeof data === "object" && "ok" in data && data.ok === true) {
    return data as ProcessDocumentResult;
  }
  const fallback = data as ProcessDocumentError;
  const ex = new Error(fallback?.message ?? "Risposta non valida") as Error & { run_id?: string | null };
  ex.run_id = fallback?.run_id ?? null;
  throw ex;
}
