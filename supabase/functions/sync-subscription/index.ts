import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://lexora-law.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Price ID to plan mapping - MUST match Stripe products
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1SivfMKG0eqN9CTOVXhLdPo7": "starter",
  "price_1SivfjKG0eqN9CTOXzYLuH7v": "pro",
  "price_1Sivg3KG0eqN9CTORmNvZX1Z": "unlimited",
};

const PLAN_LIMITS: Record<string, { max_cases: number; messages_per_case: number }> = {
  free: { max_cases: 1, messages_per_case: 10 },
  starter: { max_cases: 3, messages_per_case: 15 }, // 3 monthly cases, 15 AI messages per case
  pro: { max_cases: 10, messages_per_case: 30 }, // 10 monthly cases, 30 AI messages per case
  unlimited: { max_cases: 999999, messages_per_case: 999999 },
};

const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  free: {
    scan_letter: true,
    ai_draft: true,
    ai_chat: true,
    export_pdf: false,
    urgent_reply: false,
  },
  starter: {
    scan_letter: true,
    ai_draft: true,
    ai_chat: true,
    export_pdf: true,
    urgent_reply: false,
  },
  pro: {
    scan_letter: true,
    ai_draft: true,
    ai_chat: true,
    export_pdf: true,
    urgent_reply: true,
  },
  unlimited: {
    scan_letter: true,
    ai_draft: true,
    ai_chat: true,
    export_pdf: true,
    urgent_reply: true,
  },
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[SYNC-SUBSCRIPTION] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    logStep("ENV_MISSING", { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
    return new Response(
      JSON.stringify({ ok: false, error: "MISSING_ENV", code: "ENV_MISSING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  if (!stripeKey) {
    logStep("STRIPE_KEY_MISSING");
    return new Response(
      JSON.stringify({ ok: false, error: "STRIPE_KEY_MISSING", code: "STRIPE_KEY_MISSING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No auth header");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized", code: "MISSING_AUTH" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      logStep("Invalid token", { error: userError?.message });
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid token", code: "INVALID_TOKEN" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logStep("User authenticated", { userId, email: userEmail });

    // A) Get stripe_customer_id from profile or find by email
    let stripeCustomerId: string | null = null;

    // Check profile for existing stripe_customer_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id;
      logStep("Found stripe_customer_id in profile", { stripeCustomerId });
    }

    // If not in profile, search Stripe by email
    if (!stripeCustomerId && userEmail) {
      logStep("Searching Stripe for customer by email", { email: userEmail });
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        logStep("Found Stripe customer by email", { stripeCustomerId });

        // Save to profile for future
        await supabase.from("profiles").update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
    }

    // B) If no Stripe customer, user has never paid -> free plan
    if (!stripeCustomerId) {
      logStep("No Stripe customer found, user is on free plan");
      
      // Ensure user_subscriptions row exists with free plan
      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        plan_key: "free",
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return new Response(
        JSON.stringify({
          ok: true,
          plan_key: "free",
          status: "active",
          current_period_end: null,
          entitlements: {
            plan: "free",
            max_cases: 1,
            features: PLAN_FEATURES.free,
          },
          synced: true,
          source: "no_stripe_customer",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // C) Fetch active subscriptions from Stripe
    logStep("Fetching subscriptions from Stripe", { customerId: stripeCustomerId });
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all", // Get all to find active/trialing
      limit: 10,
    });

    // Find the best active subscription
    const activeSubscription = subscriptions.data.find(
      (sub: Stripe.Subscription) => sub.status === "active" || sub.status === "trialing"
    );

    // IMPORTANT: past_due means user still has a paid plan, but access must be blocked
    const pastDueSubscription = subscriptions.data.find(
      (sub: Stripe.Subscription) => sub.status === "past_due" || sub.status === "unpaid"
    );

    let planKey = "free";
    let status = "active";
    let currentPeriodEnd: string | null = null;
    let stripeSubscriptionId: string | null = null;
    let priceId: string | null = null;

    if (activeSubscription) {
      stripeSubscriptionId = activeSubscription.id;
      status = activeSubscription.status;
      currentPeriodEnd = new Date(activeSubscription.current_period_end * 1000).toISOString();
      
      // Get price_id from subscription items
      const subscriptionItem = activeSubscription.items.data[0];
      if (subscriptionItem?.price?.id) {
        priceId = subscriptionItem.price.id;
        planKey = priceId ? (PRICE_TO_PLAN[priceId] || "starter") : (activeSubscription.metadata?.plan_key as string) || "starter";
      }

      logStep("Found active Stripe subscription", {
        subscriptionId: stripeSubscriptionId,
        status,
        priceId,
        planKey,
        currentPeriodEnd,
      });
    } else if (pastDueSubscription) {
      stripeSubscriptionId = pastDueSubscription.id;
      status = pastDueSubscription.status;
      currentPeriodEnd = new Date(pastDueSubscription.current_period_end * 1000).toISOString();

      const subscriptionItem = pastDueSubscription.items.data[0];
      if (subscriptionItem?.price?.id) {
        priceId = subscriptionItem.price.id;
        planKey = priceId
          ? (PRICE_TO_PLAN[priceId] || "starter")
          : (pastDueSubscription.metadata?.plan_key as string) || "starter";
      }

      logStep("Found past_due Stripe subscription", {
        subscriptionId: stripeSubscriptionId,
        status,
        priceId,
        planKey,
        currentPeriodEnd,
      });
    } else {
      // Check for canceled subscription that hasn't expired yet
      const canceledButValid = subscriptions.data.find((sub: Stripe.Subscription) => {
        if (sub.status !== "canceled") return false;
        const periodEnd = new Date(sub.current_period_end * 1000);
        return periodEnd > new Date();
      });

      if (canceledButValid) {
        stripeSubscriptionId = canceledButValid.id;
        status = "canceled";
        currentPeriodEnd = new Date(canceledButValid.current_period_end * 1000).toISOString();
        const subscriptionItem = canceledButValid.items.data[0];
        if (subscriptionItem?.price?.id) {
          priceId = subscriptionItem.price.id;
          planKey = priceId ? (PRICE_TO_PLAN[priceId] || "starter") : (canceledButValid.metadata?.plan_key as string) || "starter";
        }
        logStep("Found canceled but still valid subscription", { subscriptionId: stripeSubscriptionId, planKey, currentPeriodEnd });
      } else {
        logStep("No active subscription found in Stripe, downgrading to free");
        planKey = "free";
        status = "inactive";
      }
    }

    // D) Upsert to user_subscriptions
    const planLimits = PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
    const planFeatures = PLAN_FEATURES[planKey] || PLAN_FEATURES.free;

    // Persist granular status (active | trialing | past_due | unpaid | canceled | inactive)
    const normalizedStatus =
      status === "active" || status === "trialing"
        ? "active"
        : status === "past_due" || status === "unpaid"
          ? "past_due"
          : status === "canceled"
            ? "canceled"
            : "inactive";

    const { error: upsertError } = await supabase.from("user_subscriptions").upsert({
      user_id: userId,
      plan_key: planKey,
      status: normalizedStatus,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) {
      logStep("ERROR upserting user_subscriptions", { error: upsertError.message });
    } else {
      logStep("user_subscriptions upserted successfully", { userId, planKey, status });
    }

    // Also update profiles table for backwards compatibility
    // If payment is past_due/unpaid => block access (enforcement happens both frontend + backend)
    const shouldBlock = normalizedStatus === "past_due";
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        plan: planKey,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_status: shouldBlock ? "past_due" : "active",
        access_state: shouldBlock ? "blocked" : "active",
        payment_status: shouldBlock ? "past_due" : "active",
        payment_failed_at: shouldBlock ? new Date().toISOString() : null,
        cases_limit: planLimits.max_cases,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      logStep("Warning: profiles update failed", { error: profileError.message });
    }

    // Return success with full entitlements
    const response = {
      ok: true,
      plan_key: planKey,
      status: normalizedStatus,
      current_period_end: currentPeriodEnd,
      entitlements: {
        plan: planKey,
        max_cases: planLimits.max_cases,
        features: planFeatures,
      },
      synced: true,
      source: "stripe",
      stripe_subscription_id: stripeSubscriptionId,
    };

    logStep("Sync complete", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error", code: "INTERNAL_ERROR" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
