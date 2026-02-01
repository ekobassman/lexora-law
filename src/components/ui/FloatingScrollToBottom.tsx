import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingScrollToBottomProps {
  visible: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Floating circular blue button with down arrow icon.
 * Used for scroll-to-bottom functionality in scroll containers.
 * 
 * Position: fixed bottom-right (right:16px, bottom:16px)
 * Size: 40-44px circular
 * Style: Blue background, white icon, subtle shadow
 */
export function FloatingScrollToBottom({ 
  visible, 
  onClick,
  className 
}: FloatingScrollToBottomProps) {
  if (!visible) return null;
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Position
        "fixed z-50",
        // Size (40-44px)
        "h-11 w-11 max-h-[44px] max-w-[44px]",
        // Shape & colors
        "rounded-full bg-primary text-primary-foreground",
        // Hover & interaction
        "hover:bg-primary/90 active:scale-95",
        // Shadow
        "shadow-lg shadow-primary/25",
        // Transition
        "transition-all duration-200",
        // Flex center
        "flex items-center justify-center",
        className
      )}
      style={{
        right: 16,
        bottom: 16,
      }}
      aria-label="Scroll to bottom"
    >
      <ChevronDown className="h-5 w-5" />
    </button>
  );
}
