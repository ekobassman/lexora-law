/**
 * Extract a user-friendly message from Supabase functions.invoke() error.
 * When an Edge Function returns 4xx/5xx, the client sets error.message to
 * "Edge function returned a non-2xx status code" but the response body
 * (with error/message) is often still in `data`. Pass both to get the real message.
 */
export function getEdgeFunctionErrorMessage(
  error: unknown,
  responseData?: unknown
): string {
  if (responseData != null && typeof responseData === "object") {
    const obj = responseData as { message?: string; error?: string; details?: string };
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
    if (typeof obj.details === "string" && obj.details.trim()) return obj.details;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
