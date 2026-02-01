-- Add file_size and document_type columns to documents table
-- file_size stores the size in bytes
-- document_type categorizes documents as letter, attachment, or evidence

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS file_size bigint,
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'letter';

-- Add check constraint for document_type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_document_type_check'
  ) THEN
    ALTER TABLE public.documents 
    ADD CONSTRAINT documents_document_type_check 
    CHECK (document_type IN ('letter', 'attachment', 'evidence'));
  END IF;
END $$;

-- Add index for faster queries on pratica_id ordered by created_at
CREATE INDEX IF NOT EXISTS idx_documents_pratica_created 
ON public.documents(pratica_id, created_at DESC);