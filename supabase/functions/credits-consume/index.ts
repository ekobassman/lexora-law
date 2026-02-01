import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit costs per action type
const CREDIT_COSTS: Record<string, number> = {
  CASE_CREATED: 0,           // Free, but increments case counter
  OCR_ANALYZE: 1,            // OCR + analysis
  DRAFT_GENERATE: 1,         // Generate draft
  DRAFT_REGENERATE: 1,       // Regenerate draft
  AI_SESSION_START: 1,       // Start AI chat session
  DOC_ANALYZE_EXTRA: 1,      // Extra document analysis
  REFILL: 0,                 // Refill (no cost, positive delta)
  ADJUSTMENT: 0,             // Admin adjustment
};

// Session config
const SESSION_DURATION_HOURS = 2;
const SESSION_MAX_MESSAGES = 20;
const IDEMPOTENCY_WINDOW_SECONDS = 60;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREDITS-CONSUME] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header", code: "NO_AUTH" }), {
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
      return new Response(JSON.stringify({ error: "Invalid token", code: "INVALID_TOKEN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json();
    const { action_type, case_id, meta = {}, request_id } = body;

    logStep("Request received", { userId, action_type, case_id, request_id });

    // Validate action type
    if (!action_type || !(action_type in CREDIT_COSTS)) {
      return new Response(JSON.stringify({ 
        error: "Invalid action type", 
        code: "INVALID_ACTION",
        valid_actions: Object.keys(CREDIT_COSTS)
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cost = CREDIT_COSTS[action_type];
    const currentYm = new Date().toISOString().slice(0, 7);

    // HOTFIX 5: Idempotency check with correct JSONB syntax
    if (request_id) {
      const cutoffTime = new Date(Date.now() - IDEMPOTENCY_WINDOW_SECONDS * 1000).toISOString();
      const { data: existingLedger } = await supabase
        .from("credit_ledger")
        .select("id, delta")
        .eq("user_id", userId)
        .eq("action_type", action_type)
        .eq("meta->>request_id", request_id)
        .gte("created_at", cutoffTime)
        .limit(1)
        .maybeSingle();

      if (existingLedger) {
        logStep("Idempotent request detected", { request_id });
        const { data: wallet } = await supabase
          .from("user_wallet")
          .select("balance_credits")
          .eq("user_id", userId)
          .single();

        return new Response(JSON.stringify({
          success: true,
          new_balance: wallet?.balance_credits ?? 0,
          message: "Operation already processed (idempotent)",
          delta: existingLedger.delta,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get subscription state
    const { data: subState } = await supabase
      .from("subscriptions_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Ensure subscription state exists
    if (!subState) {
      await supabase
        .from("subscriptions_state")
        .upsert({
          user_id: userId,
          plan: "free",
          monthly_case_limit: 1,
          monthly_credit_refill: 0,
        }, { onConflict: "user_id" });
    }

    const plan = subState?.plan || "free";
    const isUnlimited = plan === "unlimited";
    const monthlyCaseLimit = subState?.monthly_case_limit ?? 1;

    logStep("Plan info", { plan, isUnlimited, monthlyCaseLimit });

    // Ensure usage counters row exists
    await supabase
      .from("usage_counters_monthly")
      .upsert({ 
        user_id: userId, 
        ym: currentYm,
        cases_created: 0,
        credits_spent: 0,
        ai_sessions_started: 0
      }, { 
        onConflict: "user_id,ym",
        ignoreDuplicates: true 
      });

    // Get current usage
    const { data: usage } = await supabase
      .from("usage_counters_monthly")
      .select("*")
      .eq("user_id", userId)
      .eq("ym", currentYm)
      .single();

    const casesUsed = usage?.cases_created ?? 0;

    // Ensure wallet exists
    await supabase
      .from("user_wallet")
      .upsert({ 
        user_id: userId, 
        balance_credits: 0,
        lifetime_credits: 0
      }, { 
        onConflict: "user_id",
        ignoreDuplicates: true 
      });

    const { data: wallet } = await supabase
      .from("user_wallet")
      .select("balance_credits")
      .eq("user_id", userId)
      .single();

    const currentBalance = wallet?.balance_credits ?? 0;

    // ════════════════════════════════════════════════════════════════════
    // Handle CASE_CREATED - check case limit
    // ════════════════════════════════════════════════════════════════════
    if (action_type === "CASE_CREATED") {
      if (!isUnlimited && casesUsed >= monthlyCaseLimit) {
        logStep("Case limit reached", { casesUsed, monthlyCaseLimit });
        return new Response(JSON.stringify({
          error: "Limite pratiche mensili raggiunto. Passa a un piano superiore per continuare.",
          code: "CASE_LIMIT_REACHED",
          cases_used: casesUsed,
          cases_limit: monthlyCaseLimit,
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Increment case counter
      await supabase
        .from("usage_counters_monthly")
        .update({ cases_created: casesUsed + 1 })
        .eq("user_id", userId)
        .eq("ym", currentYm);

      // Log to ledger (case_id only; pratica_id kept in DB for backcompat but no longer populated)
      await supabase.from("credit_ledger").insert({
        user_id: userId,
        case_id: case_id || null,
        action_type,
        delta: 0,
        meta: { ...meta, request_id, ym: currentYm, plan },
      });

      logStep("Case created", { casesUsed: casesUsed + 1, monthlyCaseLimit });

      // HOTFIX 6: Return real balance and updated counts
      return new Response(JSON.stringify({
        success: true,
        new_balance: currentBalance,
        message: "Pratica creata con successo",
        cases_used: casesUsed + 1,
        cases_limit: monthlyCaseLimit,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // HOTFIX 4: Handle AI_SESSION_START with proper session tracking
    // ════════════════════════════════════════════════════════════════════
    if (action_type === "AI_SESSION_START" && case_id) {
      const now = new Date();
      
      // Check for active session
      const { data: activeSession } = await supabase
        .from("ai_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("case_id", case_id)
        .eq("is_active", true)
        .gt("expires_at", now.toISOString())
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSession && activeSession.message_count < activeSession.max_messages) {
        // Session still active - increment message count, no charge
        await supabase
          .from("ai_sessions")
          .update({ 
            message_count: activeSession.message_count + 1,
            last_message_at: now.toISOString()
          })
          .eq("id", activeSession.id);

        logStep("Session extended", { sessionId: activeSession.id, messageCount: activeSession.message_count + 1 });

        return new Response(JSON.stringify({
          success: true,
          session_active: true,
          session_id: activeSession.id,
          message_count: activeSession.message_count + 1,
          max_messages: activeSession.max_messages,
          credits_charged: 0,
          new_balance: currentBalance,
          message: "Sessione AI attiva",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Expire old session if exists
      if (activeSession) {
        await supabase
          .from("ai_sessions")
          .update({ is_active: false })
          .eq("id", activeSession.id);
      }

      // Need to start new session - check credits (unless unlimited)
      // HOTFIX 3: Unlimited users don't need credits
      if (!isUnlimited && currentBalance < cost) {
        logStep("Insufficient credits for session", { currentBalance, cost });
        return new Response(JSON.stringify({
          error: "Crediti insufficienti. Acquista crediti per continuare.",
          code: "INSUFFICIENT_CREDITS",
          current_balance: currentBalance,
          required: cost,
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new session
      const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
      const { data: newSession } = await supabase
        .from("ai_sessions")
        .insert({
          user_id: userId,
          case_id,
          ym: currentYm,
          started_at: now.toISOString(),
          last_message_at: now.toISOString(),
          message_count: 1,
          max_messages: SESSION_MAX_MESSAGES,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      // HOTFIX 3: For unlimited, don't deduct credits but still log
      const actualDelta = isUnlimited ? 0 : -cost;
      const newBalance = isUnlimited ? currentBalance : currentBalance - cost;

      if (!isUnlimited) {
        await supabase
          .from("user_wallet")
          .update({ balance_credits: newBalance })
          .eq("user_id", userId);

        await supabase
          .from("usage_counters_monthly")
          .update({ 
            credits_spent: (usage?.credits_spent ?? 0) + cost,
            ai_sessions_started: (usage?.ai_sessions_started ?? 0) + 1
          })
          .eq("user_id", userId)
          .eq("ym", currentYm);
      } else {
        // For unlimited, just increment session counter
        await supabase
          .from("usage_counters_monthly")
          .update({ 
            ai_sessions_started: (usage?.ai_sessions_started ?? 0) + 1
          })
          .eq("user_id", userId)
          .eq("ym", currentYm);
      }

      // Log to ledger with nominal_cost for unlimited
      await supabase.from("credit_ledger").insert({
        user_id: userId,
        case_id,
        action_type,
        delta: actualDelta,
        meta: {
          ...meta,
          request_id,
          ym: currentYm,
          plan,
          session_id: newSession?.id,
          nominal_cost: cost,
          unlimited: isUnlimited,
        },
      });

      logStep("New session started", { sessionId: newSession?.id, charged: !isUnlimited });

      return new Response(JSON.stringify({
        success: true,
        session_id: newSession?.id,
        session_active: true,
        message_count: 1,
        max_messages: SESSION_MAX_MESSAGES,
        new_balance: newBalance,
        credits_charged: isUnlimited ? 0 : cost,
        message: "Sessione AI avviata",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // Handle other credit-consuming actions (OCR, DRAFT, etc.)
    // ════════════════════════════════════════════════════════════════════
    if (cost > 0) {
      // HOTFIX 3: Unlimited plan users don't need credits
      if (!isUnlimited && currentBalance < cost) {
        logStep("Insufficient credits", { currentBalance, cost, action_type });
        return new Response(JSON.stringify({
          error: "Crediti insufficienti. Acquista crediti per continuare.",
          code: "INSUFFICIENT_CREDITS",
          current_balance: currentBalance,
          required: cost,
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // HOTFIX 3: For unlimited, don't deduct or track spending
      const actualDelta = isUnlimited ? 0 : -cost;
      const newBalance = isUnlimited ? currentBalance : currentBalance - cost;

      if (!isUnlimited) {
        // Deduct credits
        await supabase
          .from("user_wallet")
          .update({ balance_credits: newBalance })
          .eq("user_id", userId);

        // Update usage counters
        await supabase
          .from("usage_counters_monthly")
          .update({ credits_spent: (usage?.credits_spent ?? 0) + cost })
          .eq("user_id", userId)
          .eq("ym", currentYm);
      }

      // Log to ledger (always, with nominal_cost for unlimited)
      await supabase.from("credit_ledger").insert({
        user_id: userId,
        case_id: case_id || null,
        action_type,
        delta: actualDelta,
        meta: {
          ...meta,
          request_id,
          ym: currentYm,
          plan,
          nominal_cost: cost,
          unlimited: isUnlimited,
        },
      });

      logStep("Credits consumed", { action_type, delta: actualDelta, newBalance, unlimited: isUnlimited });

      return new Response(JSON.stringify({
        success: true,
        new_balance: newBalance,
        credits_charged: isUnlimited ? 0 : cost,
        message: getSuccessMessage(action_type),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For zero-cost actions
    return new Response(JSON.stringify({
      success: true,
      new_balance: currentBalance,
      message: "Azione completata",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("credits-consume error:", error);
    return new Response(JSON.stringify({ 
      error: "Errore temporaneo. Riprova.",
      code: "INTERNAL_ERROR" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getSuccessMessage(actionType: string): string {
  switch (actionType) {
    case "OCR_ANALYZE": return "Analisi documento avviata";
    case "DRAFT_GENERATE": return "Generazione bozza avviata";
    case "DRAFT_REGENERATE": return "Rigenerazione bozza avviata";
    case "AI_SESSION_START": return "Sessione AI avviata";
    case "DOC_ANALYZE_EXTRA": return "Analisi documento aggiuntivo avviata";
    default: return "Operazione completata";
  }
}
