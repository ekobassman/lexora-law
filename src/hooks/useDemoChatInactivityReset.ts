import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const LAST_ACTIVITY_KEY = 'lexora_demo_chat_last_activity';

/**
 * Hook to auto-reset demo chat after 15 minutes of inactivity.
 * This ensures personal data is not retained if a user abandons the chat.
 * 
 * @param onReset - Callback to execute when inactivity timeout is reached
 * @param isActive - Whether the chat has any messages (active session)
 */
export function useDemoChatInactivityReset(
  onReset: () => void,
  isActive: boolean,
  options?: {
    /** When true, inactivity reset will be temporarily blocked (e.g. while voice recording). */
    blockReset?: boolean;
  }
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockResetRef = useRef<boolean>(false);

  useEffect(() => {
    blockResetRef.current = !!options?.blockReset;
  }, [options?.blockReset]);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Clear the inactivity timeout
  const clearInactivityTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Start or restart the inactivity timer
  const startInactivityTimer = useCallback(() => {
    clearInactivityTimeout();
    
    if (!isActive) return;

    timeoutRef.current = setTimeout(() => {
      // If we're temporarily blocking resets (e.g. voice recording), do not reset.
      // Instead, just extend the timer.
      if (blockResetRef.current) {
        updateActivity();
        startInactivityTimer();
        return;
      }

      console.log('[DemoChat] Inactivity timeout reached, resetting chat for privacy');
      onReset();
      // Clear the last activity timestamp
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        // Ignore
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, [isActive, onReset, clearInactivityTimeout, updateActivity]);

  // Check for stale session on mount
  useEffect(() => {
    if (!isActive) return;

    try {
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          if (blockResetRef.current) {
            // We are blocked (e.g. mic is active). Treat as activity and continue.
            updateActivity();
            startInactivityTimer();
            return;
          }
          // Session is stale, reset immediately
          console.log('[DemoChat] Stale session detected, resetting chat for privacy');
          onReset();
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }

    // Start fresh timer
    updateActivity();
    startInactivityTimer();
  }, [isActive, onReset, updateActivity, startInactivityTimer]);

  // Reset timer on user activity
  const handleUserActivity = useCallback(() => {
    if (!isActive) return;
    updateActivity();
    startInactivityTimer();
  }, [isActive, updateActivity, startInactivityTimer]);

  // Listen for user activity events
  useEffect(() => {
    if (!isActive) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
      clearInactivityTimeout();
    };
  }, [isActive, handleUserActivity, clearInactivityTimeout]);

  // Handle visibility change (user returns to tab)
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if session expired while tab was hidden
        try {
          const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
          if (lastActivity) {
            const elapsed = Date.now() - parseInt(lastActivity, 10);
            if (elapsed >= INACTIVITY_TIMEOUT_MS) {
              if (blockResetRef.current) {
                // Still blocked (e.g. mic active). Treat as activity.
                updateActivity();
                startInactivityTimer();
                return;
              }
              console.log('[DemoChat] Session expired while tab was hidden, resetting');
              onReset();
              localStorage.removeItem(LAST_ACTIVITY_KEY);
              return;
            }
          }
        } catch {
          // Ignore
        }
        // Resume timer
        handleUserActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, onReset, handleUserActivity, updateActivity, startInactivityTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInactivityTimeout();
    };
  }, [clearInactivityTimeout]);

  return { updateActivity };
}
