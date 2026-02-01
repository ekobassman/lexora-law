import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { X, Smartphone } from 'lucide-react';

const DISMISSED_KEY = 'install-banner-dismissed';
const DISMISS_DAYS = 7;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone
    || document.referrer.includes('android-app://');
}

export function InstallBanner() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const handleLater = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4 bg-navy border-t border-gold/20 shadow-lg">
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/20 border border-gold/40">
          <Smartphone className="h-6 w-6 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ivory truncate">
            {t('pwa.installPrompt')}
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
          onClick={handleDismiss}
          className="p-1 text-ivory/60 hover:text-ivory shrink-0"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
