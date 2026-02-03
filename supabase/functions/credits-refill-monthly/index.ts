import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This should be called by a cron job or admin only
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("X-Cron-Secret");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin or cron
    let isAuthorized = false;
    
    if (cronSecret === Deno.env.get("CRON_SECRET")) {
      isAuthorized = true;
    } else if (authHeader) {
      const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (user) {
        const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
        isAuthorized = ADMIN_EMAILS.some((e) => e.toLowerCase() === (user.email ?? "").toLowerCase());
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "ADMIN_ONLY" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentYm = new Date().toISOString().slice(0, 7);
    
    // Get all active subscriptions with monthly_credit_refill > 0
    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions_state")
      .select("user_id, plan, monthly_credit_refill")
      .eq("is_active", true)
      .gt("monthly_credit_refill", 0);

    if (subError) {
      throw subError;
    }

    let refillCount = 0;
    let totalCreditsRefilled = 0;
    const errors: string[] = [];

    for (const sub of subscriptions || []) {
      try {
        // Check if already refilled this month
        const { data: existingRefill } = await supabase
          .from("credit_ledger")
          .select("id")
          .eq("user_id", sub.user_id)
          .eq("action_type", "REFILL")
          .filter("meta->ym", "eq", currentYm)
          .single();

        if (existingRefill) {
          // Already refilled this month
          continue;
        }

        // Add credits to wallet
        const { data: wallet } = await supabase
          .from("user_wallet")
          .select("balance_credits, lifetime_credits")
          .eq("user_id", sub.user_id)
          .single();

        const currentBalance = wallet?.balance_credits ?? 0;
        const currentLifetime = wallet?.lifetime_credits ?? 0;
        const refillAmount = sub.monthly_credit_refill;

        await supabase
          .from("user_wallet")
          .upsert({
            user_id: sub.user_id,
            balance_credits: currentBalance + refillAmount,
            lifetime_credits: currentLifetime + refillAmount,
          }, { onConflict: "user_id" });

        // Log to ledger
        await supabase.from("credit_ledger").insert({
          user_id: sub.user_id,
          action_type: "REFILL",
          delta: refillAmount,
          meta: { 
            ym: currentYm, 
            plan: sub.plan,
            reason: "monthly_refill" 
          },
        });

        // Ensure usage counters row exists for new month
        await supabase
          .from("usage_counters_monthly")
          .upsert({ 
            user_id: sub.user_id, 
            ym: currentYm,
            cases_created: 0,
            credits_spent: 0,
            ai_sessions_started: 0
          }, { 
            onConflict: "user_id,ym",
            ignoreDuplicates: true 
          });

        refillCount++;
        totalCreditsRefilled += refillAmount;

      } catch (err) {
        console.error(`Error refilling user ${sub.user_id}:`, err);
        errors.push(`User ${sub.user_id}: ${err}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ym: currentYm,
      users_refilled: refillCount,
      total_credits_refilled: totalCreditsRefilled,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("credits-refill-monthly error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
