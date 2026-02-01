import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useCheckout } from '@/hooks/useCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PLANS } from '@/lib/subscriptionPlans';
import { getCurrencyByCountry, getCurrencySymbol, getTimezoneCountry } from '@/lib/currency';
import { getDisplayPrice, PaidPlanKey } from '@/lib/pricingDisplay';

interface PricingThumbnailsProps {
  showTitle?: boolean;
  className?: string;
}

export function PricingThumbnails({ showTitle = true, className = '' }: PricingThumbnailsProps) {
  const { t, isRTL, countryInfo } = useLanguage();
  const { entitlements } = useEntitlements();
  const { createCheckoutSession } = useCheckout();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanKey | null>(null);

  const currentPlan = entitlements.plan_key;

  // Resolve country: countryInfo (from LanguageContext) > timezone guess
  const tzCountry = getTimezoneCountry();
  const resolvedCountry = countryInfo?.code || tzCountry;
  const currency = getCurrencyByCountry(resolvedCountry);
  const symbol = getCurrencySymbol(currency);

  const handleSelectPlan = async (planId: PaidPlanKey) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoadingPlan(planId);
    try {
      const { url } = await createCheckoutSession(planId);
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error(t('subscription.error.checkout'));
    } finally {
      setLoadingPlan(null);
    }
  };

  // Format price based on currency
  const formatPriceDisplay = (planId: PaidPlanKey): string => {
    const amount = getDisplayPrice(planId, currency);
    const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(2).replace('.', ',');
    
    if (currency === 'USD' || currency === 'GBP') {
      return `${symbol}${formatted}`;
    }
    return `${formatted}${symbol}`;
  };

  // Define the three paid plans
  const planCards: { id: PaidPlanKey; nameKey: string; casesKey: string; featuresKeys: string[] }[] = [
    {
      id: 'starter',
      nameKey: 'pricing.thumbnails.starter.name',
      casesKey: 'pricing.thumbnails.starter.cases',
      featuresKeys: [
        'pricing.thumbnails.starter.feature1',
        'pricing.thumbnails.starter.feature2',
        'pricing.thumbnails.starter.feature3',
      ],
    },
    {
      id: 'pro',
      nameKey: 'pricing.thumbnails.pro.name',
      casesKey: 'pricing.thumbnails.pro.cases',
      featuresKeys: [
        'pricing.thumbnails.pro.feature1',
        'pricing.thumbnails.pro.feature2',
        'pricing.thumbnails.pro.feature3',
      ],
    },
    {
      id: 'unlimited',
      nameKey: 'pricing.thumbnails.unlimited.name',
      casesKey: 'pricing.thumbnails.unlimited.cases',
      featuresKeys: [
        'pricing.thumbnails.unlimited.feature1',
        'pricing.thumbnails.unlimited.feature2',
        'pricing.thumbnails.unlimited.feature3',
      ],
    },
  ];

  return (
    <div className={`${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {showTitle && (
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground mb-4">
            {t('dashboard.plansIntro.title')}
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            {t('dashboard.plansIntro.text')}
          </p>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 w-full max-w-6xl mx-auto">
        {planCards.map((card) => {
          const isCurrentPlan = currentPlan === card.id;
          const isPopular = card.id === 'pro';

          return (
            <Card
              key={card.id}
              className={`relative overflow-hidden bg-card border border-border/60 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 ${
                isPopular ? 'ring-2 ring-gold/30 border-gold/40' : ''
              } ${isCurrentPlan ? 'ring-2 ring-primary/30 border-primary/40' : ''}`}
            >
              <CardContent className="p-2 sm:p-3 md:p-5 flex flex-col h-full">
                {/* Plan Name Badge */}
                <div className="flex justify-center mb-1 sm:mb-2">
                  <Badge
                    variant="outline"
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full ${
                      isPopular
                        ? 'bg-gold/10 text-gold border-gold/30'
                        : card.id === 'unlimited'
                          ? 'bg-navy/10 text-navy border-navy/30'
                          : 'bg-muted text-foreground border-border'
                    }`}
                  >
                    {t(card.nameKey)}
                  </Badge>
                </div>

                {/* Price */}
                <div className="text-center mb-0.5 sm:mb-1">
                  <span className="text-base sm:text-xl md:text-3xl font-bold text-foreground">
                    {formatPriceDisplay(card.id)}
                  </span>
                  <span className="text-muted-foreground text-[8px] sm:text-[10px] md:text-xs">/{t('pricing.perMonth')}</span>
                </div>

                {/* Cases Limit */}
                <p className="text-center text-[9px] sm:text-[10px] md:text-sm text-muted-foreground mb-1 sm:mb-3">
                  {t(card.casesKey)}
                </p>

                {/* Features List */}
                <ul className="space-y-0.5 sm:space-y-1.5 mb-2 sm:mb-4 flex-grow">
                  {card.featuresKeys.map((featureKey, index) => (
                    <li key={index} className="flex items-start gap-1 text-[8px] sm:text-[10px] md:text-xs text-foreground/80">
                      <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gold flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full rounded-full border-foreground/20 text-foreground hover:bg-foreground/5 text-[9px] sm:text-[10px] md:text-xs py-1 sm:py-1.5 h-auto ${
                    isCurrentPlan ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  disabled={isCurrentPlan || loadingPlan === card.id}
                  onClick={() => handleSelectPlan(card.id)}
                >
                  {loadingPlan === card.id ? (
                    <Loader2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin" />
                  ) : isCurrentPlan ? (
                    t('pricing.currentPlan')
                  ) : (
                    t('pricing.thumbnails.cta')
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Local Currency Note */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        {t('pricing.localCurrencyNote')}
      </p>

      {/* Compare All Plans Link */}
      <div className="text-center mt-4">
        <Link
          to="/pricing"
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          {t('pricing.thumbnails.compareAll')}
        </Link>
      </div>
    </div>
  );
}
