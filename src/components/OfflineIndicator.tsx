import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const { t } = useLanguage();
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500/95 py-2 px-4 text-amber-950 text-sm font-medium shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{t('pwa.offlineTitle')} — {t('pwa.offlineMessage')}</span>
    </div>
  );
}
