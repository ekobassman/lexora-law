import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fallback se le env non sono settate su Supabase (Dashboard → Project Settings → Edge Functions)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://wzpxxlkfxymelrodjarl.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "LA_TUA_CHIAVE_SERVICE_ROLE";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "LA_TUA_CHIAVE_ANON";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json200(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
const isAdminEmail = (email: string | undefined) =>
  ADMIN_EMAILS.some((e) => e.toLowerCase() === (email ?? "").toLowerCase());

Deno.serve(async (req) => {
  console.log("Edge function starting with URL:", SUPABASE_URL);
  console.log("[admin-user-metrics] entry");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      console.log('[admin-user-metrics] Jurisdiction blocked:', geoCheck.countryCode);
      return json200({ ok: false, reason: "jurisdiction_blocked", countryCode: geoCheck.countryCode });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[admin-user-metrics] exit: missing auth header");
      return json200({ ok: false, reason: "unauthorized" });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === "LA_TUA_CHIAVE_SERVICE_ROLE" ||
        !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "LA_TUA_CHIAVE_ANON") {
      console.error("[admin-user-metrics] Sostituisci LA_TUA_CHIAVE_SERVICE_ROLE e LA_TUA_CHIAVE_ANON nel file con le chiavi reali");
      return json200({ ok: false, reason: "error", message: "Service not configured (keys missing)" });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.log("[admin-user-metrics] exit: invalid token", userError?.message);
      return json200({ ok: false, reason: "unauthorized" });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: profile } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdminByProfile = profile?.is_admin === true;
    const isAdminByRole = roleRow?.role === "admin";
    const isAdminByEmail = isAdminEmail(user.email);
    const isAdmin = isAdminByProfile || isAdminByRole || isAdminByEmail;

    if (!isAdmin) {
      console.log("[admin-user-metrics] exit: not_admin", user.email);
      return json200({ ok: false, reason: "not_admin" });
    }

    let windowMinutes = 10;
    try {
      const body = await req.json();
      if (body?.windowMinutes && typeof body.windowMinutes === "number") {
        windowMinutes = Math.max(1, Math.min(60, body.windowMinutes));
      }
    } catch {
      // Use default
    }

    const { count: totalUsers, error: totalError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (totalError) console.error("[admin-user-metrics] Total users query error:", totalError);

    const liveThreshold = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { count: liveUsers, error: liveError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", liveThreshold);
    if (liveError) console.error("[admin-user-metrics] Live users query error:", liveError);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: activeToday, error: activeTodayError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", todayStart.toISOString());
    if (activeTodayError) console.error("[admin-user-metrics] Active today query error:", activeTodayError);

    const { count: newToday, error: newTodayError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());
    if (newTodayError) console.error("[admin-user-metrics] New today query error:", newTodayError);

    const { data: subscriptions, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("plan_key, status");
    if (subError) console.error("[admin-user-metrics] Subscriptions query error:", subError);

    const subscriptionStats = { total_paid: 0, by_plan: {} as Record<string, number> };
    if (subscriptions) {
      for (const sub of subscriptions) {
        if (sub.status === "active" && sub.plan_key !== "free") {
          subscriptionStats.total_paid++;
          subscriptionStats.by_plan[sub.plan_key] = (subscriptionStats.by_plan[sub.plan_key] || 0) + 1;
        }
      }
    }

    const { data: overrides, error: overrideError } = await adminClient
      .from("plan_overrides")
      .select("plan, is_active");
    if (overrideError) console.error("[admin-user-metrics] Overrides query error:", overrideError);

    const overrideStats = { total_active: 0, by_plan: {} as Record<string, number> };
    if (overrides) {
      for (const ov of overrides) {
        if (ov.is_active) {
          overrideStats.total_active++;
          overrideStats.by_plan[ov.plan] = (overrideStats.by_plan[ov.plan] || 0) + 1;
        }
      }
    }

    const { data: recentProfiles, error: recentError } = await adminClient
      .from("profiles")
      .select("id, full_name, created_at, last_seen_at, plan")
      .order("created_at", { ascending: false })
      .limit(25);
    if (recentError) console.error("[admin-user-metrics] Recent users query error:", recentError);

    const recentUsers: Array<{
      id: string;
      email: string | null;
      full_name: string | null;
      created_at: string | null;
      last_seen_at: string | null;
      is_live: boolean;
      subscription: { plan_key: string; status: string } | null;
      override: { plan: string; plan_code: string | null; is_active: boolean; reason: string | null } | null;
      effective_plan: string;
      plan_source: string;
    }> = [];

    if (recentProfiles?.length) {
      const userIds = recentProfiles.map((p) => p.id);
      const { data: userSubs } = await adminClient
        .from("user_subscriptions")
        .select("user_id, plan_key, status")
        .in("user_id", userIds);
      const { data: userOverrides } = await adminClient
        .from("plan_overrides")
        .select("user_id, plan, plan_code, is_active, reason")
        .in("user_id", userIds);
      const subsMap = new Map(userSubs?.map((s) => [s.user_id, s]) || []);
      const overridesMap = new Map(userOverrides?.map((o) => [o.user_id, o]) || []);

      for (const profile of recentProfiles) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id);
        const isLive = profile.last_seen_at && new Date(profile.last_seen_at) >= new Date(liveThreshold);
        const subscription = subsMap.get(profile.id);
        const override = overridesMap.get(profile.id);
        let effectivePlan = "free";
        let planSource = "free";
        if (override?.is_active) {
          effectivePlan = override.plan_code || override.plan || "free";
          planSource = "override";
        } else if (subscription?.status === "active" && subscription.plan_key !== "free") {
          effectivePlan = subscription.plan_key;
          planSource = "stripe";
        }
        recentUsers.push({
          id: profile.id,
          email: authUser?.user?.email ?? null,
          full_name: profile.full_name,
          created_at: profile.created_at,
          last_seen_at: profile.last_seen_at,
          is_live: Boolean(isLive),
          subscription: subscription ? { plan_key: subscription.plan_key, status: subscription.status } : null,
          override: override ? { plan: override.plan, plan_code: override.plan_code ?? null, is_active: override.is_active, reason: override.reason ?? null } : null,
          effective_plan: effectivePlan,
          plan_source: planSource,
        });
      }
    }

    const response = {
      totalUsers: totalUsers ?? 0,
      liveUsers: liveUsers ?? 0,
      activeToday: activeToday ?? 0,
      newToday: newToday ?? 0,
      subscriptionStats,
      overrideStats,
      recentUsers,
      windowMinutes,
      generatedAt: new Date().toISOString(),
    };
    console.log("[admin-user-metrics] exit: success", { totalUsers: response.totalUsers, liveUsers: response.liveUsers });
    return json200(response);
  } catch (err) {
    console.error("[admin-user-metrics] exit: error", err);
    return json200({ ok: false, reason: "error", message: err instanceof Error ? err.message : String(err) });
  }
});
