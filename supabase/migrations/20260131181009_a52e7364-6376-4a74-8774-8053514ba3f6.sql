-- Create unified case chat messages table
CREATE TABLE public.case_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.pratiche(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'case' CHECK (scope IN ('dashboard', 'case', 'edit')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'DE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_case_chat_messages_case_id ON public.case_chat_messages(case_id);
CREATE INDEX idx_case_chat_messages_user_case ON public.case_chat_messages(user_id, case_id);
CREATE INDEX idx_case_chat_messages_created_at ON public.case_chat_messages(case_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.case_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only access their own messages
CREATE POLICY "Users can view their own case chat messages"
ON public.case_chat_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own case chat messages"
ON public.case_chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own case chat messages"
ON public.case_chat_messages
FOR DELETE
USING (auth.uid() = user_id);