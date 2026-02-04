/**
 * OCR client: uses ONLY Vercel /api/ocr (OpenAI Vision).
 * Bypasses Supabase Edge Functions to avoid CORS issues.
 */

export interface OcrResult {
  text: string | null;
  pages?: number;
  error?: string;
  details?: string;
}

/** Relative path so same-origin request hits Vercel /api/ocr (e.g. lexora-law.com/api/ocr). */
function getOcrApiUrl(): string {
  const envOrigin = import.meta.env.VITE_OCR_API_ORIGIN;
  if (typeof envOrigin === "string" && envOrigin.trim()) return envOrigin.trim().replace(/\/$/, "") + "/api/ocr";
  return "/api/ocr";
}

/** Normalize base64: strip data URL prefix if present. */
function cleanBase64(base64: string): string {
  if (typeof base64 !== "string") return "";
  const comma = base64.indexOf(",");
  if (comma !== -1) return base64.slice(comma + 1).trim();
  return base64.trim();
}

/**
 * Call Vercel /api/ocr only. Base64 can be raw or data-URL (data:image/jpeg;base64,...).
 */
export async function ocrWithBase64(base64: string, mimeType: string): Promise<OcrResult> {
  const url = getOcrApiUrl();
  const rawBase64 = cleanBase64(base64);
  const body = { base64: rawBase64, mimeType: mimeType || "image/jpeg" };

  try {
    const res = await fetch(url.startsWith("http") ? url : (typeof window !== "undefined" ? window.location.origin : "") + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as { text?: string; pages?: number; error?: string; details?: string } | null;
    if (!res.ok) {
      const error = data?.error ?? "Could not read document. Try again.";
      const details = data?.details ?? `HTTP ${res.status}`;
      return { text: null, error, details };
    }
    const text = typeof data?.text === "string" ? data.text : null;
    const pages = typeof data?.pages === "number" ? data.pages : undefined;
    if (text !== null) return { text, pages };
    return { text: null, error: data?.error ?? "No text", details: data?.details ?? "API returned no text" };
  } catch (err) {
    const details = err instanceof Error ? err.message : "Network or request failed";
    return { text: null, error: "Could not read document. Try again.", details };
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Run OCR on a File. Compresses images > 2MB before upload. Uses only Vercel /api/ocr.
 */
export async function ocrFromFile(file: File): Promise<OcrResult> {
  const processedFile =
    file.size > 2 * 1024 * 1024 ? await compressImageForOcr(file, 1920, 0.8).catch(() => file) : file;

  if (processedFile.size > MAX_FILE_SIZE) {
    return {
      text: null,
      error: "File too large (max 10MB)",
      details: `File is ${Math.round(processedFile.size / 1024)}KB. Use a smaller image or compress it.`,
    };
  }

  const base64 = await fileToBase64(processedFile);
  const mimeType = processedFile.type || "image/jpeg";
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

function compressImageForOcr(file: File, maxWidth: number, quality: number): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = (event.target?.result as string) ?? "";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
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

function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
