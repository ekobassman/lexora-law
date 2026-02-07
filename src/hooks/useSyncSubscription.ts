import { useCallback, useRef, useEffect } from "react";
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const DEBOUNCE_MS = 30_000; // 30 seconds debounce

interface SyncResult {
  ok: boolean;
  plan_key?: string;
  status?: string;
  current_period_end?: string | null;
  error?: string;
  code?: string;
}

export function useSyncSubscription() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const lastSyncRef = useRef<number>(0);
  const syncingRef = useRef<boolean>(false);

  const syncSubscription = useCallback(async (force = false): Promise<SyncResult | null> => {
    if (!session?.access_token) {
      console.log("[SYNC-SUBSCRIPTION] No session, skipping sync");
      return null;
    }

    const now = Date.now();
    if (!force && now - lastSyncRef.current < DEBOUNCE_MS) {
      console.log("[SYNC-SUBSCRIPTION] Debounced, skipping sync");
      return null;
    }

    if (syncingRef.current) {
      console.log("[SYNC-SUBSCRIPTION] Already syncing, skipping");
      return null;
    }

    syncingRef.current = true;
    lastSyncRef.current = now;

    try {
      console.log("[SYNC-SUBSCRIPTION] Calling sync-subscription edge function");
      
      const { data, error } = await supabase.functions.invoke("sync-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("[SYNC-SUBSCRIPTION] Error:", error);
        return { ok: false, error: error.message };
      }

      console.log("[SYNC-SUBSCRIPTION] Result:", data);

      if (data?.ok) {
        // Invalidate entitlements cache to force re-fetch
        await queryClient.invalidateQueries({ queryKey: ["entitlements"] });
        console.log("[SYNC-SUBSCRIPTION] Entitlements cache invalidated");
      }

      return data as SyncResult;
    } catch (err) {
      console.error("[SYNC-SUBSCRIPTION] Exception:", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      syncingRef.current = false;
    }
  }, [session, queryClient]);

  // Auto-sync on mount (once per session, debounced)
  useEffect(() => {
    if (session?.access_token) {
      syncSubscription(false);
    }
  }, [session?.access_token, syncSubscription]);

  return { syncSubscription };
}
