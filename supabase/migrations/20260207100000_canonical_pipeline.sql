-- Canonical pipeline: cases (pratiche) + documents with file_path, source, ocr_text, analysis_json, draft_text, status.
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE IF NOT EXISTS.

-- 1) Ensure documents has required columns (cases = pratiche, already exists)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS case_id uuid NULL REFERENCES public.pratiche(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_path text NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source text NULL CHECK (source IS NULL OR source IN ('upload', 'camera'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS analysis_json jsonb NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS draft_text text NULL;

-- Sync file_path from storage_path if present
UPDATE public.documents SET file_path = COALESCE(storage_path, file_url) WHERE file_path IS NULL AND (storage_path IS NOT NULL OR file_url IS NOT NULL);

COMMENT ON COLUMN public.documents.file_path IS 'Storage path or URL for the uploaded file';
COMMENT ON COLUMN public.documents.source IS 'upload | camera';
COMMENT ON COLUMN public.documents.analysis_json IS 'Analysis result: deadlines, risks, summary, suggested_action';
COMMENT ON COLUMN public.documents.draft_text IS 'DIN-5008 style draft reply';
COMMENT ON COLUMN public.documents.status IS 'uploaded | ocr_done | ocr_failed | done';

-- 2) Indexes for pipeline
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- 3) RLS: user can only access own rows (policies already exist for documents; ensure case_id usage is allowed)
-- No change to RLS; existing "Users can view their own documents" etc. remain.

-- 4) Bucket "uploads" for canonical pipeline (optional; can use "documents" bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "uploads_insert_own" ON storage.objects;
CREATE POLICY "uploads_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "uploads_select_own" ON storage.objects;
CREATE POLICY "uploads_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "uploads_update_own" ON storage.objects;
CREATE POLICY "uploads_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "uploads_delete_own" ON storage.objects;
CREATE POLICY "uploads_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
