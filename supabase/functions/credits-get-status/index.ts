import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const currentYm = new Date().toISOString().slice(0, 7); // '2026-01'

    // Get subscription state (avoid PGRST116 by using maybeSingle)
    const { data: subState, error: subError } = await supabase
      .from("subscriptions_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (subError) {
      console.error("Error fetching subscription state:", subError);
    }

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from("user_wallet")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) {
      console.error("Error fetching wallet:", walletError);
    }

    // Get usage counters for current month
    const { data: usage, error: usageError } = await supabase
      .from("usage_counters_monthly")
      .select("*")
      .eq("user_id", userId)
      .eq("ym", currentYm)
      .maybeSingle();

    if (usageError) {
      console.error("Error fetching usage:", usageError);
    }

    // Plan-specific defaults for monthly_case_limit (single source of truth)
    const PLAN_DEFAULTS: Record<string, number> = {
      free: 1,
      starter: 3,
      pro: 10,
      unlimited: 999999,
    };

    // Calculate values
    const plan = subState?.plan || "free";
    const isActive = subState?.is_active ?? true;
    const periodEnd = subState?.period_end || null;
    
    // SINGLE SOURCE OF TRUTH: monthly_case_limit from DB, fallback to plan defaults
    const monthlyCaseLimit = subState?.monthly_case_limit ?? PLAN_DEFAULTS[plan] ?? 1;
    const monthlyCreditsRefill = subState?.monthly_credit_refill ?? 0;
    
    const casesUsedThisMonth = usage?.cases_created ?? 0;
    const creditsSpentThisMonth = usage?.credits_spent ?? 0;
    const aiSessionsThisMonth = usage?.ai_sessions_started ?? 0;
    
    const creditsBalance = wallet?.balance_credits ?? 0;
    const lifetimeCredits = wallet?.lifetime_credits ?? 0;

    // Calculate cases remaining
    const casesRemaining = Math.max(0, monthlyCaseLimit - casesUsedThisMonth);

    // Calculate next refill date (first of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextRefillDate = nextMonth.toISOString().split("T")[0];

    // Check if at case limit (unlimited never hits limit)
    const atCaseLimit = plan !== "unlimited" && casesUsedThisMonth >= monthlyCaseLimit;

    console.log(`[credits-get-status] user=${userId} plan=${plan} monthly_case_limit=${monthlyCaseLimit} cases_used=${casesUsedThisMonth} remaining=${casesRemaining} at_limit=${atCaseLimit}`);

    const response = {
      plan,
      is_active: isActive,
      period_end: periodEnd,
      cases_used_this_month: casesUsedThisMonth,
      // PRIMARY FIELD: monthly_case_limit (single source of truth)
      monthly_case_limit: monthlyCaseLimit,
      cases_remaining: casesRemaining,
      at_case_limit: atCaseLimit,
      credits_balance: creditsBalance,
      credits_spent_this_month: creditsSpentThisMonth,
      ai_sessions_this_month: aiSessionsThisMonth,
      lifetime_credits: lifetimeCredits,
      next_refill_date: nextRefillDate,
      monthly_credit_refill: monthlyCreditsRefill,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("credits-get-status error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
