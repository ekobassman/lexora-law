-- Add consent version tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS terms_version text,
ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS privacy_version text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.terms_version IS 'Version of terms accepted (e.g., 2026-01-06)';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS 'Timestamp when privacy policy was accepted';
COMMENT ON COLUMN public.profiles.privacy_version IS 'Version of privacy policy accepted (e.g., 2026-01-06)';