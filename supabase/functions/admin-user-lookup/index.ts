import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";

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

const PLANS: Record<string, number> = {
  free: 1,
  starter: 10,
  pro: 50,
  unlimited: 999999,
};

function jsonResponse(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  const dot = e.lastIndexOf(".");
  return at > 0 && dot > at + 1 && dot < e.length - 1;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") {
    console.info("[admin-user-lookup]", { method: "OPTIONS", path: "cors_preflight" });
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    console.log('[admin-user-lookup] Jurisdiction blocked:', geoCheck.countryCode);
    return jsonResponse(corsHeaders,{ code: 'JURISDICTION_BLOCKED', countryCode: geoCheck.countryCode }, 451);
  }

  const hasAuth = req.headers.has("authorization") || req.headers.has("Authorization");
  console.info("[admin-user-lookup]", { method: req.method, has_authorization: hasAuth });

  // Method check
  if (req.method !== "POST") {
    return jsonResponse(corsHeaders,{ found: false, reason: "METHOD_NOT_ALLOWED" }, 200);
  }

  // Parse body safely
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // PUBLIC PING (NO AUTH, NO DB)
  if (body?.ping === true) {
    console.info("[admin-user-lookup]", { path: "ping", executed: true });
    return jsonResponse(corsHeaders,{ ok: true, function: "admin-user-lookup", ts: Date.now() }, 200);
  }

  // LOOKUP PATH: AUTH REQUIRED
  const authHeaderRaw = req.headers.get("Authorization") ?? "";
  const token = authHeaderRaw.startsWith("Bearer ") ? authHeaderRaw.slice(7) : authHeaderRaw;

  console.info("[admin-user-lookup] LOOKUP_EMAIL", body?.email ?? "(none)");

  if (!authHeaderRaw || !token) {
    console.log("[admin-user-lookup] exit: no token");
    return jsonResponse(corsHeaders,{ ok: false, reason: "unauthorized" }, 200);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[admin-user-lookup] MISSING_ENV");
      return jsonResponse(corsHeaders,{ found: false, reason: "MISSING_ENV" }, 200);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify caller
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error("[admin-user-lookup] AUTH_FAILED", userError?.message);
      return jsonResponse(corsHeaders,{ found: false, reason: "AUTH_FAILED", detail: userError?.message }, 200);
    }

    const caller_uid = userData.user.id;
    console.info("[admin-user-lookup] CALLER_UID", caller_uid);

    const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
    const callerEmail = (userData.user.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.some((e) => e.toLowerCase() === callerEmail)) {
      console.log("[admin-user-lookup] exit: not_admin");
      return jsonResponse(corsHeaders,{ ok: false, reason: "not_admin" }, 200);
    }

    // Validate email
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return jsonResponse(corsHeaders,{ found: false, reason: "EMAIL_REQUIRED" }, 200);
    }
    if (!isValidEmail(email)) {
      return jsonResponse(corsHeaders,{ found: false, reason: "INVALID_EMAIL" }, 200);
    }

    // Lookup user
    console.info("[admin-user-lookup] LOOKUP_START", email);
    let targetUserId: string | null = null;
    let targetEmail: string | null = null;
    let page = 1;
    let userFound = false;

    while (!userFound) {
      const { data: usersPage, error: pageError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
        page,
      });

      if (pageError) {
        console.error("[admin-user-lookup] LOOKUP_ERROR", pageError.message);
        return jsonResponse(corsHeaders,{ found: false, reason: "LOOKUP_ERROR", detail: pageError.message }, 200);
      }

      if (!usersPage.users.length) break;

      for (const u of usersPage.users) {
        if (u.email?.toLowerCase() === email) {
          targetUserId = u.id;
          targetEmail = u.email ?? null;
          userFound = true;
          break;
        }
      }

      if (usersPage.users.length < 1000) break;
      page++;
    }

    if (!targetUserId) {
      console.info("[admin-user-lookup] USER_NOT_FOUND", email);
      return jsonResponse(corsHeaders,{ found: false, reason: "USER_NOT_FOUND" }, 200);
    }

    console.info("[admin-user-lookup] USER_FOUND", { id: targetUserId, email: targetEmail });

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("id", targetUserId)
      .maybeSingle();

    // Fetch override + subscription
    const { data: override } = await supabaseAdmin
      .from("plan_overrides")
      .select("id, plan, plan_code, is_active, expires_at, reason")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const { data: subscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("plan_key, status, current_period_end")
      .eq("user_id", targetUserId)
      .maybeSingle();

    let effectivePlan = "free";
    let sourceUsed: "override" | "stripe" | "free" = "free";
    let expiresAt: string | null = null;

    if (override && override.is_active) {
      effectivePlan = override.plan_code || override.plan || "unlimited";
      sourceUsed = "override";
      expiresAt = override.expires_at;
    } else if (subscription && subscription.status === "active" && subscription.plan_key !== "free") {
      effectivePlan = subscription.plan_key;
      sourceUsed = "stripe";
      expiresAt = subscription.current_period_end;
    }

    const casesMax = PLANS[effectivePlan] ?? 1;

    // Count cases
    const { count: casesUsed } = await supabaseAdmin
      .from("pratiche")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId);

    return jsonResponse(corsHeaders,{
      found: true,
      user: {
        id: targetUserId,
        email: targetEmail,
      },
      profile: profile ? {
        first_name: (profile as any).first_name ?? null,
        last_name: (profile as any).last_name ?? null,
        full_name: (profile as any).full_name ?? null,
      } : null,
      current_effective_plan: {
        plan_code: effectivePlan,
        source_used: sourceUsed,
        expires_at: expiresAt,
        cases_max: casesMax,
        cases_used: casesUsed ?? 0,
      },
      override: override ? {
        id: override.id,
        plan_code: (override.plan_code || override.plan) ?? null,
        is_active: override.is_active,
        expires_at: override.expires_at,
        reason: override.reason,
      } : null,
    }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[admin-user-lookup] EXCEPTION", msg);
    return jsonResponse(corsHeaders,{ found: false, reason: "SERVER_ERROR", detail: msg }, 200);
  }
});