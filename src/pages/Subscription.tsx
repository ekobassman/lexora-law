import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckout } from "@/hooks/useCheckout";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useSyncSubscription } from "@/hooks/useSyncSubscription";
import { getPlanConfig } from "@/lib/subscriptionPlans";

export default function Subscription() {
  const { entitlements, isLoading, error, refreshEntitlements, isPaid } = useEntitlements();
  const { openCustomerPortal, isLoading: portalLoading } = useCheckout();
  const { syncSubscription } = useSyncSubscription();

  // Sync subscription on mount (debounced)
  useEffect(() => {
    syncSubscription(false);
  }, [syncSubscription]);

  const planConfig = useMemo(() => getPlanConfig(entitlements.plan), [entitlements.plan]);

  const statusLabel = useMemo(() => {
    const s = (entitlements.status || "active").toLowerCase();
    if (s === "active") return "Active";
    if (s === "trialing") return "Trial";
    if (s === "past_due") return "Past due";
    if (s === "canceled") return "Canceled";
    return s;
  }, [entitlements.status]);

  const statusVariant = useMemo(() => {
    const s = (entitlements.status || "active").toLowerCase();
    if (s === "active" || s === "trialing") return "default" as const;
    if (s === "past_due") return "secondary" as const;
    if (s === "canceled") return "outline" as const;
    return "secondary" as const;
  }, [entitlements.status]);

  const periodLabel = useMemo(() => {
    if (!entitlements.current_period_end) return null;
    const date = new Date(entitlements.current_period_end);
    const isCanceled = (entitlements.status || "").toLowerCase() === "canceled";
    return isCanceled ? `Expires on ${format(date, "dd MMM yyyy")}` : `Renews on ${format(date, "dd MMM yyyy")}`;
  }, [entitlements.current_period_end, entitlements.status]);

  const casesMax = entitlements.limits?.casesMax ?? 1;
  const casesUsed = entitlements.usage?.casesUsed ?? 0;

  const primaryAction = useMemo(() => {
    const status = (entitlements.status || "active").toLowerCase();

    if (entitlements.plan === "free") {
      return {
        label: "Upgrade plan",
        href: "/pricing",
        onClick: undefined as undefined | (() => void),
      };
    }

    if (status === "canceled") {
      return {
        label: "Reactivate",
        href: undefined as undefined | string,
        onClick: () => openCustomerPortal(),
      };
    }

    if (status === "active" || status === "trialing") {
      return {
        label: "Manage billing",
        href: undefined as undefined | string,
        onClick: () => openCustomerPortal(),
      };
    }

    // past_due / other
    return {
      label: "Manage billing",
      href: undefined as undefined | string,
      onClick: () => openCustomerPortal(),
    };
  }, [entitlements.plan, entitlements.status, openCustomerPortal]);

  return (
    <div className="min-h-screen bg-navy pb-20 md:pb-8">
      <AppHeader />

      <main className="bg-ivory min-h-screen">
        <div className="container max-w-3xl py-10 space-y-8">
          <header className="text-center space-y-2">
            <h1 className="font-display text-3xl md:text-4xl font-medium text-navy">Subscription</h1>
            <p className="text-navy/60">Manage your plan, billing, and usage.</p>
          </header>

          <section aria-label="Plan summary">
            <Card className="shadow-premium">
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-navy font-display">Plan Summary</CardTitle>
                    <CardDescription>Current plan and billing status.</CardDescription>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    <p className="text-sm text-destructive">Could not verify your plan.</p>
                    <Button variant="outline" onClick={() => refreshEntitlements()}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-navy/60">Current plan</p>
                      <p className="text-xl font-semibold text-navy">{planConfig.id === "free" ? "Free" : `${planConfig.id.charAt(0).toUpperCase()}${planConfig.id.slice(1)} Plan`}</p>
                      {periodLabel && <p className="text-sm text-navy/60">{periodLabel}</p>}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-navy/10 bg-white p-4">
                        <p className="text-sm text-navy/60">Billing</p>
                        <p className="text-navy font-medium">Managed by Stripe</p>
                      </div>
                      <div className="rounded-lg border border-navy/10 bg-white p-4">
                        <p className="text-sm text-navy/60">Usage</p>
                        <p className="text-navy font-medium">Cases used: {casesUsed} / {casesMax === 999999 ? "∞" : casesMax}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {primaryAction.href ? (
                        <Button asChild className="w-full bg-navy text-gold hover:bg-navy/90">
                          <Link to={primaryAction.href}>{primaryAction.label}</Link>
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-navy text-gold hover:bg-navy/90"
                          disabled={portalLoading}
                          onClick={primaryAction.onClick}
                        >
                          {primaryAction.label}
                        </Button>
                      )}
                      <p className="text-xs text-navy/60 text-center">Payments are securely handled by Stripe.</p>
                    </div>

                    {!isPaid && entitlements.plan !== "free" && (
                      <div className="rounded-lg border border-navy/10 bg-white p-4">
                        <p className="text-sm text-navy/70">
                          Your plan is <span className="font-medium">{statusLabel}</span>. Some actions may be temporarily restricted.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
