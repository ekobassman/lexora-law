-- Verifica se imbimbo.bassman@gmail.com è admin in Supabase
-- Esegui in: Supabase Dashboard → SQL Editor

-- 1) L'utente esiste in auth?
SELECT id, email, created_at
FROM auth.users
WHERE email = 'imbimbo.bassman@gmail.com';

-- 2) Ha la riga admin in user_roles? (usata da is_admin() e da entitlements)
SELECT ur.user_id, ur.role, ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'imbimbo.bassman@gmail.com';

-- 3) Il profilo ha is_admin = true?
SELECT p.id, p.is_admin, p.updated_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'imbimbo.bassman@gmail.com';

-- Se (1) restituisce una riga ma (2) o (3) sono vuoti/false, esegui poi lo script di fix sotto.
