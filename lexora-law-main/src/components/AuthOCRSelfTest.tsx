import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/edgeFetch";

interface TestOutput {
  route: string;
  loggedIn: boolean;
  tokenDotCount: number | null;
  tokenLen: number | null;
  authHealth: { status: number | null; ok: boolean | null; step: string | null };
  extractText: { status: number | null; ok: boolean | null; hasText: boolean | null; textLen: number | null; step: string | null };
}

export function AuthOCRSelfTest() {
  const [output, setOutput] = useState<TestOutput | null>(null);
  const [running, setRunning] = useState(false);

  const runTest = async () => {
    setRunning(true);
    setOutput(null);

    const result: TestOutput = {
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      loggedIn: false,
      tokenDotCount: null,
      tokenLen: null,
      authHealth: { status: null, ok: null, step: null },
      extractText: { status: null, ok: null, hasText: null, textLen: null, step: null },
    };

    try {
      const refreshed = await supabase.auth.refreshSession();
      const token = refreshed.data.session?.access_token ?? null;

      result.loggedIn = !!token;
      result.tokenLen = token?.length ?? null;
      result.tokenDotCount = token ? (token.match(/\./g) || []).length : null;

      // If not logged in or token malformed, do not call edge functions
      if (!token || result.tokenDotCount !== 2) {
        console.log("[AuthOCRSelfTest]", JSON.stringify(result, null, 2));
        setOutput(result);
        setRunning(false);
        return;
      }

      // Call auth-health
      const health = await callEdgeFunction("auth-health", token, { ping: true });
      result.authHealth = {
        status: health.status,
        ok: health.ok && health.data?.ok === true,
        step: health.data?.step ?? null,
      };

      // If auth-health failed, do not call extract-text
      if (!result.authHealth.ok) {
        console.log("[AuthOCRSelfTest]", JSON.stringify(result, null, 2));
        setOutput(result);
        setRunning(false);
        return;
      }

      // Call extract-text with mode: textcheck (deterministic, no OCR)
      const ocr = await callEdgeFunction("extract-text", token, { mode: "textcheck" });
      result.extractText = {
        status: ocr.status,
        ok: ocr.ok && ocr.data?.ok === true,
        hasText: !!ocr.data?.text,
        textLen: ocr.data?.text?.length ?? null,
        step: ocr.data?.step ?? null,
      };

      console.log("[AuthOCRSelfTest]", JSON.stringify(result, null, 2));
      setOutput(result);
    } catch (e) {
      result.authHealth.step = `exception: ${e instanceof Error ? e.message : "unknown"}`;
      console.log("[AuthOCRSelfTest]", JSON.stringify(result, null, 2));
      setOutput(result);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-3 max-w-md text-xs font-mono">
      {running && <div className="text-muted-foreground">Running...</div>}
      {output && (
        <pre className="whitespace-pre-wrap break-all text-foreground">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
      <button
        onClick={runTest}
        disabled={running}
        className="mt-2 px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
      >
        Re-run
      </button>
    </div>
  );
}
