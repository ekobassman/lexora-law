
-- ════════════════════════════════════════════════════════════════════════════
-- HOTFIX 1: RLS - Remove permissive policies, keep only owner-select
-- ════════════════════════════════════════════════════════════════════════════

-- Drop all permissive USING(true) policies
DROP POLICY IF EXISTS "Service role can manage wallets" ON public.user_wallet;
DROP POLICY IF EXISTS "Service role can manage ledger" ON public.credit_ledger;
DROP POLICY IF EXISTS "Service role can manage subscription state" ON public.subscriptions_state;
DROP POLICY IF EXISTS "Service role can manage usage counters" ON public.usage_counters_monthly;

-- Verify owner-select policies exist (recreate if needed for safety)
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallet;
CREATE POLICY "Users can view their own wallet"
  ON public.user_wallet FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own ledger" ON public.credit_ledger;
CREATE POLICY "Users can view their own ledger"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own subscription state" ON public.subscriptions_state;
CREATE POLICY "Users can view their own subscription state"
  ON public.subscriptions_state FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own usage counters" ON public.usage_counters_monthly;
CREATE POLICY "Users can view their own usage counters"
  ON public.usage_counters_monthly FOR SELECT
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- HOTFIX 2: Schema consistency - Add case_id column, keep pratica_id for backcompat
-- ════════════════════════════════════════════════════════════════════════════

-- Add case_id column if not exists
ALTER TABLE public.credit_ledger 
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.pratiche(id) ON DELETE SET NULL;

-- Backfill case_id from pratica_id
UPDATE public.credit_ledger SET case_id = pratica_id WHERE case_id IS NULL AND pratica_id IS NOT NULL;

-- Create index on case_id
CREATE INDEX IF NOT EXISTS idx_credit_ledger_case_id ON public.credit_ledger(case_id);

-- ════════════════════════════════════════════════════════════════════════════
-- HOTFIX 4: AI Sessions table for proper session tracking
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.pratiche(id) ON DELETE SET NULL,
  ym text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  message_count int NOT NULL DEFAULT 1,
  max_messages int NOT NULL DEFAULT 20,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

-- Owner-select only policy
CREATE POLICY "Users can view their own ai sessions"
  ON public.ai_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_case ON public.ai_sessions(user_id, case_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_expires ON public.ai_sessions(expires_at) WHERE is_active = true;

-- Trigger for updated_at equivalent on last_message_at is handled by app logic
