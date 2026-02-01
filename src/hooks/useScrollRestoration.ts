import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to persist and restore scroll position for a page.
 * Saves scroll position to sessionStorage when navigating away,
 * and restores it when returning to the page.
 */
export function useScrollRestoration(key?: string) {
  const location = useLocation();
  const storageKey = key || `scroll-${location.pathname}`;
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);

  // Save current scroll position
  const saveScrollPosition = useCallback(() => {
    if (isRestoringRef.current) return;
    const scrollY = window.scrollY;
    sessionStorage.setItem(storageKey, String(scrollY));
  }, [storageKey]);

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    if (hasRestoredRef.current) return;
    
    const saved = sessionStorage.getItem(storageKey);
    if (saved !== null) {
      const scrollY = parseInt(saved, 10);
      if (!isNaN(scrollY) && scrollY > 0) {
        isRestoringRef.current = true;
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
          hasRestoredRef.current = true;
          // Reset flag after a short delay
          setTimeout(() => {
            isRestoringRef.current = false;
          }, 100);
        });
      }
    }
  }, [storageKey]);

  // Clear saved position (call when leaving permanently)
  const clearScrollPosition = useCallback(() => {
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  // Save scroll on scroll events (debounced via passive listener)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(saveScrollPosition, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [saveScrollPosition]);

  // Save before unload or visibility change
  useEffect(() => {
    const handleBeforeUnload = () => saveScrollPosition();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveScrollPosition]);

  // Restore on mount
  useEffect(() => {
    // Small delay to let content render
    const timeoutId = setTimeout(restoreScrollPosition, 50);
    return () => clearTimeout(timeoutId);
  }, [restoreScrollPosition]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    clearScrollPosition,
  };
}

/**
 * Hook to persist scroll position of a specific scrollable container.
 * Use this for internal scroll containers like ScrollableContentBox.
 */
export function useContainerScrollRestoration(
  containerRef: React.RefObject<HTMLElement>,
  key: string
) {
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);

  const saveScrollPosition = useCallback(() => {
    if (isRestoringRef.current || !containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    sessionStorage.setItem(key, String(scrollTop));
  }, [key, containerRef]);

  const restoreScrollPosition = useCallback(() => {
    if (hasRestoredRef.current || !containerRef.current) return;
    
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      const scrollTop = parseInt(saved, 10);
      if (!isNaN(scrollTop) && scrollTop > 0) {
        isRestoringRef.current = true;
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = scrollTop;
            hasRestoredRef.current = true;
          }
          setTimeout(() => {
            isRestoringRef.current = false;
          }, 100);
        });
      }
    }
  }, [key, containerRef]);

  const clearScrollPosition = useCallback(() => {
    sessionStorage.removeItem(key);
  }, [key]);

  // Save on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: NodeJS.Timeout;
    
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(saveScrollPosition, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [saveScrollPosition, containerRef]);

  // Restore on mount
  useEffect(() => {
    const timeoutId = setTimeout(restoreScrollPosition, 100);
    return () => clearTimeout(timeoutId);
  }, [restoreScrollPosition]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    clearScrollPosition,
  };
}
