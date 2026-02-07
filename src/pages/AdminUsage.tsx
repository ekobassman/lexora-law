import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, CreditCard, FileText, MessageSquare, Calendar, ArrowLeft, Search, Shield, PlayCircle, CheckCircle, XCircle, Info } from "lucide-react";
import { format } from "date-fns";
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
  is_admin_lookup: boolean;
  status: UsageStatus;
  ledger_recent: LedgerEntry[];
  consistency: ConsistencyCheck;
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

interface SelfTestResult {
  passed: boolean;
  summary: string;
  failed_count: number;
  tests: TestResult[];
  timestamp: string;
  disclaimer?: string;
}

export default function AdminUsage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Self-test state
  const [selfTestLoading, setSelfTestLoading] = useState(false);
  const [selfTestResult, setSelfTestResult] = useState<SelfTestResult | null>(null);

  // Check admin status
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      if (user.email === "imbimbo.bassman@gmail.com") {
        setIsAdmin(true);
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_admin");
        setIsAdmin(error ? false : data === true);
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminRole();
  }, [user]);

  // Redirect non-admins
  useEffect(() => {
    if (!checkingAdmin && isAdmin === false) {
      navigate("/app");
    }
  }, [isAdmin, checkingAdmin, navigate]);

  // Admin lookup accepts ONLY target_user_id (no email lookup)
  const fetchUsage = useCallback(async (targetUserId: string) => {
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
        body: { target_user_id: targetUserId },
      });

      if (fnError) {
        setError(fnError.message);
        return;
      }

      if (result?.error) {
        setError(`${result.code || "ERROR"}: ${result.error}`);
        return;
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [session]);

  const handleSearch = () => {
    const input = searchInput.trim();
    if (!input) {
      toast.error("Enter a user ID (UUID)");
      return;
    }

    // Only accept UUID format - email lookup removed
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);

    if (!isUuid) {
      toast.error("Please enter a valid user ID (UUID format). Email lookup is not supported.");
      return;
    }

    fetchUsage(input);
  };

  const handleRefresh = () => {
    if (data?.target_user_id) {
      fetchUsage(data.target_user_id);
      toast.success("Refreshed");
    }
  };

  const runSelfTest = async () => {
    setSelfTestLoading(true);
    setSelfTestResult(null);

    try {
      const token = session?.access_token;
      if (!token) {
        toast.error("Not authenticated");
        return;
      }

      // Call renamed function: credits-selftest-lite
      const { data: result, error: fnError } = await supabase.functions.invoke("credits-selftest-lite", {
        headers: { Authorization: `Bearer ${token}` },
        body: {},
      });

      if (fnError) {
        toast.error(fnError.message);
        return;
      }

      setSelfTestResult(result);
      if (result.passed) {
        toast.success(`All tests passed! ${result.summary}`);
      } else {
        toast.error(`Tests failed: ${result.summary}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Self-test failed");
    } finally {
      setSelfTestLoading(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Show red warning ONLY if (mismatch_wallet_vs_ledger OR mismatch_spent) AND legacy_data is false
  const showMismatchWarning = !data?.consistency.legacy_data && 
    (data?.consistency.mismatch_wallet_vs_ledger || data?.consistency.mismatch_spent);
  const showLegacyInfo = data?.consistency.legacy_data;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Admin Usage Inspector
              </h1>
              <p className="text-muted-foreground text-sm">Search user usage by UUID and run self-tests</p>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search User by ID
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="User ID (UUID)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Only user ID (UUID) lookup is supported. Email lookup has been removed for security.
            </p>
          </CardContent>
        </Card>

        {/* Self-Test Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Credits System Self-Test (Lite)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This self-test validates database invariants and consistency.
              It does NOT fully simulate client credit flows.
            </p>
            <div className="flex items-center gap-4 mb-4">
              <Button onClick={runSelfTest} disabled={selfTestLoading} variant="outline">
                {selfTestLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Run Self-Test
                  </>
                )}
              </Button>
              {selfTestResult && (
                <Badge variant={selfTestResult.passed ? "default" : "destructive"}>
                  {selfTestResult.summary}
                </Badge>
              )}
            </div>

            {selfTestResult && (
              <div className="space-y-2">
                {selfTestResult.tests.map((test, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                    {test.passed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{test.name}</p>
                      <p className="text-xs text-muted-foreground">{test.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
            {/* User Info */}
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User: {data.target_user_id.slice(0, 8)}...</CardTitle>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
            </Card>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">{data.status.plan}</div>
                  {data.status.is_unlimited && (
                    <Badge variant="secondary" className="mt-1">Unlimited</Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Cases This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.status.cases_used} / {data.status.is_unlimited ? "∞" : data.status.cases_limit}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{data.status.ym}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credits Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.status.credits_balance}</div>
                  <p className="text-xs text-muted-foreground mt-1">Spent: {data.status.credits_spent}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    AI Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.status.ai_sessions_started}</div>
                  <p className="text-xs text-muted-foreground mt-1">This month</p>
                </CardContent>
              </Card>
            </div>

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
                    Wallet balance ({data.consistency.wallet_balance}) ≠ ledger sum ({data.consistency.ledger_sum})
                  </p>
                  {data.consistency.mismatch_spent && (
                    <p>
                      Credits spent counter ({data.consistency.credits_spent_counter}) ≠ computed ({data.consistency.computed_spent_from_ledger})
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Legacy Data Info */}
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Transactions (Last 50)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.ledger_recent.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No transactions</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="text-right">Delta</TableHead>
                          <TableHead>Case ID</TableHead>
                          <TableHead>Nominal Cost</TableHead>
                          <TableHead>Meta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.ledger_recent.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs">
                              {format(new Date(entry.created_at), "MMM d, HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={entry.delta < 0 ? "destructive" : entry.delta > 0 ? "default" : "secondary"}>
                                {entry.action_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {entry.case_id ? entry.case_id.slice(0, 8) : "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {entry.meta?.nominal_cost ?? "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                              <code className="text-[10px]">{JSON.stringify(entry.meta).slice(0, 80)}</code>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
