import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';
import { CountryLawSelector } from '@/components/CountryLawSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useLogout } from '@/hooks/useLogout';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import { LogOut, User, Settings, ChevronDown, CreditCard, Shield, LayoutDashboard, HeadsetIcon } from 'lucide-react';
import { InstallAppButton } from '@/components/InstallAppButton';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePWA } from '@/hooks/usePWA';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppHeader() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { canInstall, isStandalone, isIOS } = usePWA();
  const showInstallApp = isMobile && (canInstall || isIOS || isStandalone);
  const { entitlements, isLoading: entitlementsLoading, isAdmin } = useEntitlements();
  const navigate = useNavigate();
  const logout = useLogout();

  const planLabel = entitlementsLoading ? null : (entitlements.plan || 'free').toUpperCase();
  const planSource = (entitlements as any)?.plan_source || 'unknown';

  return (
    <header className="sticky top-0 z-50 w-full overflow-x-hidden bg-navy border-b border-gold/20 safe-area-top">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-3 sm:h-20 sm:px-6">
        {/* Logo - Premium Legal Crest Style */}
        <Link to="/app" className="flex min-w-0 items-center gap-3 py-2">
          <div className="flex items-center gap-2">
            {/* Elegant crest-style logo */}
            <div className="relative flex h-10 w-10 items-center justify-center">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              {/* Inner decorative circle */}
              <div className="absolute inset-1 rounded-full border border-gold/30" />
              {/* Center monogram */}
              <span
                className="relative font-display text-lg font-semibold text-gold"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                L
              </span>
            </div>
            <span className="hidden xs:inline font-display text-xl font-medium tracking-widest text-ivory uppercase">
              LEXORA
            </span>
          </div>
        </Link>

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-3">
          {/* Subscription Badge - desktop only to prevent mobile overflow */}
          {user && (
            <div className="hidden sm:block">
              <SubscriptionBadge />
            </div>
          )}

          {/* Country/Law Jurisdiction Selector */}
          {user && (
            <div className="hidden sm:block">
              <CountryLawSelector variant="button" className="border-gold/30 text-ivory hover:text-gold hover:bg-transparent" />
            </div>
          )}

          {/* Support Link */}
          <Link to="/support">
            <Button variant="ghost" size="sm" className="gap-1 text-ivory/70 hover:text-gold hover:bg-transparent px-2">
              <HeadsetIcon className="h-4 w-4" />
              <span className="hidden lg:inline text-xs">{t('nav.support')}</span>
            </Button>
          </Link>

          {/* Globe / Language */}
          <LanguageSelector />

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-ivory hover:text-gold hover:bg-transparent">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 bg-graphite text-gold">
                    <User className="h-4 w-4" />
                  </div>
                  <ChevronDown className="h-4 w-4 text-ivory/50 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[60] w-72 bg-ivory border-gold/20">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-navy truncate">{user.email}</p>
                  {planLabel && (
                    <p className="text-xs text-navy/60">
                      Plan: <span className="font-bold">{planLabel}</span>
                      <span className="ml-1 text-[10px]">
                        ({planSource === 'override' ? '🛡️ override' : planSource === 'stripe' ? '💳 stripe' : '🆓 free'})
                      </span>
                    </p>
                  )}
                </div>

                <DropdownMenuSeparator className="bg-navy/10" />

                {/* Dashboard */}
                <DropdownMenuItem onClick={() => navigate('/app')} className="text-navy hover:bg-gold/10">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {t('header.dashboard') || 'Dashboard'}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => navigate('/settings')} className="text-navy hover:bg-gold/10">
                  <Settings className="mr-2 h-4 w-4" />
                  {t('header.settings')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/subscription')} className="text-navy hover:bg-gold/10">
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('header.subscription')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/support')} className="text-navy hover:bg-gold/10">
                  <HeadsetIcon className="mr-2 h-4 w-4" />
                  {t('nav.support')}
                </DropdownMenuItem>

                {/* Admin Panel - only show for admins */}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-navy/10" />
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="text-purple-700 hover:bg-purple-50">
                      <Shield className="mr-2 h-4 w-4" />
                      {t('header.adminPanel') || 'Admin Panel'}
                    </DropdownMenuItem>
                  </>
                )}

                {/* Installa App - solo mobile/tablet quando installabile */}
                {showInstallApp && (
                  <>
                    <DropdownMenuSeparator className="bg-navy/10" />
                    <InstallAppButton />
                  </>
                )}

                <DropdownMenuSeparator className="bg-navy/10" />
                
                {/* Logout - actual sign out */}
                <DropdownMenuItem onClick={logout} className="text-destructive hover:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('header.logoutAction') || 'Logout'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Gold divider line */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
    </header>
  );
}
