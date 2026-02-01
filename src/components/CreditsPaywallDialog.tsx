import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Zap, ArrowRight, Coins } from 'lucide-react';

interface CreditsPaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'credits' | 'cases';
  casesUsed?: number;
  casesLimit?: number;
  creditsBalance?: number;
}

export function CreditsPaywallDialog({
  open,
  onOpenChange,
  type,
  casesUsed = 0,
  casesLimit = 1,
  creditsBalance = 0,
}: CreditsPaywallDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  const handleBuyCredits = () => {
    onOpenChange(false);
    // TODO: Navigate to credits purchase page when Stripe is integrated
    navigate('/pricing');
  };

  const isCreditsIssue = type === 'credits';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            {isCreditsIssue ? (
              <Coins className="h-8 w-8 text-amber-600" />
            ) : (
              <Zap className="h-8 w-8 text-amber-600" />
            )}
          </div>
          <DialogTitle className="text-center text-xl">
            {isCreditsIssue 
              ? t('paywall.credits.title', 'Crediti esauriti')
              : t('paywall.cases.title', 'Limite pratiche raggiunto')
            }
          </DialogTitle>
          <DialogDescription className="text-center">
            {isCreditsIssue ? (
              <>
                {t('paywall.credits.description', 'Non hai abbastanza crediti per questa operazione.')}
                <div className="mt-2">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {creditsBalance} {t('paywall.credits.remaining', 'crediti rimanenti')}
                  </Badge>
                </div>
              </>
            ) : (
              <>
                {t('paywall.cases.description', 'Hai raggiunto il limite mensile di pratiche per il tuo piano.')}
                <div className="mt-2">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {casesUsed} / {casesLimit} {t('paywall.cases.used', 'pratiche usate')}
                  </Badge>
                </div>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-medium mb-2">
              {t('paywall.whatYouGet', 'Con un piano superiore ottieni:')}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-green-500" />
                {t('paywall.benefit1', 'Più pratiche al mese')}
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-green-500" />
                {t('paywall.benefit2', 'Crediti inclusi per AI e OCR')}
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-green-500" />
                {t('paywall.benefit3', 'Analisi documenti illimitata')}
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-green-500" />
                {t('paywall.benefit4', 'Assistenza AI estesa')}
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={handleUpgrade} 
            className="w-full gap-2"
            size="lg"
          >
            <Zap className="h-4 w-4" />
            {t('paywall.upgrade', 'Passa a PRO')}
          </Button>
          {isCreditsIssue && (
            <Button 
              variant="outline" 
              onClick={handleBuyCredits}
              className="w-full gap-2"
            >
              <CreditCard className="h-4 w-4" />
              {t('paywall.buyCredits', 'Acquista crediti')}
            </Button>
          )}
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {t('common.cancel', 'Annulla')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
