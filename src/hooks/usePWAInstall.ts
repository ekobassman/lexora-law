import { useState, useEffect, useCallback } from 'react';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone
    || document.referrer.includes('android-app://');
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setIsStandaloneMode(isStandalone());
    setIsIOSDevice(isIOS());
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (isStandaloneMode) return null;
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      return outcome === 'accepted';
    }
    return null;
  }, [deferredPrompt, isStandaloneMode]);

  return {
    canInstall: canInstall && !isStandaloneMode,
    isStandalone: isStandaloneMode,
    isIOS: isIOSDevice,
    triggerInstall,
  };
}
