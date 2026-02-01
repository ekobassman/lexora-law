-- Add age confirmation fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS age_policy_version TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.age_confirmed IS 'User confirmed they are 18+ years old';
COMMENT ON COLUMN public.profiles.age_policy_version IS 'Version of age policy accepted by user';