-- Idempotent: ensure global_stats exists (fix 404 on /rest/v1/global_stats)
CREATE TABLE IF NOT EXISTS public.global_stats (
  id text PRIMARY KEY DEFAULT 'main',
  documents_processed bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view global stats" ON public.global_stats;
CREATE POLICY "Anyone can view global stats"
ON public.global_stats
FOR SELECT
USING (true);

INSERT INTO public.global_stats (id, documents_processed)
VALUES ('main', 0)
ON CONFLICT (id) DO NOTHING;

-- Realtime: add table to publication if not already (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.global_stats;
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$$;
