-- ═══════════════════════════════════════════════════════════════════════════
-- EMERGENCY: Tabelle mancanti + RLS (eseguire in Supabase → SQL Editor)
-- Se profiles esiste già, saltare il CREATE e usare solo RLS/alter colonne.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) PROFILES (se la tabella non esiste; altrimenti aggiungere solo colonne mancanti)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  full_name text,
  payment_status text DEFAULT 'free',
  terms_version text,
  privacy_version text,
  age_confirmed boolean DEFAULT false
);

-- Colonne extra se profiles esiste già con altre colonne (ignora errori se già presenti)
DO $$
BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'free';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_version text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_version text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_confirmed boolean DEFAULT false;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── 2) LEGAL_VERSIONS (doc_type, version, published_at, summary)
CREATE TABLE IF NOT EXISTS public.legal_versions (
  id serial PRIMARY KEY,
  doc_type text NOT NULL,
  version text NOT NULL,
  published_at timestamptz,
  summary text DEFAULT ''
);

-- ─── 3) DASHBOARD_CHAT_MESSAGES
CREATE TABLE IF NOT EXISTS public.dashboard_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_count int,
  message_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── 4) DASHBOARD_CHAT_HISTORY
CREATE TABLE IF NOT EXISTS public.dashboard_chat_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  content text,
  created_at timestamptz
);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.dashboard_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own dashboard_chat_messages" ON public.dashboard_chat_messages;
CREATE POLICY "Users own dashboard_chat_messages"
  ON public.dashboard_chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.dashboard_chat_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own dashboard_chat_history" ON public.dashboard_chat_history;
CREATE POLICY "Users own dashboard_chat_history"
  ON public.dashboard_chat_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Colonne extra su dashboard_chat_messages se la tabella esisteva già
DO $$
BEGIN
  ALTER TABLE public.dashboard_chat_messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  ALTER TABLE public.dashboard_chat_messages ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
