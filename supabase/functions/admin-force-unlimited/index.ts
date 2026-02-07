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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    console.log('[admin-force-unlimited] Jurisdiction blocked:', geoCheck.countryCode);
    return new Response(
      JSON.stringify({ code: 'JURISDICTION_BLOCKED', countryCode: geoCheck.countryCode }),
      { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const envFingerprint = {
      supabase_url_last6: supabaseUrl.slice(-6),
      service_role_last6: serviceRoleKey.slice(-6),
    };

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[admin-force-unlimited] Missing env", {
        missing: [
          !supabaseUrl ? "SUPABASE_URL" : null,
          !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
        ].filter(Boolean),
        envFingerprint,
      });
      return new Response(JSON.stringify({ error: "MISSING ENV: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY", code: "ENV_MISSING" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : authHeader;

    // Admin client (service role) for JWT verification + privileged DB writes.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error("[admin-force-unlimited] Unauthorized", { error: userError?.message, envFingerprint });
      return new Response(JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorUserId = userData.user.id;

    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("[admin-force-unlimited] Role check error", roleError);
      return new Response(JSON.stringify({ error: "Role check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!roleRow) {
      console.warn("[admin-force-unlimited] Forbidden: not admin", { actorUserId });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Upsert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.info("[admin-force-unlimited] Upsert OK", {
      override_id: upserted?.id,
      plan_code: upserted?.plan_code,
      is_active: upserted?.is_active,
      expires_at: upserted?.expires_at,
    });

    return new Response(JSON.stringify({ ok: true, override: upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin-force-unlimited] Unhandled error", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
