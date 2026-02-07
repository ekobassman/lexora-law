-- ═══════════════════════════════════════════════════════════════════════════
-- LEXORA SCHEMA REBUILD
-- Stripe payments, credits, subscriptions, dashboard, legal versions.
-- Solo struttura: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- Nessun dato di produzione, nessuna cancellazione dati.
-- Eseguire in Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: funzione updated_at (se non esiste)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── PROFILES (base da migrazioni; colonne extra da types) ───────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'DE',
  preferred_language text DEFAULT 'IT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_version text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_confirmed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_policy_version text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_status text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_state text DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_payment_failed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_override text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_family boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cases_limit int DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cases_used int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_period_start timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_postal_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_signature text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_ai_language text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_tone_setting text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_language_level text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_save_drafts boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_update_draft_on_ai boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_update_letter_on_upload boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_use_sender_data boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suggest_legal_references boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_documents_per_pratica int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_billing_email_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_billing_event_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_payment_error_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_payment_error_message text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz;

-- ─── LEGAL (versioni documenti + accettazioni + eventi) ─────────────────────
CREATE TABLE IF NOT EXISTS public.legal_versions (
  doc_type text PRIMARY KEY CHECK (doc_type IN ('terms','privacy','disclaimer')),
  version text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_terms_version text,
  accepted_privacy_version text,
  accepted_disclaimer_version text,
  accepted_at timestamptz,
  accepted_user_agent text
);

CREATE TABLE IF NOT EXISTS public.legal_acceptance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  terms_version text,
  privacy_version text,
  age_policy_version text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  country_code text,
  ip_hash text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptance_events_user_id ON public.legal_acceptance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptance_events_accepted_at ON public.legal_acceptance_events(accepted_at DESC);

-- ─── DASHBOARD CHAT ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dashboard_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_date date NOT NULL DEFAULT CURRENT_DATE,
  messages_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_date)
);

CREATE TABLE IF NOT EXISTS public.dashboard_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_chat_messages_user_date ON public.dashboard_chat_messages(user_id, message_date);
CREATE INDEX IF NOT EXISTS idx_dashboard_chat_history_user ON public.dashboard_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_chat_history_created ON public.dashboard_chat_history(created_at DESC);

-- ─── CREDITI / STRIPE (user_wallet, credit_ledger, subscriptions_state, usage_counters_monthly) ─
CREATE TABLE IF NOT EXISTS public.user_wallet (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_credits int NOT NULL DEFAULT 0,
  lifetime_credits int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- credit_ledger: pratica_id opzionale (FK a pratiche se esiste)
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pratica_id uuid NULL,
  case_id uuid NULL,
  action_type text NOT NULL,
  delta int NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON public.credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_ym ON public.usage_counters_monthly(user_id, ym);
CREATE INDEX IF NOT EXISTS idx_subscriptions_state_plan ON public.subscriptions_state(plan);

-- ─── GLOBAL STATS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.global_stats (
  id text PRIMARY KEY DEFAULT 'main',
  documents_processed bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS (abilitazione + policy base) ───────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can view their own credit ledger" ON public.credit_ledger FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can insert their own credit ledger" ON public.credit_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own legal acceptance events" ON public.legal_acceptance_events;
CREATE POLICY "Users can view their own legal acceptance events" ON public.legal_acceptance_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own legal acceptance events" ON public.legal_acceptance_events;
CREATE POLICY "Users can insert their own legal acceptance events" ON public.legal_acceptance_events FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "legal_versions_read_all" ON public.legal_versions;
CREATE POLICY "legal_versions_read_all" ON public.legal_versions FOR SELECT USING (true);

DROP POLICY IF EXISTS "acceptances_select_own" ON public.user_legal_acceptances;
CREATE POLICY "acceptances_select_own" ON public.user_legal_acceptances FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "acceptances_insert_own" ON public.user_legal_acceptances;
CREATE POLICY "acceptances_insert_own" ON public.user_legal_acceptances FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "acceptances_update_own" ON public.user_legal_acceptances;
CREATE POLICY "acceptances_update_own" ON public.user_legal_acceptances FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own chat message counts" ON public.dashboard_chat_messages;
CREATE POLICY "Users can view their own chat message counts" ON public.dashboard_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chat message counts" ON public.dashboard_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chat message counts" ON public.dashboard_chat_messages FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own chat history" ON public.dashboard_chat_history;
CREATE POLICY "Users can view their own chat history" ON public.dashboard_chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chat messages" ON public.dashboard_chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chat history" ON public.dashboard_chat_history FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallet;
CREATE POLICY "Users can view their own wallet" ON public.user_wallet FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own subscription state" ON public.subscriptions_state;
CREATE POLICY "Users can view their own subscription state" ON public.subscriptions_state FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own usage counters" ON public.usage_counters_monthly;
CREATE POLICY "Users can view their own usage counters" ON public.usage_counters_monthly FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view global stats" ON public.global_stats;
CREATE POLICY "Anyone can view global stats" ON public.global_stats FOR SELECT USING (true);

-- Service role (per Edge Functions): policy con USING(true) solo se necessario; qui lasciamo solo SELECT per utente.

-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTICA (SELECT di verifica)
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'legal_versions' AS tbl, count(*) AS n FROM public.legal_versions
UNION ALL
SELECT 'user_legal_acceptances', count(*) FROM public.user_legal_acceptances
UNION ALL
SELECT 'dashboard_chat_messages', count(*) FROM public.dashboard_chat_messages
UNION ALL
SELECT 'dashboard_chat_history', count(*) FROM public.dashboard_chat_history
UNION ALL
SELECT 'user_wallet', count(*) FROM public.user_wallet
UNION ALL
SELECT 'subscriptions_state', count(*) FROM public.subscriptions_state
UNION ALL
SELECT 'usage_counters_monthly', count(*) FROM public.usage_counters_monthly
UNION ALL
SELECT 'global_stats', count(*) FROM public.global_stats;

SELECT * FROM public.legal_versions LIMIT 5;
SELECT id, documents_processed, updated_at FROM public.global_stats LIMIT 1;
