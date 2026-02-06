/**
 * Client-side OCR via Tesseract.js.
 * Replaces Edge Function / Vercel API calls to avoid CORS and network issues.
 */

import Tesseract from 'tesseract.js';

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function isImageType(mimeType: string): boolean {
  return IMAGE_TYPES.includes(mimeType?.toLowerCase?.() ?? '');
}

export interface TesseractOcrResult {
  text: string;
  /** Parsed fields (mittente, destinatario, data, oggetto) */
  parsed?: {
    sender?: string;
    recipient?: string;
    date?: string;
    subject?: string;
  };
}

/**
 * Extract text from an image file using Tesseract.js (client-side).
 * Supports ita+eng. Does NOT support PDF - use only for image/* types.
 */
export async function extractTextWithTesseract(
  file: File,
  onProgress?: (percent: number) => void
): Promise<TesseractOcrResult | null> {
  if (!isImageType(file.type)) {
    return null;
  }

  try {
    const result = await Tesseract.recognize(file, 'ita+eng', {
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          const percent = Math.round(m.progress * 100);
          onProgress?.(percent);
        }
      },
    });

    const extractedText = result?.data?.text?.trim() ?? '';
    if (!extractedText) return { text: '' };

    // Parse common fields (mittente, destinatario, data, oggetto)
    const lines = extractedText.split('\n').filter((l) => l.trim());
    const sender =
      lines.find((l) => /da:|mittente:|from:/i.test(l))?.replace(/da:|mittente:|from:/i, '').trim() ??
      lines[0]?.substring(0, 50) ??
      undefined;
    const recipient =
      lines.find((l) => /a:|destinatario:|to:/i.test(l))?.replace(/a:|destinatario:|to:/i, '').trim() ??
      undefined;
    const dateMatch = extractedText.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/);
    const date = dateMatch ? dateMatch[0] : undefined;
    const subject =
      lines.find((l) => /oggetto:|subject:|re:/i.test(l))?.replace(/oggetto:|subject:|re:/i, '').trim() ??
      undefined;

    return {
      text: extractedText,
      parsed: { sender, recipient, date, subject },
    };
  } catch (err) {
    console.error('[tesseractOcr] Error:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Impossibile leggere il documento. Prova con una foto più nitida.'
    );
  }
}
