import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-lexora-debug",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  console.log(`[create-case] ${step}${detailsStr}`);
};

serve(async (req) => {
  const requestId = `case-create-${Date.now()}`;
  
  try {
    logStep("Function started", { requestId, method: req.method, url: req.url });

    // CORS OPTIONS
    if (req.method === "OPTIONS") {
      logStep("CORS preflight", { requestId });
      return new Response(null, { 
        status: 200,
        headers: corsHeaders 
      });
    }

    // GEO-BLOCK CHECK
    const geoCheck = checkGeoBlock(req);
    if (geoCheck.blocked) {
      logStep("Jurisdiction blocked", { requestId, countryCode: geoCheck.countryCode, reason: geoCheck.reason });
      return new Response(
        JSON.stringify({ error: geoCheck.reason, countryCode: geoCheck.countryCode || 'unknown' }),
        { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 1: Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("Missing authorization header", { requestId });
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "Authorization header required" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      logStep("Invalid authorization format", { requestId });
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "Authorization header must be 'Bearer <token>'" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Create client with auth header
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !userData.user) {
      logStep("Auth error", { requestId, error: userError?.message, hasUser: !!userData.user });
      return new Response(
        JSON.stringify({ error: "UNAUTHORIZED", message: "Invalid or expired token" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    logStep("User authenticated", { requestId, userId, email: userData.user.email });

    // STEP 2: Parse and validate body
    let caseData;
    try {
      caseData = await req.json();
    } catch (parseError) {
      logStep("JSON parse error", { requestId, error: (parseError as Error)?.message });
      return new Response(
        JSON.stringify({ error: "VALIDATION_ERROR", message: "Invalid JSON body" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!caseData.title || typeof caseData.title !== "string" || caseData.title.trim().length === 0) {
      logStep("Validation error: missing title", { requestId });
      return new Response(
        JSON.stringify({ error: "VALIDATION_ERROR", message: "Title is required and must be a non-empty string" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate locale
    if (!caseData.locale || typeof caseData.locale !== "string") {
      logStep("Validation error: missing locale", { requestId });
      return new Response(
        JSON.stringify({ error: "VALIDATION_ERROR", message: "Locale is required" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional debug-only test hook
    if (req.headers.get("x-lexora-debug") === "true" && caseData?.__debug_force_insert_error === true) {
      logStep("Debug: forced insert failure", { requestId });
      throw new Error("DEBUG_FORCED_INSERT_FAILURE");
    }

    // STEP 3: Check plan limits (using RLS-compliant client)
    const currentYm = new Date().toISOString().slice(0, 7);

    // Check admin role using RLS
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = roleData?.role === "admin";

    // Get subscription state using RLS
    const { data: subStateRaw } = await supabaseClient
      .from("subscriptions_state")
      .select("plan,is_active,monthly_case_limit")
      .eq("user_id", userId)
      .maybeSingle();

    // Plan defaults
    const PLAN_DEFAULTS: Record<string, number | null> = {
      free: 1,
      starter: 5,
      plus: 20,
      pro: null, // unlimited
    };

    // Ensure subscription state exists
    if (!subStateRaw) {
      logStep("Creating default subscription state", { requestId, userId });
      await supabaseClient
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
    const monthlyCaseLimitRaw = subStateRaw?.monthly_case_limit ?? PLAN_DEFAULTS[plan] ?? 1;
    const monthlyCaseLimit = isAdmin ? null : (plan === "pro" ? null : monthlyCaseLimitRaw);

    // Ensure usage row exists
    await supabaseClient
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

    const { data: usageRow, error: usageErr } = await supabaseClient
      .from("usage_counters_monthly")
      .select("cases_created")
      .eq("user_id", userId)
      .eq("ym", currentYm)
      .maybeSingle();

    if (usageErr) {
      logStep("Usage read error", { requestId, error: usageErr.message });
      throw new Error(`Failed to read usage counters: ${usageErr.message}`);
    }

    const casesUsedBefore = usageRow?.cases_created ?? 0;

    logStep("Usage check", { 
      requestId, 
      userId, 
      isAdmin,
      plan,
      casesUsedBefore, 
      monthlyCaseLimit: monthlyCaseLimit === null ? '∞' : monthlyCaseLimit,
      casesRemaining: monthlyCaseLimit === null ? '∞' : (monthlyCaseLimit - casesUsedBefore),
    });

    // Enforce limits
    const shouldEnforceLimit = !isAdmin && monthlyCaseLimit !== null;
    
    if (shouldEnforceLimit && casesUsedBefore >= monthlyCaseLimit) {
      logStep("Case limit reached", { requestId, casesUsed: casesUsedBefore, limit: monthlyCaseLimit });
      return new Response(
        JSON.stringify({
          error: "PRACTICE_LIMIT_REACHED",
          message: "Limite pratiche mensili raggiunto. Passa a un piano superiore per continuare.",
          cases_used: casesUsedBefore,
          cases_limit: monthlyCaseLimit,
          upgrade_required: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 4: Insert case using RLS-compliant client
    const { data: newCase, error: insertError } = await supabaseClient
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
        locale: caseData.locale,
        source: caseData.source || "web",
      })
      .select()
      .single();

    if (insertError) {
      logStep("Insert error", { requestId, error: insertError.message, code: insertError.code });
      
      // Handle specific error types
      if (insertError.code === '42501' || insertError.message.includes('permission')) {
        return new Response(
          JSON.stringify({ error: "PERMISSION_DENIED", message: "Insufficient permissions to create case" }), 
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (insertError.message.includes('null value') || 
          insertError.message.includes('violates not-null') || 
          insertError.message.includes('foreign key')) {
        return new Response(
          JSON.stringify({ error: "VALIDATION_ERROR", message: "Invalid data provided" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Failed to create case: ${insertError.message}`);
    }

    // STEP 5: Increment usage counter via RPC
    const { data: newCasesCount, error: incErr } = await supabaseClient.rpc("increment_cases_created", {
      _user_id: userId,
      _ym: currentYm,
    });

    if (incErr) {
      logStep("Counter increment failed", { requestId, error: incErr.message, caseId: newCase.id });
      throw new Error(`Failed to increment case counter: ${incErr.message}`);
    }

    const finalCasesUsed = newCasesCount ?? (casesUsedBefore + 1);
    const finalCasesRemaining = monthlyCaseLimit === null ? null : Math.max(0, monthlyCaseLimit - finalCasesUsed);

    // STEP 6: Write to ledger
    const ledgerError = await supabaseClient.from("credit_ledger").insert({
      user_id: userId,
      case_id: newCase.id,
      action_type: "CASE_CREATED",
      delta: 0,
      meta: { request_id: requestId, ym: currentYm, plan },
    });

    if (ledgerError.error) {
      logStep("Ledger write failed", { requestId, error: ledgerError.error.message, caseId: newCase.id });
      throw new Error(`Failed to write ledger: ${ledgerError.error.message}`);
    }

    // STEP 7: Get wallet balance
    const { data: walletRow } = await supabaseClient
      .from("user_wallet")
      .select("balance_credits")
      .eq("user_id", userId)
      .maybeSingle();

    const creditsBalance = walletRow?.balance_credits ?? 0;

    logStep("Case created successfully", { requestId, caseId: newCase.id, userId });

    return new Response(
      JSON.stringify({
        success: true,
        id: newCase.id,
        caseId: newCase.id,
        case: newCase,
        usage: {
          cases_used: finalCasesUsed,
          cases_limit: monthlyCaseLimit === null ? 999999 : monthlyCaseLimit,
          remaining: finalCasesRemaining === null ? 999999 : finalCasesRemaining,
        },
        credits_balance: creditsBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[create-case] CRITICAL ERROR', {
      requestId,
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });

    // Return generic error to client
    return new Response(
      JSON.stringify({ 
        error: "INTERNAL_SERVER_ERROR", 
        message: "An internal error occurred",
        requestId: requestId 
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
