-- Add new columns to profiles table for comprehensive settings

-- Account & Profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Sender Data fields (for letters/PDFs)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_postal_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_country text DEFAULT 'DE';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_signature text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_use_sender_data boolean DEFAULT true;

-- Practices & Documents settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_save_drafts boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_update_letter_on_upload boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_documents_per_pratica integer DEFAULT 20;

-- AI & Automation settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_language_level text DEFAULT 'formal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_tone_setting text DEFAULT 'collaborative';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_ai_language text DEFAULT 'IT';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_update_draft_on_ai boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suggest_legal_references boolean DEFAULT true;

-- Security info
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;

-- Add check constraints after column creation
ALTER TABLE public.profiles ADD CONSTRAINT profiles_ai_language_level_check 
  CHECK (ai_language_level IN ('simple', 'formal', 'legal_advanced'));
  
ALTER TABLE public.profiles ADD CONSTRAINT profiles_default_tone_setting_check 
  CHECK (default_tone_setting IN ('collaborative', 'firm', 'formal_notice'));