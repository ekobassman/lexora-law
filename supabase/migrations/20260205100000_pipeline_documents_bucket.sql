-- LEXORA: Pipeline unico upload+OCR — bucket documents, tabella documents estesa, pipeline_runs (log)
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE IF NOT EXISTS, DROP POLICY IF EXISTS

-- 1) Estendi public.documents (colonne minime per pipeline)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS case_id uuid NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'documents';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_path text NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS size_bytes int NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploaded';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ocr_text text NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ocr_error text NULL;

COMMENT ON COLUMN public.documents.status IS 'uploaded | ocr_done | ocr_failed';
COMMENT ON COLUMN public.documents.storage_bucket IS 'documents (nuovo) o pratiche-files (deprecato)';

-- Consenti righe senza pratica (upload senza caso): pratica_id nullable per nuovo flusso
ALTER TABLE public.documents ALTER COLUMN pratica_id DROP NOT NULL;

-- 2) Log pipeline (solo service role inserisce)
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id bigserial PRIMARY KEY,
  user_id uuid NULL,
  doc_id uuid NULL,
  step text NOT NULL,
  ok boolean NOT NULL,
  code text NULL,
  message text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_created ON public.pipeline_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_doc_id ON public.pipeline_runs(doc_id);

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_runs_select_own" ON public.pipeline_runs;
CREATE POLICY "pipeline_runs_select_own"
  ON public.pipeline_runs FOR SELECT
  USING (auth.uid() = user_id);

-- Nessuna policy INSERT per client: solo service_role inserisce.

-- 3) RLS documents: owner solo SELECT; INSERT/UPDATE solo service_role
DROP POLICY IF EXISTS "Users can create their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
-- Mantieni select e delete per UI esistente
-- (Users can view their own documents, Users can delete their own documents restano)

-- 4) Bucket documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: owner read/write/list sul proprio prefix (userId/)
DROP POLICY IF EXISTS "documents_bucket_insert_own" ON storage.objects;
CREATE POLICY "documents_bucket_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "documents_bucket_select_own" ON storage.objects;
CREATE POLICY "documents_bucket_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "documents_bucket_update_own" ON storage.objects;
CREATE POLICY "documents_bucket_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "documents_bucket_delete_own" ON storage.objects;
CREATE POLICY "documents_bucket_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
