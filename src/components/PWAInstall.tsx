import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePWA } from '@/hooks/usePWA';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Share2, X, Plus } from 'lucide-react';

const SHOW_IOS_EVENT = 'pwa-install-show-ios-guide';
const SNOOZE_KEY = 'pwa-snooze-last-dismissed';
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 ore

function isSnoozeActive(): boolean {
  const raw = localStorage.getItem(SNOOZE_KEY);
  if (!raw) return false;
  const last = parseInt(raw, 10);
  if (Number.isNaN(last)) return false;
  return Date.now() - last < SNOOZE_MS;
}

export function showIOSInstallGuide() {
  window.dispatchEvent(new CustomEvent(SHOW_IOS_EVENT));
}

export function PWAInstall() {
  const { t } = useLanguage();
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWA();
  const isMobile = useIsMobile();
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Pulizia snooze quando l'utente installa l'app
  useEffect(() => {
    if (isInstalled) {
      localStorage.removeItem(SNOOZE_KEY);
    }
  }, [isInstalled]);

  useEffect(() => {
    if (isInstalled) return;
    if (isSnoozeActive()) return;

    // iOS (iPhone/iPad): modal dopo 1.5s
    if (isIOS) {
      const onShow = () => setShowIOSModal(true);
      window.addEventListener(SHOW_IOS_EVENT, onShow);
      const timer = setTimeout(() => setShowIOSModal(true), 1500);
      return () => {
        window.removeEventListener(SHOW_IOS_EVENT, onShow);
        clearTimeout(timer);
      };
    }

    // Android mobile: banner in fondo solo su dispositivo mobile (mai su desktop)
    if (canInstall && isMobile) {
      setShowAndroidBanner(true);
    }
  }, [canInstall, isInstalled, isIOS, isMobile]);

  const handleAndroidInstall = async () => {
    if (!canInstall) return;
    setInstalling(true);
    try {
      const accepted = await triggerInstall();
      if (accepted) setShowAndroidBanner(false);
    } finally {
      setInstalling(false);
    }
  };

  const handleAndroidDismiss = () => {
    setShowAndroidBanner(false);
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  };

  const handleIOSDismiss = () => {
    setShowIOSModal(false);
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  };

  const handleIOSOpenChange = (open: boolean) => {
    setShowIOSModal(open);
    if (!open) localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  };

  if (isInstalled) return null;

  // Android: bottom banner
  if (showAndroidBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[#0f172a] border-t border-white/20 shadow-lg">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 overflow-hidden">
            <img
              src="/icons/icon-192x192.png"
              alt="Lexora"
              className="h-10 w-10 object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              {t('pwa.installPrompt')}
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="bg-amber-500 text-[#0f172a] hover:bg-amber-400"
                onClick={handleAndroidInstall}
                disabled={installing}
              >
                {installing ? t('pwa.installing') : t('pwa.installButton')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={handleAndroidDismiss}
              >
                {t('pwa.installLater')}
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAndroidDismiss}
            className="p-2 text-white/60 hover:text-white shrink-0 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  const handleIOSAddToHome = () => {
    handleIOSDismiss();
    toast(t('pwa.iOSGuide.hint'));
  };

  // iOS: modal guida (bottom sheet stile iOS nativo)
  return (
    <Dialog open={showIOSModal} onOpenChange={handleIOSOpenChange}>
      <DialogContent
        className="fixed left-0 right-0 top-auto bottom-0 translate-x-0 translate-y-0 max-w-none w-full rounded-t-3xl rounded-b-none border-0 bg-white shadow-2xl p-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
        hideCloseButton
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
        </div>

        {/* X in alto a destra */}
        <button
          type="button"
          onClick={handleIOSDismiss}
          className="absolute right-4 top-4 z-10 p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label="Chiudi"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-2">
            <img
              src="/icons/icon-192x192.png"
              alt="Lexora"
              className="h-14 w-14 rounded-2xl object-contain shrink-0"
            />
            <h2 className="text-2xl font-bold text-gray-900">
              {t('pwa.iOSGuide.installTitle') || t('pwa.iOSGuide.title')}
            </h2>
            <p className="text-sm text-gray-500 max-w-[280px]">
              {t('pwa.iOSGuide.subtitle')}
            </p>
          </div>

          {/* Area principale: illustrazione Share */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative flex items-center justify-center">
              <svg
                className="absolute -left-8 top-1/2 -translate-y-1/2 w-10 h-6 text-gray-400"
                viewBox="0 0 40 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12h28M30 12l-6-5v3H2" />
                <path d="M24 7l6 5-6 5" />
              </svg>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 border border-gray-200">
                <Share2 className="h-8 w-8 text-gray-600" strokeWidth={2} />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500 text-center">
              {t('pwa.iOSGuide.shareHint') || t('pwa.iOSGuide.hint')}
            </p>
          </div>

          {/* Bottone Azione (stile iOS) */}
          <div className="px-0 pb-0 pt-2">
            <button
              type="button"
              onClick={handleIOSAddToHome}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-100 text-gray-900 p-4 font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              <Plus className="h-5 w-5 shrink-0" />
              {t('pwa.iOSGuide.addToHomeButton')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
