import { useState, useEffect, useCallback } from 'react';

export type DeviceType = 'ios' | 'android' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isAndroid(): boolean {
  return /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();
    setInstalled(standalone);

    if (isIOS()) {
      setDevice('ios');
    } else if (isAndroid()) {
      setDevice('android');
    } else {
      setDevice('desktop');
    }

    if (standalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = useCallback(async (): Promise<boolean | null> => {
    if (installed) return null;
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        return outcome === 'accepted';
      } catch {
        return false;
      }
    }
    return null;
  }, [deferredPrompt, installed]);

  return {
    canInstall: canInstall && !installed,
    isInstalled: installed,
    isStandalone: installed,
    isIOS: device === 'ios',
    isAndroid: device === 'android',
    isDesktop: device === 'desktop',
    device,
    triggerInstall,
    deferredPrompt,
  };
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
