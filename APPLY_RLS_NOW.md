# 🚨 URGENTE: Applicare Policy RLS Subito

L'errore è cambiato da 400 a 401 Unauthorized! Questo indica un problema di autenticazione.

## 📋 Passi Immediati:

### 1. Vai nella Dashboard Supabase
https://supabase.com/dashboard/project/wzpxxlkfxymelrodjarl

### 2. Vai in SQL Editor
https://supabase.com/dashboard/project/wzpxxlkfxymelrodjarl/sql/new

### 3. Copia e Incolla Queste Query

```sql
-- 1. ABILITA RLS SULLE TABELLE
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_chat_messages ENABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI POLICY ESISTENTI
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

-- 8. VERIFICA POLICY APPLICATE
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
```

### 4. Esegui le Query
Clicca su "Run" per eseguire ogni query

### 5. Testa di Nuovo
Ricarica la pagina e prova a caricare un file

## 🎯 Risultato Atteso:
- ✅ L'errore 401 dovrebbe sparire
- ✅ L'utente dovrebbe poter creare casi
- ✅ Le policy RLS dovrebbero essere attive

## ⚠️ Se l'errore persiste:
Potrebbe essere necessario:
1. Fare logout e login di nuovo
2. Verificare che il token JWT sia valido
3. Controllare le impostazioni RLS a livello di progetto

Esegui subito queste query nella dashboard Supabase! 🚀
