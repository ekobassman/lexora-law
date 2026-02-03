import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PING_PATH = '/manifest.json';
const PING_TIMEOUT_MS = 5000;

/** Verifica reale connettività (fetch + timeout). navigator.onLine non è affidabile. */
async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const url = `${PING_PATH}?ping=${Date.now()}`;
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export function OfflineIndicator() {
  const { t } = useLanguage();
  const [confirmedOffline, setConfirmedOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    const ok = await checkConnectivity();
    setConfirmedOffline(!ok);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    // All'avvio: NON mostrare offline subito. Solo se il browser dice offline, fare check reale dopo 500ms.
    if (typeof navigator === 'undefined') return;
    if (navigator.onLine) {
      setConfirmedOffline(false);
      return;
    }
    const timeoutId = setTimeout(() => runCheck(), 500);
    return () => clearTimeout(timeoutId);
  }, [runCheck]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onOnline = () => {
      setConfirmedOffline(false);
      runCheck();
    };

    const onOffline = () => {
      // Non mostrare subito "offline": verificare con fetch (5s timeout)
      runCheck();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [runCheck]);

  const handleRetry = () => {
    runCheck();
  };

  if (!confirmedOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 bg-amber-500/95 py-2 px-4 text-amber-950 text-sm font-medium shadow-md safe-area-top">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">
        {t('pwa.offlineTitle')} — {t('pwa.offlineMessage')}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-700/50 bg-amber-50 hover:bg-amber-100 text-amber-900 h-8"
        onClick={handleRetry}
        disabled={isChecking}
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${isChecking ? 'animate-spin' : ''}`} />
        {t('pwa.retry') || t('common.retry') || 'Riprova'}
      </Button>
    </div>
  );
}
