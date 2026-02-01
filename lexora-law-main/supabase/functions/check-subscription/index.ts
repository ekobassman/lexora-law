import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Product IDs to plan mapping
const PRODUCT_TO_PLAN: Record<string, { plan: string; casesLimit: number }> = {
  "prod_TgIFG2CndPaKw7": { plan: "basic", casesLimit: 10 },
  "prod_TgIGp2N8HiM0bA": { plan: "plus", casesLimit: 50 },
  "prod_TgIG5pUpA68QT7": { plan: "pro", casesLimit: 999999 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found, returning free plan");
      
      // Ensure profile has free plan defaults
      await supabaseClient.from("profiles").upsert({
        id: user.id,
        plan: "free",
        cases_limit: 1,
      }, { onConflict: "id" });

      return new Response(JSON.stringify({
        subscribed: false,
        plan: "free",
        cases_limit: 1,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    const activeSub = subscriptions.data.find((s: Stripe.Subscription) =>
      s.status === "active" || s.status === "trialing"
    );

    if (!activeSub) {
      logStep("No active/trialing subscription, returning free plan");

      await supabaseClient
        .from("profiles")
        .update({
          plan: "free",
          cases_limit: 1,
          stripe_customer_id: customerId,
        })
        .eq("id", user.id);

      return new Response(
        JSON.stringify({
          subscribed: false,
          plan: "free",
          cases_limit: 1,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const subscription = activeSub;
    const productId = subscription.items.data[0]?.price?.product as string | undefined;
    const planInfo = (productId && PRODUCT_TO_PLAN[productId]) || { plan: "basic", casesLimit: 10 };

    const endSec = Number((subscription as any).current_period_end);
    const startSec = Number((subscription as any).current_period_start);

    const subscriptionEnd = Number.isFinite(endSec) ? new Date(endSec * 1000).toISOString() : null;
    const billingPeriodStart = Number.isFinite(startSec) ? new Date(startSec * 1000).toISOString() : null;

    if (!subscriptionEnd || !billingPeriodStart) {
      logStep("Warning: Missing/invalid billing period timestamps", {
        current_period_end: (subscription as any).current_period_end,
        current_period_start: (subscription as any).current_period_start,
      });
    }

    logStep("Active subscription found", {
      subscriptionId: subscription.id,
      productId,
      plan: planInfo.plan,
      endDate: subscriptionEnd,
    });

    // Update profile with subscription info
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        plan: planInfo.plan,
        cases_limit: planInfo.casesLimit,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        billing_period_start: billingPeriodStart,
      })
      .eq("id", user.id);

    if (updateError) {
      logStep("Warning: Failed to update profile", { error: updateError.message });
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        plan: planInfo.plan,
        cases_limit: planInfo.casesLimit,
        subscription_end: subscriptionEnd,
        billing_period_start: billingPeriodStart,
        cancel_at_period_end: subscription.cancel_at_period_end,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
