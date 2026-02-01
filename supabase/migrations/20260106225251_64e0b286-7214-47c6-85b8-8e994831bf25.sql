-- Create legal acceptance events audit table
CREATE TABLE public.legal_acceptance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  terms_version TEXT,
  privacy_version TEXT,
  age_policy_version TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  country_code TEXT NULL,
  ip_hash TEXT NULL,
  user_agent TEXT NULL
);

-- Enable RLS
ALTER TABLE public.legal_acceptance_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own acceptance events
CREATE POLICY "Users can insert their own acceptance events"
ON public.legal_acceptance_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own acceptance events
CREATE POLICY "Users can view their own acceptance events"
ON public.legal_acceptance_events
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all acceptance events
CREATE POLICY "Admins can view all acceptance events"
ON public.legal_acceptance_events
FOR SELECT
USING (public.is_admin());

-- Create index for faster queries
CREATE INDEX idx_legal_acceptance_events_user_id ON public.legal_acceptance_events(user_id);
CREATE INDEX idx_legal_acceptance_events_accepted_at ON public.legal_acceptance_events(accepted_at DESC);