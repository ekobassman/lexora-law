/**
 * GET /api/health – Proxies Supabase Edge Function "health".
 * Env: SUPABASE_URL (fallback VITE_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL)
 *      SUPABASE_SERVICE_ROLE_KEY (fallback SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * Always returns JSON with status 200 (ok) or 503 (unhealthy). No crash.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs" };

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, apikey"
  );
  res.setHeader("Content-Type", "application/json");
}

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();
}

function getSupabaseKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Use GET or POST",
      ts: new Date().toISOString(),
    });
  }

  const supabaseUrl = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!supabaseUrl || !key) {
    return res.status(503).json({
      ok: false,
      where: "env",
      code: "ENV_MISSING",
      message: "SUPABASE_URL and key (SERVICE_ROLE or ANON) required",
      ts: new Date().toISOString(),
    });
  }

  const healthUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    const body = await response.json().catch(() => ({}));
    const status = response.ok ? 200 : 503;

    res.status(status).json({
      ...body,
      ts: body.ts ?? new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = "UPSTREAM_ERROR";
    if (process.env.NODE_ENV !== "production") {
      console.error(`[api/health] ${code}:`, message);
    }
    res.status(503).json({
      ok: false,
      where: "upstream",
      code,
      message,
      ts: new Date().toISOString(),
    });
  }
}
