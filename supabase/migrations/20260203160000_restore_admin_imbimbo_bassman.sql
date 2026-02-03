-- Restore admin access for imbimbo.bassman@gmail.com
-- Assumes user exists in auth.users. Updates public.profiles and ensures admin role in user_roles.

-- 1.1) Add is_admin column to profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 1.2) Set imbimbo.bassman@gmail.com as ADMIN (email is in auth.users, profile by id)
UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'imbimbo.bassman@gmail.com' LIMIT 1);

-- 1.3) Update public.profiles: plan_override, is_family, updated_at
UPDATE public.profiles
SET
  plan_override = 'unlimited',
  is_family = true,
  updated_at = now()
WHERE id = (SELECT id FROM auth.users WHERE email = 'imbimbo.bassman@gmail.com' LIMIT 1);

-- 2) Ensure admin role in user_roles (is_admin() reads from this table)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'imbimbo.bassman@gmail.com'
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) RLS: enable and admin policies on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;
CREATE POLICY "admin_update_all_profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);
