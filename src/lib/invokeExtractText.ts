import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/edgeFetch";
import { hardResetAuth } from "@/lib/authHardReset";
import { ocrWithBase64 } from "@/lib/ocrClient";

interface InvokeParams {
  base64: string;
  mimeType: string;
  userLanguage: string;
  navigate: (path: string) => void;
}

interface InvokeResult {
  text?: string;
  error?: string;
  success?: boolean;
}

export async function invokeExtractText(params: InvokeParams): Promise<InvokeResult | null> {
  const { base64, mimeType, navigate } = params;

  const refreshed = await supabase.auth.refreshSession();
  const token = refreshed.data.session?.access_token;

  console.info("[auth] preflight", { hasToken: !!token, tokenLen: token?.length ?? 0 });

  if (!token) {
    await hardResetAuth(navigate);
    return null;
  }

  const health = await callEdgeFunction("auth-health", token, { ping: true });
  console.info("[auth-health] fetch", {
    status: health.status,
    ok: health.ok,
    step: health.data?.step ?? null,
  });

  if (!health.ok || !health.data?.ok) {
    await hardResetAuth(navigate);
    return null;
  }

  // OCR via Vercel /api/ocr (Google Cloud Vision)
  const text = await ocrWithBase64(base64, mimeType);
  console.info("[ocr] fetch", { hasText: !!text });

  if (!text) {
    return { error: "OCR_FAILED" };
  }

  return { text, success: true };
}
