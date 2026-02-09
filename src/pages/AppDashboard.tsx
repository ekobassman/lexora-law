import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanState } from '@/hooks/usePlanState';
import { useSyncSubscription } from '@/hooks/useSyncSubscription';
import { useEntitlements } from '@/hooks/useEntitlements';
import { supabase } from '@/lib/supabaseClient';
import {
  FileText,
  Loader2,
  Trash2,
  FolderOpen,
  Zap,
  Mail,
  Scale,
  Brain,
  Lock,
  Coins,
  TrendingUp,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppHeader } from '@/components/AppHeader';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { PricingThumbnails } from '@/components/PricingThumbnails';
import { DashboardAIChat } from '@/components/DashboardAIChat';
import { LegalLoader } from '@/components/LegalLoader';
import { LegalAcceptanceGate } from '@/components/legal/LegalAcceptanceGate';
import { trackSignupConversion } from '@/lib/ads';
import { PaymentPastDueStrip } from '@/components/PaymentPastDueStrip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Pratica {
  id: string;
  title: string;
  authority: string | null;
  aktenzeichen: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  draft_response: string | null;
}

export default function AppDashboard() {
  const { t, isRTL } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  
  // Use UNIFIED plan state as single source of truth
  const { 
    planState, 
    isLoading: planLoading, 
    isReady: planReady, 
    isPaid,
    refresh: refreshPlanState,
    triggerSync
  } = usePlanState();
  
  // Legacy entitlements for features/actions that still need it
  const { 
    entitlements, 
    refreshEntitlements, 
    error: entitlementsError 
  } = useEntitlements();
  
  const { syncSubscription } = useSyncSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [pratiche, setPratiche] = useState<Pratica[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const syncCalledRef = useRef(false);
  const diagnosticLoggedRef = useRef(false);
  const conversionTrackedRef = useRef(false);

  // Get selected case title
  const selectedCaseTitle = useMemo(() => {
    if (!selectedCaseId) return null;
    const found = pratiche.find(p => p.id === selectedCaseId);
    return found?.title || null;
  }, [selectedCaseId, pratiche]);

  // DIAGNOSTIC LOGGING (as required)
  useEffect(() => {
    if (planReady && user && !diagnosticLoggedRef.current) {
      diagnosticLoggedRef.current = true;
      console.log('[AppDashboard] PLAN STATE DIAGNOSTIC:', {
        userId: user.id,
        planState: {
          plan: planState.plan,
          monthly_case_limit: planState.monthly_case_limit,
          cases_remaining: planState.cases_remaining,
          cases_used_this_month: planState.cases_used_this_month,
          messages_per_case: planState.messages_per_case,
          is_active: planState.is_active,
        },
        entitlementsPlan: entitlements.plan,
        isPaid,
        planReady,
      });
    }
  }, [planReady, user, planState, entitlements.plan, isPaid]);

  // Track Google Ads signup conversion on first dashboard access
  useEffect(() => {
    if (user && !conversionTrackedRef.current) {
      conversionTrackedRef.current = true;
      trackSignupConversion();
    }
  }, [user]);
  const urgentUnlocked = planReady && isPaid;

  // Parse checkout params from URL
  const checkoutParams = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const status = sp.get('checkout');
    const desiredPlan = sp.get('plan');
    return {
      status,
      desiredPlan,
      hasCheckoutFlag: status === 'success' || status === 'cancelled',
    };
  }, [location.search]);

  // Quick action cards - urgent reply is gated by entitlements (single source of truth)
  const quickActionCards = [
    {
      icon: urgentUnlocked ? Zap : Lock,
      titleKey: 'dashboard.actions.urgent.title',
      descKey: 'dashboard.actions.urgent.desc',
      buttonKey: urgentUnlocked ? 'dashboard.actions.urgent.button' : 'landing.actions.urgent.locked',
      color: urgentUnlocked ? 'text-amber-500' : 'text-muted-foreground',
      bgColor: urgentUnlocked ? 'bg-amber-500/10' : 'bg-muted',
      link: urgentUnlocked ? '/scan' : '/pricing',
      locked: !urgentUnlocked,
    },
    {
      icon: Mail,
      titleKey: 'dashboard.actions.read.title',
      descKey: 'dashboard.actions.read.desc',
      buttonKey: 'dashboard.actions.read.button',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      link: '/scan',
      locked: false,
    },
    {
      icon: Scale,
      titleKey: 'dashboard.actions.appeal.title',
      descKey: 'dashboard.actions.appeal.desc',
      buttonKey: 'dashboard.actions.appeal.button',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      link: '/scan',
      locked: false,
    },
    {
      icon: Brain,
      titleKey: 'dashboard.actions.explain.title',
      descKey: 'dashboard.actions.explain.desc',
      buttonKey: 'dashboard.actions.explain.button',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      link: '/scan',
      locked: false,
    },
  ];

  // Status badge styles
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return { className: 'bg-gold text-navy', label: t('status.new') };
      case 'in_progress':
        return { className: 'bg-gold/20 text-gold border border-gold/30', label: t('status.in_progress') };
      case 'ready_to_send':
        return { className: 'bg-gold/20 text-gold border border-gold/30', label: t('status.readyToSend') };
      case 'sent':
        return { className: 'bg-graphite text-ivory', label: t('status.sent') };
      case 'resolved':
      case 'completed':
        return { className: 'bg-green text-white', label: t('status.resolved') };
      case 'archived':
        return { className: 'bg-graphite text-ivory', label: t('status.archived') };
      default:
        return { className: 'bg-gold text-navy', label: status };
    }
  };

  // Note: Auth redirect is now handled by ProtectedRoute wrapper in App.tsx

  // Fetch pratiche
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Sync subscription on mount (once per session, debounced)
  useEffect(() => {
    if (user && !syncCalledRef.current) {
      syncCalledRef.current = true;
      syncSubscription(false);
    }
  }, [user, syncSubscription]);

  // Handle post-checkout refresh - use sync-subscription for deterministic reconciliation
  useEffect(() => {
    if (!user || !checkoutParams.hasCheckoutFlag) return;

    const clearParams = () => navigate('/app', { replace: true });

    if (checkoutParams.status === 'cancelled') {
      toast.info('Checkout cancelled.');
      clearParams();
      return;
    }

    // checkout=success → call sync-subscription then refresh entitlements
    toast.info('Activating your plan…');

    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        // Force sync with Stripe to ensure DB is updated
        const syncResult = await syncSubscription(true);
        console.log('[POST-CHECKOUT] sync result:', syncResult);

        // Then refresh entitlements from DB
        await refreshEntitlements();

        // Check if plan is now active
        if (syncResult?.ok && syncResult.plan_key !== 'free') {
          toast.success('Plan activated!');
          clearParams();
          return;
        }

        // Also check entitlements (in case sync already updated DB)
        if (entitlements.plan !== 'free') {
          toast.success('Plan activated!');
          clearParams();
          return;
        }

        if (attempts >= 10) {
          toast.info('Payment received. Plan activation may take a moment—please refresh.');
          clearParams();
          return;
        }

        setTimeout(tick, 2000);
      } catch (err) {
        console.error('Post-checkout sync error:', err);
        if (attempts >= 10) {
          clearParams();
        } else {
          setTimeout(tick, 2000);
        }
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [user, checkoutParams, navigate, refreshEntitlements, syncSubscription, entitlements.plan]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch payment_status from profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .maybeSingle();
    
    if (profileData?.payment_status) {
      setPaymentStatus((profileData as any).payment_status);
    }

    const { data: praticheData } = await supabase
      .from('pratiche')
      .select('*')
      .order('updated_at', { ascending: false });

    if (praticheData) {
      setPratiche(praticheData);
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await supabase.from('documents').delete().eq('pratica_id', deleteId);
      const { error } = await supabase.from('pratiche').delete().eq('id', deleteId);

      if (error) throw error;

      setPratiche((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success(t('dashboard.deleted'));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('dashboard.deleteError'));
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  // Generate file number
  const getFileNumber = (pratica: Pratica) => {
    return pratica.aktenzeichen || `#${pratica.id.slice(0, 4).toUpperCase()}`;
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <LegalAcceptanceGate>
    <div className="min-h-screen bg-navy pb-20 md:pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <AppHeader />

      {/* DASHBOARD Hero Title */}
      <section className="bg-navy py-6 border-b-2 border-gold/30">
        <div className="container">
          <h1 className="text-center font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-wide text-gold drop-shadow-[0_2px_4px_rgba(201,162,77,0.3)]">
            DASHBOARD
          </h1>
        </div>
      </section>

      {/* Payment Past Due Strip - shown if payment failed */}
      {paymentStatus === 'past_due' && (
        <section className="bg-ivory py-3">
          <div className="container max-w-lg mx-auto">
            <PaymentPastDueStrip paymentStatus={paymentStatus} />
          </div>
        </section>
      )}

      {/* Quick Actions in ivory section */}
      <section className="bg-ivory py-6">
        <div className="container space-y-6">
          {/* Page Subtitle */}
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl md:text-3xl font-medium text-navy">
              {t('dashboard.pageTitle')}
            </h2>
            <p className="text-navy/60">{t('dashboard.pageSubtitle')}</p>
          </div>

          {/* Quick Actions Grid - 2x2 compact */}
          <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
            {quickActionCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card
                  key={index}
                  className={`relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    card.locked ? 'opacity-75' : ''
                  }`}
                  onClick={() => navigate(card.link)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className={`p-2 rounded-lg ${card.bgColor}`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <h3 className="font-semibold text-navy text-sm leading-tight">
                      {t(card.titleKey)}
                    </h3>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Case Selector for AI Chat */}
      <section className="bg-navy py-4 border-b border-gold/20">
        <div className="container max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-gold" />
            <Select 
              value={selectedCaseId || ''} 
              onValueChange={(val) => setSelectedCaseId(val || null)}
            >
              <SelectTrigger className="flex-1 bg-navy/50 border-gold/30 text-ivory">
                <SelectValue placeholder={t('dashboardChat.selectCase')} />
              </SelectTrigger>
              <SelectContent>
                {pratiche.map((pratica) => (
                  <SelectItem key={pratica.id} value={pratica.id}>
                    <div className="flex items-center gap-2">
                      {selectedCaseId === pratica.id && <Check className="h-4 w-4 text-green" />}
                      <span className="truncate max-w-[200px]">{pratica.title}</span>
                    </div>
                  </SelectItem>
                ))}
                {pratiche.length === 0 && (
                  <SelectItem value="none" disabled>
                    {t('dashboard.empty')}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* AI Chat Section - FULL WIDTH, OUTSIDE CONTAINER, SAME AS LANDING */}
      <DashboardAIChat 
        selectedCaseId={selectedCaseId}
        selectedCaseTitle={selectedCaseTitle}
        onCaseSelect={() => {
          // Scroll to case selector
          const selector = document.querySelector('[data-case-selector]');
          selector?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Main Content Area - Fascicoli and other content */}
      <main className="bg-ivory min-h-screen">
        <div className="container py-10 space-y-8">

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LegalLoader size="md" />
            </div>
          ) : (
            <>
              {/* Fascicoli List */}
              <div className="space-y-4">
                {pratiche.length === 0 ? (
                  <Card className="border-dashed border-navy/20">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="mb-4 h-12 w-12 text-navy/30" />
                      <h3 className="mb-2 font-display text-lg font-medium text-navy">
                        {t('dashboard.empty')}
                      </h3>
                      <p className="mb-6 text-center text-navy/60">{t('dashboard.emptyDesc')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  pratiche.map((pratica) => {
                    const statusBadge = getStatusBadge(pratica.status);
                    const fileNumber = getFileNumber(pratica);
                    const isResolved =
                      pratica.status === 'resolved' ||
                      pratica.status === 'completed' ||
                      pratica.status === 'archived';

                    return (
                      <Card
                        key={pratica.id}
                        className={`bg-white shadow-premium ${isResolved ? 'opacity-75' : ''}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              {/* Titolo fascicolo - evidenziato in alto */}
                              <CardTitle className="font-display text-xl text-navy break-words">
                                {pratica.title && !pratica.title.startsWith('IMG') && !pratica.title.startsWith('image')
                                  ? pratica.title
                                  : `${t('dashboard.file')} ${fileNumber}`}
                              </CardTitle>
                              {/* Aktenzeichen - sotto, non evidenziato */}
                              {pratica.title && !pratica.title.startsWith('IMG') && !pratica.title.startsWith('image') && (
                                <p className="text-sm text-navy/60">
                                  {t('dashboard.file')} {fileNumber}
                                </p>
                              )}
                              {pratica.authority && (
                                <p className="text-sm text-navy/70 italic">
                                  {pratica.authority}
                                </p>
                              )}
                              <p className="text-sm text-navy/50">
                                {t('dashboard.lastUpdate')}:{' '}
                                {format(new Date(pratica.updated_at), 'dd.MM.yyyy')}
                              </p>
                            </div>
                            <Badge
                              className={`${statusBadge.className} rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap shrink-0`}
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-current" />
                                {statusBadge.label}
                              </span>
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardFooter className="pt-0 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="bg-navy text-gold hover:bg-navy/90 rounded-full px-4"
                            onClick={() => navigate(`/pratiche/${pratica.id}`)}
                          >
                            {t('dashboard.open')}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-navy/20 text-navy hover:bg-navy/5 rounded-full px-4"
                            onClick={() => navigate(`/pratiche/${pratica.id}`)}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            {t('dashboard.documents')}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5 rounded-full px-4"
                            onClick={() => setDeleteId(pratica.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('common.delete')}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })
                )}
              </div>


              {/* Plans Section */}
              <div className="pt-10 mt-10 border-t border-navy/10">
                <PricingThumbnails showTitle={true} className="max-w-4xl mx-auto" />
              </div>
            </>
          )}
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-navy/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-navy">
              {t('dashboard.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-navy/60">
              {t('dashboard.confirmDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-navy/20 text-navy">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileBottomNav />
    </div>
    </LegalAcceptanceGate>
  );
}
