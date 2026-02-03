-- Grant admin to imbimbo.bassman@gmail.com (idempotent).
-- Run this migration or paste in Supabase SQL Editor if the user still doesn't have admin.
-- Requires: user must exist in auth.users (they must have signed up at least once).

-- 1) Ensure profiles.is_admin exists and set true for this email
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'imbimbo.bassman@gmail.com' LIMIT 1);

-- 2) Ensure user_roles has admin role (is_admin() and entitlements read from here)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'imbimbo.bassman@gmail.com'
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;
