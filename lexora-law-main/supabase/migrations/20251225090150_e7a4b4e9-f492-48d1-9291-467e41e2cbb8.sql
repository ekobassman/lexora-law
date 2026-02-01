-- Add reminders field to pratiche table
ALTER TABLE public.pratiche 
ADD COLUMN IF NOT EXISTS reminders jsonb DEFAULT '[{"type":"days","value":3},{"type":"days","value":1}]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.pratiche.reminders IS 'Array of reminder settings: [{type: "days"|"hours", value: number}]';