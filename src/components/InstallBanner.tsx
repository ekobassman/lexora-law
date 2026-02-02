import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePWA } from '@/hooks/usePWA';
import { showIOSInstallGuide } from '@/components/IOSInstallGuide';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'install-banner-dismissed';
const DISMISS_FOREVER_KEY = 'install-banner-dismissed-forever';

function shouldShowBanner(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(DISMISS_FOREVER_KEY) === '1') return false;
  const dismissedAt = localStorage.getItem(DISMISSED_KEY);
  if (dismissedAt) {
    const days = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
    if (days < 7) return false;
  }
  return true;
}

export function InstallBanner() {
  const { t } = useLanguage();
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWA();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInstalled || !shouldShowBanner()) return;

    // Android: show when canInstall (beforeinstallprompt fired)
    if (canInstall) {
      setVisible(true);
      return;
    }

    // iOS: show banner that opens guide on click (IOSInstallGuide has its own auto-popup)
    if (isIOS) {
      setVisible(true);
    }
  }, [canInstall, isInstalled, isIOS]);

  const handleInstall = async () => {
    if (isIOS) {
      showIOSInstallGuide();
      setVisible(false);
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
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const handleDismissForever = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_FOREVER_KEY, '1');
  };

  const handleLater = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (!visible) return null;

  // Android: bottom banner with app icon + "Installa Lexora" + Install button
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4 bg-navy border-t border-gold/20 shadow-lg">
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/20 border border-gold/40 overflow-hidden">
          <img
            src="/icons/icon-192x192.png"
            alt="Lexora"
            className="h-10 w-10 object-contain"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ivory">
            {t('pwa.installPrompt')}
          </p>
          <p className="text-xs text-ivory/60 mt-0.5">
            {isIOS ? t('pwa.iOSGuide.title') : t('pwa.installPrompt')}
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              className="bg-gold text-navy hover:bg-gold/90"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? t('pwa.installing') : t('pwa.installButton')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-ivory/70 hover:text-ivory"
              onClick={handleLater}
            >
              {t('pwa.installLater')}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismissForever}
          className="p-1.5 text-ivory/60 hover:text-ivory shrink-0 rounded-full hover:bg-ivory/10 transition-colors"
          aria-label="Close"
          title={t('pwa.installLater')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
