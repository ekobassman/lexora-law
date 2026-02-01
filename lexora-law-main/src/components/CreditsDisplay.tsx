import { usePlanState } from '@/hooks/usePlanState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Briefcase, Zap, Info, TrendingUp, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CreditsDisplayProps {
  compact?: boolean;
  showUpgrade?: boolean;
}

export function CreditsDisplay({ compact = false, showUpgrade = true }: CreditsDisplayProps) {
  const { planState, isLoading, isReady, isSyncing, isPaid, isUnlimited } = usePlanState();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // CRITICAL: Show loading skeleton until plan state is ready
  // This prevents "1-frame-free" flash for paid users
  if (isLoading || !isReady) {
    return (
      <div className="flex flex-col gap-4 p-4 rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-2 w-full" />
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('checkout.syncing', 'Aggiorno il tuo piano…')}</span>
        </div>
      </div>
    );
  }

  const { plan, monthly_case_limit, cases_remaining, cases_used_this_month, at_case_limit, period_end } = planState;
  const progressPercent = monthly_case_limit > 0 ? Math.min(100, (cases_used_this_month / monthly_case_limit) * 100) : 0;

  // CRITICAL: Never show FREE UI for paid users
  const isFree = plan === 'free';

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
          {isUnlimited ? (
            <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <Zap className="h-3 w-3 mr-1" />
              {t('credits.unlimited', 'Illimitato')}
            </Badge>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={at_case_limit ? 'destructive' : 'outline'} 
                  className="gap-1 cursor-help"
                >
                  <Briefcase className="h-3 w-3" />
                  <span>{t('credits.creditsLabel', 'Crediti')}: {cases_remaining}/{monthly_case_limit}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{t('credits.monthlyCasesTitle', 'Crediti mensili')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('credits.monthlyCasesTooltip', 'Un credito = una pratica completa. Si consuma solo quando crei una nuova pratica.')}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Title and description based on plan type
  const getTitle = () => {
    if (isUnlimited) return t('credits.unlimitedTitle', 'Crediti illimitati');
    if (isFree) return t('credits.trialCaseTitle', 'Credito di prova');
    return t('credits.monthlyCasesTitle', 'Crediti mensili');
  };

  const getDescription = () => {
    if (isUnlimited) {
      return t('credits.unlimitedCasesDesc', 'Pratiche illimitate incluse nel tuo piano.');
    }
    if (isFree) {
      return t('credits.trialCasesDesc', 'Hai {{remaining}} pratica totale (una sola volta).', { remaining: cases_remaining });
    }
    return t('credits.monthlyCasesRemaining', 'Rimanenti questo mese: {{remaining}} di {{limit}}', { 
      remaining: cases_remaining, 
      limit: monthly_case_limit 
    });
  };

  const getTooltip = () => {
    if (isFree) {
      return t('credits.trialCaseTooltip', 'Hai 1 pratica totale (una sola volta). Per creare più pratiche, passa a un piano a pagamento.');
    }
    return t('credits.monthlyCasesTooltip', 'Un credito = una pratica completa (fascicolo). Si consuma solo quando crei una nuova pratica.');
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4 p-4 rounded-lg border bg-card shadow-sm">
        {/* Header with Title and Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="font-medium text-foreground">
                {getTitle()}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help inline ml-1" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">{getTooltip()}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Badge 
            variant={isUnlimited ? 'default' : at_case_limit ? 'destructive' : 'secondary'}
            className={isUnlimited ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : ''}
          >
            {isUnlimited 
              ? t('credits.unlimited', '∞ Illimitato')
              : t('credits.creditsLabel', 'Crediti') + `: ${cases_remaining}/${monthly_case_limit}`
            }
          </Badge>
        </div>

        {/* Progress Bar - Only for non-unlimited plans */}
        {!isUnlimited && (
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('credits.casesUsed', '{{count}} usate', { count: cases_used_this_month })}</span>
              <span>{t('credits.casesRemaining', '{{count}} rimaste', { count: cases_remaining })}</span>
            </div>
          </div>
        )}

        {/* Description Text */}
        <p className="text-sm text-muted-foreground">
          {getDescription()}
        </p>

        {/* Warning when at limit */}
        {at_case_limit && !isUnlimited && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">
              {t('credits.outOfMonthlyCases', 'Hai esaurito i crediti mensili. Passa a PRO o aspetta il rinnovo.')}
            </p>
            {period_end && (
              <p className="text-xs text-destructive/80 mt-1">
                {t('credits.renewsAt', 'Si rinnova il {{date}}', { 
                  date: new Date(period_end).toLocaleDateString() 
                })}
              </p>
            )}
          </div>
        )}

        {showUpgrade && (isFree || at_case_limit) && (
          <Button 
            size="sm" 
            variant="default" 
            className="w-full gap-2"
            onClick={() => navigate('/pricing')}
          >
            <TrendingUp className="h-4 w-4" />
            {t('credits.upgrade', 'Passa a PRO')}
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
