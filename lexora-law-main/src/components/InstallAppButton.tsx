import { useLanguage } from '@/contexts/LanguageContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { showIOSInstallGuide } from '@/components/IOSInstallGuide';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Download, Check } from 'lucide-react';
import { useState } from 'react';

export function InstallAppButton({ variant = 'dropdown' }: { variant?: 'dropdown' | 'menu' }) {
  const { t } = useLanguage();
  const { canInstall, isStandalone, isIOS, triggerInstall } = usePWAInstall();
  const [installing, setInstalling] = useState(false);

  const handleClick = async () => {
    if (isIOS) {
      showIOSInstallGuide();
      return;
    }
    if (canInstall) {
      setInstalling(true);
      try {
        await triggerInstall();
      } finally {
        setInstalling(false);
      }
    }
  };

  if (isStandalone) {
    if (variant === 'menu') {
      return (
        <div className="flex items-center gap-2 py-2 text-ivory/60 text-sm">
          <Check className="h-4 w-4 text-green-500 shrink-0" />
          {t('pwa.alreadyInstalled')}
        </div>
      );
    }
    return (
      <DropdownMenuItem disabled className="text-navy/60 cursor-default">
        <Check className="mr-2 h-4 w-4 text-green-500" />
        {t('pwa.alreadyInstalled')}
      </DropdownMenuItem>
    );
  }

  if (!canInstall && !isIOS) return null;

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        className="flex items-center gap-2 py-2 text-ivory/70 hover:text-gold transition-colors text-sm font-medium text-left w-full"
      >
        <Download className="h-4 w-4 shrink-0" />
        {installing ? t('pwa.installing') : t('pwa.installButton')}
      </button>
    );
  }

  return (
    <DropdownMenuItem onClick={handleClick} className="text-navy hover:bg-gold/10" disabled={installing}>
      <Download className="mr-2 h-4 w-4" />
      {installing ? t('pwa.installing') : t('pwa.installButton')}
    </DropdownMenuItem>
  );
}
