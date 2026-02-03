import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLogout } from '@/hooks/useLogout';
import { LogOut, User, Settings, ChevronDown, HeadsetIcon, Menu, X } from 'lucide-react';
import { InstallAppButton } from '@/components/InstallAppButton';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLanding = location.pathname === '/';

  const navLabel = (key: string, fallback: string) => {
    const v = t(key);
    return v && v !== key && !v.startsWith('nav.') ? v : fallback;
  };

  // Nav links for landing page (i18n)
  const landingNavLinks = [
    { href: '#how-it-works', labelKey: 'nav.howItWorks', fallback: 'How it works' },
    { href: '#pricing', labelKey: 'nav.pricing', fallback: 'Pricing' },
    { href: '#faq', labelKey: 'nav.faq', fallback: 'FAQ' },
  ];

  const scrollToSection = (href: string) => {
    const id = href.replace('#', '');
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-navy border-b border-gold/20 safe-area-top">
      <div className="flex h-16 items-center justify-between px-3 sm:px-4 md:px-6 lg:container md:h-20">
        {/* Logo - Premium Legal Style */}
        <Link to={user ? "/app" : "/"} className="flex items-center gap-2 py-2 shrink-0">
          <div className="flex items-center gap-2">
            {/* Elegant crest-style logo */}
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center shrink-0">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              {/* Inner decorative circle */}
              <div className="absolute inset-1 rounded-full border border-gold/30" />
              {/* Center monogram */}
              <span className="relative font-display text-base sm:text-lg font-semibold text-gold" style={{ fontFamily: 'Georgia, serif' }}>L</span>
            </div>
            <span className="font-display text-lg sm:text-xl font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </div>
        </Link>

        {/* Desktop Navigation (landing page only) - flex, truncate long labels */}
        {isLanding && !user && (
          <nav className="hidden md:flex items-center gap-3 lg:gap-5 min-w-0 flex-1 justify-center max-w-2xl">
            <InstallAppButton variant="menu" />
            {landingNavLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollToSection(link.href)}
                className="text-ivory/70 hover:text-gold transition-colors text-sm font-medium whitespace-nowrap truncate max-w-[140px] lg:max-w-none lg:truncate-none"
                title={navLabel(link.labelKey, link.fallback)}
              >
                {navLabel(link.labelKey, link.fallback)}
              </button>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile menu button (landing only) */}
          {isLanding && !user && (
            <button
              className="md:hidden p-2 text-ivory/70 hover:text-gold"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}

          {/* Support Link - hidden on small mobile to save space */}
          {!isLanding && (
            <Link to="/support" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="gap-1.5 text-ivory/70 hover:text-gold hover:bg-transparent">
                <HeadsetIcon className="h-4 w-4" />
                <span className="hidden md:inline">{t('nav.support')}</span>
              </Button>
            </Link>
          )}

          <LanguageSelector />
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-ivory hover:text-gold hover:bg-transparent px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 bg-graphite text-gold">
                    <User className="h-4 w-4" />
                  </div>
                  <ChevronDown className="h-4 w-4 text-ivory/50 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-ivory border-gold/20">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-navy truncate">{user.email}</p>
                  <p className="text-xs text-navy/60">{t('header.privateWorkspace')}</p>
                </div>
                <DropdownMenuSeparator className="bg-navy/10" />
                <DropdownMenuItem onClick={() => navigate('/app')} className="text-navy hover:bg-gold/10">
                  <User className="mr-2 h-4 w-4" />
                  {t('header.dashboard') || t('nav.dashboard')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="text-navy hover:bg-gold/10">
                  <Settings className="mr-2 h-4 w-4" />
                  {t('header.settings') || t('nav.settings')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/support')} className="text-navy hover:bg-gold/10">
                  <HeadsetIcon className="mr-2 h-4 w-4" />
                  {t('nav.support')}
                </DropdownMenuItem>
                <InstallAppButton />
                <DropdownMenuSeparator className="bg-navy/10" />
                <DropdownMenuItem onClick={logout} className="text-destructive hover:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('header.logoutAction') || t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="bg-gold text-navy hover:bg-gold/90 px-3 sm:px-4 text-sm whitespace-nowrap">{t('nav.login')}</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu (landing only) */}
      {isLanding && !user && mobileMenuOpen && (
        <div className="md:hidden bg-navy border-t border-gold/20 py-4 px-4">
          <nav className="flex flex-col gap-3">
            {landingNavLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollToSection(link.href)}
                className="text-ivory/70 hover:text-gold transition-colors text-sm font-medium text-left py-2 break-words"
              >
                {navLabel(link.labelKey, link.fallback)}
              </button>
            ))}
            <Link
              to="/support"
              className="text-ivory/70 hover:text-gold transition-colors text-sm font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.support')}
            </Link>
            <InstallAppButton variant="menu" />
          </nav>
        </div>
      )}

      {/* Gold divider line */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
    </header>
  );
}
