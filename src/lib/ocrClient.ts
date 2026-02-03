/**
 * Client for Vercel /api/ocr (Google Cloud Vision).
 * Use this everywhere OCR is needed so a single endpoint and env (GOOGLE_APPLICATION_CREDENTIALS_JSON) are used.
 */

export interface OcrResult {
  text: string | null;
  pages?: number;
  /** API error code / short message */
  error?: string;
  /** Detailed message from API (e.g. missing credentials, Vision API error) */
  details?: string;
}

function getOcrBaseUrl(): string {
  if (typeof window === "undefined") return "";
  // Optional: in local dev (Vite only) set VITE_OCR_API_ORIGIN to your Vercel URL so /api/ocr is reachable
  const envOrigin = import.meta.env.VITE_OCR_API_ORIGIN;
  if (typeof envOrigin === "string" && envOrigin.trim()) return envOrigin.trim().replace(/\/$/, "");
  return window.location.origin;
}

/**
 * Call the app's /api/ocr endpoint. Base64 can be raw or data-URL prefix (e.g. "data:image/jpeg;base64,...").
 * Returns { text, pages?, error?, details? }. On success text is set; on failure text is null and error/details may be set.
 */
export async function ocrWithBase64(base64: string, mimeType: string): Promise<OcrResult> {
  const base = getOcrBaseUrl();
  const url = `${base}/api/ocr`;
  const body = typeof base64 === "string" && base64.includes(",")
    ? { base64: base64.split(",")[1]?.trim() ?? base64, mimeType }
    : { base64, mimeType };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as { text?: string; pages?: number; error?: string; details?: string } | null;
    if (!res.ok) {
      const details = data?.details ?? data?.error ?? (res.status === 500 ? "Server error" : `HTTP ${res.status}`);
      return { text: null, error: data?.error ?? "OCR failed", details };
    }
    const text = typeof data?.text === "string" ? data.text : null;
    const pages = typeof data?.pages === "number" ? data.pages : undefined;
    return text !== null ? { text, pages } : { text: null, error: "No text", details: "API returned no text" };
  } catch (err) {
    const details = err instanceof Error ? err.message : "Network or request failed";
    return { text: null, error: "OCR failed", details };
  }
}

/**
 * Run OCR on a File (image or PDF). Reads file as base64 and calls /api/ocr.
 */
export async function ocrFromFile(file: File): Promise<OcrResult> {
  const base64 = await fileToBase64(file);
  const mimeType = file.type || guessMimeType(file);
  return ocrWithBase64(base64, mimeType);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = reject;
  });
}

function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
