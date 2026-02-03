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

    // Get caller from JWT
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

    const body = await req.json();
    const { 
      credits_amount, 
      reason, 
      target_user_id,  // For admin adjustments
    } = body;

    // Validate input
    if (typeof credits_amount !== "number" || credits_amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid credits amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validReasons = ["stripe_purchase", "admin_adjustment", "promo", "refund"];
    if (!reason || !validReasons.includes(reason)) {
      return new Response(JSON.stringify({ 
        error: "Invalid reason", 
        valid_reasons: validReasons 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine target user
    let targetUserId = user.id;

    // For admin_adjustment, check if caller is admin and use target_user_id
    if (reason === "admin_adjustment") {
      const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
      if (!ADMIN_EMAILS.some((e) => e.toLowerCase() === (user.email ?? "").toLowerCase())) {
        return new Response(JSON.stringify({ error: "ADMIN_ONLY" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (target_user_id) {
        targetUserId = target_user_id;
      }
    }

    // For stripe_purchase, only allow self-purchase
    if (reason === "stripe_purchase" && target_user_id && target_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Cannot purchase credits for another user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure wallet exists
    await supabase
      .from("user_wallet")
      .upsert({ 
        user_id: targetUserId, 
        balance_credits: 0,
        lifetime_credits: 0
      }, { 
        onConflict: "user_id",
        ignoreDuplicates: true 
      });

    // Get current wallet
    const { data: wallet } = await supabase
      .from("user_wallet")
      .select("balance_credits, lifetime_credits")
      .eq("user_id", targetUserId)
      .single();

    const currentBalance = wallet?.balance_credits ?? 0;
    const currentLifetime = wallet?.lifetime_credits ?? 0;

    // Update wallet
    const newBalance = currentBalance + credits_amount;
    const newLifetime = currentLifetime + credits_amount;

    await supabase
      .from("user_wallet")
      .update({ 
        balance_credits: newBalance,
        lifetime_credits: newLifetime,
      })
      .eq("user_id", targetUserId);

    // Log to ledger
    await supabase.from("credit_ledger").insert({
      user_id: targetUserId,
      action_type: reason === "admin_adjustment" ? "ADJUSTMENT" : "REFILL",
      delta: credits_amount,
      meta: { 
        reason,
        applied_by: user.id,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      target_user_id: targetUserId,
      credits_added: credits_amount,
      new_balance: newBalance,
      message: `${credits_amount} crediti aggiunti con successo`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("credits-apply error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
