-- LEXORA: Sistema limiti per piano + contatori mensili + RPC (idempotente)
-- Esegui in Supabase SQL Editor o via: npx supabase db push (dopo link)

-- Drop old RPC that references old usage_counters_monthly (avoid FK errors on drop)
DROP FUNCTION IF EXISTS public.increment_cases_created(uuid, text);

-- Drop old table so we can recreate with new schema
DROP TABLE IF EXISTS public.usage_counters_monthly CASCADE;

-- 1) plan_limits
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_key text PRIMARY KEY,
  uploads_per_month int NOT NULL DEFAULT 0,
  ocr_pages_per_month int NOT NULL DEFAULT 0,
  chat_messages_per_month int NOT NULL DEFAULT 0,
  max_file_mb int NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) user_plan
CREATE TABLE IF NOT EXISTS public.user_plan (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL DEFAULT 'free',
  source text NOT NULL DEFAULT 'internal',
  stripe_customer_id text NULL,
  stripe_subscription_id text NULL,
  current_period_end timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) usage_counters_monthly (new schema)
CREATE TABLE public.usage_counters_monthly (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,
  uploads_count int NOT NULL DEFAULT 0,
  ocr_pages_count int NOT NULL DEFAULT 0,
  chat_messages_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);

-- 4) usage_events (audit/debug)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  month date NOT NULL,
  metric text NOT NULL,
  amount int NOT NULL,
  source text NOT NULL DEFAULT 'edge',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed plan_limits (TODO: allineare numeri al prodotto)
INSERT INTO public.plan_limits (plan_key, uploads_per_month, ocr_pages_per_month, chat_messages_per_month, max_file_mb)
VALUES
  ('free', 5, 10, 30, 10),
  ('starter', 50, 200, 500, 20),
  ('pro', 200, 1000, 2000, 25),
  ('unlimited', 999999, 999999, 999999, 50)
ON CONFLICT (plan_key) DO UPDATE SET
  uploads_per_month = EXCLUDED.uploads_per_month,
  ocr_pages_per_month = EXCLUDED.ocr_pages_per_month,
  chat_messages_per_month = EXCLUDED.chat_messages_per_month,
  max_file_mb = EXCLUDED.max_file_mb,
  updated_at = now();

-- RLS
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_limits_read_all" ON public.plan_limits;
CREATE POLICY "plan_limits_read_all" ON public.plan_limits FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_plan_read_own" ON public.user_plan;
CREATE POLICY "user_plan_read_own" ON public.user_plan FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usage_monthly_read_own" ON public.usage_counters_monthly;
CREATE POLICY "usage_monthly_read_own" ON public.usage_counters_monthly FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usage_events_read_own" ON public.usage_events;
CREATE POLICY "usage_events_read_own" ON public.usage_events FOR SELECT USING (auth.uid() = user_id);

-- (Scritture su usage_* e user_plan solo via SERVICE_ROLE nelle Edge Functions; nessuna policy write qui.)

-- Helper: primo giorno del mese
CREATE OR REPLACE FUNCTION public.month_start(d date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT date_trunc('month', d)::date;
$$;

-- RPC: leggi uso + limiti (crea righe mancanti)
CREATE OR REPLACE FUNCTION public.get_usage_and_limits(p_user_id uuid, p_month date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m date := public.month_start(p_month);
  pkey text;
  lim record;
  cnt record;
BEGIN
  INSERT INTO public.user_plan(user_id, plan_key)
  VALUES (p_user_id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT plan_key INTO pkey FROM public.user_plan WHERE user_id = p_user_id;

  SELECT * INTO lim FROM public.plan_limits WHERE plan_key = COALESCE(pkey, 'free');

  INSERT INTO public.usage_counters_monthly(user_id, month)
  VALUES (p_user_id, m)
  ON CONFLICT (user_id, month) DO NOTHING;

  SELECT * INTO cnt FROM public.usage_counters_monthly
  WHERE user_id = p_user_id AND month = m;

  RETURN jsonb_build_object(
    'plan_key', COALESCE(pkey, 'free'),
    'limits', jsonb_build_object(
      'uploads_per_month', lim.uploads_per_month,
      'ocr_pages_per_month', lim.ocr_pages_per_month,
      'chat_messages_per_month', lim.chat_messages_per_month,
      'max_file_mb', lim.max_file_mb
    ),
    'usage', jsonb_build_object(
      'uploads_count', COALESCE(cnt.uploads_count, 0),
      'ocr_pages_count', COALESCE(cnt.ocr_pages_count, 0),
      'chat_messages_count', COALESCE(cnt.chat_messages_count, 0)
    ),
    'month', m
  );
END;
$$;

-- RPC: consuma uso e blocca se supera limiti
CREATE OR REPLACE FUNCTION public.consume_usage(
  p_user_id uuid,
  p_month date,
  p_metric text,
  p_amount int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m date := public.month_start(p_month);
  state jsonb;
  plan_key text;
  lim jsonb;
  usage jsonb;
  new_value int;
  limit_value int;
BEGIN
  state := public.get_usage_and_limits(p_user_id, m);
  plan_key := state->>'plan_key';
  lim := state->'limits';
  usage := state->'usage';

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'state', state);
  END IF;

  IF p_metric = 'uploads' THEN
    new_value := (COALESCE(usage->>'uploads_count', '0'))::int + p_amount;
    limit_value := (lim->>'uploads_per_month')::int;
    IF new_value > limit_value THEN
      RETURN jsonb_build_object('ok', false, 'error', 'LIMIT_UPLOADS', 'state', state);
    END IF;
    UPDATE public.usage_counters_monthly
      SET uploads_count = new_value, updated_at = now()
      WHERE user_id = p_user_id AND month = m;

  ELSIF p_metric = 'ocr_pages' THEN
    new_value := (COALESCE(usage->>'ocr_pages_count', '0'))::int + p_amount;
    limit_value := (lim->>'ocr_pages_per_month')::int;
    IF new_value > limit_value THEN
      RETURN jsonb_build_object('ok', false, 'error', 'LIMIT_OCR', 'state', state);
    END IF;
    UPDATE public.usage_counters_monthly
      SET ocr_pages_count = new_value, updated_at = now()
      WHERE user_id = p_user_id AND month = m;

  ELSIF p_metric = 'chat_messages' THEN
    new_value := (COALESCE(usage->>'chat_messages_count', '0'))::int + p_amount;
    limit_value := (lim->>'chat_messages_per_month')::int;
    IF new_value > limit_value THEN
      RETURN jsonb_build_object('ok', false, 'error', 'LIMIT_CHAT', 'state', state);
    END IF;
    UPDATE public.usage_counters_monthly
      SET chat_messages_count = new_value, updated_at = now()
      WHERE user_id = p_user_id AND month = m;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'UNKNOWN_METRIC', 'metric', p_metric, 'state', state);
  END IF;

  INSERT INTO public.usage_events(user_id, month, metric, amount, source)
  VALUES (p_user_id, m, p_metric, p_amount, 'edge');

  state := public.get_usage_and_limits(p_user_id, m);
  RETURN jsonb_build_object('ok', true, 'state', state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_usage_and_limits(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_and_limits(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_usage(uuid, date, text, int) TO service_role;

COMMENT ON TABLE public.plan_limits IS 'Limiti per piano (free/starter/pro/unlimited)';
COMMENT ON TABLE public.user_plan IS 'Piano corrente utente';
COMMENT ON TABLE public.usage_counters_monthly IS 'Contatori mensili per utente';
