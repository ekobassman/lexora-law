-- 1) Add missing columns to profiles (safe: IF NOT EXISTS)
-- Rollback: ALTER TABLE public.profiles DROP COLUMN IF EXISTS country; ALTER TABLE public.profiles DROP COLUMN IF EXISTS preferred_language;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN country TEXT DEFAULT 'DE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN preferred_language TEXT DEFAULT 'IT';
  END IF;
END $$;

-- 2) Fix infinite recursion in profiles RLS: admin policies must NOT read from profiles.
-- Cause: "admin_read_all_profiles" / "admin_update_all_profiles" used
--   EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
-- which triggers the same policy when evaluating -> recursion.
-- Fix: use public.is_admin() which reads from user_roles (SECURITY DEFINER, no RLS on profiles).

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
