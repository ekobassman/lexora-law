import { useLanguage } from '@/contexts/LanguageContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Zap, User } from 'lucide-react';

export function SubscriptionBadge() {
  const { t } = useLanguage();
  const { entitlements, isLoading } = useEntitlements();

  if (isLoading) return null;

  const plan = entitlements.plan;
  const casesUsed = entitlements.usage?.casesUsed ?? 0;
  const casesLimit = entitlements.limits?.casesMax ?? 1;

  const getIcon = () => {
    switch (plan) {
      case 'unlimited':
        return <Crown className="h-3 w-3" />;
      case 'pro':
        return <Sparkles className="h-3 w-3" />;
      case 'starter':
        return <Zap className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getStyle = () => {
    switch (plan) {
      case 'unlimited':
        return 'bg-gradient-to-r from-gold to-amber-400 text-navy';
      case 'pro':
        return 'bg-gold/20 text-gold border border-gold/30';
      case 'starter':
        return 'bg-navy/10 text-navy';
      default:
        return 'bg-graphite/10 text-graphite';
    }
  };

  const remaining = Math.max(0, casesLimit - casesUsed);
  const showRemaining = plan !== 'unlimited';

  return (
    <Badge className={`${getStyle()} gap-1.5 px-2 py-1`}>
      {getIcon()}
      <span className="font-medium">{plan.toUpperCase()}</span>
      {showRemaining && (
        <span className="opacity-70">
          ({remaining}/{casesLimit === 999999 ? '∞' : casesLimit})
        </span>
      )}
    </Badge>
  );
}
