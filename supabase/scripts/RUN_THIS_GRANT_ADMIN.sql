-- ============================================================
-- COPIA E INCOLLA QUESTO SCRIPT IN: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Concede admin a imbimbo.bassman@gmail.com
-- Dopo aver eseguito: logout dall'app, poi login. Dovresti vedere ADMIN e Pannello di controllo.
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE LOWER(email) = 'imbimbo.bassman@gmail.com' LIMIT 1);

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'imbimbo.bassman@gmail.com'
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

-- Verifica: SELECT u.email, ur.role, p.is_admin FROM auth.users u
-- LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
-- LEFT JOIN public.profiles p ON p.id = u.id WHERE LOWER(u.email) = 'imbimbo.bassman@gmail.com';
