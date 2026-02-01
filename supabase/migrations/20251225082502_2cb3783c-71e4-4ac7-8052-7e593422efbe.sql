-- Add chat_history JSONB column to pratiche table for AI conversation history
ALTER TABLE public.pratiche
ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;