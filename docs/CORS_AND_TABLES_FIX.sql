-- CORS + TABELLE - Esegui in Supabase → SQL Editor (manualmente)
-- Dopo: Edge Functions → auth-health, credits-get-status, sync-subscription → Salva

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_status text DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS legal_versions (
  id serial PRIMARY KEY,
  doc_type text,
  version text
);

CREATE TABLE IF NOT EXISTS dashboard_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_count int
);
