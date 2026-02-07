-- Tabelle veloci (SQL Editor Supabase) - dopo CORS fix + queste tabelle → dashboard chat OK
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name text,
  last_name text,
  payment_status text DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS legal_versions (
  id serial PRIMARY KEY,
  doc_type text,
  version text
);

CREATE TABLE IF NOT EXISTS dashboard_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  messages_count int
);
