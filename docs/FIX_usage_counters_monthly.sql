-- Esegui questo script nel Supabase Dashboard → SQL Editor (progetto wzpxxlkfxymelrodjarl)
-- per creare la tabella usage_counters_monthly se manca (errore: "could not find the table public.usage_counters_monthly in the schema cache")

-- 1) Funzione updated_at (se non esiste)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2) Tabella usage_counters_monthly
CREATE TABLE IF NOT EXISTS public.usage_counters_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ym text NOT NULL,
  cases_created int NOT NULL DEFAULT 0,
  credits_spent int NOT NULL DEFAULT 0,
  ai_sessions_started int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ym)
);

-- 3) Indice
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_ym
  ON public.usage_counters_monthly(user_id, ym);

-- 4) Trigger updated_at
DROP TRIGGER IF EXISTS update_usage_counters_monthly_updated_at ON public.usage_counters_monthly;
CREATE TRIGGER update_usage_counters_monthly_updated_at
  BEFORE UPDATE ON public.usage_counters_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS
ALTER TABLE public.usage_counters_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own usage counters" ON public.usage_counters_monthly;
CREATE POLICY "Users can view their own usage counters"
  ON public.usage_counters_monthly FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage usage counters" ON public.usage_counters_monthly;
CREATE POLICY "Service role can manage usage counters"
  ON public.usage_counters_monthly FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6) Funzione increment_cases_created (usata da create-case)
CREATE OR REPLACE FUNCTION public.increment_cases_created(
  _user_id uuid,
  _ym text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.usage_counters_monthly (user_id, ym, cases_created, credits_spent, ai_sessions_started)
  VALUES (_user_id, _ym, 1, 0, 0)
  ON CONFLICT (user_id, ym)
  DO UPDATE SET cases_created = public.usage_counters_monthly.cases_created + 1
  RETURNING cases_created INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_cases_created(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_cases_created(uuid, text) TO service_role;
