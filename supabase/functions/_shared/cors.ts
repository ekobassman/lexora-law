/**
 * CORS headers for Supabase Edge Functions.
 * Allow: lexora-law.com, www.lexora-law.com, lexora-law.vercel.app, *.vercel.app, localhost.
 * When Origin is in allowlist we reflect it (required for credentialed requests); else use "*".
 */

/** Simple CORS headers (Origin: *) - use for credits-get-status, sync-subscription, auth-health, etc. */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const ALLOWED_ORIGINS = new Set([
  "https://lexora-law.com",
  "https://www.lexora-law.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://[::1]:5173",
  "http://[::1]:5174",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:4173",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:4173"
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
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-lexora-debug, x-demo-mode",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Max-Age": "86400"
};

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = isAllowedOrigin(origin) ? origin! : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    ...BASE_HEADERS,
  };
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders(req) 
    });
  }
  return null;
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin');
  
  // Check if origin is in allowed list
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-lexora-debug, x-demo-mode',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
  }
  
  // Default CORS headers for development
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-lexora-debug, x-demo-mode',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
