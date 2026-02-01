
-- ════════════════════════════════════════════════════════════════════════════
-- CREDITS ENGINE - Tabelle + Indici + Trigger (Idempotente)
-- ════════════════════════════════════════════════════════════════════════════

-- 1) user_wallet - Bilancio crediti utente
CREATE TABLE IF NOT EXISTS public.user_wallet (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_credits int NOT NULL DEFAULT 0,
  lifetime_credits int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) credit_ledger - Storico transazioni crediti
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pratica_id uuid NULL REFERENCES public.pratiche(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  delta int NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) subscriptions_state - Stato abbonamento e limiti
CREATE TABLE IF NOT EXISTS public.subscriptions_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  period_start timestamptz NULL,
  period_end timestamptz NULL,
  monthly_case_limit int NOT NULL DEFAULT 1,
  monthly_credit_refill int NOT NULL DEFAULT 0,
  monthly_ai_softcap int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4) usage_counters_monthly - Contatori mensili
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

-- ════════════════════════════════════════════════════════════════════════════
-- INDICI
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created 
  ON public.credit_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_counters_user_ym 
  ON public.usage_counters_monthly(user_id, ym);

CREATE INDEX IF NOT EXISTS idx_subscriptions_state_plan 
  ON public.subscriptions_state(plan);

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGER updated_at
-- ════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_user_wallet_updated_at
  BEFORE UPDATE ON public.user_wallet
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_state_updated_at
  BEFORE UPDATE ON public.subscriptions_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_counters_monthly_updated_at
  BEFORE UPDATE ON public.usage_counters_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS - Abilita e Policy
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters_monthly ENABLE ROW LEVEL SECURITY;

-- user_wallet: SELECT solo owner
CREATE POLICY "Users can view their own wallet"
  ON public.user_wallet FOR SELECT
  USING (auth.uid() = user_id);

-- credit_ledger: SELECT solo owner
CREATE POLICY "Users can view their own ledger"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- subscriptions_state: SELECT solo owner
CREATE POLICY "Users can view their own subscription state"
  ON public.subscriptions_state FOR SELECT
  USING (auth.uid() = user_id);

-- usage_counters_monthly: SELECT solo owner
CREATE POLICY "Users can view their own usage counters"
  ON public.usage_counters_monthly FOR SELECT
  USING (auth.uid() = user_id);

-- Service role policies (per edge functions con service_role)
CREATE POLICY "Service role can manage wallets"
  ON public.user_wallet FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage ledger"
  ON public.credit_ledger FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage subscription state"
  ON public.subscriptions_state FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage usage counters"
  ON public.usage_counters_monthly FOR ALL
  USING (true)
  WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════
-- BACKFILL - Inizializza utenti esistenti
-- ════════════════════════════════════════════════════════════════════════════

-- Crea wallet per utenti esistenti
INSERT INTO public.user_wallet (user_id, balance_credits, lifetime_credits)
SELECT id, 0, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Crea subscriptions_state per utenti esistenti (plan free)
INSERT INTO public.subscriptions_state (user_id, plan, monthly_case_limit, monthly_credit_refill)
SELECT id, 'free', 1, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGER per nuovi utenti - auto-create wallet e subscription state
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create wallet
  INSERT INTO public.user_wallet (user_id, balance_credits, lifetime_credits)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create subscription state (free plan)
  INSERT INTO public.subscriptions_state (user_id, plan, monthly_case_limit, monthly_credit_refill)
  VALUES (NEW.id, 'free', 1, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger on auth.users (se non esiste già)
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();
