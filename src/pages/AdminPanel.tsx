import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Shield, User, AlertTriangle, Bug, Zap, Wifi, WifiOff, ArrowLeft, Users, UserCheck, UserPlus, Activity, RefreshCw, CreditCard, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { isAdminEmail } from '@/lib/adminConfig';

interface UserMetrics {
  totalUsers: number;
  liveUsers: number;
  activeToday: number;
  newToday: number;
  subscriptionStats: {
    total_paid: number;
    by_plan: Record<string, number>;
  };
  overrideStats: {
    total_active: number;
    by_plan: Record<string, number>;
  };
  recentUsers: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    created_at: string | null;
    last_seen_at: string | null;
    is_live: boolean;
    subscription: {
      plan_key: string;
      status: string;
    } | null;
    override: {
      plan: string;
      plan_code: string | null;
      is_active: boolean;
      reason: string | null;
    } | null;
    effective_plan: string;
    plan_source: string;
  }>;
  windowMinutes: number;
  generatedAt: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
}

interface PlanOverride {
  id: string;
  plan: string;
  plan_code?: string;
  is_active: boolean;
  reason: string | null;
  expires_at?: string | null;
}

interface UserData {
  profile: UserProfile;
  email: string;
  effectivePlan: string;
  planSource: 'override' | 'stripe' | 'free';
  override: PlanOverride | null;
  casesUsed: number;
  casesMax: number;
}

interface EntitlementsDebug {
  user_id?: string;
  is_admin?: boolean;
  override_row_exists?: boolean;
  override_is_active?: boolean;
  override_expires_at?: string | null;
  override_plan_code?: string | null;
  stripe_status?: string | null;
  stripe_plan_key?: string | null;
  env_fingerprint?: {
    supabase_url_last6?: string;
    anon_key_last6?: string;
    service_role_last6?: string;
  };
}

export default function AdminPanel() {
  const { user, loading: authLoading, session } = useAuth();
  const { entitlements, refresh: refreshEntitlements, error: entitlementsError, isLoading: entitlementsLoading } = useEntitlements();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [settingSelfOverride, setSettingSelfOverride] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<{ ok: boolean; message: string; raw?: any } | null>(null);

  const [authDebug, setAuthDebug] = useState<{
    session_exists: boolean;
    access_token_len: number;
    token_prefix: string;
    current_user_email: string | null;
  }>({
    session_exists: false,
    access_token_len: 0,
    token_prefix: '',
    current_user_email: null,
  });

  // Form state
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [isActive, setIsActive] = useState(true);
  const [reason, setReason] = useState('');

  // User Metrics state
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Legal Acceptance Events state
  interface LegalAcceptanceEvent {
    id: string;
    user_id: string;
    event_type: string;
    terms_version: string | null;
    privacy_version: string | null;
    age_policy_version: string | null;
    accepted_at: string;
    country_code: string | null;
    user_agent: string | null;
  }
  const [legalEvents, setLegalEvents] = useState<LegalAcceptanceEvent[]>([]);
  const [legalEventsLoading, setLegalEventsLoading] = useState(false);
  const [legalStats, setLegalStats] = useState<{ today: number; last7days: number }>({ today: 0, last7days: 0 });

  // Debug info from entitlements
  const debugInfo: EntitlementsDebug = (entitlements as any)?.debug || {};

  // Debug: log when admin panel mounts
  useEffect(() => {
    console.log('[AdminPanel] mounted', { user: user?.email, authLoading, checkingAdmin });
    return () => console.log('[AdminPanel] unmounted');
  }, []);

  // Auth Debug (admin-only): show session/token proof on-screen
  useEffect(() => {
    const applySession = (session: any) => {
      const token = session?.access_token ?? '';
      setAuthDebug({
        session_exists: Boolean(session),
        access_token_len: token.length,
        token_prefix: token ? token.slice(0, 12) : '',
        current_user_email: user?.email ?? null,
      });
    };

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      applySession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [user?.email]);

  // Check admin status via RPC (user_roles / profiles). Fallback to email if DB not populated (e.g. after migration).
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      // Debug: log user / metadata
      console.log('[AdminPanel] user for admin check:', {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      });

      try {
        const { data, error } = await supabase.rpc('is_admin');
        console.log('[AdminPanel] admin-check response:', { data, error: error?.message });

        if (error) {
          console.error('[AdminPanel] Admin check error:', error);
          // Fallback: known admin email when RPC fails (e.g. user_roles empty after migration)
          setIsAdmin(isAdminEmail(user?.email));
          if (isAdminEmail(user?.email)) console.log('[AdminPanel] fallback: admin by email');
        } else if (data === true) {
          setIsAdmin(true);
        } else {
          // RPC returned false: no row in user_roles. Fallback to email.
          const byEmail = isAdminEmail(user?.email);
          setIsAdmin(byEmail);
          if (byEmail) console.log('[AdminPanel] fallback: admin by email (RPC false)');
        }
      } catch (err) {
        console.error('[AdminPanel] Admin check failed:', err);
        setIsAdmin(isAdminEmail(user?.email));
        if (isAdminEmail(user?.email)) console.log('[AdminPanel] fallback: admin by email (after throw)');
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  // Only redirect to auth if not logged in; do NOT redirect non-admins — show message in panel instead (no white page)
  useEffect(() => {
    if (!authLoading && !checkingAdmin && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, checkingAdmin, navigate]);

  // Fetch user metrics from edge function
  const fetchUserMetrics = useCallback(async (showToast = false) => {
    setMetricsLoading(true);
    setMetricsError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setMetricsError('No session');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
      console.log('[AdminPanel] admin-user-metrics request:', {
        urlHint: supabaseUrl ? `${supabaseUrl.slice(0, 30)}.../functions/v1/admin-user-metrics` : 'MISSING VITE_SUPABASE_URL',
      });

      const { data, error } = await supabase.functions.invoke('admin-user-metrics', {
        headers: { Authorization: `Bearer ${token}` },
        body: { windowMinutes: 10 },
      });

      console.log('[AdminPanel] admin-user-metrics response:', { ok: data?.ok, reason: data?.reason, error, hasData: !!data });

      if (error) {
        const anyErr = error as any;
        const status = anyErr?.context?.status ?? anyErr?.status ?? '';
        const msg = error?.message ?? '';
        const isNetworkOrConfig =
          !supabaseUrl ||
          msg.includes('Failed to send') ||
          msg.includes('fetch') ||
          msg.includes('NetworkError');
        const hint = isNetworkOrConfig
          ? ' Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY) in Vercel; deploy: supabase functions deploy admin-user-metrics'
          : '';
        setMetricsError(
          status === 403 ? 'Admin only' : `Error: ${msg}${hint}`
        );
        return;
      }

      if (data?.ok === false) {
        setMetricsError(data.reason || data.message || 'Not authorized');
        return;
      }

      if (data?.error) {
        setMetricsError(`${data.error}: ${data.message || ''}`);
        return;
      }

      setUserMetrics(data);
      if (showToast) {
        toast.success('Metrics refreshed');
      }
      console.log('[admin-user-metrics] Fetched:', data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
      const hint =
        !supabaseUrl || msg.includes('fetch') || msg.includes('Failed')
          ? ' Set VITE_SUPABASE_URL and key in Vercel; run: supabase functions deploy admin-user-metrics'
          : '';
      setMetricsError(`Exception: ${msg}${hint}`);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Auto-refresh metrics every 30s when admin panel is open
  useEffect(() => {
    if (isAdmin !== true) return;

    // Initial fetch
    fetchUserMetrics();

    // Set up interval
    metricsIntervalRef.current = setInterval(() => {
      fetchUserMetrics();
    }, 30000); // 30 seconds

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [isAdmin, fetchUserMetrics]);

  // Fetch legal acceptance events
  const fetchLegalEvents = useCallback(async () => {
    setLegalEventsLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch last 25 events
      const { data: events, error } = await supabase
        .from('legal_acceptance_events')
        .select('*')
        .order('accepted_at', { ascending: false })
        .limit(25);

      if (error) {
        console.error('[AdminPanel] Error fetching legal events:', error);
        return;
      }

      setLegalEvents(events || []);

      // Calculate stats
      const todayCount = (events || []).filter(e => e.accepted_at >= todayStart).length;
      const last7Count = (events || []).filter(e => e.accepted_at >= sevenDaysAgo).length;
      setLegalStats({ today: todayCount, last7days: last7Count });
    } catch (err) {
      console.error('[AdminPanel] Exception fetching legal events:', err);
    } finally {
      setLegalEventsLoading(false);
    }
  }, []);

  // Fetch legal events when admin
  useEffect(() => {
    if (isAdmin === true) {
      fetchLegalEvents();
    }
  }, [isAdmin, fetchLegalEvents]);

  const handleForceUnlimitedServerSide = useCallback(async () => {
    if (!user) return;

    setSettingSelfOverride(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('admin-force-unlimited', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: {},
      });

      if (error) throw error;

      toast.success('Override UNLIMITED applicato (server-side). Refreshing...');

      // Immediately refresh entitlements (updates debug block)
      await refreshEntitlements();

      // Hard refresh of the function result can lag in rare cases; do a second refetch quickly.
      await refreshEntitlements();

      toast.success('Entitlements refreshed - verifica override_exists/plan_source');
      console.info('[admin-force-unlimited] Response', data);
    } catch (error) {
      console.error('Force self override error:', error);
      toast.error('Errore nel settare override (server-side)');
    } finally {
      setSettingSelfOverride(false);
    }
  }, [user, refreshEntitlements]);

  // Health Check - test if edge function is reachable (PUBLIC ping; no auth header)
  const handleHealthCheck = useCallback(async () => {
    setHealthChecking(true);
    setHealthResult(null);

    const functionName = 'admin-user-lookup';
    console.log('[AdminPanel] Health check invoke:', functionName);

    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { ping: true },
      });
      const elapsed = Date.now() - startTime;

      if (error) {
        const anyErr = error as any;
        const status = anyErr?.context?.status ?? anyErr?.status ?? '';
        const context = anyErr?.context ?? {};

        // User-visible, strict error details
        const details = `${error.message} ${String(status)} ${JSON.stringify(context)}`;
        console.error('[AdminPanel] Health check error:', details);

        setHealthResult({
          ok: false,
          message: details,
          raw: { elapsed_ms: elapsed, functionName, message: error.message, status, context },
        });
        return;
      }

      setHealthResult({
        ok: true,
        message: `200 OK (${elapsed}ms)`,
        raw: data,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const details = `Network/Endpoint error. Check function name, deploy, CORS. ${msg}`;
      console.error('[AdminPanel] Health check exception:', details);
      setHealthResult({ ok: false, message: details, raw: { functionName, exception: msg } });
    } finally {
      setHealthChecking(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      toast.error('Inserisci un email');
      return;
    }

    setSearching(true);
    setUserData(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const token = session?.access_token ?? '';

      if (sessionError || !session) {
        toast.error('Not logged in');
        setSearching(false);
        return;
      }

      if (token.length < 50) {
        toast.error(`Invalid token (len=${token.length})`);
        setSearching(false);
        return;
      }

      const emailToSearch = searchEmail.trim().toLowerCase();
      console.log('[AdminPanel] Invoking admin-user-lookup for email:', emailToSearch);

      const { data: result, error: searchError } = await supabase.functions.invoke('admin-user-lookup', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: { email: emailToSearch },
      });

      // LOG FULL RESPONSE (data + error)
      console.log('[AdminPanel] SEARCH RESPONSE:', { data: result, error: searchError });

      if (searchError) {
        const anyErr = searchError as any;
        const status = anyErr?.context?.status ?? anyErr?.status ?? '';
        const context = anyErr?.context ?? {};
        const details = `${searchError.message} ${String(status)} ${JSON.stringify(context)}`;
        console.error('[AdminPanel] Search error details:', details);
        toast.error(details);
        return;
      }

      // Function returned 200 - check ok:false (not_admin, etc.) or found flag
      if (result?.ok === false) {
        const reason = result?.reason || result?.message || 'not_authorized';
        console.log('[AdminPanel] API denied:', { reason, result });
        toast.error(reason === 'not_admin' ? 'Solo admin' : String(reason));
        return;
      }
      if (!result?.found) {
        const reason = result?.reason || 'USER_NOT_FOUND';
        const detail = result?.detail || '';
        console.log('[AdminPanel] User not found:', { reason, detail, result });
        toast.error(`User not found: ${reason}${detail ? ` (${detail})` : ''}`);
        return;
      }

      // Success - populate userData (using new response structure)
      const targetUserId = result.user?.id;
      const targetEmail = result.user?.email;
      const profile = result.profile;
      const effectivePlan = result.current_effective_plan?.plan_code || 'free';
      const planSource = result.current_effective_plan?.source_used || 'free';
      const casesUsed = result.current_effective_plan?.cases_used || 0;
      const casesMax = result.current_effective_plan?.cases_max || 1;
      const override = result.override;

      setUserData({
        profile: { id: targetUserId, full_name: profile?.full_name || null },
        email: targetEmail,
        effectivePlan,
        planSource,
        override: override
          ? {
              id: override.id,
              plan: override.plan_code,
              plan_code: override.plan_code,
              is_active: override.is_active,
              reason: override.reason,
              expires_at: override.expires_at,
            }
          : null,
        casesUsed,
        casesMax,
      });

      if (override) {
        setSelectedPlan(override.plan_code || 'free');
        setIsActive(override.is_active);
        setReason(override.reason || '');
      } else {
        setSelectedPlan('free');
        setIsActive(true);
        setReason('');
      }

      toast.success('User found');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[AdminPanel] Search exception:', error);
      toast.error(`Exception: ${msg}`);
    } finally {
      setSearching(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!userData) return;

    setSaving(true);
    try {
      // VERIFICA OBBLIGATORIA: sessione attiva nel client singleton
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('[admin-save-override] session check:', {
        hasSession: Boolean(session),
        hasAccessToken: Boolean(session?.access_token),
        tokenLen: session?.access_token?.length ?? 0,
        tokenPrefix: session?.access_token?.slice(0, 20) ?? 'none',
      });

      if (!session?.access_token) {
        toast.error('NO SESSION IN INVOKE CLIENT - rifare login');
        return;
      }

      // Pass JWT explicitly in headers
      const { data, error } = await supabase.functions.invoke('admin-save-override', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          target_user_id: userData.profile.id,
          plan_code: selectedPlan,
          is_active: isActive,
          expires_at: null,
          reason: reason || null,
        },
      });

      console.log('[admin-save-override] invoke result:', { data, error });

      if (error) {
        const anyErr = error as any;
        const statusCode = anyErr?.context?.status ?? anyErr?.status ?? 'no-status';

        // Try to extract JSON error body from the Response (so we show real server error codes)
        let serverHint = '';
        try {
          const resp: Response | undefined = anyErr?.context;
          if (resp && typeof resp === 'object' && typeof (resp as any).clone === 'function') {
            const cloned = (resp as any).clone() as Response;
            const text = await cloned.text();
            if (text) {
              try {
                const parsed = JSON.parse(text);
                serverHint = ` | ${parsed?.error ?? 'ERROR'}${parsed?.message ? `: ${parsed.message}` : ''}`;
              } catch {
                serverHint = ` | ${text.slice(0, 200)}`;
              }
            }
          }
        } catch {
          // ignore
        }

        toast.error(`Save failed (${statusCode}): ${error.message}${serverHint}`);
        return;
      }

      if (data?.error) {
        // Edge function returned error in body
        toast.error(`${data.error}: ${data.detail || ''}`);
        return;
      }

      toast.success('Override salvato');
      await handleSearch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[admin-save-override] exception', e);
      toast.error(`Errore salvataggio: ${msg.slice(0, 180)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!userData?.override) return;

    setSaving(true);
    try {
      // 1) Check session first
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        toast.error('Non loggato - impossibile rimuovere');
        console.error('[admin-remove-override] No session', sessionError);
        setSaving(false);
        return;
      }

      const token = sessionData.session.access_token;
      console.log('[admin-remove-override] Calling with token len:', token.length);

      const { data: result, error: invokeError } = await supabase.functions.invoke('admin-set-override', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          target_user_id: userData.profile.id,
          action: 'remove',
        },
      });

      // 2) Log full response for debugging
      console.log('[admin-remove-override] Response:', { data: result, error: invokeError });

      if (invokeError) {
        const anyErr = invokeError as any;
        const status = anyErr?.context?.status ?? anyErr?.status ?? 'N/A';
        const details = `${invokeError.message} (status: ${status})`;
        console.error('[admin-remove-override] Invoke error:', details);
        toast.error(`Errore rimozione: ${invokeError.message.slice(0, 150)}`);
        setSaving(false);
        return;
      }

      if (result?.ok === false) {
        const msg = result?.reason || result?.message || 'Non autorizzato';
        console.log('[admin-remove-override] API denied:', result);
        toast.error(msg);
        setSaving(false);
        return;
      }
      if (result?.error) {
        toast.error(`${result.error} (${result.code || 'UNKNOWN'})`);
        setSaving(false);
        return;
      }

      console.log('[admin-remove-override] SUCCESS:', result);
      toast.success('Override rimosso!');
      await handleSearch(); // Refresh user data

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[admin-remove-override] Exception:', error);
      toast.error(`Errore imprevisto: ${msg.slice(0, 150)}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Always render panel (no white page). If not admin, show message instead of full content.
  if (!user) {
    return null;
  }

  if (isAdmin !== true) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {isAdmin === false
                ? 'You are not authorized to view this page.'
                : 'Could not verify admin access. Please try again or run the SQL script in Supabase to grant admin.'}
            </p>
            <Button onClick={() => navigate('/app', { replace: true })} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Frontend env fingerprint
  const frontendEnv = {
    supabase_url_last6: (import.meta.env.VITE_SUPABASE_URL || '').slice(-6),
    anon_key_last6: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').slice(-6),
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Admin Panel</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app', { replace: true })}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.backToDashboard')}</span>
          </Button>
        </div>
      </header>

      <main className="container py-8 max-w-4xl space-y-6">
        {/* USER MONITORING SECTION */}
        <Card className="border-2 border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-600" />
                User Monitoring
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchUserMetrics(true)}
                disabled={metricsLoading}
                className="flex items-center gap-2"
              >
                {metricsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
            {userMetrics && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(userMetrics.generatedAt).toLocaleTimeString()} • Auto-refresh: 30s
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {metricsError && (
              <div className="p-3 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {metricsError}
              </div>
            )}

            {metricsLoading && !userMetrics && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {userMetrics && (
              <>
                {/* Metrics Cards - Row 1: User Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-card rounded-lg border shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-medium">Total Users</span>
                    </div>
                    <p className="text-2xl font-bold">{userMetrics.totalUsers}</p>
                  </div>

                  <div className="p-4 bg-card rounded-lg border shadow-sm border-green-500/50">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <Activity className="h-4 w-4" />
                      <span className="text-xs font-medium">Live Now</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{userMetrics.liveUsers}</p>
                    <p className="text-[10px] text-muted-foreground">last {userMetrics.windowMinutes} min</p>
                  </div>

                  <div className="p-4 bg-card rounded-lg border shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <UserCheck className="h-4 w-4" />
                      <span className="text-xs font-medium">Active Today</span>
                    </div>
                    <p className="text-2xl font-bold">{userMetrics.activeToday}</p>
                  </div>

                  <div className="p-4 bg-card rounded-lg border shadow-sm border-primary/50">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <UserPlus className="h-4 w-4" />
                      <span className="text-xs font-medium">New Today</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{userMetrics.newToday}</p>
                  </div>
                </div>

                {/* Metrics Cards - Row 2: Subscription & Override Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-card rounded-lg border shadow-sm border-amber-500/50">
                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-xs font-medium">Paid Subscriptions</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">{userMetrics.subscriptionStats?.total_paid || 0}</p>
                    {userMetrics.subscriptionStats?.by_plan && Object.keys(userMetrics.subscriptionStats.by_plan).length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {Object.entries(userMetrics.subscriptionStats.by_plan).map(([plan, count]) => (
                          <span key={plan} className="mr-2">{plan}: {count}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-card rounded-lg border shadow-sm border-purple-500/50">
                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                      <Crown className="h-4 w-4" />
                      <span className="text-xs font-medium">Active Overrides</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{userMetrics.overrideStats?.total_active || 0}</p>
                    {userMetrics.overrideStats?.by_plan && Object.keys(userMetrics.overrideStats.by_plan).length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {Object.entries(userMetrics.overrideStats.by_plan).map(([plan, count]) => (
                          <span key={plan} className="mr-2">{plan}: {count}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-card rounded-lg border shadow-sm col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs font-medium">Subscription Breakdown</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {userMetrics.subscriptionStats?.by_plan && Object.entries(userMetrics.subscriptionStats.by_plan).map(([plan, count]) => (
                        <Badge key={plan} variant="secondary" className="text-xs">
                          {plan}: {count}
                        </Badge>
                      ))}
                      {(!userMetrics.subscriptionStats?.by_plan || Object.keys(userMetrics.subscriptionStats.by_plan).length === 0) && (
                        <span className="text-xs text-muted-foreground">No paid subscriptions yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Users Table with Plan Info */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Recent Users (last 25) — Click email to set override
                  </h3>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Quick Override</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userMetrics.recentUsers.map((recentUser) => (
                          <TableRow key={recentUser.id}>
                            <TableCell className="font-mono text-xs">
                              <button
                                onClick={() => {
                                  setSearchEmail(recentUser.email || '');
                                  if (recentUser.email) {
                                    handleSearch();
                                  }
                                }}
                                className="text-primary hover:underline text-left"
                              >
                                {recentUser.email || '—'}
                              </button>
                            </TableCell>
                            <TableCell className="text-sm">
                              {recentUser.full_name || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={recentUser.effective_plan === 'free' ? 'secondary' : 'default'}
                                className={
                                  recentUser.effective_plan === 'unlimited' ? 'bg-purple-500 hover:bg-purple-600' :
                                  recentUser.effective_plan === 'pro' ? 'bg-amber-500 hover:bg-amber-600' :
                                  recentUser.effective_plan === 'starter' ? 'bg-blue-500 hover:bg-blue-600' :
                                  ''
                                }
                              >
                                {recentUser.effective_plan}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {recentUser.plan_source === 'override' ? (
                                <span className="text-purple-600 font-medium">🛡️ Override</span>
                              ) : recentUser.plan_source === 'stripe' ? (
                                <span className="text-green-600 font-medium">💳 Stripe</span>
                              ) : (
                                <span className="text-muted-foreground">Free</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {recentUser.is_live ? (
                                <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                  <Activity className="h-3 w-3 mr-1" />
                                  LIVE
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-muted-foreground">
                                  Offline
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={recentUser.override?.is_active ? (recentUser.override.plan_code || recentUser.override.plan) : 'none'}
                                onValueChange={async (value) => {
                                  if (value === 'none') {
                                    // Disable override
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session?.access_token) {
                                      toast.error('Session expired');
                                      return;
                                    }
                                    await supabase.functions.invoke('admin-save-override', {
                                      headers: { Authorization: `Bearer ${session.access_token}` },
                                      body: {
                                        target_user_id: recentUser.id,
                                        plan_code: recentUser.override?.plan_code || 'free',
                                        is_active: false,
                                        expires_at: null,
                                        reason: 'Disabled from admin monitor',
                                      },
                                    });
                                    toast.success('Override disabled');
                                    fetchUserMetrics(true);
                                  } else {
                                    // Set/update override
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session?.access_token) {
                                      toast.error('Session expired');
                                      return;
                                    }
                                    await supabase.functions.invoke('admin-save-override', {
                                      headers: { Authorization: `Bearer ${session.access_token}` },
                                      body: {
                                        target_user_id: recentUser.id,
                                        plan_code: value,
                                        is_active: true,
                                        expires_at: null,
                                        reason: 'Set from admin monitor',
                                      },
                                    });
                                    toast.success(`Override set to ${value}`);
                                    fetchUserMetrics(true);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No Override</SelectItem>
                                  <SelectItem value="starter">Starter</SelectItem>
                                  <SelectItem value="pro">Pro</SelectItem>
                                  <SelectItem value="unlimited">Unlimited</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                        {userMetrics.recentUsers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No users found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* LEGAL ACCEPTANCE EVENTS SECTION */}
        <Card className="border-2 border-green-500/50 bg-green-50/30 dark:bg-green-950/20">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-green-600" />
                Legal Acceptance Audit
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLegalEvents}
                disabled={legalEventsLoading}
                className="flex items-center gap-2"
              >
                {legalEventsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs font-medium">Today</span>
                </div>
                <p className="text-2xl font-bold">{legalStats.today}</p>
              </div>
              <div className="p-4 bg-card rounded-lg border shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs font-medium">Last 7 Days</span>
                </div>
                <p className="text-2xl font-bold">{legalStats.last7days}</p>
              </div>
            </div>

            {/* Events Table */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Terms Ver</TableHead>
                    <TableHead>Privacy Ver</TableHead>
                    <TableHead>Age Ver</TableHead>
                    <TableHead>Accepted At</TableHead>
                    <TableHead>Country</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {legalEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-xs">{event.user_id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant={event.event_type === 'signup_accept' ? 'default' : 'secondary'}>
                          {event.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{event.terms_version || '-'}</TableCell>
                      <TableCell className="text-xs">{event.privacy_version || '-'}</TableCell>
                      <TableCell className="text-xs">{event.age_policy_version || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(event.accepted_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{event.country_code || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {legalEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No legal acceptance events found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ENTITLEMENTS DEBUG BLOCK */}
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bug className="h-5 w-5 text-primary" />
              Entitlements Debug (Your Account)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">user_id:</span>
                <p className="font-mono text-xs break-all">{debugInfo.user_id || user.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground">is_admin:</span>
                <p className={debugInfo.is_admin ? 'text-green-600 font-bold' : 'text-red-600'}>{String(debugInfo.is_admin ?? isAdmin)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">effective_plan:</span>
                <p className="font-bold text-lg uppercase">{entitlements.plan}</p>
              </div>
              <div>
                <span className="text-muted-foreground">plan_source:</span>
                <p className={`font-bold ${
                  (entitlements as any).plan_source === 'override' ? 'text-primary' :
                  (entitlements as any).plan_source === 'stripe' ? 'text-green-600' : 'text-muted-foreground'
                }`}>
                  {(entitlements as any).plan_source || 'unknown'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">override_row_exists:</span>
                <p className={debugInfo.override_row_exists ? 'text-green-600' : 'text-red-600'}>{String(debugInfo.override_row_exists ?? false)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">override_is_active:</span>
                <p className={debugInfo.override_is_active ? 'text-green-600' : 'text-muted-foreground'}>{String(debugInfo.override_is_active ?? false)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">override_expires_at:</span>
                <p>{debugInfo.override_expires_at ?? 'null (no expiry)'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">override_plan_code:</span>
                <p>{debugInfo.override_plan_code ?? 'null'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">stripe_status:</span>
                <p>{debugInfo.stripe_status ?? 'null'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">stripe_plan_key:</span>
                <p>{debugInfo.stripe_plan_key ?? 'null'}</p>
              </div>
            </div>

            {/* ENV FINGERPRINT COMPARISON */}
            <div className="border-t pt-3">
              {/* Entitlements fetch status */}
              {entitlementsError && (
                <p className="text-destructive text-xs mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Entitlements Error: {entitlementsError}
                </p>
              )}
              {entitlementsLoading && (
                <p className="text-muted-foreground text-xs mb-2">Loading entitlements...</p>
              )}

              <p className="text-xs text-muted-foreground mb-2">Project URL Fingerprint (must match exactly):</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Frontend URL:</span> {frontendEnv.supabase_url_last6}
                </div>
                <div>
                  <span className="text-muted-foreground">Backend URL:</span>{' '}
                  {debugInfo.env_fingerprint?.supabase_url_last6
                    ? debugInfo.env_fingerprint.supabase_url_last6
                    : entitlementsError
                      ? '(entitlements call failed - auth issue?)'
                      : entitlementsLoading
                        ? '(loading...)'
                        : 'MISSING ENV'}
                </div>
              </div>

              {debugInfo.env_fingerprint?.supabase_url_last6 &&
                frontendEnv.supabase_url_last6 !== debugInfo.env_fingerprint?.supabase_url_last6 && (
                  <p className="text-destructive text-xs mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> URL MISMATCH - reading different DB!
                  </p>
                )}

              {!debugInfo.env_fingerprint?.supabase_url_last6 && !entitlementsError && !entitlementsLoading && (
                <p className="text-destructive text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Backend env missing — functions cannot read your DB.
                </p>
              )}

              {!debugInfo.env_fingerprint?.supabase_url_last6 && entitlementsError && (
                <p className="text-amber-500 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Entitlements call failed (401 = session issue, not env issue). Try logging out and back in.
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-3 mb-1">Key Fingerprints (may differ: anon vs service role):</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Frontend (ANON):</span> {frontendEnv.anon_key_last6}
                </div>
                <div>
                  <span className="text-muted-foreground">Backend (SVC):</span>{' '}
                  {debugInfo.env_fingerprint?.service_role_last6
                    ? debugInfo.env_fingerprint.service_role_last6
                    : entitlementsError
                      ? '(n/a)'
                      : 'MISSING'}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Note: Key mismatch is expected (anon vs service role).</p>
            </div>

            {/* TEMPORARY ADMIN-ONLY BUTTON (SERVER-SIDE UPSERT) */}
            <Button
              onClick={handleForceUnlimitedServerSide}
              disabled={settingSelfOverride}
              className="w-full"
            >
              {settingSelfOverride ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              FORCE UNLIMITED FOR MY ACCOUNT (NO EXPIRY)
            </Button>
          </CardContent>
        </Card>

        {/* Auth Debug (admin-only proof) */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Auth Debug (client)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">session_exists:</span>
              <p className="font-mono">{String(authDebug.session_exists)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">access_token_len:</span>
              <p className="font-mono">{authDebug.access_token_len}</p>
            </div>
            <div>
              <span className="text-muted-foreground">token_prefix:</span>
              <p className="font-mono">{authDebug.token_prefix || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">current_user_email:</span>
              <p className="font-mono break-all">{authDebug.current_user_email || '—'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Health Check Section */}
        <Card className="border border-amber-500/50 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {healthResult?.ok ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-amber-600" />}
              Edge Function Health Check
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Test if admin-user-lookup function is deployed and reachable before searching.
            </p>
            <Button
              onClick={handleHealthCheck}
              disabled={healthChecking}
              variant="outline"
              className="w-full"
            >
              {healthChecking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Test Function (ping)
            </Button>
            {healthResult && (
              <div className={`p-3 rounded text-sm ${healthResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <p className="font-medium">{healthResult.ok ? '✅ ' : '❌ '}{healthResult.message}</p>
                {healthResult.raw && (
                  <pre className="mt-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(healthResult.raw, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Cerca utente (per assegnare override)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Email utente"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cerca'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Result */}
        {userData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Risultato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{userData.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-mono text-xs">{userData.profile.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Piano effettivo</p>
                  <p className="font-medium capitalize">{userData.effectivePlan}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fonte piano</p>
                  <p className={`font-medium ${
                    userData.planSource === 'override' ? 'text-primary' :
                    userData.planSource === 'stripe' ? 'text-green-600' : 'text-muted-foreground'
                  }`}>
                    {userData.planSource === 'override' ? '🛡️ Admin Override' :
                     userData.planSource === 'stripe' ? '💳 Stripe' : '🆓 Free'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Casi usati</p>
                  <p className="font-medium">{userData.casesUsed} / {userData.casesMax}</p>
                </div>
                {userData.override && (
                  <div>
                    <p className="text-sm text-muted-foreground">Override attivo</p>
                    <p className={`font-medium ${userData.override.is_active ? 'text-green-600' : 'text-red-600'}`}>
                      {userData.override.is_active ? '✅ Sì' : '❌ No'}
                    </p>
                  </div>
                )}
              </div>

              {/* Override Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Imposta piano (override)</Label>
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (1 caso)</SelectItem>
                      <SelectItem value="starter">Starter (10 casi)</SelectItem>
                      <SelectItem value="pro">Pro (50 casi)</SelectItem>
                      <SelectItem value="unlimited">Unlimited (∞ casi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Override attivo</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                <div className="space-y-2">
                  <Label>Motivo (opzionale)</Label>
                  <Textarea
                    placeholder="Es: Beta tester, partner, supporto..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleSaveOverride} disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salva override'}
                  </Button>
                  {userData.override && userData.override.is_active && (
                    <Button
                      variant="destructive"
                      onClick={handleRemoveOverride}
                      disabled={saving}
                    >
                      Rimuovi
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mobile bottom back button */}
        <div className="sm:hidden pt-8 pb-4">
          <Button
            variant="outline"
            onClick={() => navigate('/app', { replace: true })}
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('admin.backToDashboard')}
          </Button>
        </div>
      </main>
    </div>
  );
}
