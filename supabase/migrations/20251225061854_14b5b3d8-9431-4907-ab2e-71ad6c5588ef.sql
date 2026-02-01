-- Create storage bucket for practice files
INSERT INTO storage.buckets (id, name, public)
VALUES ('pratiche-files', 'pratiche-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for pratiche-files bucket
CREATE POLICY "Users can upload their own practice files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'pratiche-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own practice files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'pratiche-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own practice files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'pratiche-files' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add file_url column to pratiche if not exists
ALTER TABLE public.pratiche ADD COLUMN IF NOT EXISTS file_url TEXT;