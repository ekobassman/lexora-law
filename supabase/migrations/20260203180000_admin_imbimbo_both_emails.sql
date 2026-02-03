-- Grant admin to imbimbo.bassman@gmail.com (idempotent).
-- Run in Supabase SQL Editor if the user still shows as Free / no admin panel.

-- 1) profiles.is_admin
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE LOWER(email) = 'imbimbo.bassman@gmail.com' LIMIT 1);

-- 2) user_roles (is_admin() and entitlements read from here)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'imbimbo.bassman@gmail.com'
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;
