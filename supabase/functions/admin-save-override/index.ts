import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocked country codes
const BLOCKED_COUNTRIES = ['RU', 'CN'];

function checkGeoBlock(req: Request): { blocked: boolean; countryCode: string | null } {
  const countryCode = req.headers.get('cf-ipcountry') 
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-country')
    || req.headers.get('fly-client-country');
  if (!countryCode) return { blocked: false, countryCode: null };
  const normalized = countryCode.toUpperCase();
  return { blocked: BLOCKED_COUNTRIES.includes(normalized), countryCode: normalized };
}

// Temporary beta allowlist (deterministic)
const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    console.log('[admin-save-override] Jurisdiction blocked:', geoCheck.countryCode);
    return jsonResponse(451, { code: 'JURISDICTION_BLOCKED', countryCode: geoCheck.countryCode });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- AUTH ---
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "UNAUTHORIZED" });
    }

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      return jsonResponse(401, { error: "UNAUTHORIZED" });
    }

    // --- ADMIN CHECK ---
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
      return jsonResponse(403, { error: "NOT_ADMIN" });
    }

    // --- BODY VALIDATION ---
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, {
        error: "BAD_REQUEST",
        details: ["invalid JSON body"],
      });
    }

    const details: string[] = [];

    const target_user_id = body?.target_user_id;
    const plan_code = body?.plan_code;
    const is_active = body?.is_active;
    const expires_at = body?.expires_at;
    const reason = body?.reason;

    if (!isUuid(target_user_id)) details.push("target_user_id must be a uuid");
    if (typeof plan_code !== "string" || plan_code.trim().length === 0) {
      details.push("plan_code must be a non-empty string");
    }
    if (typeof is_active !== "boolean") details.push("is_active must be a boolean");

    const expiresOk =
      expires_at === null || expires_at === undefined || typeof expires_at === "string";
    if (!expiresOk) details.push("expires_at must be null or string");

    const reasonOk = reason === null || reason === undefined || typeof reason === "string";
    if (!reasonOk) details.push("reason must be null or string");

    if (details.length > 0) {
      return jsonResponse(400, { error: "BAD_REQUEST", details });
    }

    // --- DB WRITE (SERVICE ROLE) ---
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error: upsertError } = await svc.from("plan_overrides").upsert(
      {
        user_id: target_user_id,
        plan_code: plan_code,
        plan: plan_code,
        is_active: is_active,
        expires_at: expires_at ?? null,
        reason: reason ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      return jsonResponse(500, {
        error: "INTERNAL_ERROR",
        message: upsertError.message,
      });
    }

    // --- SUCCESS ---
    return jsonResponse(200, { success: true });
  } catch (err: any) {
    return jsonResponse(500, {
      error: "INTERNAL_ERROR",
      message: err?.message ?? "unknown error",
    });
  }

  // Final fallback (must never fall through)
  return jsonResponse(500, { error: "FALLTHROUGH_ERROR" });
});

