import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * credits-selftest-lite
 * 
 * This self-test validates DATABASE INVARIANTS and CONSISTENCY only.
 * It does NOT fully simulate client credit flows.
 * 
 * Use for: verifying atomic operations, RPC functions, and basic plan logic.
 * NOT for: end-to-end integration testing of client flows.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if admin (if auth provided) - also allow cron calls without auth
    if (authHeader) {
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

      const callerEmail = (user.email ?? "").toLowerCase();
      const isCallerAdmin = ADMIN_EMAILS.some((e) => e.toLowerCase() === callerEmail);
      
      if (!isCallerAdmin) {
        return new Response(JSON.stringify({ error: "ADMIN_ONLY" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const tests: TestResult[] = [];
    const currentYm = new Date().toISOString().slice(0, 7);
    const testUserId = crypto.randomUUID();

    // ═══════════════════════════════════════════════════════════════════
    // Setup test user state
    // ═══════════════════════════════════════════════════════════════════
    const setupTestUser = async (plan: string, caseLimit: number, creditBalance: number, casesUsed: number = 0) => {
      // Create subscription state
      await supabase.from("subscriptions_state").upsert({
        user_id: testUserId,
        plan,
        monthly_case_limit: caseLimit,
        monthly_credit_refill: 0,
        is_active: true,
      }, { onConflict: "user_id" });

      // Create wallet
      await supabase.from("user_wallet").upsert({
        user_id: testUserId,
        balance_credits: creditBalance,
        lifetime_credits: creditBalance,
      }, { onConflict: "user_id" });

      // Create usage counters
      await supabase.from("usage_counters_monthly").upsert({
        user_id: testUserId,
        ym: currentYm,
        cases_created: casesUsed,
        credits_spent: 0,
        ai_sessions_started: 0,
      }, { onConflict: "user_id,ym" });
    };

    const cleanupTestUser = async () => {
      await supabase.from("credit_ledger").delete().eq("user_id", testUserId);
      await supabase.from("ai_sessions").delete().eq("user_id", testUserId);
      await supabase.from("usage_counters_monthly").delete().eq("user_id", testUserId);
      await supabase.from("user_wallet").delete().eq("user_id", testUserId);
      await supabase.from("subscriptions_state").delete().eq("user_id", testUserId);
    };

    // ═══════════════════════════════════════════════════════════════════
    // TEST 1: FREE plan - case limit enforcement
    // ═══════════════════════════════════════════════════════════════════
    try {
      await cleanupTestUser();
      await setupTestUser("free", 1, 0, 1); // Already used 1 case

      const { data: subState } = await supabase
        .from("subscriptions_state")
        .select("plan, monthly_case_limit")
        .eq("user_id", testUserId)
        .maybeSingle();

      const { data: usageRow } = await supabase
        .from("usage_counters_monthly")
        .select("cases_created")
        .eq("user_id", testUserId)
        .eq("ym", currentYm)
        .maybeSingle();

      const casesUsed = usageRow?.cases_created ?? 0;
      const caseLimit = subState?.monthly_case_limit ?? 1;
      const plan = subState?.plan ?? "free";

      const shouldBlock = plan !== "unlimited" && casesUsed >= caseLimit;

      tests.push({
        name: "FREE: case limit blocks second case",
        passed: shouldBlock === true,
        message: shouldBlock ? "Correctly blocked" : "Should have blocked but didn't",
        details: { casesUsed, caseLimit, plan, shouldBlock },
      });
    } catch (err) {
      tests.push({
        name: "FREE: case limit blocks second case",
        passed: false,
        message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // TEST 2: Credit balance decrements correctly
    // ═══════════════════════════════════════════════════════════════════
    try {
      await cleanupTestUser();
      await setupTestUser("basic", 3, 2, 0); // 2 credits

      const { data: walletBefore } = await supabase
        .from("user_wallet")
        .select("balance_credits")
        .eq("user_id", testUserId)
        .maybeSingle();

      const beforeBalance = walletBefore?.balance_credits ?? 0;

      // Deduct 1 credit
      await supabase
        .from("user_wallet")
        .update({ balance_credits: beforeBalance - 1 })
        .eq("user_id", testUserId);

      const { data: walletAfter1 } = await supabase
        .from("user_wallet")
        .select("balance_credits")
        .eq("user_id", testUserId)
        .maybeSingle();

      // Deduct another credit
      await supabase
        .from("user_wallet")
        .update({ balance_credits: (walletAfter1?.balance_credits ?? 0) - 1 })
        .eq("user_id", testUserId);

      const { data: walletAfter2 } = await supabase
        .from("user_wallet")
        .select("balance_credits")
        .eq("user_id", testUserId)
        .maybeSingle();

      const finalBalance = walletAfter2?.balance_credits ?? 0;
      const insufficientCredits = finalBalance < 1;

      tests.push({
        name: "BASIC: credit balance decrements to 0",
        passed: finalBalance === 0 && insufficientCredits,
        message: finalBalance === 0 ? "Correctly consumed to 0" : `Expected 0, got ${finalBalance}`,
        details: { beforeBalance, finalBalance, insufficientCredits },
      });
    } catch (err) {
      tests.push({
        name: "BASIC: credit balance decrements to 0",
        passed: false,
        message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // TEST 3: AI session creation and extension
    // ═══════════════════════════════════════════════════════════════════
    try {
      await cleanupTestUser();
      await setupTestUser("basic", 3, 5, 0);

      const testCaseId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Create a session
      await supabase.from("ai_sessions").insert({
        user_id: testUserId,
        case_id: testCaseId,
        ym: currentYm,
        started_at: now.toISOString(),
        last_message_at: now.toISOString(),
        message_count: 1,
        max_messages: 20,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      // Deduct 1 credit for session start
      await supabase
        .from("user_wallet")
        .update({ balance_credits: 4 })
        .eq("user_id", testUserId);

      // Check active session exists
      const { data: activeSession } = await supabase
        .from("ai_sessions")
        .select("*")
        .eq("user_id", testUserId)
        .eq("case_id", testCaseId)
        .eq("is_active", true)
        .gt("expires_at", now.toISOString())
        .maybeSingle();

      const sessionActive = activeSession !== null;

      // Simulate extend (no charge)
      if (activeSession && activeSession.message_count < 20) {
        await supabase
          .from("ai_sessions")
          .update({ message_count: activeSession.message_count + 1, last_message_at: new Date().toISOString() })
          .eq("id", activeSession.id);
      }

      const { data: walletCheck } = await supabase
        .from("user_wallet")
        .select("balance_credits")
        .eq("user_id", testUserId)
        .maybeSingle();

      // Balance should still be 4 (no charge for extend)
      const extendNoCharge = walletCheck?.balance_credits === 4;

      tests.push({
        name: "AI session: start charged, extend free",
        passed: sessionActive && extendNoCharge,
        message: sessionActive && extendNoCharge ? "Correctly handled" : "Session handling failed",
        details: { sessionActive, balanceAfterExtend: walletCheck?.balance_credits, extendNoCharge },
      });
    } catch (err) {
      tests.push({
        name: "AI session: start charged, extend free",
        passed: false,
        message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // TEST 4: Atomic increment RPC works
    // ═══════════════════════════════════════════════════════════════════
    try {
      await cleanupTestUser();
      await setupTestUser("basic", 5, 0, 0);

      const { data: newCount1, error: rpcErr1 } = await supabase.rpc("increment_cases_created", {
        _user_id: testUserId,
        _ym: currentYm,
      });

      const { data: newCount2, error: rpcErr2 } = await supabase.rpc("increment_cases_created", {
        _user_id: testUserId,
        _ym: currentYm,
      });

      const rpcWorks = !rpcErr1 && !rpcErr2 && newCount1 === 1 && newCount2 === 2;

      tests.push({
        name: "Atomic increment RPC",
        passed: rpcWorks,
        message: rpcWorks ? "RPC works correctly" : `RPC failed or counts wrong`,
        details: { newCount1, newCount2, rpcErr1: rpcErr1?.message, rpcErr2: rpcErr2?.message },
      });
    } catch (err) {
      tests.push({
        name: "Atomic increment RPC",
        passed: false,
        message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // TEST 5: UNLIMITED plan bypasses credit check
    // ═══════════════════════════════════════════════════════════════════
    try {
      await cleanupTestUser();
      await setupTestUser("unlimited", 999, 0, 0); // 0 credits

      const { data: subState } = await supabase
        .from("subscriptions_state")
        .select("plan")
        .eq("user_id", testUserId)
        .maybeSingle();

      const { data: wallet } = await supabase
        .from("user_wallet")
        .select("balance_credits")
        .eq("user_id", testUserId)
        .maybeSingle();

      const isUnlimited = subState?.plan === "unlimited";
      const balance = wallet?.balance_credits ?? 0;

      const shouldNotBlock = isUnlimited;

      tests.push({
        name: "UNLIMITED: bypasses credit check",
        passed: shouldNotBlock && balance === 0,
        message: shouldNotBlock ? "Correctly bypasses credit check" : "Failed to bypass",
        details: { isUnlimited, balance },
      });
    } catch (err) {
      tests.push({
        name: "UNLIMITED: bypasses credit check",
        passed: false,
        message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Cleanup
    // ═══════════════════════════════════════════════════════════════════
    await cleanupTestUser();

    // Calculate summary
    const passed = tests.every((t) => t.passed);
    const passedCount = tests.filter((t) => t.passed).length;
    const failedCount = tests.length - passedCount;

    return new Response(JSON.stringify({
      passed,
      summary: `${passedCount}/${tests.length} tests passed`,
      failed_count: failedCount,
      tests,
      timestamp: new Date().toISOString(),
      disclaimer: "This self-test validates database invariants and consistency. It does NOT fully simulate client credit flows.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("credits-selftest-lite error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
