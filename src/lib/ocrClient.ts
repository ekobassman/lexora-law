/**
 * Client for Vercel /api/ocr (Google Cloud Vision).
 * Use this everywhere OCR is needed so a single endpoint and env (GOOGLE_APPLICATION_CREDENTIALS_JSON) are used.
 */

export interface OcrResult {
  text: string;
  pages?: number;
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
 * Returns extracted text or null on failure.
 */
export async function ocrWithBase64(base64: string, mimeType: string): Promise<string | null> {
  const base = getOcrBaseUrl();
  const url = `${base}/api/ocr`;
  const body = typeof base64 === "string" && base64.includes(",")
    ? { base64: base64.split(",")[1]?.trim() ?? base64, mimeType }
    : { base64, mimeType };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) return null;
  const text = data?.text;
  return typeof text === "string" ? text : null;
}

/**
 * Run OCR on a File (image or PDF). Reads file as base64 and calls /api/ocr.
 */
export async function ocrFromFile(file: File): Promise<string | null> {
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
