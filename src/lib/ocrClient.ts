/**
 * OCR client: tries Supabase Edge Function `ocr` first (if VITE_SUPABASE_URL set),
 * then falls back to Vercel /api/ocr (Google Cloud Vision).
 * All error responses include CORS and return JSON with error/details for UI.
 */

export interface OcrResult {
  text: string | null;
  pages?: number;
  /** API error code / short message */
  error?: string;
  /** Detailed message from API (e.g. missing credentials, Vision API error) */
  details?: string;
}

function getSupabaseOcrUrl(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (typeof url === "string" && url.trim()) return url.trim().replace(/\/$/, "") + "/functions/v1/ocr";
  return null;
}

function getSupabaseAnonKey(): string | null {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof key === "string" && key.trim()) return key.trim();
  return null;
}

function getOcrBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const envOrigin = import.meta.env.VITE_OCR_API_ORIGIN;
  if (typeof envOrigin === "string" && envOrigin.trim()) return envOrigin.trim().replace(/\/$/, "");
  return window.location.origin;
}

/** Try Supabase Edge Function ocr (JSON body with base64). Returns null if not configured or on failure. */
async function ocrWithSupabase(base64: string, mimeType: string): Promise<OcrResult | null> {
  const url = getSupabaseOcrUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  const rawBase64 = typeof base64 === "string" && base64.includes(",") ? base64.split(",")[1]?.trim() ?? base64 : base64;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ base64: rawBase64, mimeType }),
    });

    const data = (await res.json().catch(() => null)) as { success?: boolean; text?: string; error?: string; details?: string; tip?: string } | null;
    if (!res.ok) {
      const error = data?.error ?? "Could not read document. Try again.";
      const details = [data?.details, data?.tip].filter(Boolean).join(" ") || `HTTP ${res.status}`;
      return { text: null, error, details };
    }
    if (data?.success && typeof data?.text === "string") {
      return { text: data.text };
    }
    return { text: null, error: data?.error ?? "No text", details: data?.details ?? "No text in response" };
  } catch (err) {
    const details = err instanceof Error ? err.message : "Network or request failed";
    return { text: null, error: "Could not read document. Try again.", details };
  }
}

/** Call Vercel /api/ocr (Google Cloud Vision). */
async function ocrWithVercel(base64: string, mimeType: string): Promise<OcrResult> {
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
      return { text: null, error: data?.error ?? "Could not read document. Try again.", details };
    }
    const text = typeof data?.text === "string" ? data.text : null;
    const pages = typeof data?.pages === "number" ? data.pages : undefined;
    return text !== null ? { text, pages } : { text: null, error: "No text", details: "API returned no text" };
  } catch (err) {
    const details = err instanceof Error ? err.message : "Network or request failed";
    return { text: null, error: "Could not read document. Try again.", details };
  }
}

/**
 * Call OCR: Supabase Edge Function first (if configured), then Vercel /api/ocr.
 * Base64 can be raw or data-URL prefix (e.g. "data:image/jpeg;base64,...").
 */
export async function ocrWithBase64(base64: string, mimeType: string): Promise<OcrResult> {
  const supabaseResult = await ocrWithSupabase(base64, mimeType);
  if (supabaseResult !== null) return supabaseResult;
  return ocrWithVercel(base64, mimeType);
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Run OCR on a File (image or PDF). Optionally compresses large images before upload.
 */
export async function ocrFromFile(file: File): Promise<OcrResult> {
  const mimeType = file.type || guessMimeType(file);
  let f = file;
  if (ALLOWED_IMAGE_TYPES.includes(mimeType) && file.size > 2 * 1024 * 1024) {
    f = await compressImageForOcr(file, 1920, 0.8).catch(() => file);
  }
  if (f.size > MAX_FILE_SIZE) {
    return {
      text: null,
      error: "File too large (max 10MB)",
      details: `File is ${Math.round(f.size / 1024)}KB. Use a smaller image or compress it.`,
    };
  }
  const base64 = await fileToBase64(f);
  return ocrWithBase64(base64, mimeType);
}

/** Compress image to reduce size before OCR (avoids timeouts / memory issues). */
function compressImageForOcr(file: File, maxWidth: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
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
