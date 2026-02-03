import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocked country codes
const BLOCKED_COUNTRIES = ['RU', 'CN'];

// Fetch country from external IP geolocation API
async function getCountryFromIP(req: Request): Promise<string | null> {
  // Try to get client IP from various headers
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || null;
  
  // Try infrastructure headers first (fastest, no API call)
  const headerCountry = req.headers.get('cf-ipcountry') 
    || req.headers.get('x-vercel-ip-country')
    || req.headers.get('x-country')
    || req.headers.get('fly-client-country');
  
  if (headerCountry) {
    console.log('[GEO] Country from header:', headerCountry);
    return headerCountry.toUpperCase();
  }
  
  // Fallback to external API
  try {
    // ip-api.com is free for non-commercial use
    const response = await fetch(`http://ip-api.com/json/${clientIP || ''}?fields=countryCode`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.countryCode) {
        console.log('[GEO] Country from ip-api.com:', data.countryCode);
        return data.countryCode.toUpperCase();
      }
    }
  } catch (e) {
    console.log('[GEO] ip-api.com failed:', e);
  }
  
  // Try ipapi.co as backup
  try {
    const response = await fetch(`https://ipapi.co/${clientIP || 'json'}/country/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const countryCode = (await response.text()).trim();
      if (countryCode && countryCode.length === 2) {
        console.log('[GEO] Country from ipapi.co:', countryCode);
        return countryCode.toUpperCase();
      }
    }
  } catch (e) {
    console.log('[GEO] ipapi.co failed:', e);
  }
  
  return null;
}

// Check geo-block - uses external API if headers unavailable
async function checkGeoBlock(req: Request): Promise<{ blocked: boolean; countryCode: string | null; reason: string }> {
  const countryCode = await getCountryFromIP(req);
  
  // FAIL-OPEN for entitlements: If country can't be determined, allow access
  // (Geo-blocking at frontend level via geo-check is the primary gate)
  if (!countryCode) {
    console.log('[GEO] Could not determine country, allowing access (fail-open for entitlements)');
    return { blocked: false, countryCode: null, reason: 'UNKNOWN_ALLOWED' };
  }
  
  if (BLOCKED_COUNTRIES.includes(countryCode)) {
    return { blocked: true, countryCode, reason: 'JURISDICTION_BLOCKED' };
  }
  
  return { blocked: false, countryCode, reason: 'OK' };
}

// Plan definitions - single source of truth (backend)  
// null = unlimited (for admin bypass and unlimited plan)
const PLANS: Record<
  string,
  {
    max_cases: number | null;
    messages_per_case: number | null;
    ai_credits: number | null;
    features: Record<string, boolean>;
  }
> = {
  free: {
    max_cases: 1,
    messages_per_case: 10,
    ai_credits: 100,
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: false,
      urgent_reply: false,
    },
  },
  starter: {
    max_cases: 3,
    messages_per_case: 15,
    ai_credits: 500,
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: false,
    },
  },
  pro: {
    max_cases: 10,
    messages_per_case: 30,
    ai_credits: 2000,
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: true,
    },
  },
  unlimited: {
    max_cases: null,  // null = truly unlimited
    messages_per_case: null,  // null = truly unlimited
    ai_credits: null,  // null = truly unlimited
    features: {
      scan_letter: true,
      ai_draft: true,
      ai_chat: true,
      export_pdf: true,
      urgent_reply: true,
    },
  },
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[ENTITLEMENTS] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GEO-BLOCK CHECK (FAIL-CLOSED)
  const geoCheck = await checkGeoBlock(req);
  if (geoCheck.blocked) {
    logStep('Jurisdiction blocked/unknown', { countryCode: geoCheck.countryCode, reason: geoCheck.reason });
    return new Response(
      JSON.stringify({ code: geoCheck.reason, countryCode: geoCheck.countryCode || 'unknown' }),
      { status: 451, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Environment (STRICT) — must be present or we fail loudly
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  console.log("[ENV] SUPABASE_URL", supabaseUrl);

  const envFingerprint = {
    supabase_url_last6: supabaseUrl.slice(-6),
    service_role_last6: serviceRoleKey.slice(-6),
  };

  if (!supabaseUrl || !serviceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    logStep("ENV_MISSING", { missing, envFingerprint });
    return new Response(
      JSON.stringify({ error: `MISSING ENV: ${missing.join("/")}`, code: "ENV_MISSING", step: "env_check" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }

  logStep("Environment fingerprint", envFingerprint);

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    console.log("[REQ] authHeader prefix", authHeader.slice(0, 20), "len", authHeader.length);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logStep("No Bearer token");
      return new Response(JSON.stringify({ error: "Missing Bearer token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      logStep("Invalid token", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Invalid token", details: userError?.message ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logStep("User authenticated", { userId, email: userEmail });

    // Fetch access_state/payment_status for enforcement + UI
    const { data: profile } = await supabase
      .from("profiles")
      .select("access_state,payment_status,stripe_status")
      .eq("id", userId)
      .maybeSingle();

    // Check admin role (allowlist + user_roles)
    const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"];
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = ADMIN_EMAILS.includes(userEmail ?? "") || roleData?.role === "admin";
    logStep("Admin check", { isAdmin, role: roleData?.role ?? "none" });

    // PRIORITY 1: Check for active admin override FIRST
    const { data: override, error: overrideError } = await supabase
      .from("plan_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    logStep("Override query result", {
      found: !!override,
      error: overrideError?.message ?? null,
      override_id: override?.id ?? null,
      override_plan: override?.plan ?? null,
      override_plan_code: override?.plan_code ?? null,
      override_expires_at: override?.expires_at ?? null,
    });

    let effectivePlan: string;
    let planSource: "override" | "stripe" | "free";

    // Check if override is valid (not expired)
    const overrideValid = override && (!override.expires_at || new Date(override.expires_at) > new Date());

    if (overrideValid) {
      // Admin override takes priority - use plan_code if set, fallback to plan
      effectivePlan = (override.plan_code || override.plan || "free").toLowerCase();
      planSource = "override";
      logStep("Using admin override", {
        plan: effectivePlan,
        overrideId: override.id,
        expires_at: override.expires_at,
      });
    } else {
      if (override && !overrideValid) {
        logStep("Override exists but is expired or invalid", { expires_at: override?.expires_at });
      }

      // PRIORITY 2: Check Stripe subscription
      const { data: subscription, error: subError } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (subError) logStep("Error fetching subscription", { error: subError.message });
      logStep("Subscription query result", {
        found: !!subscription,
        plan_key: subscription?.plan_key ?? null,
        status: subscription?.status ?? null,
        stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
      });

      // IMPORTANT: past_due users still keep their paid plan label, but should be blocked elsewhere
      if (
        subscription &&
        subscription.plan_key !== "free" &&
        (subscription.status === "active" ||
          subscription.status === "trialing" ||
          subscription.status === "past_due")
      ) {
        effectivePlan = subscription.plan_key.toLowerCase();
        planSource = "stripe";
        logStep("Using Stripe subscription", { plan: effectivePlan });
      } else {
        effectivePlan = "free";
        planSource = "free";
        logStep("Using FREE plan (no override, no active subscription)");
      }
    }

    // Get usage data
    const { data: usage, error: usageError } = await supabase
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (usageError) logStep("Error fetching usage", { error: usageError.message });

    // Lazy init for existing users
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!subscription) {
      logStep("Creating default subscription for user");
      await supabase.from("user_subscriptions").upsert(
        {
          user_id: userId,
          plan_key: "free",
          status: "active",
        },
        { onConflict: "user_id" },
      );
    }

    if (!usage) {
      logStep("Creating default usage for user");
      await supabase.from("user_usage").upsert(
        {
          user_id: userId,
          cases_created: 0,
        },
        { onConflict: "user_id" },
      );
    }

    const planConfig = PLANS[effectivePlan] || PLANS.free;

    // ADMIN BYPASS: Admins get null limits (truly unlimited)
    const casesMaxRaw = isAdmin ? null : planConfig.max_cases;
    const messagesPerCaseRaw = isAdmin ? null : planConfig.messages_per_case;
    const aiCreditsRaw = isAdmin ? null : planConfig.ai_credits;

    // Count actual cases from pratiche table as backup
    const { count: actualCasesCount } = await supabase
      .from("pratiche")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const casesUsed = actualCasesCount ?? usage?.cases_created ?? 0;
    
    // For display: null means unlimited, otherwise use actual number
    const casesMax = casesMaxRaw;

    const currentPeriodEnd = subscription?.current_period_end || null;

    // NEW response shape (required by UX)
    const normalized = {
      role: isAdmin ? "admin" : "user",
      plan: effectivePlan,
      plan_source: planSource,
      status: subscription?.status || "active",
      current_period_end: currentPeriodEnd,
      // Payment enforcement context
      access_state: profile?.access_state ?? null,
      payment_status: profile?.payment_status ?? null,
      stripe_status: profile?.stripe_status ?? null,
      limits: {
        practices: casesMax,
        aiCredits: aiCreditsRaw,
        messages: messagesPerCaseRaw,
      },
      usage: {
        practicesUsed: casesUsed,
        aiCreditsUsed: 0,  // TODO: track this properly
        messagesUsed: 0,  // TODO: track this properly
      },
      // Debug info for admin
      debug: {
        user_id: userId,
        is_admin: isAdmin,
        override_row_exists: !!override,
        override_is_active: override?.is_active ?? false,
        override_expires_at: override?.expires_at ?? null,
        override_plan_code: override?.plan_code ?? null,
        stripe_status: subscription?.status ?? null,
        stripe_plan_key: subscription?.plan_key ?? null,
        access_state: profile?.access_state ?? null,
        payment_status: profile?.payment_status ?? null,
        env_fingerprint: envFingerprint,
      },
    };

    // Backwards-compatible fields (keep existing UI working while we migrate)
    const legacy = {
      plan_key: effectivePlan,
      max_cases: casesMax === null ? 999999 : casesMax,  // Legacy format expected number
      cases_created: casesUsed,
      can_create_case: casesMax === null || casesUsed < casesMax,
      features: planConfig.features,
      messages_per_case: messagesPerCaseRaw === null ? 999999 : messagesPerCaseRaw,  // Legacy format
      // NEW: Also include raw values for backward compat
      casesMax,
      casesUsed,
    };

    const response = {
      ...normalized,
      ...legacy,
    };

    logStep("Returning entitlements", {
      role: response.role,
      plan: response.plan,
      plan_source: response.plan_source,
      practicesUsed: response.usage.practicesUsed,
      practicesMax: response.limits.practices,
      override_row_exists: normalized.debug.override_row_exists,
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("Error", { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
