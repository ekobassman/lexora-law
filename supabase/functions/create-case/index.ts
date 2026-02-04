import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

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
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));
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

    // Check admin role (allowlist + user_roles)
    const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
    const userEmail = (userData.user.email ?? "").toLowerCase();
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = ADMIN_EMAILS.some((e) => e.toLowerCase() === userEmail) || roleData?.role === "admin";
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

    // STEP 3: Consume 1 upload via RPC (plan_limits + usage_counters_monthly). Admin bypass.
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let usageState: { plan_key?: string; usage?: { uploads_count?: number }; limits?: { uploads_per_month?: number } } | null = null;

    if (!isAdmin) {
      const { data: consumeResult, error: consumeErr } = await supabaseAdmin.rpc("consume_usage", {
        p_user_id: userId,
        p_month: today,
        p_metric: "uploads",
        p_amount: 1,
      });

      if (consumeErr) {
        logStep("Usage RPC error", { error: consumeErr.message });
        return new Response(
          JSON.stringify({
            error: "USAGE_SYSTEM_UNAVAILABLE",
            message: "Sistema limiti non disponibile. Riprova tra poco.",
            details: consumeErr.message,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = consumeResult as { ok?: boolean; error?: string; state?: typeof usageState } | null;
      if (!result?.ok) {
        usageState = result?.state ?? null;
        const code = result?.error ?? "LIMIT_UPLOADS";
        const msg =
          code === "LIMIT_UPLOADS"
            ? "Limite upload mensili raggiunto. Passa a un piano superiore."
            : code === "LIMIT_OCR"
              ? "Limite pagine OCR mensili raggiunto."
              : code === "LIMIT_CHAT"
                ? "Limite messaggi chat mensili raggiunto."
                : "Limite mensile raggiunto. Passa a un piano superiore.";
        logStep("REJECTED: limit reached", { code, state: usageState });
        return new Response(
          JSON.stringify({
            error: code,
            message: msg,
            state: usageState,
            upgrade_required: true,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      usageState = result?.state ?? null;
    } else {
      const { data: stateData } = await supabaseAdmin.rpc("get_usage_and_limits", {
        p_user_id: userId,
        p_month: today,
      });
      usageState = stateData as typeof usageState;
    }

    logStep("Usage check OK", { plan_key: usageState?.plan_key, uploads: usageState?.usage?.uploads_count });

    // STEP 4: Insert case
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

    logStep("AFTER insert success", { caseId: newCase.id, userId });

    // Optional: credit_ledger / user_wallet (non-blocking)
    try {
      await supabaseAdmin.from("credit_ledger").insert({
        user_id: userId,
        case_id: newCase.id,
        action_type: "CASE_CREATED",
        delta: 0,
        meta: { request_id: `case-create-${userId}-${Date.now()}`, month: today },
      });
    } catch (ledgerErr) {
      logStep("Ledger write failed (non-critical)", { error: (ledgerErr as Error)?.message });
    }

    let creditsBalance = 0;
    try {
      const { data: walletRow } = await supabaseAdmin.from("user_wallet").select("balance_credits").eq("user_id", userId).maybeSingle();
      creditsBalance = walletRow?.balance_credits ?? 0;
    } catch (_) {
      // ignore
    }

    const usage = usageState?.usage ?? {};
    const limits = usageState?.limits ?? {};
    const uploadsUsed = usage.uploads_count ?? 0;
    const uploadsLimit = limits.uploads_per_month ?? 999999;

    return new Response(
      JSON.stringify({
        success: true,
        id: newCase.id,
        case: newCase,
        usage: {
          cases_used: uploadsUsed,
          cases_limit: uploadsLimit,
          remaining: Math.max(0, uploadsLimit - uploadsUsed),
        },
        credits_balance: creditsBalance,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
