import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];

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

    // Get caller user from JWT
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

    const callerId = user.id;
    const callerEmail = user.email ?? "";

    // Parse body
    const body = await req.json().catch(() => ({}));
    const { target_user_id } = body;

    let targetUserId = callerId;
    let isAdminLookup = false;

    // Admin lookup accepts ONLY target_user_id (no email lookup)
    if (target_user_id) {
      if (!ADMIN_EMAILS.includes(callerEmail.toLowerCase())) {
        return new Response(JSON.stringify({ error: "ADMIN_ONLY" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isAdminLookup = true;
      targetUserId = target_user_id;
    }

    const now = new Date();
    const currentYm = now.toISOString().slice(0, 7);

    // ═══════════════════════════════════════════════════════════════════
    // BOUNDED QUERIES - NO "fetch all ledger rows"
    // ═══════════════════════════════════════════════════════════════════

    // Subscription state
    const { data: subState } = await supabase
      .from("subscriptions_state")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();

    // Wallet
    const { data: wallet } = await supabase
      .from("user_wallet")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();

    // Usage counters for current month
    const { data: usage } = await supabase
      .from("usage_counters_monthly")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("ym", currentYm)
      .maybeSingle();

    // A) ledger_recent: last 50 rows (UI display only)
    const { data: ledgerRows } = await supabase
      .from("credit_ledger")
      .select("id, action_type, delta, created_at, case_id, meta")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(50);

    // ═══════════════════════════════════════════════════════════════════
    // B) computed_spent_month - BOUNDED query using created_at (not meta.ym)
    // ═══════════════════════════════════════════════════════════════════
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // Query only negative delta rows in current month - bounded by date range
    const { data: spentThisMonthRows } = await supabase
      .from("credit_ledger")
      .select("delta")
      .eq("user_id", targetUserId)
      .lt("delta", 0)
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", nextMonthStart.toISOString());

    const computedSpentMonth = Math.abs(
      (spentThisMonthRows || []).reduce((acc, row) => acc + (row.delta ?? 0), 0)
    );

    // ═══════════════════════════════════════════════════════════════════
    // C) ledger_sum_all_time - use credits_balance as fallback (no RPC available)
    // Since we can't fetch all rows and no RPC exists, we fallback to wallet balance
    // ═══════════════════════════════════════════════════════════════════
    const creditsBalance = wallet?.balance_credits ?? 0;
    
    // We use credits_balance as ledger_sum fallback
    // This means ledger_sum will equal wallet_balance, so mismatch is always false when unknown
    const ledgerSumKnown = false; // No RPC, can't compute actual sum
    const ledgerSum = creditsBalance; // Fallback to avoid false positives

    // ═══════════════════════════════════════════════════════════════════
    // D) legacy_data detection (deterministic)
    // legacy_data = (no ledger rows) AND (has credits)
    // ═══════════════════════════════════════════════════════════════════
    const hasLedgerHistory = (ledgerRows || []).length > 0;
    const legacyData = !hasLedgerHistory && creditsBalance > 0;

    // ═══════════════════════════════════════════════════════════════════
    // E) mismatch rules
    // ═══════════════════════════════════════════════════════════════════
    const plan = subState?.plan ?? "free";
    const isUnlimited = plan === "unlimited";
    const casesUsed = usage?.cases_created ?? 0;
    const casesLimit = subState?.monthly_case_limit ?? 1;
    const creditsSpent = usage?.credits_spent ?? 0;
    const aiSessionsStarted = usage?.ai_sessions_started ?? 0;

    // mismatch_wallet_vs_ledger: only meaningful if legacy_data is false AND ledger_sum is known
    // Since ledger_sum is NOT known (no RPC), we set mismatch to false to avoid false warnings
    const mismatchWalletVsLedger = !legacyData && ledgerSumKnown && creditsBalance !== ledgerSum;

    // mismatch_spent: only evaluate if not unlimited and computed_spent is available
    // For unlimited plans: always false
    const mismatchSpent = !isUnlimited && creditsSpent !== computedSpentMonth;

    // Next refill date (first of next month)
    const nextRefillDate = nextMonthStart.toISOString().split("T")[0];

    const response = {
      target_user_id: targetUserId,
      is_admin_lookup: isAdminLookup,
      status: {
        plan,
        ym: currentYm,
        cases_used: casesUsed,
        cases_limit: casesLimit,
        credits_balance: creditsBalance,
        credits_spent: creditsSpent,
        ai_sessions_started: aiSessionsStarted,
        next_refill_date: nextRefillDate,
        is_unlimited: isUnlimited,
        period_start: subState?.period_start ?? null,
        period_end: subState?.period_end ?? null,
      },
      ledger_recent: ledgerRows || [],
      consistency: {
        ledger_sum: ledgerSumKnown ? ledgerSum : null,
        wallet_balance: creditsBalance,
        mismatch_wallet_vs_ledger: mismatchWalletVsLedger,
        credits_spent_counter: creditsSpent,
        computed_spent_from_ledger: computedSpentMonth,
        mismatch_spent: mismatchSpent,
        legacy_data: legacyData,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("usage-inspector error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
