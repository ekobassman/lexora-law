import { useLanguage } from '@/contexts/LanguageContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Zap, User, Shield } from 'lucide-react';

export function SubscriptionBadge() {
  const { t } = useLanguage();
  const { entitlements, isLoading, isAdmin } = useEntitlements();

  if (isLoading) return null;

  const plan = entitlements.plan;
  const casesUsed = entitlements.usage?.casesUsed ?? 0;
  const casesLimit = entitlements.limits?.casesMax ?? 1;

  const getIcon = () => {
    if (isAdmin) return <Shield className="h-3 w-3" />;
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
    if (isAdmin) return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-400/40';
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

  const displayLabel = isAdmin ? 'ADMIN' : plan.toUpperCase();
  const remaining = Math.max(0, (casesLimit ?? 0) - casesUsed);
  const showRemaining = !isAdmin && plan !== 'unlimited' && casesLimit != null && casesLimit < 999999;

  return (
    <Badge className={`${getStyle()} gap-1.5 px-2 py-1`}>
      {getIcon()}
      <span className="font-medium">{displayLabel}</span>
      {showRemaining && (
        <span className="opacity-70">
          ({remaining}/{casesLimit === 999999 ? '∞' : casesLimit})
        </span>
      )}
    </Badge>
  );
}
