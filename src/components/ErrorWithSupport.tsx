import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, HeadsetIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorWithSupportProps {
  message?: string;
  showIcon?: boolean;
  variant?: 'inline' | 'block';
  className?: string;
}

/**
 * Reusable error display component with Support link.
 * Use this for all error states (upload, OCR, payment, login errors).
 */
export function ErrorWithSupport({ 
  message, 
  showIcon = true, 
  variant = 'inline',
  className = '' 
}: ErrorWithSupportProps) {
  const { t } = useLanguage();
  
  const errorMessage = message || t('common.error');

  if (variant === 'block') {
    return (
      <div className={`rounded-lg border border-destructive/30 bg-destructive/5 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          {showIcon && (
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
          )}
          <div className="flex-1 space-y-2">
            <p className="text-sm text-destructive font-medium">{errorMessage}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('support.problemHint')}
              </span>
              <Link to="/support">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                  <HeadsetIcon className="mr-1 h-3 w-3" />
                  {t('nav.support')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant - compact
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      {showIcon && <AlertTriangle className="h-4 w-4 text-destructive" />}
      <span className="text-destructive">{errorMessage}</span>
      <span className="text-muted-foreground">•</span>
      <Link to="/support" className="inline-flex items-center gap-1 text-primary hover:underline">
        <HeadsetIcon className="h-3 w-3" />
        {t('support.contactSupport')}
      </Link>
    </div>
  );
}