-- Create table to track dashboard AI chat messages per user per day
CREATE TABLE public.dashboard_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_date)
);

-- Create table to store chat history for dashboard AI chat
CREATE TABLE public.dashboard_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for dashboard_chat_messages
CREATE POLICY "Users can view their own chat message counts"
ON public.dashboard_chat_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat message counts"
ON public.dashboard_chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat message counts"
ON public.dashboard_chat_messages
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for dashboard_chat_history
CREATE POLICY "Users can view their own chat history"
ON public.dashboard_chat_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
ON public.dashboard_chat_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat history"
ON public.dashboard_chat_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_dashboard_chat_messages_user_date ON public.dashboard_chat_messages(user_id, message_date);
CREATE INDEX idx_dashboard_chat_history_user ON public.dashboard_chat_history(user_id);
CREATE INDEX idx_dashboard_chat_history_created ON public.dashboard_chat_history(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_dashboard_chat_messages_updated_at
BEFORE UPDATE ON public.dashboard_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();