import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from '@/lib/supabaseClient';
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, CreditCard, FileText, MessageSquare, Calendar, ArrowLeft, Info } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface UsageStatus {
  plan: string;
  ym: string;
  cases_used: number;
  cases_limit: number;
  credits_balance: number;
  credits_spent: number;
  ai_sessions_started: number;
  next_refill_date: string;
  is_unlimited: boolean;
  period_start: string | null;
  period_end: string | null;
}

interface LedgerEntry {
  id: string;
  action_type: string;
  delta: number;
  created_at: string;
  case_id: string | null;
  meta: Record<string, any>;
}

interface ConsistencyCheck {
  ledger_sum: number | null;
  wallet_balance: number;
  mismatch_wallet_vs_ledger: boolean;
  credits_spent_counter: number;
  computed_spent_from_ledger: number;
  mismatch_spent: boolean;
  legacy_data: boolean;
}

interface UsageData {
  target_user_id: string;
  status: UsageStatus;
  ledger_recent: LedgerEntry[];
  consistency: ConsistencyCheck;
}

export default function AccountUsage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = session?.access_token;
      if (!token) {
        setError("Not authenticated");
        return;
      }

      const { data: result, error: fnError } = await supabase.functions.invoke("usage-inspector", {
        headers: { Authorization: `Bearer ${token}` },
        body: {},
      });

      if (fnError) {
        setError(fnError.message);
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchUsage();
    }
  }, [session]);

  const handleRefresh = async () => {
    await fetchUsage();
    toast.success("Usage data refreshed");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy pb-20 md:pb-8">
        <AppHeader />
        <main className="bg-ivory min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-navy" />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  // Show red warning ONLY if (mismatch_wallet_vs_ledger OR mismatch_spent) AND legacy_data is false
  const showMismatchWarning = !data?.consistency.legacy_data && 
    (data?.consistency.mismatch_wallet_vs_ledger || data?.consistency.mismatch_spent);
  const showLegacyInfo = data?.consistency.legacy_data;

  return (
    <div className="min-h-screen bg-navy pb-20 md:pb-8">
      <AppHeader />

      <main className="bg-ivory min-h-screen">
        <div className="container max-w-5xl py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
                <ArrowLeft className="h-5 w-5 text-navy" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-navy font-display">Usage & Credits</h1>
                <p className="text-navy/60 text-sm">Your account usage details</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={loading} className="border-navy/20">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {error && (
            <Card className="border-destructive mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {data && (
            <>
              {/* Credits Section */}
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-navy mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Credits
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="shadow-premium">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-navy/60">Credits Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">{data.status.credits_balance}</div>
                      {data.status.is_unlimited && (
                        <Badge variant="secondary" className="mt-1">Unlimited</Badge>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-premium">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-navy/60">Spent This Month</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">{data.status.credits_spent}</div>
                      <p className="text-xs text-navy/50 mt-1">{data.status.ym}</p>
                    </CardContent>
                  </Card>

                  <Card className="shadow-premium">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-navy/60">Next Refill</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold text-navy">
                        {data.status.next_refill_date ? format(new Date(data.status.next_refill_date), "MMM d, yyyy") : "N/A"}
                      </div>
                      <p className="text-xs text-navy/50 mt-1">Monthly reset</p>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* AI Usage Section */}
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-navy mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  AI Usage
                </h2>
                <Card className="shadow-premium">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-navy/60">AI Sessions Started This Month</p>
                        <p className="text-3xl font-bold text-navy">{data.status.ai_sessions_started}</p>
                      </div>
                      <div className="text-right max-w-xs">
                        <p className="text-xs text-navy/50">
                          One AI session includes up to 20 messages or 2 hours.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Cases Section */}
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-navy mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Cases
                </h2>
                <Card className="shadow-premium">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-navy/60">Cases Used This Month</p>
                        <p className="text-3xl font-bold text-navy">
                          {data.status.cases_used} / {data.status.is_unlimited ? "∞" : data.status.cases_limit}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">{data.status.plan}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Consistency Warning - only if mismatch AND NOT legacy */}
              {showMismatchWarning && (
                <Card className="border-destructive bg-destructive/5 mb-6">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Consistency Warning
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      Wallet balance ({data.consistency.wallet_balance}) doesn't match ledger sum ({data.consistency.ledger_sum})
                    </p>
                    {data.consistency.mismatch_spent && (
                      <p>
                        Credits spent counter ({data.consistency.credits_spent_counter}) doesn't match computed ({data.consistency.computed_spent_from_ledger})
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Legacy Data Info - informational, not blocking */}
              {showLegacyInfo && (
                <Card className="border-blue-200 bg-blue-50 mb-6">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Legacy Data Detected</p>
                        <p className="text-xs text-blue-600 mt-1">
                          Ledger may not fully reconcile due to credits added before the ledger system was implemented.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ledger Table */}
              <section>
                <h2 className="text-lg font-semibold text-navy mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Transactions (Last 50)
                </h2>
                <Card className="shadow-premium">
                  <CardContent className="pt-6">
                    {data.ledger_recent.length === 0 ? (
                      <p className="text-navy/50 text-center py-8">No transactions yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-navy/70">Date</TableHead>
                              <TableHead className="text-navy/70">Action</TableHead>
                              <TableHead className="text-right text-navy/70">Delta</TableHead>
                              <TableHead className="text-navy/70">Case ID</TableHead>
                              <TableHead className="text-navy/70">Nominal Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.ledger_recent.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell className="text-xs text-navy/80">
                                  {format(new Date(entry.created_at), "MMM d, HH:mm")}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={entry.delta < 0 ? "destructive" : entry.delta > 0 ? "default" : "secondary"}>
                                    {entry.action_type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-navy">
                                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                                </TableCell>
                                <TableCell className="text-xs font-mono text-navy/50">
                                  {entry.case_id ? entry.case_id.slice(0, 8) : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-navy/50">
                                  {entry.meta?.nominal_cost ? entry.meta.nominal_cost : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
