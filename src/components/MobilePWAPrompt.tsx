import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePWA } from '@/hooks/usePWA';
import { showIOSInstallGuide } from '@/components/PWAInstall';
import { MobileSaveDocumentPWA } from '@/components/MobileSaveDocumentPWA';
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
 * Fixed bottom banner on mobile only (md:hidden). Prompts PWA install.
 * Shows when: already can install / iOS, or after 3s on mobile viewport.
 * Hidden when installed or user dismissed (localStorage).
 */
export function MobilePwaBanner() {
  const { t } = useLanguage();
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWA();
  const [showBanner, setShowBanner] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setShowBanner(false);
      return;
    }

    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY)) {
      setShowBanner(false);
      return;
    }

    // Show immediately if we have install capability or iOS
    if (canInstall || isIOS) {
      setShowBanner(true);
      return;
    }

    // Otherwise show after 3s on mobile viewport
    const timer = setTimeout(() => {
      if (window.innerWidth < 768) setShowBanner(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [canInstall, isIOS]);

  useEffect(() => {
    if (isInstalled) setShowBanner(false);
  }, [isInstalled]);

  const handleInstall = async () => {
    if (isIOS) {
      showIOSInstallGuide();
      return;
    }
    if (canInstall) {
      setInstalling(true);
      try {
        const accepted = await triggerInstall();
        if (accepted) setShowBanner(false);
      } finally {
        setInstalling(false);
      }
      return;
    }
    // Fallback: scroll to PWA install section or show instructions
    const pwaSection = document.getElementById('install-app');
    if (pwaSection) {
      pwaSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-amber-500/40 bg-navy shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="banner"
      aria-label={label('mobileInstall.bannerText', 'Install Lexora to save your documents')}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/40">
          <Download className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ivory line-clamp-2">
            {label('mobileInstall.bannerText', 'Install Lexora to save your documents')}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 bg-amber-500 text-navy hover:bg-amber-400 text-xs font-medium"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? t('pwa.installing') : label('mobileInstall.installBtn', 'Install')}
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
    </div>
  );
}

export interface MobileDocumentPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Document-generated install prompt (isOpen/onClose API).
 * Shown when a document is generated on mobile and app is not installed.
 * Use with: documentGenerated && innerWidth < 768 && !standalone → setShowInstallPrompt(true).
 */
export function MobileDocumentPrompt({ isOpen, onClose }: MobileDocumentPromptProps) {
  return (
    <MobileSaveDocumentPWA
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onContinue={onClose}
    />
  );
}
