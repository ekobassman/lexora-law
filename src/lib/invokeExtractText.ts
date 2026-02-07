import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/edgeFetch";
import { hardResetAuth } from "@/lib/authHardReset";

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
  const { base64, mimeType, userLanguage, navigate } = params;

  const refreshed = await supabase.auth.refreshSession();
  const token = refreshed.data.session?.access_token;

  console.info("[auth] preflight", { hasToken: !!token, tokenLen: token?.length ?? 0 });

  if (!token) {
    await hardResetAuth(navigate);
    return null;
  }

  // AUTH HEALTH via fetch (bypass invoke)
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

  // EXTRACT TEXT via fetch (bypass invoke)
  const ocr = await callEdgeFunction("extract-text", token, {
    imageBase64: base64,
    mimeType,
    userLanguage,
  });

  console.info("[extract-text] fetch", {
    status: ocr.status,
    ok: ocr.ok,
    hasText: !!ocr.data?.text,
  });

  if (ocr.status === 401) {
    await hardResetAuth(navigate);
    return null;
  }

  if (!ocr.ok) {
    return { error: "OCR_FAILED" };
  }

  return ocr.data;
}
