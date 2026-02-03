import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useTermsCheck } from '@/hooks/useTermsCheck';
import { TermsReacceptDialog } from '@/components/TermsReacceptDialog';

const ADMIN_EMAIL = 'imbimbo.bassman@gmail.com';

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

        // If admin is required, check admin status
        if (requireAdmin) {
          try {
            const { data: adminData, error } = await supabase.rpc('is_admin');
            if (cancelled) return;
            
            if (error) {
              console.error('[ProtectedRoute] is_admin RPC error:', error);
              setAdminStatus('error');
            } else {
              setAdminStatus(adminData === true ? 'admin' : 'not_admin');
            }
          } catch (e) {
            console.error('[ProtectedRoute] is_admin threw:', e);
            if (!cancelled) setAdminStatus('error');
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
        setAdminStatus('loading'); // Show loader while checking
        setTimeout(async () => {
          try {
            const { data: adminData, error } = await supabase.rpc('is_admin');
            if (error) {
              setAdminStatus('error');
            } else {
              setAdminStatus(adminData === true ? 'admin' : 'not_admin');
            }
          } catch {
            setAdminStatus('error');
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

  // ADMIN REQUIRED: wait for admin status
  if (requireAdmin) {
    // Still checking admin status - show loader (NO REDIRECT YET)
    if (adminStatus === 'loading') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Error checking admin (e.g., 401) - redirect to auth
    if (adminStatus === 'error') {
      return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    // Not admin - redirect to app; if admin email, show hint to run SQL in Supabase
    if (adminStatus === 'not_admin') {
      const isAdminEmail = userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (isAdminEmail) {
        toast.error('Admin role not set in database. Run the SQL script in Supabase (SQL Editor) to unlock the Admin Panel.', { duration: 8000 });
      }
      return <Navigate to="/app" replace />;
    }

    // adminStatus === 'admin' - allow through
  }

  return <>{children}</>;
}
