import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Plus, Settings, HeadsetIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type NavItem = {
  href: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  highlight?: boolean;
  isActive?: (pathname: string) => boolean;
};

export function MobileBottomNav() {
  const location = useLocation();
  const { t } = useLanguage();

  const pathname = location.pathname;

  const navItems: NavItem[] = [
    {
      href: '/app',
      icon: LayoutDashboard,
      labelKey: 'nav.dashboard',
      isActive: (p) => p === '/app' || p === '/dashboard' || p === '/pratiche' || p.startsWith('/pratiche/'),
    },
    {
      href: '/scan',
      icon: Plus,
      labelKey: 'nav.upload',
      highlight: true,
      isActive: (p) => p === '/scan',
    },
    {
      href: '/support',
      icon: HeadsetIcon,
      labelKey: 'nav.support',
      isActive: (p) => p === '/support',
    },
    {
      href: '/settings',
      icon: Settings,
      labelKey: 'nav.settings',
      isActive: (p) => p === '/settings',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold/20 bg-navy md:hidden safe-area-bottom" aria-label={t('nav.dashboard')}>
      <div className="grid h-16 grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive ? item.isActive(pathname) : pathname === item.href;
          const label = t(item.labelKey);

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex flex-col items-center justify-center gap-0.5"
                aria-label={label}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-navy shadow-lg -mt-4 border-2 border-navy">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-medium text-gold">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              aria-label={label}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? 'text-gold' : 'text-ivory/60 hover:text-ivory'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
