import { useState, useEffect, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollableContentBox } from '@/components/ScrollableContentBox';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  previewText?: string | null;
  children: ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  className?: string;
  /** Enable fixed-height scrollable content area. Defaults to true. */
  scrollable?: boolean;
  /** Max height for scrollable content. Defaults to 70vh. */
  maxContentHeight?: string;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  badgeVariant = 'secondary',
  previewText,
  children,
  storageKey,
  defaultOpen = false,
  forceOpen,
  className,
  scrollable = true,
  maxContentHeight = '70vh',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Load from localStorage on mount
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsOpen(stored === 'true');
      }
    }
  }, [storageKey]);

  // Handle forceOpen override
  useEffect(() => {
    if (forceOpen === true) {
      setIsOpen(true);
      if (storageKey) {
        localStorage.setItem(storageKey, 'true');
      }
    }
  }, [forceOpen, storageKey]);

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    if (storageKey) {
      localStorage.setItem(storageKey, String(open));
    }
  };

  // Create preview text (first 140 chars with ellipsis)
  const truncatedPreview = previewText && previewText.length > 140 
    ? previewText.slice(0, 140).trim() + '…' 
    : previewText;

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <Card className={cn('mb-6 transition-all bg-white', className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none hover:bg-ivory/50 transition-colors rounded-t-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gold">{icon}</span>
                  <CardTitle className="text-lg text-navy">{title}</CardTitle>
                  {badge && (
                    <Badge variant={badgeVariant} className="ml-2 text-xs bg-graphite text-ivory">
                      {badge}
                    </Badge>
                  )}
                </div>
                {!isOpen && truncatedPreview && (
                  <p className="text-sm text-navy/50 line-clamp-2 mt-1">
                    {truncatedPreview}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 mt-1">
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-navy/40 transition-transform" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-navy/40 transition-transform" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
          <CardContent className="pt-0 text-navy">
            {scrollable ? (
              <ScrollableContentBox maxHeight={maxContentHeight}>
                {children}
              </ScrollableContentBox>
            ) : (
              children
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}