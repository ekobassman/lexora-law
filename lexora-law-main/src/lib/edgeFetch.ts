import { supabase } from "@/integrations/supabase/client";

export async function callEdgeFunction(functionName: string, token: string, body: any) {
  // Get URL and anon key from environment or supabase client internals
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    (supabase as any)?.supabaseUrl ||
    (supabase as any)?.url;
  const anon =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (supabase as any)?.supabaseKey ||
    (supabase as any)?.anonKey;

  if (!url || !anon) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in client runtime");
  }

  const endpoint = `${url}/functions/v1/${functionName}`;

  console.info(`[edgeFetch] calling ${functionName}`, {
    endpoint,
    hasToken: !!token,
    tokenLen: token?.length ?? 0,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { ok: res.ok, status: res.status, data };
}
