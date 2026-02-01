import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollableContentBoxProps {
  children: ReactNode;
  className?: string;
  /** Max height of the container. Defaults to 70vh (iPhone screen equivalent) */
  maxHeight?: string;
  /** Show the "jump to bottom" button */
  showScrollButton?: boolean;
  /** Custom label for the scroll button */
  scrollButtonLabel?: string;
  /** Whether to auto-scroll to bottom on content change */
  autoScrollOnChange?: boolean;
}

/**
 * A container with a fixed max-height and internal scrolling.
 * Includes an optional "jump to bottom" button that appears when scrolled up.
 * Designed for mobile-first experience (approx. iPhone screen height).
 */
export function ScrollableContentBox({
  children,
  className,
  maxHeight = '70vh',
  showScrollButton = true,
  scrollButtonLabel,
  autoScrollOnChange = false,
}: ScrollableContentBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Check if user has scrolled up from the bottom
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Consider "at bottom" if within 100px of the bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsScrolledUp(!atBottom);
  }, []);

  // Auto-scroll on content change if enabled
  useEffect(() => {
    if (autoScrollOnChange) {
      scrollToBottom();
    }
  }, [children, autoScrollOnChange]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={containerRef}
        className="overflow-y-auto overscroll-contain"
        style={{
          maxHeight,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
      
      {/* Jump to bottom button - small round icon only, bottom-right */}
      {showScrollButton && isScrolledUp && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 h-10 w-10 max-h-[44px] max-w-[44px] rounded-full shadow-lg z-10 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-colors"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
