import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Sparkles, Zap, Building2, Crown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckout } from '@/hooks/useCheckout';

interface PricingSectionProps {
  id?: string;
}

export function PricingSection({ id }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false);
  const { t } = useLanguage();
  const { user } = useAuth();
  const { createCheckoutSession, isLoading: checkoutLoading } = useCheckout();

  const handleCheckout = async (planId: 'starter' | 'plus' | 'pro') => {
    console.log('Checkout plan', planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        console.error('Stripe checkout error', await res.text());
        return;
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Stripe checkout exception', err);
    }
  };

  const plans = [
    {
      id: 'free',
      name: t('landingSections.pricing.plans.free.name'),
      description: t('landingSections.pricing.plans.free.description'),
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: Zap,
      features: [
        t('landingSections.pricing.plans.free.features.0'),
        t('landingSections.pricing.plans.free.features.1'),
        t('landingSections.pricing.plans.free.features.2'),
        t('landingSections.pricing.plans.free.features.3'),
      ],
      cta: t('landingSections.pricing.plans.free.cta'),
      ctaLink: '/auth?mode=signup',
      popular: false,
      variant: 'outline' as const,
    },
    {
      id: 'starter',
      name: t('landingSections.pricing.plans.starter.name'),
      description: t('landingSections.pricing.plans.starter.description'),
      monthlyPrice: 3.99,
      yearlyPrice: 39.90,
      icon: Sparkles,
      features: [
        t('landingSections.pricing.plans.starter.features.0'),
        t('landingSections.pricing.plans.starter.features.1'),
        t('landingSections.pricing.plans.starter.features.2'),
        t('landingSections.pricing.plans.starter.features.3'),
        t('landingSections.pricing.plans.starter.features.4'),
      ],
      cta: t('landingSections.pricing.plans.starter.cta'),
      ctaLink: '/auth?mode=signup&plan=starter',
      popular: false,
      variant: 'outline' as const,
    },
    {
      id: 'plus',
      name: t('landingSections.pricing.plans.plus.name'),
      description: t('landingSections.pricing.plans.plus.description'),
      monthlyPrice: 9.99,
      yearlyPrice: 99.90,
      icon: Building2,
      features: [
        t('landingSections.pricing.plans.plus.features.0'),
        t('landingSections.pricing.plans.plus.features.1'),
        t('landingSections.pricing.plans.plus.features.2'),
        t('landingSections.pricing.plans.plus.features.3'),
        t('landingSections.pricing.plans.plus.features.4'),
      ],
      cta: t('landingSections.pricing.plans.plus.cta'),
      ctaLink: '/auth?mode=signup&plan=plus',
      popular: true,
      variant: 'premium' as const,
    },
    {
      id: 'pro',
      name: t('landingSections.pricing.plans.pro.name'),
      description: t('landingSections.pricing.plans.pro.description'),
      monthlyPrice: 19.99,
      yearlyPrice: 199.90,
      icon: Crown,
      features: [
        t('landingSections.pricing.plans.pro.features.0'),
        t('landingSections.pricing.plans.pro.features.1'),
        t('landingSections.pricing.plans.pro.features.2'),
        t('landingSections.pricing.plans.pro.features.3'),
        t('landingSections.pricing.plans.pro.features.4'),
      ],
      cta: t('landingSections.pricing.plans.pro.cta'),
      ctaLink: '/auth?mode=signup&plan=pro',
      popular: false,
      variant: 'outline' as const,
    },
  ];

  return (
    <section id={id} className="py-16 md:py-24 bg-ivory">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="bg-gold/10 text-gold border-gold/30 mb-4">
            {t('landingSections.pricing.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
            {t('landingSections.pricing.title')}
          </h2>
          <p className="text-navy/70 max-w-2xl mx-auto mb-8">
            {t('landingSections.pricing.subtitle')}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${!isYearly ? 'text-navy font-semibold' : 'text-navy/60'}`}>
              {t('landingSections.pricing.monthly')}
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-gold"
            />
            <span className={`text-sm ${isYearly ? 'text-navy font-semibold' : 'text-navy/60'}`}>
              {t('landingSections.pricing.yearly')}
            </span>
            {isYearly && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                {t('landingSections.pricing.save')}
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const period = isYearly ? t('landingSections.pricing.perYear') : t('landingSections.pricing.perMonth');
            
            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${
                  plan.popular
                    ? 'border-2 border-gold shadow-lg shadow-gold/10 scale-105'
                    : 'border-navy/10'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gold text-navy font-semibold px-4">
                      {t('landingSections.pricing.popular')}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className={`h-12 w-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                    plan.popular ? 'bg-gold/20' : 'bg-navy/5'
                  }`}>
                    <Icon className={`h-6 w-6 ${plan.popular ? 'text-gold' : 'text-navy/70'}`} />
                  </div>
                  <CardTitle className="text-xl text-navy">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold text-navy">
                      {price === 0 ? t('landingSections.pricing.free') : `€${price.toFixed(2).replace('.', ',')}`}
                    </span>
                    {price > 0 && (
                      <span className="text-navy/60 text-sm">{period}</span>
                    )}
                  </div>
                  
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-navy/80">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  {plan.id === 'free' ? (
                    <Button variant={plan.variant} className="w-full" asChild>
                      <Link to={plan.ctaLink}>{plan.cta}</Link>
                    </Button>
                  ) : (
                    <Button
                      variant={plan.variant}
                      className="w-full"
                      onClick={() => handleCheckout(plan.id as 'starter' | 'plus' | 'pro')}
                    >
                      {plan.cta}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Trust note */}
        <p className="text-center text-sm text-navy/60 mt-8">
          {t('landingSections.pricing.trustNote')}
        </p>
      </div>
    </section>
  );
}
