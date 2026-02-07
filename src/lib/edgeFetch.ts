import { supabase } from '@/lib/supabaseClient';

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

  // public-health: Supabase "legacy secret" richiede Authorization + apikey con publishable key (non token utente)
  const isPublicHealth = functionName === "public-health";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${isPublicHealth ? anon : token}`,
  };

  console.info(`[edgeFetch] calling ${functionName}`, {
    endpoint,
    hasToken: !!token,
    useAnonKey: isPublicHealth,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
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
