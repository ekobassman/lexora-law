-- Add structured override fields required by entitlements debug + no-expiry overrides
ALTER TABLE public.plan_overrides
ADD COLUMN IF NOT EXISTS plan_code text;

ALTER TABLE public.plan_overrides
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

UPDATE public.plan_overrides
SET plan_code = COALESCE(plan_code, plan)
WHERE plan_code IS NULL;

-- Let users read their own override (needed for debugging & transparency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'plan_overrides'
      AND policyname = 'Users can view their own plan override'
  ) THEN
    CREATE POLICY "Users can view their own plan override"
    ON public.plan_overrides
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END$$;
