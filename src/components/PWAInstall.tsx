import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Share2, Plus, Check, X } from 'lucide-react';

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

    if (isIOS) {
      const onShow = () => setShowIOSModal(true);
      window.addEventListener(SHOW_IOS_EVENT, onShow);
      const timer = setTimeout(() => setShowIOSModal(true), 1500);
      return () => {
        window.removeEventListener(SHOW_IOS_EVENT, onShow);
        clearTimeout(timer);
      };
    }

    if (canInstall) {
      setShowAndroidBanner(true);
    }
  }, [canInstall, isInstalled, isIOS]);

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

  // iOS: modal guida
  return (
    <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
      <DialogContent className="bg-white border-gray-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#0f172a] font-display">
            {t('pwa.iOSGuide.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <ol className="space-y-4 text-sm text-gray-800">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 font-semibold">
                1
              </span>
              <span className="pt-0.5">
                {t('pwa.iOSGuide.step1')}{' '}
                <Share2 className="inline h-4 w-4 text-amber-600 align-middle" />
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 font-semibold">
                2
              </span>
              <span className="pt-0.5">{t('pwa.iOSGuide.step2')}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 font-semibold">
                3
              </span>
              <span className="pt-0.5">{t('pwa.iOSGuide.step3')}</span>
            </li>
          </ol>
          <div className="flex items-center gap-2 rounded-lg bg-[#0f172a]/5 p-3 text-xs text-gray-700">
            <Plus className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {t('pwa.iOSGuide.step2')} → {t('pwa.iOSGuide.step3')}
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full border-gray-300 text-[#0f172a] hover:bg-amber-50"
            onClick={handleIOSDismiss}
          >
            <Check className="mr-2 h-4 w-4" />
            {t('pwa.iOSGuide.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
