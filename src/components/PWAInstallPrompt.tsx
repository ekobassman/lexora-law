import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePWA } from '@/hooks/usePWA';
import { showIOSInstallGuide } from '@/components/PWAInstall';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import i18n from '@/i18n';

const DISMISS_KEY = 'pwa-mobile-install-banner-dismissed';

function label(key: string, fallback: string): string {
  const v = i18n.t(key);
  if (!v || v === key || String(v).startsWith('mobileInstall.')) return fallback;
  return String(v);
}

/**
 * Fixed bottom banner on MOBILE ONLY (sm:block md:hidden) to invite PWA install.
 * Hidden when app is already installed or user dismissed.
 */
export function PWAInstallPrompt() {
  const { t } = useLanguage();
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWA();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInstalled) {
      setVisible(false);
      return;
    }
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY)) {
      setVisible(false);
      return;
    }
    if (canInstall || isIOS) setVisible(true);
  }, [canInstall, isInstalled, isIOS]);

  const handleInstall = async () => {
    if (isIOS) {
      showIOSInstallGuide();
      return;
    }
    if (!canInstall) return;
    setInstalling(true);
    try {
      const accepted = await triggerInstall();
      if (accepted) setVisible(false);
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 max-h-16 border-t border-amber-500/40 bg-navy shadow-lg sm:flex md:hidden pb-[env(safe-area-inset-bottom,0)]"
      role="banner"
      aria-label={label('mobileInstall.bannerText', 'Install Lexora to save your documents')}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/40">
        <Download className="h-5 w-5 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ivory line-clamp-2">
          {label('mobileInstall.bannerText', 'Installa Lexora per salvare i tuoi documenti')}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 bg-amber-500 text-navy hover:bg-amber-400 text-xs font-medium"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? t('pwa.installing') : label('mobileInstall.installBtn', 'Installa')}
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-full p-2 text-ivory/60 hover:text-ivory hover:bg-white/10 transition-colors"
        aria-label={label('mobileInstall.dismiss', 'Close')}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
