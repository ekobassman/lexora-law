/**
 * Shared chat policy: use available context first, never ask for data already in context.
 * Used by demo chat, dashboard chat, and edit chat. One policy for all surfaces.
 */

export const CHAT_GUARDRAILS = `
=== CONTEXT-FIRST (STRICT) ===
1. Use available context first: case metadata, uploaded document OCR text, profile, deadlines, previous messages. Never ask the user for information that is already present in the context below.
2. If something is missing, ask ONE precise question only after listing what you already know.
3. On the edit page (pratica/case open): prioritize editing the existing draft; do not interrogate the user for data already in the case or documents.
4. Keep answers short and action-oriented. Do not repeat long questionnaires when context is already rich.
`;

export interface ChatContext {
  surface: 'demo' | 'dashboard' | 'edit';
  /** Case/pratica: title, authority, deadline, etc. */
  caseTitle?: string;
  caseAuthority?: string;
  caseDeadline?: string;
  /** Existing letter text (incoming) or draft (outgoing) */
  letterText?: string;
  draftText?: string;
  /** OCR text from uploaded documents */
  ocrText?: string;
  /** Document summaries or attachment info */
  documentSummaries?: string[];
  /** User profile: name, address, sender data */
  profile?: {
    fullName?: string;
    senderFullName?: string;
    senderAddress?: string;
    senderCity?: string;
    senderPostalCode?: string;
    senderCountry?: string;
  };
  /** Previous messages in this conversation (for "what you already know") */
  hasPriorMessages?: boolean;
  priorMessageCount?: number;
}

/**
 * Builds the "CONTEXT ALREADY AVAILABLE" block to send to the backend.
 * Backend will prepend this to the system prompt so the AI does not ask for these.
 */
export function buildSystemPrompt(ctx: ChatContext): string {
  const parts: string[] = [];

  if (ctx.caseTitle) parts.push(`Case title: ${ctx.caseTitle}`);
  if (ctx.caseAuthority) parts.push(`Authority: ${ctx.caseAuthority}`);
  if (ctx.caseDeadline) parts.push(`Deadline: ${ctx.caseDeadline}`);
  if (ctx.letterText && ctx.letterText.trim().length > 0) {
    parts.push(`Letter text (incoming): ${ctx.letterText.trim().slice(0, 2000)}${ctx.letterText.length > 2000 ? '...' : ''}`);
  }
  if (ctx.draftText && ctx.draftText.trim().length > 0) {
    parts.push(`Existing draft: ${ctx.draftText.trim().slice(0, 2000)}${ctx.draftText.length > 2000 ? '...' : ''}`);
  }
  if (ctx.ocrText && ctx.ocrText.trim().length > 0) {
    parts.push(`Document OCR text: ${ctx.ocrText.trim().slice(0, 3000)}${ctx.ocrText.length > 3000 ? '...' : ''}`);
  }
  if (ctx.documentSummaries && ctx.documentSummaries.length > 0) {
    parts.push(`Documents: ${ctx.documentSummaries.join('; ')}`);
  }
  if (ctx.profile) {
    const p = ctx.profile;
    if (p.fullName) parts.push(`User name: ${p.fullName}`);
    if (p.senderFullName) parts.push(`Sender name: ${p.senderFullName}`);
    if (p.senderAddress || p.senderCity || p.senderPostalCode || p.senderCountry) {
      parts.push(`Sender address: ${[p.senderAddress, p.senderCity, p.senderPostalCode, p.senderCountry].filter(Boolean).join(', ')}`);
    }
  }
  if (ctx.hasPriorMessages && (ctx.priorMessageCount ?? 0) > 0) {
    parts.push(`Conversation: ${ctx.priorMessageCount} prior messages in this chat. Use them; do not ask again for information already given.`);
  }

  if (parts.length === 0) return '';
  return parts.join('\n');
}

/** Phrases that indicate the assistant is asking for info (might be redundant if in ctx) */
const REDUNDANT_ASK_PATTERNS = [
  /I need (more )?information/i,
  /can you provide/i,
  /could you (please )?(provide|tell|send)/i,
  /please (provide|tell|send|give)/i,
  /(tell me|send me) (the|your)/i,
  /(we )?need (to know|the following)/i,
  /(I )?don't have (the|your)/i,
  /(missing|mancano|fehlen)/i,
];

/**
 * Dev-only: if the reply contains "ask for info" phrases and ctx has content, log a warning.
 * Call after receiving assistant message.
 */
export function assertNoRedundantAsk(reply: string, ctx: ChatContext): void {
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
  const hasContext = !!(
    (ctx.letterText && ctx.letterText.trim().length > 0) ||
    (ctx.draftText && ctx.draftText.trim().length > 0) ||
    (ctx.ocrText && ctx.ocrText.trim().length > 0) ||
    (ctx.caseTitle || ctx.profile?.fullName || ctx.profile?.senderFullName) ||
    (ctx.hasPriorMessages && (ctx.priorMessageCount ?? 0) >= 2)
  );
  if (!hasContext || !reply) return;
  const match = REDUNDANT_ASK_PATTERNS.some((re) => re.test(reply));
  if (match) {
    console.warn(
      '[Lexora chat policy] Assistant may be asking for information that could be in context. Reply snippet:',
      reply.slice(0, 200),
      'Context had:',
      { caseTitle: !!ctx.caseTitle, draftText: !!ctx.draftText, ocrText: !!ctx.ocrText, profile: !!ctx.profile, priorMessages: ctx.priorMessageCount }
    );
  }
}
