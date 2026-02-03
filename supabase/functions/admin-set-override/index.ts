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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  function json200(body: unknown) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GEO-BLOCK CHECK — return 200 for UI-safe responses
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    console.log('[admin-set-override] Jurisdiction blocked:', geoCheck.countryCode);
    return json200({ ok: false, reason: "jurisdiction_blocked", countryCode: geoCheck.countryCode });
  }

  console.log("[admin-set-override] entry");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const envFingerprint = {
      supabase_url_last6: supabaseUrl.slice(-6),
      anon_key_last6: supabaseAnonKey.slice(-6),
      service_role_last6: serviceRoleKey.slice(-6),
    };

    console.log("[admin-set-override] ENV CHECK", envFingerprint);

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[admin-set-override] Missing env vars");
      return json200({ ok: false, reason: "error", message: "Service not configured" });
    }

    // Read Authorization header (check both cases)
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    console.log("[admin-set-override] AUTH HEADER", { 
      has_header: Boolean(authHeader), 
      header_len: authHeader.length,
      prefix: authHeader.slice(0, 15)
    });

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[admin-set-override] exit: no auth");
      return json200({ ok: false, reason: "unauthorized" });
    }

    const token = authHeader.slice("Bearer ".length);

    // Verify caller using anon client with the user's token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    console.log("[admin-set-override] AUTH RESULT", { 
      user_id: userData?.user?.id,
      user_email: userData?.user?.email,
      error: userError?.message
    });

    if (userError || !userData?.user) {
      console.error("[admin-set-override] Unauthorized", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized (invalid token)", code: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorUserId = userData.user.id;
    const actorEmail = userData.user.email ?? "";

    const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
    if (!ADMIN_EMAILS.some((e) => e.toLowerCase() === actorEmail.toLowerCase())) {
      console.log("[admin-set-override] exit: not_admin");
      return json200({ ok: false, reason: "not_admin" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Parse request body
    const body = await req.json();
    const { target_user_id, action, plan_code, expires_at, reason } = body;

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required", code: "MISSING_USER_ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!action || !["apply", "remove"].includes(action)) {
      return new Response(JSON.stringify({ error: "action must be 'apply' or 'remove'", code: "INVALID_ACTION" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.info("[admin-set-override] Processing", { action, target_user_id, plan_code });

    // Get current override for audit
    const { data: currentOverride } = await supabaseAdmin
      .from("plan_overrides")
      .select("id, plan, plan_code, is_active")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (action === "apply") {
      if (!plan_code) {
        return json200({ ok: false, reason: "error", message: "plan_code required for apply" });
      }

      const overridePayload = {
        user_id: target_user_id,
        plan: plan_code,
        plan_code: plan_code,
        is_active: true,
        expires_at: expires_at || null,
        reason: reason || "Admin override",
        created_by: actorUserId,
      };

      const { data: upserted, error: upsertError } = await supabaseAdmin
        .from("plan_overrides")
        .upsert(overridePayload, { onConflict: "user_id" })
        .select("id, plan_code, is_active, expires_at")
        .maybeSingle();

      if (upsertError) {
        console.error("[admin-set-override] Upsert failed", upsertError);
        return json200({ ok: false, reason: "error", message: upsertError.message });
      }

      // Audit log
      await supabaseAdmin.from("plan_override_audit").insert({
        target_user_id,
        actor_user_id: actorUserId,
        old_plan: currentOverride?.plan_code || currentOverride?.plan || null,
        new_plan: plan_code,
        old_is_active: currentOverride?.is_active ?? null,
        new_is_active: true,
        reason: reason || "Admin override",
      });

      console.info("[admin-set-override] Override applied", { override_id: upserted?.id });

      return json200({ ok: true, action: "applied", override: upserted });

    } else if (action === "remove") {
      if (!currentOverride) {
        return json200({ ok: false, reason: "error", message: "No override exists" });
      }

      const { error: updateError } = await supabaseAdmin
        .from("plan_overrides")
        .update({ is_active: false })
        .eq("user_id", target_user_id);

      if (updateError) {
        console.error("[admin-set-override] Remove failed", updateError);
        return json200({ ok: false, reason: "error", message: updateError.message });
      }

      // Audit log
      await supabaseAdmin.from("plan_override_audit").insert({
        target_user_id,
        actor_user_id: actorUserId,
        old_plan: currentOverride.plan_code || currentOverride.plan,
        new_plan: currentOverride.plan_code || currentOverride.plan,
        old_is_active: true,
        new_is_active: false,
        reason: "Override removed by admin",
      });

      console.info("[admin-set-override] Override removed", { target_user_id });
      return json200({ ok: true, action: "removed" });
    }

    return json200({ ok: false, reason: "error", message: "Unknown action" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[admin-set-override] Unhandled error", error);
    return json200({ ok: false, reason: "error", message: msg });
  }
});
