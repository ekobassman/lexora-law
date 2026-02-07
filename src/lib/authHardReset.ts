import { supabase } from '@/lib/supabaseClient';
import { toast } from "sonner";

export async function hardResetAuth(navigate: (path: string) => void) {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  try {
    const wipe = (store: Storage) => {
      const keys = Object.keys(store);
      for (const k of keys) {
        if (k.toLowerCase().includes("supabase")) store.removeItem(k);
      }
      store.removeItem("supabase.auth.token");
    };
    wipe(localStorage);
    wipe(sessionStorage);
  } catch {
    // ignore
  }

  toast.error("Session expired. Please log in again.");
  navigate("/login");
}
