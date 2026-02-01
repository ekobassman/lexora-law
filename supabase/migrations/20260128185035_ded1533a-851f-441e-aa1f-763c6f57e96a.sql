-- Legal versions table (tracks current document versions)
CREATE TABLE IF NOT EXISTS public.legal_versions (
  doc_type text PRIMARY KEY CHECK (doc_type IN ('terms','privacy','disclaimer')),
  version text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL DEFAULT ''
);

-- Initial seed data
INSERT INTO public.legal_versions (doc_type, version, published_at, summary)
VALUES
  ('terms',      '2026-01-28_v1', now(), 'Initial Terms'),
  ('privacy',    '2026-01-28_v1', now(), 'Initial Privacy'),
  ('disclaimer', '2026-01-28_v1', now(), 'Initial Disclaimer')
ON CONFLICT (doc_type) DO NOTHING;

-- User legal acceptances table
CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_terms_version text,
  accepted_privacy_version text,
  accepted_disclaimer_version text,
  accepted_at timestamptz,
  accepted_user_agent text
);

-- Enable RLS
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read legal versions
CREATE POLICY "legal_versions_read_all"
ON public.legal_versions
FOR SELECT
USING (true);

-- RLS: Users can read their own acceptances
CREATE POLICY "acceptances_select_own"
ON public.user_legal_acceptances
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Users can insert their own acceptances
CREATE POLICY "acceptances_insert_own"
ON public.user_legal_acceptances
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can update their own acceptances
CREATE POLICY "acceptances_update_own"
ON public.user_legal_acceptances
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);