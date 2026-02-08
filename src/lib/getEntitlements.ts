import { supabase } from '@/lib/supabaseClient';
import type { Session } from "@supabase/supabase-js";

export type PlanId = "free" | "starter" | "plus" | "pro" | "unlimited";
export type BillingStatus = "active" | "past_due" | "canceled" | "trialing" | string;

export interface EntitlementsDebug {
  user_id?: string;
  is_admin?: boolean;
  override_row_exists?: boolean;
  override_is_active?: boolean;
  override_expires_at?: string | null;
  override_plan_code?: string | null;
  stripe_status?: string | null;
  stripe_plan_key?: string | null;
  env_fingerprint?: {
    supabase_url_last6?: string;
    anon_key_last6?: string;
    service_role_last6?: string;
  };
}

export interface EntitlementsDTO {
  role: "admin" | "user";
  plan: PlanId;
  plan_source?: "override" | "stripe" | "free";
  status: BillingStatus;
  current_period_end: string | null;
  // Payment enforcement context (from profiles)
  access_state?: string | null;
  payment_status?: string | null;
  stripe_status?: string | null;
  limits: {
    practices: number | null;  // null = unlimited
    aiCredits: number | null;  // null = unlimited
    messages: number | null;    // null = unlimited
    // Legacy compat
    casesMax?: number | null;
    [k: string]: unknown;
  };
  usage: {
    practicesUsed: number;
    aiCreditsUsed: number;
    messagesUsed: number;
    // Legacy compat
    casesUsed?: number;
    [k: string]: unknown;
  };

  // Debug info (admin only)
  debug?: EntitlementsDebug;

  // Backwards-compat fields (still returned by backend)
  plan_key?: string;
  max_cases?: number;
  cases_created?: number;
  can_create_case?: boolean;
  features?: Record<string, boolean>;
  messages_per_case?: number;
}

export async function getEntitlements(session: Session): Promise<EntitlementsDTO> {
  const { data, error } = await supabase.functions.invoke("entitlements", {
    headers: {
      // Make the token explicit for clarity / debugging.
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || "Entitlements fetch failed");
  }

  const plan: PlanId = (data?.plan || data?.plan_key || "free").toLowerCase();
  const status: BillingStatus = (data?.status || "active").toLowerCase();
  const role: "admin" | "user" = data?.role || "user";

  // Handle both new format (null = unlimited) and legacy format (999999 = unlimited)
  const practicesMax =
    data?.limits?.practices !== undefined
      ? data.limits.practices
      : typeof data?.limits?.casesMax === "number"
      ? data.limits.casesMax === 999999 ? null : data.limits.casesMax
      : typeof data?.max_cases === "number"
        ? data.max_cases === 999999 ? null : data.max_cases
        : 1;

  const practicesUsed =
    typeof data?.usage?.practicesUsed === "number"
      ? data.usage.practicesUsed
      : typeof data?.usage?.casesUsed === "number"
      ? data.usage.casesUsed
      : typeof data?.cases_created === "number"
      ? data.cases_created
        : 0;

  const aiCreditsMax = data?.limits?.aiCredits ?? null;
  const messagesMax = data?.limits?.messages !== undefined 
    ? data.limits.messages 
    : (data?.messages_per_case === 999999 ? null : data?.messages_per_case ?? null);

  const current_period_end: string | null = data?.current_period_end ?? null;

  const normalized: EntitlementsDTO = {
    ...data,
    role,
    plan,
    status,
    current_period_end,
    limits: {
      ...(data?.limits || {}),
      practices: practicesMax,
      aiCredits: aiCreditsMax,
      messages: messagesMax,
      casesMax: practicesMax,  // Legacy compat
    },
    usage: {
      ...(data?.usage || {}),
      practicesUsed,
      aiCreditsUsed: data?.usage?.aiCreditsUsed ?? 0,
      messagesUsed: data?.usage?.messagesUsed ?? 0,
      casesUsed: practicesUsed,  // Legacy compat
    },
  };

  // Required explicit log format
  // eslint-disable-next-line no-console
  console.log(
    `[ENTITLEMENTS] user=${session.user.id} role=${normalized.role} plan=${normalized.plan} status=${normalized.status} end=${normalized.current_period_end ?? "null"} used=${normalized.usage.practicesUsed}/${normalized.limits.practices === null ? "∞" : normalized.limits.practices}`,
  );

  // eslint-disable-next-line no-console
  console.log("[ENTITLEMENTS] payload", normalized);

  return normalized;
}
