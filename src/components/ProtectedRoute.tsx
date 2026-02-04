import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useTermsCheck } from '@/hooks/useTermsCheck';
import { TermsReacceptDialog } from '@/components/TermsReacceptDialog';
import { isAdminEmail } from '@/lib/adminConfig';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';
type AdminStatus = 'loading' | 'admin' | 'not_admin' | 'error';

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const location = useLocation();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('loading');
  const [adminStatus, setAdminStatus] = useState<AdminStatus>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Terms check hook
  const { loading: termsLoading, termsOutdated, privacyOutdated, ageNotConfirmed, needsReaccept, refresh: refreshTerms } = useTermsCheck(userId);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        
        if (cancelled) return;

        if (!session?.access_token) {
          setSessionStatus('unauthenticated');
          setUserId(null);
          return;
        }

        setSessionStatus('authenticated');
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? '');

        // Debug: log user / metadata (admin check)
        const u = session.user;
        console.log('[ProtectedRoute] user for admin check:', {
          id: u?.id,
          email: u?.email,
          user_metadata: u?.user_metadata,
          app_metadata: u?.app_metadata,
        });

        // If admin is required, check admin status (RPC reads user_roles / profiles)
        if (requireAdmin) {
          try {
            const { data: adminData, error } = await supabase.rpc('is_admin');
            if (cancelled) return;

            console.log('[ProtectedRoute] is_admin RPC result:', { adminData, error: error?.message });

            if (error) {
              console.error('[ProtectedRoute] is_admin RPC error:', error);
              // Fallback: if DB role missing (e.g. after migration), allow known admin email
              if (isAdminEmail(u?.email)) {
                console.log('[ProtectedRoute] fallback: admin by email');
                setAdminStatus('admin');
              } else {
                setAdminStatus('error');
              }
            } else if (adminData === true) {
              setAdminStatus('admin');
            } else {
              // RPC returned false: no row in user_roles. Fallback to email for known admin.
              if (isAdminEmail(u?.email)) {
                console.log('[ProtectedRoute] fallback: admin by email (RPC false)');
                setAdminStatus('admin');
              } else {
                setAdminStatus('not_admin');
              }
            }
          } catch (e) {
            console.error('[ProtectedRoute] is_admin threw:', e);
            if (!cancelled) {
              if (isAdminEmail(u?.email)) {
                console.log('[ProtectedRoute] fallback: admin by email (after throw)');
                setAdminStatus('admin');
              } else {
                setAdminStatus('error');
              }
            }
          }
        }
      } catch (e) {
        console.error('[ProtectedRoute] getSession threw:', e);
        if (!cancelled) {
          setSessionStatus('unauthenticated');
          setUserId(null);
        }
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH]', event, Boolean(session));
      
      if (!session?.access_token) {
        setSessionStatus('unauthenticated');
        setUserId(null);
        setAdminStatus('loading'); // Reset admin status
        return;
      }

      setSessionStatus('authenticated');
      setUserId(session.user.id);

      // Re-check admin status on auth change if required
      if (requireAdmin) {
        setAdminStatus('loading');
        setTimeout(async () => {
          try {
            const { data: adminData, error } = await supabase.rpc('is_admin');
            const email = session?.user?.email;
            if (error) {
              setAdminStatus(isAdminEmail(email) ? 'admin' : 'error');
            } else if (adminData === true) {
              setAdminStatus('admin');
            } else {
              setAdminStatus(isAdminEmail(email) ? 'admin' : 'not_admin');
            }
          } catch {
            setAdminStatus(isAdminEmail(session?.user?.email) ? 'admin' : 'error');
          }
        }, 0);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [requireAdmin]);

  // LOADING: session check in progress
  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // NOT AUTHENTICATED: redirect to /auth
  if (sessionStatus === 'unauthenticated') {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // TERMS CHECK: wait for terms loading
  if (termsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // TERMS OUTDATED or AGE NOT CONFIRMED: show re-accept dialog (blocks entire app)
  if (needsReaccept && userId) {
    return (
      <TermsReacceptDialog
        userId={userId}
        termsOutdated={termsOutdated}
        privacyOutdated={privacyOutdated}
        ageNotConfirmed={ageNotConfirmed}
        onAccepted={() => {
          // Refresh terms check after acceptance
          refreshTerms();
        }}
      />
    );
  }

  // ADMIN REQUIRED: do NOT redirect on error or not_admin — always render AdminPanel so page loads (no white page / redirect loop)
  if (requireAdmin) {
    if (adminStatus === 'loading') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    // error / not_admin: still render children; AdminPanel will show "Not authorized" or message
  }

  return <>{children}</>;
}
