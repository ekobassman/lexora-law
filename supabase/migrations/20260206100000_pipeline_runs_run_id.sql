-- LEXORA: run_id reale su pipeline_runs per debug deterministico. Idempotente.

-- 1) Colonna run_id su pipeline_runs (nullable per righe esistenti; nuovi insert sempre con run_id)
ALTER TABLE public.pipeline_runs ADD COLUMN IF NOT EXISTS run_id uuid NULL;
CREATE INDEX IF NOT EXISTS pipeline_runs_run_id_idx ON public.pipeline_runs(run_id);

COMMENT ON COLUMN public.pipeline_runs.run_id IS 'UUID del run (process-document); stessa run_id per tutti gli step di una richiesta';

-- 2) Opzionale: ultima_run_id su documents per correlazione
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ultima_run_id uuid NULL;
COMMENT ON COLUMN public.documents.ultima_run_id IS 'run_id dell’ultimo process-document che ha aggiornato il documento';
