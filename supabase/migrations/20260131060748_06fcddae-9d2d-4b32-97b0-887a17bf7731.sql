-- Add payment failure tracking fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS access_state text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS payment_failed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_billing_event_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_billing_email_at timestamp with time zone DEFAULT NULL;

-- Add check constraint for access_state
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_access_state_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_access_state_check 
CHECK (access_state IN ('active', 'blocked'));

-- Add check constraint for stripe_status
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_stripe_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_stripe_status_check 
CHECK (stripe_status IN ('active', 'past_due', 'unpaid', 'canceled', 'trialing'));