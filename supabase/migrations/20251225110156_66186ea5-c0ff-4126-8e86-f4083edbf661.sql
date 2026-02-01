-- Add terms acceptance tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Timestamp when user accepted Terms of Service and Privacy Policy';