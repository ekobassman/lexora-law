import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

const PLANS: Record<string, { max_cases: number }> = {
  free: { max_cases: 1 },
  starter: { max_cases: 10 },
  pro: { max_cases: 50 },
  unlimited: { max_cases: 999999 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    console.log('[admin-get-entitlements] Jurisdiction blocked:', geoCheck.countryCode);
    return new Response(
      JSON.stringify({ code: 'JURISDICTION_BLOCKED', countryCode: geoCheck.countryCode }),
      { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is admin via user_roles table
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: caller, error: callerError } = await supabase.auth.getUser(token);

    if (callerError || !caller.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
    if (!ADMIN_EMAILS.some((e) => e.toLowerCase() === (caller.user.email ?? "").toLowerCase())) {
      return new Response(JSON.stringify({ error: "ADMIN_ONLY" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[admin-get-entitlements] Getting entitlements for:", userId);

    // Check for override first
    const { data: override } = await supabase
      .from("plan_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    let effectivePlan: string;
    let planSource: "admin" | "stripe" | "free";

    if (override) {
      effectivePlan = override.plan.toLowerCase();
      planSource = "admin";
    } else {
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (subscription && subscription.status === "active" && subscription.plan_key !== "free") {
        effectivePlan = subscription.plan_key.toLowerCase();
        planSource = "stripe";
      } else {
        effectivePlan = "free";
        planSource = "free";
      }
    }

    // Count cases
    const { count: casesUsed } = await supabase
      .from("pratiche")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const planConfig = PLANS[effectivePlan] || PLANS.free;

    return new Response(JSON.stringify({
      plan: effectivePlan,
      plan_source: planSource,
      limits: { casesMax: planConfig.max_cases },
      usage: { casesUsed: casesUsed ?? 0 },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[admin-get-entitlements] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});