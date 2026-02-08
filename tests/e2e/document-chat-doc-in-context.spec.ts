import { test, expect } from "@playwright/test";

/**
 * Structural regression: document-in-context chat endpoints must use the provided OCR text
 * and must NOT say they didn't receive the document or ask for information already present.
 *
 * Calls homepage-trial-chat (demo) with dummy OCR containing a unique reference and authority.
 * Asserts: response includes the reference (proves doc is used) and does NOT contain forbidden phrases.
 *
 * Requires: SUPABASE_URL and optionally SUPABASE_ANON_KEY in env (or .env).
 * Dashboard and chat-with-ai need auth; run against deployed functions.
 */
const DUMMY_OCR = `
Spett.le Finanzamt Berlin Mitte
Riferimento: REF-2024-DOC-CHAT-001
Oggetto: Richiesta di chiarimento

Gentile Ufficio,
con la presente in riferimento alla comunicazione del 15.01.2024 (Aktenzeichen 123-456/2024)
vi chiediamo di fornire chiarimenti in merito alla cartella esattoriale.
Restiamo a disposizione.
Distinti saluti.
`.trim();

const REFERENCE_IN_DOC = "REF-2024-DOC-CHAT-001";
const AUTHORITY_IN_DOC = "Finanzamt";

const FORBIDDEN_PHRASES = [
  /non ho trovato informazioni/i,
  /non ho ricevuto (il )?testo/i,
  /I did not receive the letter/i,
  /I can't see the document/i,
  /indicami l'indirizzo/i,
  /please provide the (address|document)/i,
  /nessuna informazione affidabile/i,
  /Technical error: document context missing/i,
];

function hasForbiddenPhrase(text: string): boolean {
  return FORBIDDEN_PHRASES.some((r) => r.test(text));
}

test.describe("Document-in-context: response uses OCR and does not ask for info present", () => {
  test("homepage-trial-chat: with documentText, response includes reference and does not say doc missing", async () => {
    const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    test.skip(!baseUrl, "SUPABASE_URL or VITE_SUPABASE_URL required");

    const url = `${baseUrl}/functions/v1/homepage-trial-chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Che devo fare?",
        language: "IT",
        isFirstMessage: true,
        conversationHistory: [],
        documentText: DUMMY_OCR,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.reply).toBeDefined();
    const reply = String(data.reply || "");

    // Proves document is used: response should mention the reference or authority from the OCR
    const usesDoc =
      reply.includes(REFERENCE_IN_DOC) ||
      reply.includes("REF-2024") ||
      reply.toLowerCase().includes(AUTHORITY_IN_DOC.toLowerCase()) ||
      reply.includes("Finanzamt") ||
      reply.includes("riferimento") ||
      reply.includes("Aktenzeichen");
    expect(usesDoc).toBeTruthy();

    // Must NOT say document was not received or ask for info already in the doc
    expect(hasForbiddenPhrase(reply)).toBe(false);
  });
});
