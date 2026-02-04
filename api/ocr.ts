/**
 * POST /api/ocr – Google Cloud Vision OCR (images + PDFs).
 * Credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON only. Node runtime only.
 * Verification: GET /api/ocr/ping shows hasKey and projectIdFromKey; POST with { base64, mimeType } returns { text, pages? }.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ImageAnnotatorClient } from "@google-cloud/vision/build/src/v1";

export const config = { runtime: "nodejs" };

function getCredentials(): Record<string, unknown> | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

/** If base64 contains a comma, strip prefix (e.g. data:image/jpeg;base64,) and keep content after comma. */
function normalizeBase64(base64: string): string {
  const commaIdx = base64.indexOf(",");
  if (commaIdx !== -1) return base64.slice(commaIdx + 1).trim();
  return base64.trim();
}

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Content-Type", "application/json");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "OCR failed", details: "Method not allowed" });
  }

  try {
    const credentials = getCredentials();
    if (!credentials) {
      return res.status(500).json({
        error: "Could not read document. Try again.",
        details: "GOOGLE_APPLICATION_CREDENTIALS_JSON missing or invalid JSON",
      });
    }

    const body = typeof req.body === "object" && req.body !== null ? (req.body as { base64?: string; mimeType?: string }) : {};
    const rawBase64 = body.base64;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";
    if (!rawBase64 || typeof rawBase64 !== "string") {
      return res.status(400).json({ error: "Could not read document. Try again.", details: "Missing base64" });
    }

    const base64 = normalizeBase64(rawBase64);
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      return res.status(400).json({ error: "Could not read document. Try again.", details: "Invalid base64" });
    }
    if (buffer.length === 0) {
      return res.status(400).json({ error: "Could not read document. Try again.", details: "Empty file" });
    }

    const client = new ImageAnnotatorClient({ credentials });
    const isPdf = mimeType.toLowerCase() === "application/pdf";

    if (isPdf) {
      const [result] = await client.batchAnnotateFiles({
        requests: [
          {
            inputConfig: {
              mimeType: "application/pdf",
              content: buffer,
            },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" as const }],
            pages: [1, 2, 3, 4, 5],
          },
        ],
      });

      const fileResponses = result?.responses?.[0]?.responses ?? [];
      const texts: string[] = [];
      for (const r of fileResponses) {
        const t = r?.fullTextAnnotation?.text;
        if (typeof t === "string" && t) texts.push(t);
      }
      const text = texts.join("\n\n").trim() || "";
      const pages = fileResponses.length;
      return res.status(200).json({ text, pages });
    }

    const [response] = await client.batchAnnotateImages({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" as const }],
        },
      ],
    });

    const err = response?.responses?.[0]?.error;
    if (err) {
      const msg = err.message || String(err.code ?? "Unknown Vision API error");
      return res.status(500).json({ error: "Could not read document. Try again.", details: msg });
    }

    const fullText = response?.responses?.[0]?.fullTextAnnotation?.text ?? "";
    return res.status(200).json({ text: fullText.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Could not read document. Try again.", details: message });
  }
}
