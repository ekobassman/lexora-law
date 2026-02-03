import { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronDown, Loader2 } from 'lucide-react';

const THRESHOLD_PX = 100;
const MAX_PULL_PX = 100;
const RESISTANCE = 0.5;

export function PullToRefresh() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartYRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const isPullingRef = useRef(false);

  pullDistanceRef.current = pullDistance;
  isPullingRef.current = isPulling;

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && e.touches.length === 1) {
        isPullingRef.current = true;
        setIsPulling(true);
        touchStartYRef.current = e.touches[0].clientY;
        setPullDistance(0);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || e.touches.length !== 1) return;
      if (window.scrollY > 0) {
        isPullingRef.current = false;
        setIsPulling(false);
        setPullDistance(0);
        return;
      }
      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      if (deltaY > 0) {
        const distance = Math.min(deltaY * RESISTANCE, MAX_PULL_PX);
        setPullDistance(distance);
        if (distance >= 10) e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      const currentPull = pullDistanceRef.current;
      if (currentPull >= THRESHOLD_PX) {
        triggerRefresh();
      }
      isPullingRef.current = false;
      setIsPulling(false);
      setPullDistance(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, triggerRefresh]);

  if (!isMobile) return null;

  const height = Math.min(pullDistance, MAX_PULL_PX);
  const reachedThreshold = pullDistance >= THRESHOLD_PX;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-center overflow-hidden transition-[height] duration-150 ease-out"
      style={{
        height: height,
        maxHeight: MAX_PULL_PX,
        pointerEvents: 'none',
      }}
      aria-hidden
    >
      <div className="flex h-full min-h-[60px] w-full items-center justify-center gap-2 border-b border-gray-200/80 bg-white/95 shadow-sm">
        {isRefreshing ? (
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        ) : (
          <>
            <ChevronDown
              className="h-6 w-6 shrink-0 text-gray-500 transition-transform duration-200"
              style={{
                transform: reachedThreshold ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
            <span className="text-sm font-medium text-gray-600">
              {reachedThreshold
                ? (t('pullToRefresh.release') || 'Release to refresh')
                : (t('pullToRefresh.pull') || 'Pull to refresh')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
