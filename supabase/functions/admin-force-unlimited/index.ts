import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

function json200(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  console.log("[admin-force-unlimited] entry");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      console.log('[admin-force-unlimited] Jurisdiction blocked:', geoCheck.countryCode);
      return json200({ ok: false, reason: "jurisdiction_blocked", countryCode: geoCheck.countryCode });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[admin-force-unlimited] Missing env");
      return json200({ ok: false, reason: "error", message: "Service not configured" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : authHeader;
    if (!token) {
      console.log("[admin-force-unlimited] exit: no token");
      return json200({ ok: false, reason: "unauthorized" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      console.log("[admin-force-unlimited] exit: invalid token", userError?.message);
      return json200({ ok: false, reason: "unauthorized" });
    }

    const actorUserId = userData.user.id;
    const actorEmail = (userData.user.email ?? "").toLowerCase();
    const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
    if (!ADMIN_EMAILS.some((e) => e.toLowerCase() === actorEmail)) {
      console.log("[admin-force-unlimited] exit: not_admin");
      return json200({ ok: false, reason: "not_admin" });
    }

    console.info("[admin-force-unlimited] Forcing self override", { actorUserId });

    const overridePayload = {
      user_id: actorUserId,
      plan: "unlimited",
      plan_code: "unlimited",
      is_active: true,
      expires_at: null,
      reason: "Admin self-override (force button)",
      created_by: actorUserId,
    };

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("plan_overrides")
      .upsert(overridePayload, { onConflict: "user_id" })
      .select("id, user_id, plan, plan_code, is_active, expires_at, reason, updated_at")
      .maybeSingle();

    if (upsertError) {
      console.error("[admin-force-unlimited] Upsert failed", upsertError);
      return json200({ ok: false, reason: "error", message: upsertError.message });
    }

    console.log("[admin-force-unlimited] exit: success", { override_id: upserted?.id });
    return json200({ ok: true, override: upserted });
  } catch (error) {
    console.error("[admin-force-unlimited] Unhandled error", error);
    const msg = error instanceof Error ? error.message : String(error);
    return json200({ ok: false, reason: "error", message: msg });
  }
});
