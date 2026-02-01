-- Create case_context_pack table for AI context caching per case
CREATE TABLE public.case_context_pack (
  case_id uuid PRIMARY KEY REFERENCES public.pratiche(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  language text NOT NULL DEFAULT 'DE',
  context_text text NOT NULL DEFAULT '',
  source_hash text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_context_pack ENABLE ROW LEVEL SECURITY;

-- RLS: Only owner can view their own context pack
CREATE POLICY "Users can view their own context pack"
ON public.case_context_pack
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Only owner can insert their own context pack
CREATE POLICY "Users can insert their own context pack"
ON public.case_context_pack
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS: Only owner can update their own context pack
CREATE POLICY "Users can update their own context pack"
ON public.case_context_pack
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS: Only owner can delete their own context pack
CREATE POLICY "Users can delete their own context pack"
ON public.case_context_pack
FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_case_context_pack_user ON public.case_context_pack(user_id);

-- Add language column to pratiche.chat_history messages for multilingual tracking
-- (chat_history is already JSONB, so we'll handle language in the message structure)