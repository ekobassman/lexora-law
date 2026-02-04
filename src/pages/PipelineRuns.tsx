/**
 * Debug: ultime 20 righe da pipeline_runs per l'utente corrente (auth.uid()).
 * Accessibile da Admin o per qualsiasi utente loggato per vedere i propri run.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';

interface PipelineRunRow {
  id: number;
  user_id: string | null;
  doc_id: string | null;
  step: string;
  ok: boolean;
  code: string | null;
  message: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export default function PipelineRuns() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PipelineRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('pipeline_runs')
      .select('id, user_id, doc_id, step, ok, code, message, meta, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (e) {
      setError(e.message);
      setRuns([]);
    } else {
      setRuns((data ?? []) as PipelineRunRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    if (user?.id) fetchRuns();
  }, [user?.id, authLoading]);

  if (authLoading || !user) return null;

  return (
    <div className="container max-w-5xl py-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <Button variant="outline" size="sm" onClick={fetchRuns} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pipeline runs (ultime 20)</CardTitle>
          <p className="text-sm text-muted-foreground">Log upload+OCR per il tuo account</p>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {error && (
            <p className="text-destructive text-sm py-4">{error}</p>
          )}
          {!loading && !error && runs.length === 0 && (
            <p className="text-muted-foreground text-sm py-4">Nessun run trovato.</p>
          )}
          {!loading && runs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>id</TableHead>
                  <TableHead>step</TableHead>
                  <TableHead>ok</TableHead>
                  <TableHead>code</TableHead>
                  <TableHead>message</TableHead>
                  <TableHead>created_at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell>{r.step}</TableCell>
                    <TableCell>
                      <Badge variant={r.ok ? 'default' : 'destructive'}>{r.ok ? 'ok' : 'fail'}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.code ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={r.message ?? ''}>{r.message ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
