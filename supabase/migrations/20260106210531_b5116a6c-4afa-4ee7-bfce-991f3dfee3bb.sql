-- Add last_seen_at column for tracking user activity
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Add index for efficient querying of live users
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at DESC NULLS LAST);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.last_seen_at IS 'Timestamp of last user activity, updated via heartbeat';