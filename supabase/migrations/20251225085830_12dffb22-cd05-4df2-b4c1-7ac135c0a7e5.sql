-- Add deadline management fields to pratiche table
ALTER TABLE public.pratiche 
ADD COLUMN IF NOT EXISTS deadline_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS calendar_event_created boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.pratiche.deadline_source IS 'Source of deadline: ai (detected) or manual (user input)';
COMMENT ON COLUMN public.pratiche.calendar_event_created IS 'Whether a calendar event was created for this deadline';