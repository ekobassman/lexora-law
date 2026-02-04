/**
 * CORS headers for Supabase Edge Functions.
 * Allow: lexora-law.com, www.lexora-law.com, lexora-law.vercel.app, *.vercel.app, localhost.
 * When Origin is in allowlist we reflect it (required for credentialed requests); else use "*".
 */

const ALLOWED_ORIGINS = new Set([
  "https://www.lexora-law.com",
  "https://lexora-law.com",
  "https://lexora-law.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin || typeof origin !== "string") return false;
  const o = origin.trim().toLowerCase();
  if (ALLOWED_ORIGINS.has(o)) return true;
  // *.vercel.app (e.g. https://lexora-law-git-xxx-lexora1.vercel.app)
  if (o.startsWith("https://") && o.endsWith(".vercel.app")) return true;
  return false;
}

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = isAllowedOrigin(origin) ? origin! : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    ...BASE_HEADERS,
  };
}
