import { supabase } from '@/lib/supabaseClient';
import { toast } from "sonner";

/**
 * Hard logout: signs out from Supabase, clears all cached state, 
 * and forces a full page reload to /auth
 */
export async function hardLogout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error("[hardLogout] signOut error:", e);
  }

  // Clear any Supabase-related storage
  try {
    const wipe = (store: Storage) => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;
        const lower = k.toLowerCase();
        if (lower.includes("supabase") || lower.startsWith("sb-")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => store.removeItem(k));
    };
    wipe(localStorage);
    wipe(sessionStorage);

    // Some browsers keep extra auth/session artifacts; clear sessionStorage entirely.
    sessionStorage.clear();
  } catch (e) {
    console.error("[hardLogout] storage wipe error:", e);
  }

  // Show toast before reload
  toast.success("Logged out");

  // Force hard redirect to guarantee app state is reset (important for iOS Safari)
  window.location.replace("/auth");
}
