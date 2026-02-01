import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL_MS = 60000; // 60 seconds

export function useHeartbeat() {
  const { user } = useAuth();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      const now = Date.now();
      // Throttle: only update if 60s have passed
      if (now - lastUpdateRef.current < HEARTBEAT_INTERVAL_MS) {
        return;
      }

      lastUpdateRef.current = now;

      try {
        const { error } = await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', user.id);

        if (error) {
          console.error('[Heartbeat] Update failed:', error.message);
        }
      } catch (err) {
        console.error('[Heartbeat] Exception:', err);
      }
    };

    // Initial update on mount
    updateLastSeen();

    // Set up interval
    const intervalId = setInterval(updateLastSeen, HEARTBEAT_INTERVAL_MS);

    // Also update on visibility change (tab becomes visible)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);
}
