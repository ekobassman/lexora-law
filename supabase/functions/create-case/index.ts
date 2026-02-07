import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocked country codes
const BLOCKED_COUNTRIES = ['RU', 'CN'];

function checkGeoBlock(req: Request): { blocked: boolean; countryCode: string | null; reason: string } {
  const countryCode = req.headers.get('cf-ipcountry') 
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-country')
    || req.headers.get('fly-client-country');
  
  if (!countryCode) {
    return { blocked: false, countryCode: null, reason: 'NO_GEO_HEADER' };
  }
  
  const normalized = countryCode.toUpperCase();
  
  if (BLOCKED_COUNTRIES.includes(normalized)) {
    return { blocked: true, countryCode: normalized, reason: 'JURISDICTION_BLOCKED' };
  }
  
  return { blocked: false, countryCode: normalized, reason: 'OK' };
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CASE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK
  const geoCheck = checkGeoBlock(req);
  if (geoCheck.blocked) {
    logStep('Jurisdiction blocked', { countryCode: geoCheck.countryCode, reason: geoCheck.reason });
    return new Response(
      JSON.stringify({ code: geoCheck.reason, countryCode: geoCheck.countryCode || 'unknown' }),
      { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    logStep("Function started");

    // STEP 1: Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("Auth error", { error: userError?.message });
      return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "Invalid token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = roleData?.role === "admin";
    logStep("Admin check", { isAdmin, role: roleData?.role ?? "none" });

    // STEP 2: Parse case data
    const caseData = await req.json();

    if (!caseData.title || typeof caseData.title !== "string") {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "Title is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Optional debug-only test hook: allow forcing an insert failure to verify counters don't increment.
    // This does NOT grant any extra access; it only forces this request to fail early.
    if (req.headers.get("x-lexora-debug") === "true" && caseData?.__debug_force_insert_error === true) {
      logStep("Debug: forced insert failure");
      throw new Error("DEBUG_FORCED_INSERT_FAILURE");
    }

    // STEP 3: Read plan + usage (server-side), enforce case limit BEFORE insert
    const currentYm = new Date().toISOString().slice(0, 7);

    const { data: subStateRaw } = await supabaseAdmin
      .from("subscriptions_state")
      .select("plan,is_active,monthly_case_limit")
      .eq("user_id", userId)
      .maybeSingle();

    // Ensure subscription state exists (defaults)
    if (!subStateRaw) {
      await supabaseAdmin
        .from("subscriptions_state")
        .upsert(
          {
            user_id: userId,
            plan: "free",
            monthly_case_limit: 1,
            monthly_credit_refill: 0,
            monthly_ai_softcap: 0,
            is_active: true,
          },
          { onConflict: "user_id" },
        );
    }

    const plan = subStateRaw?.plan ?? "free";
    
    // ADMIN BYPASS: Admins get null limit (truly unlimited)
    // Also handle unlimited plan with null limit
    const monthlyCaseLimitRaw = subStateRaw?.monthly_case_limit ?? 1;
    const monthlyCaseLimit = isAdmin ? null : (plan === "unlimited" ? null : monthlyCaseLimitRaw);

    // Ensure usage row exists for current month
    await supabaseAdmin
      .from("usage_counters_monthly")
      .upsert(
        {
          user_id: userId,
          ym: currentYm,
          cases_created: 0,
          credits_spent: 0,
          ai_sessions_started: 0,
        },
        { onConflict: "user_id,ym" },
      );

    const { data: usageRow, error: usageErr } = await supabaseAdmin
      .from("usage_counters_monthly")
      .select("cases_created")
      .eq("user_id", userId)
      .eq("ym", currentYm)
      .maybeSingle();

    if (usageErr) {
      logStep("Usage read error", { error: usageErr.message });
      throw new Error(`Failed to read usage counters: ${usageErr.message}`);
    }

    const casesUsedBefore = usageRow?.cases_created ?? 0;

    logStep("BEFORE insert check", { 
      userId, 
      isAdmin,
      plan,
      casesUsedBefore, 
      monthlyCaseLimit: monthlyCaseLimit === null ? '∞' : monthlyCaseLimit,
      casesRemaining: monthlyCaseLimit === null ? '∞' : (monthlyCaseLimit - casesUsedBefore),
    });

    // ADMIN BYPASS + UNLIMITED BYPASS: Skip limit check if admin or monthlyCaseLimit is null
    const shouldEnforceLimit = !isAdmin && monthlyCaseLimit !== null;
    
    if (shouldEnforceLimit && monthlyCaseLimit !== null && casesUsedBefore >= monthlyCaseLimit) {
      logStep("REJECTED: case limit reached", { casesUsed: casesUsedBefore, limit: monthlyCaseLimit });
      return new Response(
        JSON.stringify({
          error: "PRACTICE_LIMIT_REACHED",
          message: "Limite pratiche mensili raggiunto. Passa a un piano superiore per continuare.",
          cases_used: casesUsedBefore,
          cases_limit: monthlyCaseLimit,
          upgrade_required: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // STEP 4: Insert case (only if limit check passed)
    const { data: newCase, error: insertError } = await supabaseAdmin
      .from("pratiche")
      .insert({
        user_id: userId,
        title: caseData.title.trim(),
        authority: caseData.authority?.trim() || null,
        aktenzeichen: caseData.aktenzeichen?.trim() || null,
        deadline: caseData.deadline || null,
        letter_text: caseData.letter_text?.trim() || null,
        file_url: caseData.file_url || null,
        status: caseData.status || "new",
        explanation: caseData.explanation || null,
        risks: caseData.risks || null,
        draft_response: caseData.draft_response || null,
        chat_history: caseData.chat_history || [],
      })
      .select()
      .single();

    if (insertError) {
      logStep("Insert error", { error: insertError.message });
      throw new Error(`Failed to create case: ${insertError.message}`);
    }

    // STEP 5: Only AFTER successful insert: atomic increment counter via RPC
    const { data: newCasesCount, error: incErr } = await supabaseAdmin.rpc("increment_cases_created", {
      _user_id: userId,
      _ym: currentYm,
    });

    if (incErr) {
      // Case was created but counter update failed; surface error for observability.
      logStep("Post-insert atomic increment failed", { error: incErr.message, caseId: newCase.id });
      throw new Error(`Failed to increment case counter: ${incErr.message}`);
    }

    const finalCasesUsed = newCasesCount ?? (casesUsedBefore + 1);
    const finalCasesRemaining = monthlyCaseLimit === null ? null : Math.max(0, monthlyCaseLimit - finalCasesUsed);

    logStep("AFTER insert success", { 
      caseId: newCase.id, 
      casesUsedBefore, 
      casesUsedAfter: finalCasesUsed, 
      casesRemaining: finalCasesRemaining === null ? '∞' : finalCasesRemaining,
      monthlyCaseLimit: monthlyCaseLimit === null ? '∞' : monthlyCaseLimit,
    });

    const requestId = `case-create-${userId}-${Date.now()}`;
    const { error: ledgerErr } = await supabaseAdmin.from("credit_ledger").insert({
      user_id: userId,
      case_id: newCase.id,
      action_type: "CASE_CREATED",
      delta: 0,
      meta: { request_id: requestId, ym: currentYm, plan },
    });

    if (ledgerErr) {
      logStep("Post-insert ledger write failed", { error: ledgerErr.message, caseId: newCase.id });
      throw new Error(`Failed to write ledger: ${ledgerErr.message}`);
    }

    // STEP 7: Increment global documents processed counter (fire and forget)
    try {
      await supabaseAdmin.rpc("increment_documents_processed");
    } catch (globalErr) {
      logStep("Global stats increment failed (non-critical)", { error: (globalErr as Error)?.message });
    }

    const { data: walletRow } = await supabaseAdmin
      .from("user_wallet")
      .select("balance_credits")
      .eq("user_id", userId)
      .maybeSingle();

    const creditsBalance = walletRow?.balance_credits ?? 0;

    logStep("Case created successfully", { caseId: newCase.id, userId });

    return new Response(
      JSON.stringify({
        success: true,
        id: newCase.id,
        case: newCase,
        usage: {
          cases_used: finalCasesUsed,
          cases_limit: monthlyCaseLimit === null ? 999999 : monthlyCaseLimit,  // Legacy format
          remaining: finalCasesRemaining === null ? 999999 : finalCasesRemaining,  // Legacy format
        },
        credits_balance: creditsBalance,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: "SERVER_ERROR", message: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
