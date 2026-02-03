import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePWA } from '@/hooks/usePWA';
import { showIOSInstallGuide } from '@/components/PWAInstall';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Download, X } from 'lucide-react';
import i18n from '@/i18n';

function label(key: string, fallback: string): string {
  const v = i18n.t(key);
  if (!v || v === key || String(v).startsWith('mobileInstall.')) return fallback;
  return String(v);
}

interface MobileSaveDocumentPWAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
}

/**
 * Bottom-sheet modal on MOBILE ONLY shown after user generates a document in demo.
 * Invites to install PWA to save and access offline.
 */
export function MobileSaveDocumentPWA({ open, onOpenChange, onContinue }: MobileSaveDocumentPWAProps) {
  const { t } = useLanguage();
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePWA();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    if (isIOS) {
      showIOSInstallGuide();
      onOpenChange(false);
      return;
    }
    if (!canInstall) {
      onOpenChange(false);
      return;
    }
    setInstalling(true);
    try {
      const accepted = await triggerInstall();
      if (accepted) onOpenChange(false);
    } finally {
      setInstalling(false);
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed left-0 right-0 top-auto bottom-0 translate-x-0 translate-y-0 max-w-none w-full rounded-t-2xl rounded-b-none border-t-2 border-amber-500/50 bg-navy shadow-2xl p-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 sm:hidden md:hidden"
        hideCloseButton
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-amber-500/40" aria-hidden />
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 p-2 rounded-full text-ivory/60 hover:text-ivory hover:bg-white/10 transition-colors"
          aria-label={label('mobileInstall.dismiss', 'Close')}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="px-6 pb-8 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40">
              <Download className="h-7 w-7 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-ivory">
              {label('mobileInstall.saveDocumentTitle', 'Hai generato un documento!')}
            </h2>
            <p className="text-sm text-ivory/70">
              {label('mobileInstall.saveDocumentDesc', 'Installa l\'app per salvarlo e accedervi offline.')}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              className="w-full bg-amber-500 text-navy hover:bg-amber-400 font-medium"
              onClick={handleInstall}
              disabled={installing || isInstalled}
            >
              <Download className="mr-2 h-4 w-4" />
              {installing ? t('pwa.installing') : label('mobileInstall.installApp', 'Installa App')}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-ivory/80 hover:text-ivory hover:bg-white/10"
              onClick={handleContinue}
            >
              {label('mobileInstall.continueWeb', 'Continua sul web')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
