import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

/**
 * Brutal logout that ensures the session cannot "resurrect":
 * - await signOut
 * - clear react-query cache
 * - wipe Supabase auth keys ("supabase" + "sb-") from storage
 * - hard redirect to /auth
 */
export function useLogout() {
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    // 1) Try global sign out (invalidate server-side)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      // eslint-disable-next-line no-console
      console.log('[LOGOUT] signOut(global) result', { error });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[LOGOUT] signOut(global) threw', e);
    }

    // 1b) Always attempt local sign out too (guarantee local tokens removed even if network fails)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      // eslint-disable-next-line no-console
      console.log('[LOGOUT] signOut(local) result', { error });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[LOGOUT] signOut(local) threw', e);
    }

    // Reset all cached app state (entitlements, etc.)
    queryClient.clear();

    // Wipe all Supabase-related keys from storage
    try {
      const wipe = (store: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k) continue;
          const lower = k.toLowerCase();
          if (lower.includes('supabase') || lower.startsWith('sb-')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => store.removeItem(k));
      };
      wipe(localStorage);
      wipe(sessionStorage);
      sessionStorage.clear();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[LOGOUT] storage clear failed', e);
    }

    // Debug: verify session is really gone before hard redirect
    try {
      const { data } = await supabase.auth.getSession();
      // eslint-disable-next-line no-console
      console.log('[LOGOUT] getSession after wipe', { hasSession: Boolean(data.session) });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[LOGOUT] getSession after wipe threw', e);
    }

    // Hard redirect (avoids stale state + iOS Safari issues)
    window.location.replace('/auth');
  }, [queryClient]);

  return logout;
}
