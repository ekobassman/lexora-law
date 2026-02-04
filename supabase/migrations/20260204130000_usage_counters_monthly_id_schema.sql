-- usage_counters_monthly: schema con id (uuid), user_id, count, month, year, created_at, updated_at
-- Sostituisce la tabella esistente se presente (CASCADE).

DROP TABLE IF EXISTS public.usage_counters_monthly CASCADE;

CREATE TABLE public.usage_counters_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count integer NOT NULL DEFAULT 0,
  month integer NOT NULL,
  year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_monthly_user_year_month
  ON public.usage_counters_monthly (user_id, year, month);

ALTER TABLE public.usage_counters_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_monthly_read_own" ON public.usage_counters_monthly;
CREATE POLICY "usage_monthly_read_own"
  ON public.usage_counters_monthly
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.usage_counters_monthly IS 'Contatori mensili per utente (count, month, year)';
