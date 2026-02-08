/**
 * Structural guardrails for document-aware chat (demo, dashboard, edit).
 * - Single source of truth for DOCUMENT_TEXT in messages.
 * - Fail-closed when document is expected but OCR text is missing.
 * - Output validation: replace forbidden "I didn't receive the document" phrases with safe fallback.
 */

export const DOCUMENT_TEXT_SYSTEM_LABEL = "DOCUMENT_TEXT (authoritative):";

/** Phrases that indicate the model claims it did not receive or cannot see the document. */
const FORBIDDEN_PHRASES_DOCUMENT_NOT_RECEIVED: RegExp[] = [
  /non ho ricevuto il testo/i,
  /non ho ricevuto (la )?lettera/i,
  /I did not receive the letter/i,
  /I have not received the (letter|document)/i,
  /I can't see the document/i,
  /I cannot see the document/i,
  /I don't have (access to )?the document/i,
  /document (text )?(was )?not (provided|received|included)/i,
  /letter (text )?(was )?not (provided|received|included)/i,
  /(please|kindly|could you) (provide|send|share|paste) (the )?(letter|document)/i,
  /(forniscimi|inviami|incolla|carica) (il )?(testo della )?lettera/i,
  /(ti chiedo di )?riportare i dati (della lettera|anagrafici)/i,
  /nessun (documento|testo) (fornito|ricevuto|presente)/i,
  /no (document|letter) (text )?(has been )?(provided|received)/i,
];

export const SAFE_FALLBACK_MESSAGE =
  "Technical error: document context missing or not injected. Please retry.";

export type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };

export interface BuildStrictMessagesOpts {
  /** Full system prompt: Lexora behavior rules, document-first, forbidden phrases, no signature requests. */
  systemRules: string;
  /** Full OCR text when document is in context. Empty string = no document. */
  documentText: string | null;
  /** Max length for document text in the dedicated system block (truncate with "...[truncated]" if needed). */
  documentTextMaxLen?: number;
  /** Conversation history (optional). Last message can be the current user message if client sends it that way. */
  history?: Array<{ role: string; content: string }>;
  /** Current user message. If not included in history, it will be appended. */
  userMessage: string;
  /** If true, do not add a separate user message at the end (already in history). */
  userMessageInHistory?: boolean;
}

/**
 * Build messages with strict structure:
 * a) system: Lexora behavior rules
 * b) system: "DOCUMENT_TEXT (authoritative): <full OCR text>" when documentText is non-empty
 * c) history (user/assistant)
 * d) user: current user message (unless userMessageInHistory)
 */
export function buildStrictMessages(opts: BuildStrictMessagesOpts): OpenAIMessage[] {
  const {
    systemRules,
    documentText,
    documentTextMaxLen = 12000,
    history = [],
    userMessage,
    userMessageInHistory = false,
  } = opts;

  const messages: OpenAIMessage[] = [];
  messages.push({ role: "system", content: systemRules });

  const docText = (documentText || "").trim();
  if (docText.length > 0) {
    const truncated =
      docText.length > documentTextMaxLen
        ? docText.slice(0, documentTextMaxLen) + "\n...[truncated]"
        : docText;
    messages.push({
      role: "system",
      content: `${DOCUMENT_TEXT_SYSTEM_LABEL}\n\n${truncated}`,
    });
  }

  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: String(msg.content || "").slice(0, 4000),
      });
    }
  }

  if (!userMessageInHistory && userMessage.trim()) {
    messages.push({ role: "user", content: userMessage.trim().slice(0, 4000) });
  }

  return messages;
}

export interface ExpectDocumentGuardrailOpts {
  /** When set, document text is expected (e.g. from case). */
  caseId?: string | null;
  /** When set, document text is expected. */
  documentId?: string | null;
  /** When set, document text is expected (edit chat inside case). */
  praticaId?: string | null;
  /** Current document/OCR text (from payload or DB). */
  documentText: string | null;
  /** Demo: true when the user message is an upload marker but we have no extracted text. */
  isUploadWithoutText?: boolean;
}

export interface GuardrailFail {
  ok: false;
  error: "DOCUMENT_TEXT_MISSING";
  hint: string;
  caseId?: string;
  documentId?: string;
  documentTextLength: number;
}

/**
 * If document is expected (case_id / document_id / pratica_id present or upload without text)
 * but document_text is empty, return fail. Caller should return 400 and log.
 */
export function expectDocumentGuardrail(
  opts: ExpectDocumentGuardrailOpts
): { ok: true } | GuardrailFail {
  const {
    caseId,
    documentId,
    praticaId,
    documentText,
    isUploadWithoutText = false,
  } = opts;

  const hasDocId = !!(caseId || documentId || praticaId);
  const docText = (documentText || "").trim();
  const hasText = docText.length > 0;

  if (isUploadWithoutText) {
    return {
      ok: false,
      error: "DOCUMENT_TEXT_MISSING",
      hint: "OCR text not provided to chat. Fix pipeline.",
      documentTextLength: 0,
    };
  }

  if (hasDocId && !hasText) {
    return {
      ok: false,
      error: "DOCUMENT_TEXT_MISSING",
      hint: "OCR text not provided to chat. Fix pipeline.",
      caseId: caseId ?? undefined,
      documentId: documentId ?? undefined,
      documentTextLength: 0,
    };
  }

  return { ok: true };
}

/**
 * If document was provided (documentTextLength > 0) and the model output contains
 * forbidden phrases (e.g. "I did not receive the letter"), return safe fallback and log.
 */
export function validateOutputForbiddenPhrases(
  documentTextLength: number,
  modelOutput: string,
  logContext?: { endpoint: string; caseId?: string; documentId?: string }
): { ok: true; response: string } | { ok: false; response: string; logged: true } {
  if (documentTextLength <= 0) {
    return { ok: true, response: modelOutput };
  }

  const hasForbidden = FORBIDDEN_PHRASES_DOCUMENT_NOT_RECEIVED.some((r) => r.test(modelOutput));
  if (!hasForbidden) {
    return { ok: true, response: modelOutput };
  }

  const ctx = logContext ? ` ${JSON.stringify(logContext)}` : "";
  console.error(
    `[documentChatGuardrails] FORBIDDEN_PHRASE_IN_OUTPUT: document_text_length=${documentTextLength}, output_snippet=${modelOutput.slice(0, 200)}...${ctx}`
  );
  return {
    ok: false,
    response: SAFE_FALLBACK_MESSAGE,
    logged: true,
  };
}
