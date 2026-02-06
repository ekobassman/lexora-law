-- ========================================
-- EMERGENCY FIX: Run in Supabase Dashboard → SQL Editor → New Query
-- Same as migration 20260208120000_profiles_columns_and_rls_fix.sql
-- (Do NOT recreate is_admin() - it already exists and uses has_role.)
-- ========================================

-- 1. Add columns to profiles table (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN country TEXT DEFAULT 'DE';
    RAISE NOTICE 'Column country added to profiles table';
  ELSE
    RAISE NOTICE 'Column country already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN preferred_language TEXT DEFAULT 'IT';
    RAISE NOTICE 'Column preferred_language added to profiles table';
  ELSE
    RAISE NOTICE 'Column preferred_language already exists';
  END IF;
END $$;

-- 2. Fix RLS policies (remove recursion: use is_admin() instead of SELECT FROM profiles)
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;
CREATE POLICY "admin_update_all_profiles"
ON public.profiles
FOR UPDATE
USING (public.is_admin());

-- 3. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 4. Verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
AND column_name IN ('country', 'preferred_language');
