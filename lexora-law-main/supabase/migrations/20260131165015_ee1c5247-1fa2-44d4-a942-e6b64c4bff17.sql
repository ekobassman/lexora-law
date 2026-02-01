-- Add payment status fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_payment_failed_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_payment_error_code text NULL,
ADD COLUMN IF NOT EXISTS last_payment_error_message text NULL;

-- Add constraint for valid payment_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_payment_status_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_payment_status_check
    CHECK (payment_status IN ('active','past_due','unpaid','canceled'));
  END IF;
END $$;