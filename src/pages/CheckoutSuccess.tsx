import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncSubscription } from '@/hooks/useSyncSubscription';
import { useCredits } from '@/hooks/useCredits';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [500, 1000, 2000, 4000, 8000]; // exponential backoff

export default function CheckoutSuccess() {
  const { session, user, loading: authLoading } = useAuth();
  const { syncSubscription } = useSyncSubscription();
  const { refresh: refreshCredits } = useCredits();
  const { refreshEntitlements } = useEntitlements();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const syncAttemptedRef = useRef(false);

  const performSync = useCallback(async () => {
    if (!session?.access_token) {
      console.log('[CheckoutSuccess] No session, waiting...');
      return false;
    }

    try {
      console.log('[CheckoutSuccess] Syncing subscription, attempt', retryCount + 1);
      const result = await syncSubscription(true); // force sync
      
      if (result) {
        console.log('[CheckoutSuccess] Sync successful, refreshing data');
        // Refresh both credits and entitlements to update UI
        await Promise.all([
          refreshCredits(),
          refreshEntitlements(),
        ]);
        setStatus('success');
        return true;
      } else {
        throw new Error('Sync returned false');
      }
    } catch (err: any) {
      console.error('[CheckoutSuccess] Sync failed:', err);
      setErrorMessage(err.message || 'Sincronizzazione fallita');
      return false;
    }
  }, [session?.access_token, syncSubscription, refreshCredits, refreshEntitlements, retryCount]);

  const retrySync = useCallback(async () => {
    setStatus('loading');
    setRetryCount(prev => prev + 1);
    const success = await performSync();
    if (!success && retryCount < MAX_RETRIES - 1) {
      const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
      console.log(`[CheckoutSuccess] Retry ${retryCount + 1} failed, waiting ${delay}ms`);
      setTimeout(() => retrySync(), delay);
    } else if (!success) {
      setStatus('error');
    }
  }, [performSync, retryCount]);

  // Initial sync attempt
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Not logged in, redirect to login
      navigate('/login');
      return;
    }
    if (syncAttemptedRef.current) return;
    syncAttemptedRef.current = true;

    const startSync = async () => {
      const success = await performSync();
      if (!success) {
        // Start retry loop
        retrySync();
      }
    };

    // Small delay to ensure Stripe webhook has processed
    const timer = setTimeout(startSync, 1000);
    return () => clearTimeout(timer);
  }, [authLoading, user, navigate, performSync, retrySync]);

  // Auto-redirect on success after 2 seconds
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        navigate('/app');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="bg-ivory rounded-2xl shadow-premium p-8 max-w-md w-full text-center space-y-6">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 text-gold animate-spin mx-auto" />
            <h1 className="text-2xl font-display font-medium text-navy">
              {t('checkout.syncing', 'Aggiorno il tuo piano…')}
            </h1>
            <p className="text-navy/60">
              {t('checkout.pleaseWait', 'Attendere prego, stiamo sincronizzando il tuo abbonamento.')}
            </p>
            {retryCount > 0 && (
              <p className="text-sm text-navy/50">
                {t('checkout.retryCount', 'Tentativo {{count}} di {{max}}', { count: retryCount + 1, max: MAX_RETRIES })}
              </p>
            )}
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <h1 className="text-2xl font-display font-medium text-navy">
              {t('checkout.success', 'Piano aggiornato!')}
            </h1>
            <p className="text-navy/60">
              {t('checkout.redirecting', 'Reindirizzamento alla dashboard…')}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-display font-medium text-navy">
              {t('checkout.syncFailed', 'Sincronizzazione non riuscita')}
            </h1>
            <p className="text-navy/60">
              {t('checkout.syncFailedDesc', 'Non siamo riusciti a sincronizzare il tuo piano. Non preoccuparti, il pagamento è andato a buon fine.')}
            </p>
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <div className="space-y-3 pt-2">
              <Button 
                onClick={() => {
                  setRetryCount(0);
                  syncAttemptedRef.current = false;
                  setStatus('loading');
                  retrySync();
                }}
                className="w-full gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {t('checkout.retry', 'Riprova')}
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/app')}
                className="w-full"
              >
                {t('checkout.goToDashboard', 'Vai alla dashboard')}
              </Button>
              <p className="text-xs text-navy/50">
                {t('checkout.contactSupport', 'Se il problema persiste, contatta il supporto.')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
