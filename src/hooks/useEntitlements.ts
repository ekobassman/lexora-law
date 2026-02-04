import { useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getEntitlements, type EntitlementsDTO } from "@/lib/getEntitlements";
import { isAdminEmail } from "@/lib/adminConfig";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_ENTITLEMENTS: EntitlementsDTO = {
  role: "user",
  plan: "free",
  status: "active",
  current_period_end: null,
  limits: { 
    practices: 1,
    aiCredits: 100,
    messages: 10,
    casesMax: 1,
  },
  usage: { 
    practicesUsed: 0,
    aiCreditsUsed: 0,
    messagesUsed: 0,
    casesUsed: 0,
  },
  // legacy defaults
  plan_key: "free",
  max_cases: 1,
  cases_created: 0,
  can_create_case: true,
  messages_per_case: 10,
  features: {
    scan_letter: true,
    ai_draft: true,
    ai_chat: true,
    export_pdf: false,
    urgent_reply: false,
  },
};

interface UseEntitlementsReturn {
  entitlements: EntitlementsDTO;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  refreshEntitlements: () => Promise<void>;
  /** Alias for refreshEntitlements - for backward compat */
  refresh: () => Promise<void>;

  // convenience flags
  isPaid: boolean;
  isAdmin: boolean;
  hasFeature: (feature: string) => boolean;
}

export function useEntitlements(): UseEntitlementsReturn {
  const { session } = useAuth();

  // Only fetch entitlements when we have a valid session with access token
  const hasValidToken = Boolean(session?.access_token);

  const query = useQuery({
    queryKey: ["entitlements", session?.user?.id],
    queryFn: async () => {
      // Double-check token exists before making API call
      if (!session?.access_token) {
        console.log('[useEntitlements] No access token, returning defaults');
        return DEFAULT_ENTITLEMENTS;
      }
      return getEntitlements(session);
    },
    // Only enable query when we have a valid token
    enabled: hasValidToken,
    staleTime: 10_000,
    refetchOnWindowFocus: hasValidToken,
    retry: 1,
  });

  const entitlements = (query.data || DEFAULT_ENTITLEMENTS) as EntitlementsDTO;

  const isReady = useMemo(() => {
    // If no session, we still treat entitlements as ready (free).
    return !session ? true : query.isSuccess || query.isError;
  }, [session, query.isSuccess, query.isError]);

  const refreshEntitlements = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const hasFeature = useCallback(
    (feature: string) => {
      return entitlements?.features?.[feature] === true;
    },
    [entitlements],
  );

  const isPaid = entitlements.plan !== "free" && (entitlements.status === "active" || entitlements.status === "trialing");

  // Derive isAdmin: API role/debug first, then fallback by email (so UI shows Admin even if DB/API not synced yet)
  const computeIsAdmin = useCallback(() => {
    if (entitlements?.role === 'admin' || entitlements?.debug?.is_admin === true) return true;
    return isAdminEmail(session?.user?.email);
  }, [entitlements?.role, entitlements?.debug?.is_admin, session?.user?.email]);

  const isAdmin = computeIsAdmin();
  
  // Log admin status changes for debugging
  useEffect(() => {
    console.log('[useEntitlements] isAdmin:', isAdmin, 'role:', entitlements?.role, 'debug.is_admin:', entitlements?.debug?.is_admin);
  }, [isAdmin, entitlements?.role, entitlements?.debug?.is_admin]);

  return {
    entitlements,
    isLoading: query.isLoading,
    isReady,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refreshEntitlements,
    refresh: refreshEntitlements,
    isPaid,
    isAdmin,
    hasFeature,
  };
}
