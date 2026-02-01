import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useCheckout } from '@/hooks/useCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CheckCircle2, 
  Zap, 
  Sparkles, 
  Crown, 
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { PLANS, PlanType } from '@/lib/subscriptionPlans';
import { getCurrencyByCountry, getCurrencySymbol, getTimezoneCountry } from '@/lib/currency';
import { getDisplayPrice, PaidPlanKey } from '@/lib/pricingDisplay';

export default function Pricing() {
  const { t, isRTL, countryInfo } = useLanguage();
  const { entitlements } = useEntitlements();
  const { createCheckoutSession } = useCheckout();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanKey | null>(null);

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
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    setLoadingPlan(plan);
    try {
      const { url } = await createCheckoutSession(plan);
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const getPlanIcon = (planId: PlanType) => {
    switch (planId) {
      case 'starter': return <Zap className="h-6 w-6" />;
      case 'pro': return <Sparkles className="h-6 w-6" />;
      case 'unlimited': return <Crown className="h-6 w-6" />;
      default: return null;
    }
  };

  const getPlanColor = (planId: PlanType) => {
    switch (planId) {
      case 'starter': return 'text-blue-500 bg-blue-500/10';
      case 'pro': return 'text-gold bg-gold/10';
      case 'unlimited': return 'text-purple-500 bg-purple-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const paidPlans: PaidPlanKey[] = ['starter', 'pro', 'unlimited'];

  const features = [
    'pricing.features.freeCase',
    'pricing.features.noCard',
    'pricing.features.cancelAnytime',
    'pricing.features.clearPricing',
  ];

  return (
    <div className="min-h-screen bg-ivory" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <section className="container py-12 md:py-20 pt-24 md:pt-28">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
        </div>

        <div className="mx-auto max-w-4xl text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Info Bar - Centered checklist above cards */}
        <div className="mx-auto max-w-3xl mb-10 px-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:flex md:flex-wrap md:justify-center md:gap-x-8 md:gap-y-2">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-foreground/80">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span>{t(feature)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {paidPlans.map((planId) => {
            const planConfig = PLANS[planId];
            const isCurrentPlan = currentPlan === planId;
            const isPopular = planConfig.highlighted;
            const colorClasses = getPlanColor(planId);

            return (
              <Card 
                key={planId} 
                className={`relative overflow-hidden transition-all hover:shadow-lg ${
                  isPopular ? 'border-gold ring-2 ring-gold/20' : ''
                } ${isCurrentPlan ? 'border-primary' : ''}`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-gold text-navy text-xs font-bold px-3 py-1 rounded-bl-lg">
                    {t('pricing.popular')}
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-br-lg">
                    {t('pricing.currentPlan')}
                  </div>
                )}
                
                <CardHeader className="text-center pb-4 pt-8">
                  <div className={`mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-full ${colorClasses}`}>
                    {getPlanIcon(planId)}
                  </div>
                  <CardTitle className="text-xl">{planConfig.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      {formatPriceDisplay(planId)}
                    </span>
                    <span className="text-muted-foreground">/{t('pricing.perMonth')}</span>
                  </div>
                  <CardDescription className="mt-2">
                    {t(`pricing.plans.${planId}.description`)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {planConfig.featureKeys.slice(0, 4).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>{t(feature)}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full mt-6"
                    variant={isPopular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || loadingPlan === planId}
                    onClick={() => handleUpgrade(planId)}
                  >
                    {loadingPlan === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      t('pricing.currentPlan')
                    ) : (
                      t('pricing.activate')
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Local Currency Note */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('pricing.localCurrencyNote')}
        </p>

        {/* Legal Microcopy */}
        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.legal')}
          </p>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
