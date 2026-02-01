-- Create a table to track global document processing stats
CREATE TABLE public.global_stats (
  id text PRIMARY KEY DEFAULT 'main',
  documents_processed bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read the stats (public counter)
CREATE POLICY "Anyone can view global stats"
ON public.global_stats
FOR SELECT
USING (true);

-- Insert initial row
INSERT INTO public.global_stats (id, documents_processed) VALUES ('main', 0);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_stats;

-- Create a function to increment the counter atomically
CREATE OR REPLACE FUNCTION public.increment_documents_processed()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count bigint;
BEGIN
  UPDATE global_stats
  SET documents_processed = documents_processed + 1,
      updated_at = now()
  WHERE id = 'main'
  RETURNING documents_processed INTO new_count;
  
  RETURN new_count;
END;
$$;