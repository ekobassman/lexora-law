import { supabase } from '@/lib/supabaseClient';

/**
 * Hard reset all Supabase auth state (local + session storage).
 * Use when token refresh fails or session is corrupted.
 */
export async function hardResetAuth(navigate: (path: string) => void) {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore signOut errors
  }

  try {
    // Wipe common supabase storage keys (Lovable can leave stale refresh tokens)
    localStorage.removeItem("supabase.auth.token");
    Object.keys(localStorage).forEach((k) => {
      if (k.toLowerCase().includes("supabase")) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach((k) => {
      if (k.toLowerCase().includes("supabase")) sessionStorage.removeItem(k);
    });
  } catch {
    // Ignore storage errors
  }

  navigate("/login");
}

/**
 * Check if session is valid before making authenticated API calls.
 * Returns the user if valid, null otherwise.
 */
export async function getValidUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.warn("[authUtils] getValidUser failed:", error?.message);
    return null;
  }
  return user;
}
