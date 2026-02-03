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

const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
const isAdminEmail = (email: string | undefined) =>
  ADMIN_EMAILS.some((e) => e.toLowerCase() === (email ?? "").toLowerCase());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    console.log('[admin-user-metrics] Jurisdiction blocked:', geoCheck.countryCode);
    return new Response(
      JSON.stringify({ code: 'JURISDICTION_BLOCKED', countryCode: geoCheck.countryCode }),
      { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdminEmail(user.email)) {
      return new Response(JSON.stringify({ error: "ADMIN_ONLY" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let windowMinutes = 10;
    try {
      const body = await req.json();
      if (body?.windowMinutes && typeof body.windowMinutes === "number") {
        windowMinutes = Math.max(1, Math.min(60, body.windowMinutes));
      }
    } catch {
      // Use default
    }

    // Use service role for aggregate queries
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get total users
    const { count: totalUsers, error: totalError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      console.error("Total users query error:", totalError);
    }

    // Get live users (last X minutes)
    const liveThreshold = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { count: liveUsers, error: liveError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", liveThreshold);

    if (liveError) {
      console.error("Live users query error:", liveError);
    }

    // Get active today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: activeToday, error: activeTodayError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", todayStart.toISOString());

    if (activeTodayError) {
      console.error("Active today query error:", activeTodayError);
    }

    // Get new signups today
    const { count: newToday, error: newTodayError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    if (newTodayError) {
      console.error("New today query error:", newTodayError);
    }

    // Get subscription stats
    const { data: subscriptions, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("plan_key, status");

    if (subError) {
      console.error("Subscriptions query error:", subError);
    }

    // Count subscriptions by plan (only active)
    const subscriptionStats = {
      total_paid: 0,
      by_plan: {} as Record<string, number>,
    };

    if (subscriptions) {
      for (const sub of subscriptions) {
        if (sub.status === "active" && sub.plan_key !== "free") {
          subscriptionStats.total_paid++;
          subscriptionStats.by_plan[sub.plan_key] = (subscriptionStats.by_plan[sub.plan_key] || 0) + 1;
        }
      }
    }

    // Get override stats
    const { data: overrides, error: overrideError } = await adminClient
      .from("plan_overrides")
      .select("plan, is_active");

    if (overrideError) {
      console.error("Overrides query error:", overrideError);
    }

    const overrideStats = {
      total_active: 0,
      by_plan: {} as Record<string, number>,
    };

    if (overrides) {
      for (const ov of overrides) {
        if (ov.is_active) {
          overrideStats.total_active++;
          overrideStats.by_plan[ov.plan] = (overrideStats.by_plan[ov.plan] || 0) + 1;
        }
      }
    }

    // Get recent 25 users with auth email, subscription, and override info
    const { data: recentProfiles, error: recentError } = await adminClient
      .from("profiles")
      .select("id, full_name, created_at, last_seen_at, plan")
      .order("created_at", { ascending: false })
      .limit(25);

    if (recentError) {
      console.error("Recent users query error:", recentError);
    }

    // Fetch emails, subscriptions, and overrides for recent profiles
    const recentUsers = [];
    if (recentProfiles) {
      // Batch fetch subscriptions and overrides
      const userIds = recentProfiles.map(p => p.id);
      
      const { data: userSubs } = await adminClient
        .from("user_subscriptions")
        .select("user_id, plan_key, status")
        .in("user_id", userIds);

      const { data: userOverrides } = await adminClient
        .from("plan_overrides")
        .select("user_id, plan, plan_code, is_active, reason")
        .in("user_id", userIds);

      const subsMap = new Map(userSubs?.map(s => [s.user_id, s]) || []);
      const overridesMap = new Map(userOverrides?.map(o => [o.user_id, o]) || []);

      for (const profile of recentProfiles) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id);
        const isLive = profile.last_seen_at && new Date(profile.last_seen_at) >= new Date(liveThreshold);
        const subscription = subsMap.get(profile.id);
        const override = overridesMap.get(profile.id);

        // Determine effective plan
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
          email: authUser?.user?.email || null,
          full_name: profile.full_name,
          created_at: profile.created_at,
          last_seen_at: profile.last_seen_at,
          is_live: Boolean(isLive),
          subscription: subscription ? {
            plan_key: subscription.plan_key,
            status: subscription.status,
          } : null,
          override: override ? {
            plan: override.plan,
            plan_code: override.plan_code,
            is_active: override.is_active,
            reason: override.reason,
          } : null,
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

    console.log("[admin-user-metrics] Response:", { totalUsers, liveUsers, activeToday, newToday, subscriptionStats, overrideStats });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin-user-metrics] Error:", error);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
