-- Policy RLS per Supabase
-- Esegui queste query nella console SQL di Supabase

-- 1. ABILITA RLS SULLE TABELLE
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_chat_messages ENABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI POLICY ESISTENTI (se presenti)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own messages" ON dashboard_chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON dashboard_chat_messages;

-- 3. POLICY PER PROFILES (lettura solo propri dati)
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- 4. POLICY PER PROFILES (inserimento solo proprio profilo)
CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. POLICY PER PROFILES (aggiornamento solo proprio profilo)
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);

-- 6. POLICY PER DASHBOARD_CHAT_MESSAGES (lettura solo propri messaggi)
CREATE POLICY "Users can view own messages" ON dashboard_chat_messages
FOR SELECT USING (auth.uid() = user_id);

-- 7. POLICY PER DASHBOARD_CHAT_MESSAGES (inserimento solo propri messaggi)
CREATE POLICY "Users can insert own messages" ON dashboard_chat_messages
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. POLICY PER DASHBOARD_CHAT_MESSAGES (aggiornamento solo propri messaggi)
CREATE POLICY "Users can update own messages" ON dashboard_chat_messages
FOR UPDATE USING (auth.uid() = user_id);

-- 9. VERIFICA POLICY APPLICATE
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('profiles', 'dashboard_chat_messages')
ORDER BY tablename, policyname;

-- 10. VERIFICA STRUTTURA TABELLE
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'dashboard_chat_messages')
ORDER BY table_name, ordinal_position;

-- 11. VERIFICA UTENTE SPECIFICO
SELECT 
  id,
  email,
  created_at,
  last_seen_at,
  plan,
  age_confirmed,
  privacy_version,
  terms_version
FROM profiles 
WHERE id = 'c06f14c1-efc6-4c80-8da6-70351ac1b394';

-- 12. VERIFICA MESSAGGI UTENTE
SELECT 
  COUNT(*) as messages_count,
  user_id,
  MAX(created_at) as last_message_at
FROM dashboard_chat_messages 
WHERE user_id = 'c06f14c1-efc6-4c80-8da6-70351ac1b394'
GROUP BY user_id;

-- 13. VERIFICA PERMESSI UTENTE
SELECT 
  rolname,
  hasprivilege,
  grantee
FROM information_schema.role_table_grants 
WHERE table_name IN ('profiles', 'dashboard_chat_messages');
