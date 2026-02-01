import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2, Plus, Check } from 'lucide-react';

const DISMISSED_KEY = 'ios-install-guide-dismissed';
const SHOW_EVENT = 'lexora-show-ios-install-guide';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone;
}

export function showIOSInstallGuide() {
  window.dispatchEvent(new CustomEvent(SHOW_EVENT));
}

export function IOSInstallGuide() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onShow = () => setOpen(true);
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  }, []);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-ivory border-gold/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy font-display">
            {t('pwa.iOSGuide.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <ol className="space-y-4 text-sm text-navy/90">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold font-semibold">
                1
              </span>
              <span className="pt-0.5">
                {t('pwa.iOSGuide.step1')}{' '}
                <Share2 className="inline h-4 w-4 text-gold align-middle" />
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold font-semibold">
                2
              </span>
              <span className="pt-0.5">{t('pwa.iOSGuide.step2')}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold font-semibold">
                3
              </span>
              <span className="pt-0.5">{t('pwa.iOSGuide.step3')}</span>
            </li>
          </ol>
          <div className="flex items-center gap-2 rounded-lg bg-navy/5 p-3 text-xs text-navy/80">
            <Plus className="h-4 w-4 shrink-0 text-gold" />
            <span>
              {t('pwa.iOSGuide.step2')} — {t('pwa.iOSGuide.step3')}
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full border-gold/30 text-navy hover:bg-gold/10"
            onClick={handleDismiss}
          >
            <Check className="mr-2 h-4 w-4" />
            {t('pwa.iOSGuide.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
