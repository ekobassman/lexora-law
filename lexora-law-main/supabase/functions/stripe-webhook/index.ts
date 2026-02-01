import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Price ID to plan mapping - MUST match Stripe products
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1SivfMKG0eqN9CTOVXhLdPo7": "starter",
  "price_1SivfjKG0eqN9CTOXzYLuH7v": "pro",
  "price_1Sivg3KG0eqN9CTORmNvZX1Z": "unlimited",
};

const PLAN_LIMITS: Record<string, { max_cases: number }> = {
  free: { max_cases: 1 },
  starter: { max_cases: 10 },
  pro: { max_cases: 50 },
  unlimited: { max_cases: 999999 },
};

const logStep = (correlationId: string, step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK][${correlationId}] ${step}`, details ? JSON.stringify(details) : "");
};

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY / OVERRIDE PROTECTION CHECK
// ═══════════════════════════════════════════════════════════════════════════
// If user has is_family=true OR plan_override IS NOT NULL → Stripe CANNOT change them
async function isUserProtected(supabase: any, userId: string, correlationId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_family, plan_override")
      .eq("id", userId)
      .single();
    
    if (error || !profile) {
      logStep(correlationId, "Could not fetch profile for protection check", { userId, error: error?.message });
      return false;
    }
    
    const isProtected = profile.is_family === true || profile.plan_override !== null;
    
    if (isProtected) {
      logStep(correlationId, "SKIP_STRIPE_OVERRIDE_PROTECTED_USER", { 
        userId, 
        is_family: profile.is_family, 
        plan_override: profile.plan_override 
      });
    }
    
    return isProtected;
  } catch (err) {
    logStep(correlationId, "ERROR checking user protection", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().slice(0, 8);
  logStep(correlationId, "Webhook request received");

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!stripeKey) {
    logStep(correlationId, "ERROR: STRIPE_SECRET_KEY not set");
    return new Response("Server configuration error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const resend = resendKey ? new Resend(resendKey) : null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    let event: Stripe.Event;

    // Verify webhook signature if secret is set
    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        logStep(correlationId, "ERROR: Missing stripe-signature header");
        return new Response("Missing signature", { status: 400 });
      }
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep(correlationId, "Webhook signature verified");
      } catch (err) {
        logStep(correlationId, "ERROR: Invalid signature", { error: err instanceof Error ? err.message : String(err) });
        return new Response("Invalid signature", { status: 400 });
      }
    } else {
      // For development without webhook secret
      event = JSON.parse(body) as Stripe.Event;
      logStep(correlationId, "WARNING: No webhook secret configured, accepting unverified event");
    }

    logStep(correlationId, "Event received", { type: event.type, id: event.id });

    // Handle relevant events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(supabase, stripe, session, correlationId);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, stripe, subscription, correlationId);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, stripe, subscription, correlationId);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, stripe, resend, invoice, event.id, correlationId);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, stripe, resend, invoice, correlationId);
        break;
      }
      default:
        logStep(correlationId, "Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep(correlationId, "ERROR", { message: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: "Webhook error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// Resolve user_id from multiple sources
async function resolveUserId(
  supabase: any,
  stripe: Stripe,
  metadata: Record<string, string> | null,
  clientReferenceId: string | null,
  customerId: string | null,
  customerEmail: string | null,
  correlationId: string
): Promise<{ userId: string | null; email: string | null }> {
  // Priority 1: metadata.user_id
  if (metadata?.user_id) {
    logStep(correlationId, "Resolved user_id from metadata", { user_id: metadata.user_id });
    return { userId: metadata.user_id, email: customerEmail };
  }

  // Priority 2: client_reference_id
  if (clientReferenceId) {
    logStep(correlationId, "Resolved user_id from client_reference_id", { user_id: clientReferenceId });
    return { userId: clientReferenceId, email: customerEmail };
  }

  // Priority 3: Lookup by customer email
  let email = customerEmail;
  
  // If no email, get it from Stripe customer
  if (!email && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted && 'email' in customer) {
        email = customer.email;
      }
    } catch (e) {
      logStep(correlationId, "Failed to fetch customer from Stripe", { customerId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (email) {
    logStep(correlationId, "Looking up user by email", { email });
    const { data: userData } = await supabase.auth.admin.listUsers();
    const matchingUser = userData?.users?.find((u: { email?: string }) => 
      u.email?.toLowerCase() === email?.toLowerCase()
    );
    if (matchingUser) {
      logStep(correlationId, "Resolved user_id from email lookup", { user_id: matchingUser.id, email });
      return { userId: matchingUser.id, email };
    }
    logStep(correlationId, "No user found for email", { email });
  }

  logStep(correlationId, "Could not resolve user_id");
  return { userId: null, email };
}

async function handleCheckoutComplete(
  supabase: any,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  correlationId: string
) {
  logStep(correlationId, "Processing checkout.session.completed", { 
    sessionId: session.id,
    customerId: session.customer,
    customerEmail: session.customer_email,
    clientReferenceId: session.client_reference_id,
    metadata: session.metadata,
  });

  // Resolve user_id
  const { userId } = await resolveUserId(
    supabase,
    stripe,
    session.metadata,
    session.client_reference_id,
    session.customer as string | null,
    session.customer_email,
    correlationId
  );

  if (!userId) {
    logStep(correlationId, "ERROR: No user_id found for checkout session");
    return;
  }

  // CHECK PROTECTION: Family/Override users are immune
  if (await isUserProtected(supabase, userId, correlationId)) {
    return; // Do not modify protected users
  }

  const planKey = session.metadata?.plan_key || "starter";
  logStep(correlationId, "User and plan resolved", { userId, planKey });

  // Get subscription details if this was a subscription checkout
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    await updateUserSubscription(supabase, userId, subscription, planKey, session.customer as string, correlationId);
  } else {
    // One-time payment - just update with the plan
    await upsertSubscription(supabase, userId, planKey, "active", session.customer as string, null, null, correlationId);
  }
}

async function handleSubscriptionUpdate(
  supabase: any,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  correlationId: string
) {
  logStep(correlationId, "Processing subscription update", { 
    subscriptionId: subscription.id, 
    status: subscription.status,
    metadata: subscription.metadata,
    customerId: subscription.customer,
  });

  // Resolve user_id
  const { userId } = await resolveUserId(
    supabase,
    stripe,
    subscription.metadata as Record<string, string>,
    null,
    subscription.customer as string,
    null,
    correlationId
  );

  if (!userId) {
    logStep(correlationId, "ERROR: No user_id in subscription");
    return;
  }

  // CHECK PROTECTION: Family/Override users are immune
  if (await isUserProtected(supabase, userId, correlationId)) {
    return; // Do not modify protected users
  }

  const planKey = subscription.metadata?.plan_key || getPlanFromPriceId(subscription);
  
  // Check if subscription status requires blocking
  const blockingStatuses = ['unpaid', 'canceled', 'past_due'];
  const shouldBlock = blockingStatuses.includes(subscription.status);
  
  await updateUserSubscription(supabase, userId, subscription, planKey, subscription.customer as string, correlationId, shouldBlock);
}

async function handleSubscriptionCanceled(
  supabase: any,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  correlationId: string
) {
  logStep(correlationId, "Processing subscription canceled", { subscriptionId: subscription.id });

  // Resolve user_id
  const { userId } = await resolveUserId(
    supabase,
    stripe,
    subscription.metadata as Record<string, string>,
    null,
    subscription.customer as string,
    null,
    correlationId
  );

  if (!userId) {
    logStep(correlationId, "ERROR: No user_id for canceled subscription");
    return;
  }

  // CHECK PROTECTION: Family/Override users are immune - Stripe CANNOT cancel them
  if (await isUserProtected(supabase, userId, correlationId)) {
    return; // Do not modify protected users
  }

  // Downgrade to free and BLOCK access
  await upsertSubscription(supabase, userId, "free", "canceled", subscription.customer as string, subscription.id, null, correlationId, true);
  logStep(correlationId, "User downgraded to free and blocked", { userId });
}

async function handlePaymentFailed(
  supabase: any,
  stripe: Stripe,
  resend: any | null,
  invoice: Stripe.Invoice,
  eventId: string,
  correlationId: string
) {
  logStep(correlationId, "Processing invoice.payment_failed", { invoiceId: invoice.id, eventId });

  // Resolve user by stripe customer
  const { userId, email } = await resolveUserId(
    supabase,
    stripe,
    null,
    null,
    invoice.customer as string,
    invoice.customer_email,
    correlationId
  );

  if (!userId) {
    logStep(correlationId, "No user found for payment failed invoice");
    return;
  }

  // CHECK PROTECTION: Family/Override users are immune - payment failures do NOT block them
  if (await isUserProtected(supabase, userId, correlationId)) {
    return; // Do not block or email protected users
  }

  // Check idempotency - don't process same event twice
  const { data: profile } = await supabase
    .from("profiles")
    .select("last_billing_event_id")
    .eq("id", userId)
    .single();

  if (profile?.last_billing_event_id === eventId) {
    logStep(correlationId, "Event already processed, skipping (idempotency)", { eventId });
    return;
  }

  // Extract payment failure details from invoice
  const failureCode = (invoice as any).last_payment_error?.code ?? null;
  const failureMsg = (invoice as any).last_payment_error?.message ?? null;

  // UPDATE DATABASE: Block access and set payment_status to past_due
  const { error: updateError } = await supabase.from("profiles").update({
    stripe_status: "past_due",
    access_state: "blocked",
    payment_status: "past_due",
    payment_failed_at: new Date().toISOString(),
    last_payment_failed_at: new Date().toISOString(),
    last_payment_error_code: failureCode,
    last_payment_error_message: failureMsg,
    last_billing_event_id: eventId,
    last_billing_email_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  if (updateError) {
    logStep(correlationId, "ERROR updating profile for payment failure", { error: updateError.message });
  } else {
    logStep(correlationId, "Profile updated: payment_status=past_due, access_state=blocked", { userId, failureCode });
  }

  // Also update user_subscriptions
  await supabase.from("user_subscriptions").update({
    status: "past_due",
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // SEND EMAIL: Notify user about payment failure
  if (resend && email) {
    try {
      await resend.emails.send({
        from: "Lexora <noreply@lexora.app>",
        to: [email],
        subject: "⚠️ Pagamento non riuscito – Accesso sospeso / Payment Failed – Access Suspended",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #C9A24D, #A8863D); padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .warning { background: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #C9A24D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚜ Lexora</h1>
  </div>
  <div class="content">
    <h2>🇮🇹 Italiano</h2>
    <div class="warning">
      <strong>Il tuo pagamento non è andato a buon fine.</strong><br>
      Il tuo account è stato temporaneamente sospeso fino al completamento del pagamento.
    </div>
    <p>Per ripristinare l'accesso alle tue pratiche e ai servizi premium, ti preghiamo di aggiornare il tuo metodo di pagamento.</p>
    <a href="https://amt-helper-de.lovable.app/subscription" class="button">Aggiorna Pagamento</a>
    
    <hr>
    
    <h2>🇩🇪 Deutsch</h2>
    <div class="warning">
      <strong>Ihre Zahlung ist fehlgeschlagen.</strong><br>
      Ihr Konto wurde vorübergehend gesperrt, bis die Zahlung abgeschlossen ist.
    </div>
    <p>Um den Zugang zu Ihren Akten und Premium-Diensten wiederherzustellen, aktualisieren Sie bitte Ihre Zahlungsmethode.</p>
    <a href="https://amt-helper-de.lovable.app/subscription" class="button">Zahlung Aktualisieren</a>
    
    <hr>
    
    <h2>🇬🇧 English</h2>
    <div class="warning">
      <strong>Your payment has failed.</strong><br>
      Your account has been temporarily suspended until payment is completed.
    </div>
    <p>To restore access to your cases and premium services, please update your payment method.</p>
    <a href="https://amt-helper-de.lovable.app/subscription" class="button">Update Payment</a>
    
    <p style="margin-top: 30px; font-size: 12px; color: #666;">
      © Lexora – Your Legal Assistant
    </p>
  </div>
</body>
</html>
        `,
      });
      logStep(correlationId, "Payment failed email sent successfully", { email });
    } catch (emailErr) {
      logStep(correlationId, "ERROR sending payment failed email", { error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
    }
  } else {
    logStep(correlationId, "Skipping email: Resend not configured or no email", { hasResend: !!resend, email });
  }
}

async function handlePaymentSucceeded(
  supabase: any,
  stripe: Stripe,
  resend: any | null,
  invoice: Stripe.Invoice,
  correlationId: string
) {
  logStep(correlationId, "Processing invoice.paid", { invoiceId: invoice.id });

  // Resolve user
  const { userId, email } = await resolveUserId(
    supabase,
    stripe,
    null,
    null,
    invoice.customer as string,
    invoice.customer_email,
    correlationId
  );

  if (!userId) {
    logStep(correlationId, "No user found for paid invoice");
    return;
  }

  // CHECK PROTECTION: Family/Override users are immune - but we can still send success email
  const userIsProtected = await isUserProtected(supabase, userId, correlationId);
  
  if (!userIsProtected) {
    // RESTORE ACCESS only for non-protected users - clear all payment failure fields
    const { error: updateError } = await supabase.from("profiles").update({
      stripe_status: "active",
      access_state: "active",
      payment_status: "active",
      payment_failed_at: null,
      last_payment_failed_at: null,
      last_payment_error_code: null,
      last_payment_error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);

    if (updateError) {
      logStep(correlationId, "ERROR updating profile for payment success", { error: updateError.message });
    } else {
      logStep(correlationId, "Profile updated: payment_status=active, access_state=active", { userId });
    }

    // Also update user_subscriptions
    await supabase.from("user_subscriptions").update({
      status: "active",
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  }

  // Optionally send success email (even for protected users who manually paid)
  if (resend && email) {
    try {
      await resend.emails.send({
        from: "Lexora <noreply@lexora.app>",
        to: [email],
        subject: "✅ Pagamento ricevuto – Accesso ripristinato / Payment Received – Access Restored",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #C9A24D, #A8863D); padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .success { background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #C9A24D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚜ Lexora</h1>
  </div>
  <div class="content">
    <div class="success">
      <strong>🎉 Pagamento ricevuto con successo!</strong><br>
      Il tuo accesso è stato ripristinato.
    </div>
    <p>Grazie per il tuo pagamento. Puoi continuare a utilizzare tutti i servizi Lexora.</p>
    <a href="https://amt-helper-de.lovable.app/dashboard" class="button">Vai alla Dashboard</a>
    <p style="margin-top: 30px; font-size: 12px; color: #666;">© Lexora – Your Legal Assistant</p>
  </div>
</body>
</html>
        `,
      });
      logStep(correlationId, "Payment success email sent", { email });
    } catch (emailErr) {
      logStep(correlationId, "ERROR sending payment success email", { error: emailErr instanceof Error ? emailErr.message : String(emailErr) });
    }
  }
}

async function updateUserSubscription(
  supabase: any,
  userId: string,
  subscription: Stripe.Subscription,
  planKey: string,
  customerId: string,
  correlationId: string,
  forceBlock: boolean = false
) {
  const resolvedPlan = planKey || getPlanFromPriceId(subscription);
  const isActive = !forceBlock && (subscription.status === "active" || subscription.status === "trialing");
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await upsertSubscription(
    supabase,
    userId,
    resolvedPlan,
    isActive ? "active" : subscription.status,
    customerId,
    subscription.id,
    periodEnd,
    correlationId,
    forceBlock
  );
}

async function upsertSubscription(
  supabase: any,
  userId: string,
  planKey: string,
  status: string,
  customerId: string | null,
  subscriptionId: string | null,
  periodEnd: string | null,
  correlationId: string,
  blockAccess: boolean = false
) {
  const planLimits = PLAN_LIMITS[planKey] || PLAN_LIMITS.free;
  const accessState = blockAccess ? "blocked" : "active";
  const stripeStatus = status === "active" ? "active" : status;

  // Upsert user_subscriptions
  const { error: subError } = await supabase.from("user_subscriptions").upsert({
    user_id: userId,
    plan_key: planKey,
    status: status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (subError) {
    logStep(correlationId, "ERROR upserting user_subscriptions", { error: subError.message });
  } else {
    logStep(correlationId, "user_subscriptions updated", { userId, planKey, status });
  }

  // Also update profiles table for backwards compatibility + access control
  const { error: profileError } = await supabase.from("profiles").update({
    plan: planKey,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_status: stripeStatus,
    access_state: accessState,
    cases_limit: planLimits.max_cases,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  if (profileError) {
    logStep(correlationId, "Warning: profiles update failed", { error: profileError.message });
  } else {
    logStep(correlationId, "profiles updated", { userId, planKey, accessState });
  }
}

function getPlanFromPriceId(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price?.id;
  return PRICE_TO_PLAN[priceId] || "starter";
}
