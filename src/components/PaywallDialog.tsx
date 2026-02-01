import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useCheckout } from '@/hooks/useCheckout';
import { PLANS, PlanType } from '@/lib/subscriptionPlans';
import { getCurrencyByCountry, getCurrencySymbol, getTimezoneCountry } from '@/lib/currency';
import { getDisplayPrice, PaidPlanKey } from '@/lib/pricingDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Crown, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaywallDialog({ open, onOpenChange }: PaywallDialogProps) {
  const { t, countryInfo } = useLanguage();
  const { entitlements } = useEntitlements();
  const { createCheckoutSession } = useCheckout();
  const [loading, setLoading] = useState<PaidPlanKey | null>(null);

  const currentPlan = entitlements.plan_key;

  // Resolve country: countryInfo (from LanguageContext) > timezone guess
  const tzCountry = getTimezoneCountry();
  const resolvedCountry = countryInfo?.code || tzCountry;
  const currency = getCurrencyByCountry(resolvedCountry);
  const symbol = getCurrencySymbol(currency);

  // Format price based on currency
  const formatPriceDisplay = (planId: PaidPlanKey): string => {
    const amount = getDisplayPrice(planId, currency);
    const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(2).replace('.', ',');
    
    if (currency === 'USD' || currency === 'GBP') {
      return `${symbol}${formatted}`;
    }
    return `${formatted}${symbol}`;
  };

  const handleUpgrade = async (plan: PaidPlanKey) => {
    setLoading(plan);
    try {
      const { url } = await createCheckoutSession(plan);
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(t('subscription.error.checkout'));
    } finally {
      setLoading(null);
    }
  };

  const getPlanIcon = (plan: PlanType) => {
    switch (plan) {
      case 'starter': return <Zap className="h-5 w-5" />;
      case 'pro': return <Sparkles className="h-5 w-5" />;
      case 'unlimited': return <Crown className="h-5 w-5" />;
      default: return null;
    }
  };

  const paidPlans: PaidPlanKey[] = ['starter', 'pro', 'unlimited'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-4">
          <DialogTitle className="text-2xl font-display text-navy">
            {t('subscription.paywall.title')}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t('subscription.paywall.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          {paidPlans.map((planId) => {
            const planConfig = PLANS[planId];
            const isCurrentPlan = currentPlan === planId;
            const isHighlighted = planConfig.highlighted;

            return (
              <Card 
                key={planId}
                className={`relative transition-all ${
                  isHighlighted 
                    ? 'border-gold shadow-lg ring-2 ring-gold/20' 
                    : 'border-navy/10'
                } ${isCurrentPlan ? 'bg-navy/5' : ''}`}
              >
                {isHighlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy">
                    {t('subscription.popular')}
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${
                    isHighlighted ? 'bg-gold text-navy' : 'bg-navy/10 text-navy'
                  }`}>
                    {getPlanIcon(planId)}
                  </div>
                  <CardTitle className="text-xl font-display text-navy">
                    {planConfig.name}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-navy">{formatPriceDisplay(planId)}</span>
                    <span className="text-navy/60">/{t('subscription.perMonth')}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-center text-sm text-navy/70">
                    {t(`subscription.plan.${planId}.casesDesc`)}
                  </p>

                  <Button
                    className={`w-full ${
                      isHighlighted 
                        ? 'bg-gold text-navy hover:bg-gold/90' 
                        : 'bg-navy text-gold hover:bg-navy/90'
                    }`}
                    disabled={isCurrentPlan || loading !== null}
                    onClick={() => handleUpgrade(planId)}
                  >
                    {loading === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      t('subscription.currentPlan')
                    ) : (
                      t('subscription.upgrade')
                    )}
                  </Button>

                  <ul className="space-y-2 text-sm">
                    {planConfig.featureKeys.slice(0, 4).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green shrink-0 mt-0.5" />
                        <span className="text-navy/70">{t(feature)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Local Currency Note */}
        <p className="text-center text-xs text-navy/50 pt-2">
          {t('pricing.localCurrencyNote')}
        </p>

        <p className="text-center text-sm text-navy/50 pt-2">
          {t('subscription.cancelAnytime')}
        </p>
      </DialogContent>
    </Dialog>
  );
}
